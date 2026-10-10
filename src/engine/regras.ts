/**
 * Motor de regras: olha a viagem inteira e devolve alertas.
 *
 * Principio que governa tudo aqui: **o app nunca bloqueia, ele avisa.**
 * Nenhuma funcao deste arquivo impede o usuario de fazer o que quiser. Elas
 * explicam o problema em portugues claro e, quando da, oferecem uma correcao
 * de um clique.
 *
 * Tres niveis:
 *   erro     quebra a viagem de verdade (nao da tempo, lugar fechado)
 *   atencao  provavelmente da errado ou custa caro
 *   dica     melhora a viagem, mas ignorar nao quebra nada
 *
 * Cada regra tem um `codigo` estavel e um teste nomeado por esse codigo.
 */
import type { DiaDaSemana } from '../schema/base.ts';
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { converterRelogio, offsetDaCidade, offsetDoDia } from './fusos.ts';
import { calcularOrcamento, formatarFaixaBRL } from './orcamento.ts';
import {
  HORAS_OCUPADAS_POR_RITMO,
  JANELAS_DE_REFEICAO,
  MINIMO_DE_SONO_HORAS,
} from './padroes.ts';
import { type DiaResolvido, resolverDia } from './resolver-dia.ts';
import { luzDoDia } from './sol.ts';
import {
  diferencaEmDias,
  emQuantosDias,
  formatarDuracao,
  paraHHMM,
  paraMinutos,
  porExtenso,
  somarDias,
} from './tempo.ts';

export type NivelDeAlerta = 'erro' | 'atencao' | 'dica';

/**
 * Toda acao que um alerta pode oferecer num clique.
 *
 * Isto era `tipo: string`, e o resultado foi que ONZE dos dezoito tipos que
 * as regras emitiam nao tinham tratador na interface: o alerta aparecia, o
 * botao aparecia, e o clique caia no `default` do switch sem fazer nada.
 * Um botao que nao faz nada e pior que botao nenhum — ele consome a
 * confianca que o resto dos avisos construiu.
 *
 * Como uniao fechada, a interface precisa de um tratador para cada membro e
 * o compilador cobra. Acrescentar um tipo aqui quebra o build ate alguem
 * dizer o que o clique faz.
 */
export type TipoDeCorrecao =
  | 'abrir-orcamento'
  | 'abrir-requisitos'
  | 'adiar-inicio-do-dia'
  | 'adicionar-noite'
  | 'ajustar-duracao'
  | 'aliviar-dia'
  | 'antecipar-para-terminar-antes'
  | 'definir-hospedagem'
  | 'empurrar-proximos'
  | 'encaixar-no-horario'
  | 'encurtar-anterior'
  | 'inserir-folga'
  | 'inserir-refeicao'
  | 'inserir-trecho'
  | 'marcar-reservado'
  | 'mover-dia'
  | 'mover-para-horario'
  | 'mover-para-outro-dia';

export interface Correcao {
  /** Codigo da acao, para a interface saber o que fazer no clique. */
  tipo: TipoDeCorrecao;
  rotulo: string;
  dados?: Record<string, unknown>;
}

export interface Alerta {
  codigo: string;
  nivel: NivelDeAlerta;
  titulo: string;
  mensagem: string;
  diaId?: string;
  blocoIds: string[];
  correcoes: Correcao[];
}

const DIAS_DA_SEMANA: DiaDaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function diaDaSemanaDe(dataIso: string): DiaDaSemana {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const indice = new Date(Date.UTC(ano ?? 2000, (mes ?? 1) - 1, dia ?? 1)).getUTCDay();
  return DIAS_DA_SEMANA[indice] ?? 'seg';
}

/** Altitude acima da qual o app avisa sobre soroche. */
const ALTITUDE_DE_ATENCAO_M = 2400;
/** Diferenca de altitude que caracteriza "subiu rapido". */
const SUBIDA_BRUSCA_M = 1500;

interface Contexto {
  viagem: Viagem;
  pacote: PacoteDestino;
  dias: DiaResolvido[];
  itensPorId: Map<string, Item>;
  /**
   * "Hoje", em AAAA-MM-DD. Injetado de fora: o motor e puro e nao chama
   * Date.now(), senao os testes de prazo mudariam de resultado todo dia.
   */
  hoje?: string;
}

export interface OpcoesDeValidacao {
  hoje?: string;
}

// --------------------------------------------------------------- deslocamento

function regraDeslocamentoImpossivel(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const lacuna of dia.lacunas) {
      if (lacuna.cabe || lacuna.faltamMin <= 0) continue;
      const d = lacuna.deslocamento;
      alertas.push({
        codigo: 'deslocamento-impossivel',
        nivel: 'erro',
        titulo: `Faltam ${formatarDuracao(lacuna.faltamMin)} para o trajeto`,
        mensagem:
          `${d?.resumo ?? 'O trajeto'} Mas so ha ${formatarDuracao(lacuna.minutosDisponiveis)} ` +
          `entre uma coisa e outra, das ${paraHHMM(lacuna.inicioMin)} as ${paraHHMM(lacuna.fimMin)}.`,
        diaId: dia.dia.id,
        blocoIds: [lacuna.depoisDe, lacuna.antesDe],
        correcoes: [
          {
            tipo: 'empurrar-proximos',
            rotulo: `Empurrar o que vem depois em ${formatarDuracao(lacuna.faltamMin)}`,
            dados: { aPartirDe: lacuna.antesDe, minutos: lacuna.faltamMin },
          },
          {
            tipo: 'encurtar-anterior',
            rotulo: `Encurtar a atividade anterior em ${formatarDuracao(lacuna.faltamMin)}`,
            dados: { blocoId: lacuna.depoisDe, minutos: lacuna.faltamMin },
          },
          {
            tipo: 'mover-para-outro-dia',
            rotulo: 'Mover a proxima atividade para outro dia',
            dados: { blocoId: lacuna.antesDe },
          },
        ],
      });
    }
  }
}

/**
 * O dia MAIS PROXIMO do roteiro em que este item abre.
 *
 * "Mova para outro dia" sem dizer qual dia joga o trabalho de volta para o
 * usuario justamente no momento em que ele errou. Proximidade conta a
 * partir do dia em que ele tentou agendar, olhando para os dois lados: um
 * museu fechado na segunda costuma caber no domingo anterior tanto quanto
 * na terca seguinte.
 *
 * Exige tambem que a cidade-base do dia bata com a do item — nao adianta
 * sugerir a quinta-feira se nessa quinta ele esta em outra cidade.
 */
function diaMaisProximoEmQueAbre(
  ctx: Contexto,
  item: Item,
  diaAtualId: string,
): { id: string; data: string } | undefined {
  const indiceAtual = ctx.dias.findIndex((d) => d.dia.id === diaAtualId);
  if (indiceAtual < 0) return undefined;

  const candidatos = ctx.dias
    .map((d, i) => ({ d, distancia: Math.abs(i - indiceAtual) }))
    .filter((x) => x.distancia > 0)
    .sort((a, b) => a.distancia - b.distancia);

  for (const { d } of candidatos) {
    if (d.dia.cidadeBaseId && d.dia.cidadeBaseId !== item.cidadeId) continue;
    const dow = diaDaSemanaDe(d.dia.data);
    if (item.diasFechados.includes(dow)) continue;
    if (item.horarios?.[dow] === 'fechado') continue;
    return { id: d.dia.id, data: d.dia.data };
  }
  return undefined;
}

// ---------------------------------------------------------------------- tempo

function regraBlocosSobrepostos(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const s of dia.sobreposicoes) {
      const a = dia.blocos.find((b) => b.bloco.id === s.a);
      const b = dia.blocos.find((x) => x.bloco.id === s.b);
      alertas.push({
        codigo: 'blocos-sobrepostos',
        nivel: 'erro',
        titulo: 'Duas coisas no mesmo horario',
        mensagem: `"${a?.rotulo}" e "${b?.rotulo}" se cruzam por ${formatarDuracao(s.minutos)}.`,
        diaId: dia.dia.id,
        blocoIds: [s.a, s.b],
        correcoes: [
          {
            tipo: 'empurrar-proximos',
            rotulo: `Empurrar "${b?.rotulo}" em ${formatarDuracao(s.minutos)}`,
            dados: { aPartirDe: s.b, minutos: s.minutos },
          },
          { tipo: 'mover-para-outro-dia', rotulo: 'Mover um dos dois para outro dia', dados: { blocoId: s.b } },
        ],
      });
    }
  }
}

function regraHorarioDeFuncionamento(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    const dow = diaDaSemanaDe(dia.dia.data);

    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item) continue;
      const item = b.item;
      const horarioDoDia = item.horarios?.[dow];

      if (horarioDoDia === 'fechado' || item.diasFechados.includes(dow)) {
        alertas.push({
          codigo: 'fechado-neste-dia',
          nivel: 'erro',
          titulo: `${item.nome} fecha neste dia da semana`,
          mensagem: `Voce agendou para ${dia.dia.data}, uma ${nomeLongoDoDia(dow)}, e o lugar nao abre.`,
          diaId: dia.dia.id,
          blocoIds: [b.bloco.id],
          correcoes: [
            (() => {
              const alvo = diaMaisProximoEmQueAbre(ctx, item, dia.dia.id);
              return alvo
                ? {
                    tipo: 'mover-para-outro-dia' as const,
                    rotulo: `Mover para ${nomeLongoDoDia(diaDaSemanaDe(alvo.data))} ${alvo.data.slice(8, 10)}/${alvo.data.slice(5, 7)}`,
                    dados: { blocoId: b.bloco.id, diaDestinoId: alvo.id },
                  }
                : {
                    tipo: 'mover-para-outro-dia' as const,
                    rotulo: 'Ver o calendario para escolher o dia',
                    dados: { blocoId: b.bloco.id },
                  };
            })(),
          ],
        });
        continue;
      }

      if (!Array.isArray(horarioDoDia)) continue; // desconhecido ou 24h: o motor cala

      const cabeEmAlguma = horarioDoDia.some(
        (j) => b.intervalo.inicio >= paraMinutos(j.abre) && b.intervalo.fim <= paraMinutos(j.fecha),
      );
      if (cabeEmAlguma) continue;

      const janelas = horarioDoDia.map((j) => `${j.abre}–${j.fecha}`).join(' e ');
      alertas.push({
        codigo: 'fora-do-horario',
        nivel: 'atencao',
        titulo: `${item.nome} pode estar fechado nesse horario`,
        mensagem:
          `Voce agendou das ${paraHHMM(b.intervalo.inicio)} as ${paraHHMM(b.intervalo.fim)}, ` +
          `e o horario registrado e ${janelas}.` +
          (item.horariosObservacao ? ` Fonte diz: ${item.horariosObservacao}` : ''),
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: [
          {
            tipo: 'encaixar-no-horario',
            rotulo: `Encaixar dentro de ${janelas}`,
            dados: { blocoId: b.bloco.id, janelas: horarioDoDia },
          },
        ],
      });
    }
  }
}

function regraDuracaoAbaixoDoMinimo(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item?.duracao) continue;
      const minimo = b.item.duracao.min;
      if (b.bloco.durationMin >= minimo) continue;
      alertas.push({
        codigo: 'duracao-abaixo-do-minimo',
        nivel: 'atencao',
        titulo: `${formatarDuracao(b.bloco.durationMin)} e pouco para ${b.item.nome}`,
        mensagem: `A pesquisa indica no minimo ${formatarDuracao(minimo)}, e o tipico e ${formatarDuracao(
          b.item.duracao.tipica,
        )}.`,
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: [
          {
            tipo: 'ajustar-duracao',
            rotulo: `Esticar para ${formatarDuracao(b.item.duracao.tipica)}`,
            dados: { blocoId: b.bloco.id, durationMin: b.item.duracao.tipica },
          },
        ],
      });
    }
  }
}

function regraLuzDoDia(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item?.restricoes.dependeDeLuzDoDia) continue;

      // O por do sol e o do lugar da ATIVIDADE, nao o da cidade onde se
      // dorme: em San Andres escurece 20 min depois que em Cartagena, e
      // usar a cidade-base daria a hora errada no alerta.
      const cidade = ctx.pacote.cidades.find((c) => c.id === b.item?.cidadeId);
      if (!cidade) continue;
      const offset = offsetDaCidade(ctx.pacote, cidade.id);
      const sol = luzDoDia(cidade.coords, dia.dia.data, offset);
      if (!sol.temNoiteEDia) continue;

      /*
        O anoitecer sai no relogio da CIDADE DA ATIVIDADE; o bloco esta no
        relogio do DIA (a cidade-base). Comparar os dois direto erra uma hora
        inteira quando o passeio cruza fuso — base em Cancun (UTC-5) e dia em
        Chichen Itza (UTC-6) e exatamente esse caso, e o erro cai para o lado
        ruim: o app diria "no escuro" um passeio que termina com sol.
      */
      const anoitecerNoDia = converterRelogio(sol.anoitecerMin, offset, offsetDoDia(ctx.pacote, dia.dia));
      if (b.intervalo.fim <= anoitecerNoDia) continue;

      const depois = b.intervalo.fim - anoitecerNoDia;
      alertas.push({
        codigo: 'luz-do-dia',
        nivel: 'atencao',
        titulo: `${b.item.nome} termina depois de escurecer`,
        mensagem:
          `Em ${dia.dia.data} o sol se poe as ${paraHHMM(sol.anoitecerMin)} em ${cidade.nome}, ` +
          `e a atividade vai ate ${paraHHMM(converterRelogio(b.intervalo.fim, offsetDoDia(ctx.pacote, dia.dia), offset))} ` +
          `no relogio de la — ${formatarDuracao(depois)} no escuro.`,
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: [
          {
            tipo: 'antecipar-para-terminar-antes',
            rotulo: `Antecipar para terminar as ${paraHHMM(sol.anoitecerMin)}`,
            dados: { blocoId: b.bloco.id, novoInicio: anoitecerNoDia - b.bloco.durationMin },
          },
        ],
      });
    }
  }
}

function regraHorarioFixoDeSaida(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item?.passeio) continue;
      const { horariosDeSaida, horarioFixo } = b.item.passeio;
      if (!horarioFixo || horariosDeSaida.length === 0) continue;

      const minutos = horariosDeSaida.map(paraMinutos);
      if (minutos.includes(b.intervalo.inicio)) continue;

      alertas.push({
        codigo: 'horario-fixo-de-saida',
        nivel: 'atencao',
        titulo: `${b.item.nome} tem horario de saida marcado`,
        mensagem: `Este passeio sai as ${horariosDeSaida.join(', ')}, e voce agendou para ${paraHHMM(
          b.intervalo.inicio,
        )}.`,
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: minutos.map((m) => ({
          tipo: 'mover-para-horario',
          rotulo: `Mover para ${paraHHMM(m)}`,
          dados: { blocoId: b.bloco.id, startMin: m },
        })),
      });
    }
  }
}

function regraDiaSobrecarregado(ctx: Contexto, alertas: Alerta[]): void {
  const teto = HORAS_OCUPADAS_POR_RITMO[ctx.viagem.ritmo] * 60;
  for (const dia of ctx.dias) {
    const ocupado = dia.minutosEmAtividades + dia.minutosEmDeslocamento;
    if (ocupado <= teto) continue;
    alertas.push({
      codigo: 'dia-sobrecarregado',
      nivel: 'atencao',
      titulo: `Dia cheio demais: ${formatarDuracao(ocupado)} ocupados`,
      mensagem:
        `Para o ritmo "${ctx.viagem.ritmo}" o app considera ate ${formatarDuracao(teto)} por dia. ` +
        `Aqui sao ${formatarDuracao(dia.minutosEmAtividades)} de atividade mais ` +
        `${formatarDuracao(dia.minutosEmDeslocamento)} de deslocamento.`,
      diaId: dia.dia.id,
      blocoIds: [],
      correcoes: [{ tipo: 'mover-para-outro-dia', rotulo: 'Mover alguma atividade para outro dia' }],
    });
  }
}

function regraDiaSemRefeicao(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    if (dia.blocos.length === 0) continue;

    for (const [nome, janela] of Object.entries(JANELAS_DE_REFEICAO)) {
      const dentro = dia.blocos.some(
        (b) =>
          (b.bloco.tipo === 'refeicao' ||
            (b.bloco.tipo === 'atividade' &&
              ['restaurante', 'cafe'].includes(b.item?.categoria ?? ''))) &&
          b.intervalo.inicio < janela.fim &&
          janela.inicio < b.intervalo.fim,
      );
      if (dentro) continue;

      // So avisa se o dia esta ocupado naquela janela: dia livre nao precisa
      // de alerta de almoco.
      const ocupadoNaJanela = dia.blocos.some(
        (b) => b.intervalo.inicio < janela.fim && janela.inicio < b.intervalo.fim,
      );
      if (!ocupadoNaJanela) continue;

      alertas.push({
        codigo: 'dia-sem-refeicao',
        nivel: 'dica',
        titulo: `Sem ${nome} previsto`,
        mensagem: `Das ${paraHHMM(janela.inicio)} as ${paraHHMM(
          janela.fim,
        )} voce esta ocupado e nao ha ${nome} na agenda.`,
        diaId: dia.dia.id,
        blocoIds: [],
        correcoes: [
          {
            tipo: 'inserir-refeicao',
            rotulo: `Reservar 1 h para ${nome}`,
            dados: { diaId: dia.dia.id, janela },
          },
        ],
      });
    }
  }
}

function regraSonoInsuficiente(ctx: Contexto, alertas: Alerta[]): void {
  for (let i = 0; i < ctx.dias.length - 1; i += 1) {
    const hoje = ctx.dias[i];
    const amanha = ctx.dias[i + 1];
    if (!hoje || !amanha) continue;

    const fimDeHoje = hoje.blocos.reduce((max, b) => Math.max(max, b.intervalo.fim), 0);
    const inicioDeAmanha = amanha.blocos.reduce(
      (min, b) => Math.min(min, b.intervalo.inicio),
      Number.POSITIVE_INFINITY,
    );
    if (fimDeHoje === 0 || !Number.isFinite(inicioDeAmanha)) continue;

    const horasEntre = (1440 - fimDeHoje + inicioDeAmanha) / 60;
    if (horasEntre >= MINIMO_DE_SONO_HORAS) continue;

    alertas.push({
      codigo: 'sono-insuficiente',
      nivel: 'atencao',
      titulo: `So ${horasEntre.toFixed(1)} h entre um dia e outro`,
      mensagem:
        `O dia ${hoje.dia.data} termina as ${paraHHMM(fimDeHoje)} e ${amanha.dia.data} comeca as ` +
        `${paraHHMM(inicioDeAmanha)}. Descontando o trajeto ate a hospedagem, sobra menos que isso para dormir.`,
      diaId: amanha.dia.id,
      blocoIds: [],
      correcoes: [
        { tipo: 'adiar-inicio-do-dia', rotulo: 'Comecar o dia seguinte mais tarde', dados: { diaId: amanha.dia.id } },
      ],
    });
  }
}

// ------------------------------------------------------------------ coerencia

function regraItemForaDaCidadeBase(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    const base = dia.dia.cidadeBaseId;
    if (!base) continue;
    const temTrecho = dia.dia.blocos.some((b) => b.tipo === 'trecho');

    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item) continue;
      if (b.item.cidadeId === base) continue;
      if (temTrecho) continue; // o dia tem troca de cidade: faz sentido

      const cidadeDoItem = ctx.pacote.cidades.find((c) => c.id === b.item?.cidadeId);
      const cidadeBase = ctx.pacote.cidades.find((c) => c.id === base);
      alertas.push({
        codigo: 'item-fora-da-cidade-base',
        nivel: 'atencao',
        titulo: `${b.item.nome} fica em outra cidade`,
        mensagem:
          `Neste dia voce dorme em ${cidadeBase?.nome ?? base}, mas esta atividade e em ` +
          `${cidadeDoItem?.nome ?? b.item.cidadeId}, e nao ha nenhuma troca de cidade agendada.`,
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: [
          { tipo: 'inserir-trecho', rotulo: 'Adicionar a viagem entre as cidades', dados: { de: base, para: b.item.cidadeId } },
          { tipo: 'mover-para-outro-dia', rotulo: 'Mover para um dia nessa cidade', dados: { blocoId: b.bloco.id } },
        ],
      });
    }
  }
}

function regraNoiteSemHospedagem(ctx: Contexto, alertas: Alerta[]): void {
  const ultimo = ctx.viagem.dias.at(-1)?.id;
  for (const dia of ctx.viagem.dias) {
    if (dia.id === ultimo) continue; // na ultima noite normalmente se viaja
    if (dia.cidadeBaseId && dia.hospedagem?.nome?.trim()) continue;

    alertas.push({
      codigo: 'noite-sem-hospedagem',
      nivel: 'atencao',
      titulo: `Sem hospedagem definida em ${dia.data}`,
      mensagem: dia.cidadeBaseId
        ? 'A cidade esta definida, mas nao ha hospedagem anotada para esta noite.'
        : 'Este dia nao tem cidade-base nem hospedagem: o app nao sabe de onde voce sai nem para onde volta.',
      diaId: dia.id,
      blocoIds: [],
      correcoes: [{ tipo: 'definir-hospedagem', rotulo: 'Definir onde dormir', dados: { diaId: dia.id } }],
    });
  }
}

function regraMinimoDeNoites(ctx: Contexto, alertas: Alerta[]): void {
  const noitesPorCidade = new Map<string, number>();
  for (const dia of ctx.viagem.dias) {
    if (!dia.cidadeBaseId) continue;
    noitesPorCidade.set(dia.cidadeBaseId, (noitesPorCidade.get(dia.cidadeBaseId) ?? 0) + 1);
  }

  for (const [cidadeId, noites] of noitesPorCidade) {
    const cidade = ctx.pacote.cidades.find((c) => c.id === cidadeId);
    const minimo = cidade?.noitesRecomendadas?.min;
    if (!cidade || minimo === undefined || noites >= minimo) continue;

    alertas.push({
      codigo: 'cidade-abaixo-do-minimo-de-noites',
      nivel: 'dica',
      titulo: `${noites} noite(s) em ${cidade.nome} e pouco`,
      mensagem:
        `A pesquisa recomenda no minimo ${minimo} e idealmente ` +
        `${cidade.noitesRecomendadas?.ideal} noites. Com menos, metade do tempo vira deslocamento.`,
      blocoIds: [],
      correcoes: [{ tipo: 'adicionar-noite', rotulo: `Adicionar noite em ${cidade.nome}`, dados: { cidadeId } }],
    });
  }
}

// ------------------------------------------------------------ saude e seguranca

function regraAltitude(ctx: Contexto, alertas: Alerta[]): void {
  let altitudeAnterior: number | undefined;

  for (const [indice, dia] of ctx.viagem.dias.entries()) {
    const cidade = ctx.pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
    if (!cidade) continue;

    const subiuMuito =
      altitudeAnterior !== undefined && cidade.altitudeM - altitudeAnterior >= SUBIDA_BRUSCA_M;
    const primeiroDiaDaViagem = indice === 0;

    if (cidade.altitudeM >= ALTITUDE_DE_ATENCAO_M && (primeiroDiaDaViagem || subiuMuito)) {
      const resolvido = ctx.dias[indice];
      const ocupado = (resolvido?.minutosEmAtividades ?? 0) + (resolvido?.minutosEmDeslocamento ?? 0);
      alertas.push({
        codigo: 'altitude-no-primeiro-dia',
        nivel: 'atencao',
        titulo: `${cidade.nome} fica a ${cidade.altitudeM.toLocaleString('pt-BR')} m`,
        mensagem:
          (primeiroDiaDaViagem
            ? 'E o primeiro dia da viagem. '
            : `Voce subiu ${(cidade.altitudeM - (altitudeAnterior ?? 0)).toLocaleString('pt-BR')} m de uma vez. `) +
          `Nas primeiras 24 a 48 h, pegue leve, beba agua e evite alcool. ` +
          `Hoje o dia tem ${formatarDuracao(ocupado)} ocupados.`,
        diaId: dia.id,
        blocoIds: [],
        correcoes: [{ tipo: 'aliviar-dia', rotulo: 'Deixar este dia mais leve', dados: { diaId: dia.id } }],
      });
    }
    altitudeAnterior = cidade.altitudeM;
  }
}

function regraVooAposMergulho(ctx: Contexto, alertas: Alerta[]): void {
  interface Mergulho {
    fimAbsoluto: number;
    esperaHoras: number;
    nome: string;
    blocoId: string;
    diaId: string;
  }
  const mergulhos: Mergulho[] = [];

  for (const [indice, dia] of ctx.dias.entries()) {
    const baseDoDia = indice * 1440;

    for (const b of dia.blocos) {
      if (b.bloco.tipo === 'atividade' && b.item?.restricoes.naoVoarDepoisHoras) {
        mergulhos.push({
          fimAbsoluto: baseDoDia + b.intervalo.fim,
          esperaHoras: b.item.restricoes.naoVoarDepoisHoras,
          nome: b.item.nome,
          blocoId: b.bloco.id,
          diaId: dia.dia.id,
        });
      }

      if (b.bloco.tipo !== 'trecho' || b.bloco.modal !== 'voo') continue;
      const partida = baseDoDia + b.intervalo.inicio;

      for (const m of mergulhos) {
        const horasDepois = (partida - m.fimAbsoluto) / 60;
        if (horasDepois < 0 || horasDepois >= m.esperaHoras) continue;
        alertas.push({
          codigo: 'voo-apos-mergulho',
          nivel: 'erro',
          titulo: `Voo ${horasDepois.toFixed(1)} h depois de mergulhar`,
          mensagem:
            `Depois de "${m.nome}" e preciso esperar ao menos ${m.esperaHoras} h antes de voar ` +
            '(recomendacao da DAN: 12 h para um mergulho, 18 h para mergulhos repetidos). ' +
            'Voar antes disso tem risco de doenca descompressiva.',
          diaId: dia.dia.id,
          blocoIds: [m.blocoId, b.bloco.id],
          correcoes: [
            { tipo: 'mover-para-outro-dia', rotulo: 'Antecipar o mergulho', dados: { blocoId: m.blocoId } },
            { tipo: 'mover-para-outro-dia', rotulo: 'Atrasar o voo', dados: { blocoId: b.bloco.id } },
          ],
        });
      }
    }
  }
}

function regraSituacaoDaCidade(ctx: Contexto, alertas: Alerta[]): void {
  const vistas = new Set<string>();
  for (const dia of ctx.viagem.dias) {
    const cidade = ctx.pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
    if (!cidade || vistas.has(cidade.id)) continue;
    vistas.add(cidade.id);

    for (const s of cidade.situacaoAtual) {
      if (s.ate && s.ate < dia.data) continue;
      alertas.push({
        codigo: 'situacao-atual-da-cidade',
        nivel: s.gravidade === 'grave' ? 'erro' : s.gravidade === 'atencao' ? 'atencao' : 'dica',
        titulo: `${cidade.nome}: ${s.titulo}`,
        mensagem: `${s.descricao} (verificado em ${s.verificadoEm})`,
        diaId: dia.id,
        blocoIds: [],
        correcoes: [],
      });
    }
  }
}

function regraEventoNoDia(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.viagem.dias) {
    for (const evento of ctx.pacote.calendario) {
      const fim = evento.dataFim ?? evento.dataInicio;
      if (dia.data < evento.dataInicio || dia.data > fim) continue;
      if (evento.escopo !== 'nacional' && evento.escopo !== dia.cidadeBaseId) continue;

      const evite = evento.valeEstarPresente === 'evite';
      alertas.push({
        codigo: evite ? 'evento-desaconselhado-no-dia' : 'evento-no-dia',
        nivel: evite ? 'atencao' : 'dica',
        titulo: evento.nome,
        mensagem:
          [
            evento.descricao,
            evento.impacto.fechamentos,
            evento.impacto.lotacao ? `Lotacao: ${evento.impacto.lotacao}.` : '',
            evento.impacto.preco ? `Preco: ${evento.impacto.preco.replace('-', ' ')}.` : '',
          ]
            .filter(Boolean)
            .join(' ') || 'Confira o impacto no seu dia.',
        diaId: dia.id,
        blocoIds: [],
        correcoes: evite
          ? [{ tipo: 'mover-dia', rotulo: 'Considerar outra data', dados: { diaId: dia.id } }]
          : [],
      });
    }
  }
}

function regraReservaComPrazo(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item?.reserva.necessaria) continue;
      if (b.bloco.statusDeReserva === 'reservado' || b.bloco.statusDeReserva === 'pago') continue;

      const dias = b.item.reserva.antecedenciaDias;
      alertas.push({
        codigo: 'precisa-reservar',
        nivel: b.item.reserva.esgotaRapido ? 'atencao' : 'dica',
        titulo: `${b.item.nome} precisa de reserva`,
        mensagem:
          (dias ? `Reserve com pelo menos ${dias} dia(s) de antecedencia. ` : '') +
          (b.item.reserva.esgotaRapido ? 'Costuma esgotar. ' : '') +
          (b.item.reserva.comoReservar ?? ''),
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: [
          { tipo: 'marcar-reservado', rotulo: 'Marcar como reservado', dados: { blocoId: b.bloco.id } },
        ],
      });
    }
  }
}

function regraClimaDoMes(ctx: Contexto, alertas: Alerta[]): void {
  const vistas = new Set<string>();
  for (const dia of ctx.viagem.dias) {
    const cidade = ctx.pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
    if (!cidade) continue;
    const mes = Number(dia.data.slice(5, 7));
    const chave = `${cidade.id}-${mes}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    const clima = cidade.climaPorMes.find((c) => c.mes === mes);
    if (!clima) continue;
    if (clima.pesoNaDecisao !== 'alto') continue;

    alertas.push({
      codigo: 'clima-do-mes',
      nivel: 'dica',
      titulo: `${cidade.nome} em ${nomeDoMes(mes)}: ${clima.chuvaMm.toLocaleString('pt-BR')} mm em ${clima.diasDeChuva} dias`,
      mensagem: [clima.resumo, clima.planoBChuva].filter(Boolean).join(' Plano B: '),
      diaId: dia.id,
      blocoIds: [],
      correcoes: [],
    });
  }
}

function regraOrcamento(ctx: Contexto, alertas: Alerta[]): void {
  const orcamento = calcularOrcamento(ctx.viagem, ctx.pacote);
  if (!orcamento.orcado) return;

  /*
    O teto inclui o voo e o voo nao esta na conta.

    Este aviso vem ANTES do de estouro de proposito. Um total que parece
    caber dentro do teto, calculado sem a maior linha da viagem, e pior que
    nenhum total: ele autoriza a gastar. O dono deste app definiu o teto
    como "ate R$ 8.000 por pessoa INCLUINDO voo internacional", e o aereo
    costuma comer de um terco a metade disso.
  */
  if (ctx.viagem.orcamento?.incluiVoosInternacionais && ctx.viagem.voo?.precoPorPessoa === undefined) {
    const rotas = ctx.pacote.voosInternacionais.length;
    alertas.push({
      codigo: 'voo-fora-do-orcamento',
      nivel: 'atencao',
      titulo: 'O teto inclui o voo, e o voo nao esta na conta',
      mensagem:
        'Seu teto por pessoa foi definido como incluindo o aereo, mas nenhum preco de voo foi anotado. ' +
        'Tudo o que o orcamento mostra hoje esta por baixo.' +
        (rotas > 0
          ? ` O banco tem ${rotas} rota${rotas > 1 ? 's' : ''} pesquisada${rotas > 1 ? 's' : ''} com faixa de preco e link de busca.`
          : ''),
      blocoIds: [],
      correcoes: [{ tipo: 'abrir-orcamento', rotulo: 'Escolher o voo' }],
    });
  }

  if (!orcamento.estourou) return;

  alertas.push({
    codigo: 'orcamento-estourado',
    nivel: 'atencao',
    titulo: `Gasto planejado passa do seu teto`,
    mensagem:
      `O planejado soma ${formatarFaixaBRL(orcamento.total)} e o teto e ` +
      `${formatarFaixaBRL(orcamento.orcado)}.` +
      (orcamento.semPreco.length > 0
        ? ` E ainda ha ${orcamento.semPreco.length} item(ns) sem preco no banco, entao o real tende a ser maior.`
        : ''),
    blocoIds: [],
    correcoes: [{ tipo: 'abrir-orcamento', rotulo: 'Ver onde o dinheiro esta indo' }],
  });
}

// ----------------------------------------------------------------- auxiliares

const NOMES_LONGOS: Record<DiaDaSemana, string> = {
  seg: 'segunda-feira',
  ter: 'terca-feira',
  qua: 'quarta-feira',
  qui: 'quinta-feira',
  sex: 'sexta-feira',
  sab: 'sabado',
  dom: 'domingo',
};

function nomeLongoDoDia(d: DiaDaSemana): string {
  return NOMES_LONGOS[d];
}

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function nomeDoMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

const ORDEM: Record<NivelDeAlerta, number> = { erro: 0, atencao: 1, dica: 2 };

// --------------------------------------------------------------------- publico

export function validarViagem(
  viagem: Viagem,
  pacote: PacoteDestino,
  opcoes: OpcoesDeValidacao = {},
): Alerta[] {
  const dias = viagem.dias.map((d) => resolverDia(viagem, d, pacote));
  const ctx: Contexto = {
    viagem,
    pacote,
    dias,
    itensPorId: new Map(pacote.itens.map((i) => [i.id, i])),
    ...(opcoes.hoje ? { hoje: opcoes.hoje } : {}),
  };

  const alertas: Alerta[] = [];
  const regras = [
    regraDeslocamentoImpossivel,
    regraBlocosSobrepostos,
    regraHorarioDeFuncionamento,
    regraDuracaoAbaixoDoMinimo,
    regraLuzDoDia,
    regraHorarioFixoDeSaida,
    regraDiaSobrecarregado,
    regraDiaSemRefeicao,
    regraSonoInsuficiente,
    regraItemForaDaCidadeBase,
    regraNoiteSemHospedagem,
    regraMinimoDeNoites,
    regraAltitude,
    regraVooAposMergulho,
    regraSituacaoDaCidade,
    regraEventoNoDia,
    regraReservaComPrazo,
    regraClimaDoMes,
    regraOrcamento,
    regraDocumentosDeEntrada,
    regraPrazoDeReserva,
    regraFolgaAntesDoQueNaoEspera,
  ];

  for (const regra of regras) regra(ctx, alertas);

  return alertas.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

// ------------------------------------------------- melhorias 11, 12 e 3

/**
 * MELHORIA 11 — alerta de documentos.
 * O requisito de entrada esta no banco desde sempre, mas so aparecia num
 * documento que ninguem le. Agora vira alerta na tela, com prazo contado a
 * partir do primeiro dia da viagem.
 */
function regraDocumentosDeEntrada(ctx: Contexto, alertas: Alerta[]): void {
  const primeiroDia = ctx.viagem.dias[0]?.data;
  if (!primeiroDia) return;

  const nacionalidade = ctx.viagem.viajantes.nacionalidade;
  const requisito =
    ctx.pacote.destino.entrada.find((e) => e.nacionalidade === nacionalidade) ??
    ctx.pacote.destino.entrada[0];
  if (!requisito) return;

  const diasAte = ctx.hoje ? diferencaEmDias(ctx.hoje, primeiroDia) : undefined;
  const prazo = diasAte === undefined ? '' : ` A viagem comeca ${emQuantosDias(diasAte)}.`;

  if (requisito.vistoNecessario) {
    alertas.push({
      codigo: 'visto-necessario',
      nivel: 'erro',
      titulo: `${ctx.pacote.destino.nome} exige visto para ${nacionalidade}`,
      mensagem: `${requisito.observacoes || requisito.documento}${prazo}`,
      blocoIds: [],
      correcoes: [{ tipo: 'abrir-requisitos', rotulo: 'Ver os requisitos de entrada' }],
    });
  }

  if (requisito.vacinaFebreAmarela) {
    alertas.push({
      codigo: 'vacina-exigida',
      nivel: 'atencao',
      titulo: 'Vacina a conferir antes de viajar',
      mensagem:
        `${requisito.vacinaFebreAmarela}${prazo}` +
        ' A vacina de febre amarela precisa de 10 dias para valer.',
      blocoIds: [],
      correcoes: [],
    });
  }

  alertas.push({
    codigo: 'documento-de-entrada',
    nivel: 'dica',
    titulo: 'Documento de entrada',
    mensagem: `${requisito.documento}${
      requisito.formularioMigratorio ? ` ${requisito.formularioMigratorio}` : ''
    }`,
    blocoIds: [],
    correcoes: [],
  });
}

/**
 * MELHORIA 12 — contagem regressiva de reserva.
 * "Reserve com 30 dias de antecedencia" nao diz nada; "reserve ate 14 de
 * novembro, em 12 dias" diz.
 */
function regraPrazoDeReserva(ctx: Contexto, alertas: Alerta[]): void {
  if (!ctx.hoje) return;

  for (const dia of ctx.dias) {
    for (const b of dia.blocos) {
      if (b.bloco.tipo !== 'atividade' || !b.item?.reserva.necessaria) continue;
      if (b.bloco.statusDeReserva === 'reservado' || b.bloco.statusDeReserva === 'pago') continue;

      const antecedencia = b.item.reserva.antecedenciaDias;
      if (antecedencia === undefined) continue;

      const prazo = somarDias(dia.dia.data, -antecedencia);
      const diasAteOPrazo = diferencaEmDias(ctx.hoje, prazo);

      alertas.push({
        codigo: diasAteOPrazo < 0 ? 'prazo-de-reserva-vencido' : 'prazo-de-reserva',
        nivel: diasAteOPrazo < 0 ? 'erro' : diasAteOPrazo <= 7 ? 'atencao' : 'dica',
        titulo:
          diasAteOPrazo < 0
            ? `Passou do prazo de reserva de ${b.item.nome}`
            : `Reserve ${b.item.nome} ate ${porExtenso(prazo)}`,
        mensagem:
          diasAteOPrazo < 0
            ? `A antecedencia recomendada e de ${antecedencia} dias, e o prazo venceu ${emQuantosDias(diasAteOPrazo)}. Pode ja nao haver vaga.`
            : `Sao ${antecedencia} dias de antecedencia: o prazo cai ${emQuantosDias(diasAteOPrazo)}.`,
        diaId: dia.dia.id,
        blocoIds: [b.bloco.id],
        correcoes: [
          { tipo: 'marcar-reservado', rotulo: 'Marcar como reservado', dados: { blocoId: b.bloco.id } },
        ],
      });
    }
  }
}

/** Folga minima antes de algo que nao espera. */
const FOLGA_ANTES_DE_VOO_MIN = 30;

/**
 * MELHORIA 3 — bloco-tampao.
 * Chegar em cima da hora e o que mais estraga dia de viagem. Antes de voo e
 * de passeio com saida marcada, o app cobra folga.
 */
function regraFolgaAntesDoQueNaoEspera(ctx: Contexto, alertas: Alerta[]): void {
  for (const dia of ctx.dias) {
    for (const lacuna of dia.lacunas) {
      if (lacuna.tipo !== 'entre-blocos' || !lacuna.cabe) continue;
      const sobra = lacuna.minutosLivres;
      if (sobra === null || sobra >= FOLGA_ANTES_DE_VOO_MIN) continue;

      const seguinte = dia.blocos.find((b) => b.bloco.id === lacuna.antesDe);
      if (!seguinte) continue;

      const ehVoo = seguinte.bloco.tipo === 'trecho' && seguinte.bloco.modal === 'voo';
      const ehSaidaMarcada =
        seguinte.bloco.tipo === 'atividade' && Boolean(seguinte.item?.passeio?.horarioFixo);
      if (!ehVoo && !ehSaidaMarcada) continue;

      alertas.push({
        codigo: 'sem-folga-antes-do-horario-marcado',
        nivel: 'atencao',
        titulo: `So ${formatarDuracao(sobra)} de folga antes de ${seguinte.rotulo}`,
        mensagem:
          (ehVoo ? 'Voo nao espera. ' : 'Este passeio sai na hora marcada. ') +
          `Depois do trajeto sobram ${formatarDuracao(sobra)}. Qualquer atraso no caminho faz voce perder.`,
        diaId: dia.dia.id,
        blocoIds: [lacuna.depoisDe, seguinte.bloco.id],
        correcoes: [
          {
            tipo: 'inserir-folga',
            rotulo: `Reservar ${formatarDuracao(FOLGA_ANTES_DE_VOO_MIN)} de folga`,
            dados: { antesDe: seguinte.bloco.id, minutos: FOLGA_ANTES_DE_VOO_MIN - sobra },
          },
          {
            tipo: 'encurtar-anterior',
            rotulo: 'Encurtar a atividade anterior',
            dados: { blocoId: lacuna.depoisDe, minutos: FOLGA_ANTES_DE_VOO_MIN - sobra },
          },
        ],
      });
    }
  }
}
