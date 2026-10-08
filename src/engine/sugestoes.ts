/**
 * MELHORIA 4 — plano B de chuva.
 * MELHORIA 19 — comparar dois roteiros lado a lado.
 *
 * Modulo puro: propoe, nunca aplica. Quem aplica e a interface, depois do
 * clique do usuario — o app nao mexe no roteiro dele sozinho.
 */
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { calcularOrcamento, type Faixa } from './orcamento.ts';
import { validarViagem } from './regras.ts';
import { resolverDia } from './resolver-dia.ts';
import { formatarDuracao } from './tempo.ts';

// ------------------------------------------------------- plano B de chuva

export interface TrocaSugerida {
  blocoId: string;
  itemAtual: string;
  /** Alternativas cobertas, na mesma cidade, que cabem na mesma duracao. */
  alternativas: Array<{ item: Item; porque: string }>;
}

export interface PlanoBDeChuva {
  diaId: string;
  cidadeId?: string;
  /** mm e dias de chuva do mes, quando o banco sabe. */
  motivo: string;
  trocas: TrocaSugerida[];
  /** Quando nao ha nada ao ar livre no dia. */
  nadaParaTrocar: boolean;
}

/** Categorias que nao dependem de ficar seco. */
const CATEGORIAS_COBERTAS = new Set(['museu', 'restaurante', 'cafe', 'bar', 'compras']);

function ehCoberto(item: Item): boolean {
  if (item.restricoes.dependeDeClima) return false;
  return CATEGORIAS_COBERTAS.has(item.categoria);
}

/**
 * Para um dia, lista o que esta ao ar livre e o que poderia entrar no lugar.
 * As alternativas vem da MESMA cidade e cabem na duracao do bloco: trocar
 * uma praia de 5 h por um museu de 45 min deixaria o dia vazio.
 */
export function planoBDeChuva(
  viagem: Viagem,
  diaId: string,
  pacote: PacoteDestino,
): PlanoBDeChuva | undefined {
  const dia = viagem.dias.find((d) => d.id === diaId);
  if (!dia) return undefined;

  const cidade = pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
  const mes = Number(dia.data.slice(5, 7));
  const clima = cidade?.climaPorMes.find((c) => c.mes === mes);

  const motivo = clima
    ? `${cidade?.nome} em ${dia.data.slice(5, 7)}/${dia.data.slice(0, 4)}: ${clima.chuvaMm.toLocaleString('pt-BR')} mm em ${clima.diasDeChuva} dias de chuva.`
    : 'Sem dado de clima para este mes nesta cidade: a troca e so por precaucao.';

  const resolvido = resolverDia(viagem, dia, pacote);
  const jaNoDia = new Set(
    dia.blocos.filter((b) => b.tipo === 'atividade').map((b) => b.itemId),
  );
  const descartados = new Set(Object.keys(viagem.descartados));

  const trocas: TrocaSugerida[] = [];

  for (const b of resolvido.blocos) {
    if (b.bloco.tipo !== 'atividade' || !b.item) continue;
    if (!b.item.restricoes.dependeDeClima) continue;

    const duracao = b.bloco.durationMin;
    const alternativas = pacote.itens
      .filter((i) => i.cidadeId === b.item?.cidadeId)
      .filter((i) => i.agendavel && ehCoberto(i))
      .filter((i) => !jaNoDia.has(i.id) && !descartados.has(i.id))
      .filter((i) => i.duracao && i.duracao.min <= duracao)
      .sort((a, b2) => {
        // Prefere o que mais se aproxima da duracao do bloco vago.
        const da = Math.abs((a.duracao?.tipica ?? 0) - duracao);
        const db = Math.abs((b2.duracao?.tipica ?? 0) - duracao);
        return da - db;
      })
      .slice(0, 4)
      .map((i) => ({
        item: i,
        porque: `${i.categoria}, coberto, ${formatarDuracao(i.duracao?.tipica ?? 0)} tipicos`,
      }));

    if (alternativas.length > 0) {
      trocas.push({ blocoId: b.bloco.id, itemAtual: b.item.nome, alternativas });
    }
  }

  return {
    diaId,
    ...(dia.cidadeBaseId ? { cidadeId: dia.cidadeBaseId } : {}),
    motivo,
    trocas,
    nadaParaTrocar: trocas.length === 0,
  };
}

// ----------------------------------------------------- comparar roteiros

export interface ResumoDeRoteiro {
  nome: string;
  dias: number;
  noitesPorCidade: Record<string, number>;
  minutosEmAtividades: number;
  minutosEmDeslocamento: number;
  minutosLivres: number;
  custo: Faixa;
  custoPorPessoa: Faixa;
  erros: number;
  atencoes: number;
  dicas: number;
  /** Itens sem preco no banco: o custo real tende a ser maior que o mostrado. */
  itensSemPreco: number;
}

export interface ComparacaoDeRoteiros {
  a: ResumoDeRoteiro;
  b: ResumoDeRoteiro;
  /** Frases prontas dizendo em que cada um ganha. */
  diferencas: string[];
}

export function resumirRoteiro(viagem: Viagem, pacote: PacoteDestino): ResumoDeRoteiro {
  const dias = viagem.dias.map((d) => resolverDia(viagem, d, pacote));
  const alertas = validarViagem(viagem, pacote);
  const orcamento = calcularOrcamento(viagem, pacote);

  const noitesPorCidade: Record<string, number> = {};
  for (const d of viagem.dias) {
    if (!d.cidadeBaseId) continue;
    noitesPorCidade[d.cidadeBaseId] = (noitesPorCidade[d.cidadeBaseId] ?? 0) + 1;
  }

  return {
    nome: viagem.nome,
    dias: viagem.dias.length,
    noitesPorCidade,
    minutosEmAtividades: dias.reduce((s, d) => s + d.minutosEmAtividades, 0),
    minutosEmDeslocamento: dias.reduce((s, d) => s + d.minutosEmDeslocamento, 0),
    minutosLivres: dias.reduce((s, d) => s + d.minutosLivres, 0),
    custo: orcamento.total,
    custoPorPessoa: orcamento.totalPorPessoa,
    erros: alertas.filter((a) => a.nivel === 'erro').length,
    atencoes: alertas.filter((a) => a.nivel === 'atencao').length,
    dicas: alertas.filter((a) => a.nivel === 'dica').length,
    itensSemPreco: orcamento.semPreco.length,
  };
}

function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function compararRoteiros(
  viagemA: Viagem,
  viagemB: Viagem,
  pacote: PacoteDestino,
): ComparacaoDeRoteiros {
  const a = resumirRoteiro(viagemA, pacote);
  const b = resumirRoteiro(viagemB, pacote);
  const diferencas: string[] = [];

  const compara = (
    rotulo: string,
    va: number,
    vb: number,
    formatar: (n: number) => string,
    maiorEMelhor: boolean,
  ): void => {
    if (va === vb) return;
    const vencedor = maiorEMelhor ? (va > vb ? a : b) : va < vb ? a : b;
    diferencas.push(
      `${rotulo}: ${a.nome} ${formatar(va)}, ${b.nome} ${formatar(vb)} — melhor em ${vencedor.nome}.`,
    );
  };

  compara('Conflitos', a.erros, b.erros, (n) => `${n}`, false);
  compara('Pontos de atencao', a.atencoes, b.atencoes, (n) => `${n}`, false);
  compara('Tempo livre', a.minutosLivres, b.minutosLivres, formatarDuracao, true);
  compara(
    'Tempo em deslocamento',
    a.minutosEmDeslocamento,
    b.minutosEmDeslocamento,
    formatarDuracao,
    false,
  );
  compara('Custo por pessoa (minimo)', a.custoPorPessoa.min, b.custoPorPessoa.min, reais, false);

  if (a.itensSemPreco !== b.itensSemPreco) {
    diferencas.push(
      `Itens sem preco no banco: ${a.nome} ${a.itensSemPreco}, ${b.nome} ${b.itensSemPreco}. ` +
        'Quanto mais, menos confiavel e a comparacao de custo.',
    );
  }

  return { a, b, diferencas };
}

// --------------------------------------------- sugestao de janela de datas

export interface JanelaSugerida {
  inicio: string;
  fim: string;
  /** 0 a 100. So serve para ordenar; o que vale e o porque. */
  nota: number;
  chuvaMediaMm: number;
  diasDeChuvaMedia: number;
  /** Frases curtas explicando a nota. E isto que o usuario le. */
  porque: string[];
  /** Eventos que caem dentro da janela. */
  eventos: Array<{ nome: string; data: string; veredito?: string }>;
}

/**
 * Pontua janelas de datas para uma viagem de N dias.
 *
 * Nao existe "melhor mes" universal: depende de quais bases o viajante quer.
 * Por isso a funcao recebe as cidades que interessam — normalmente as dos
 * favoritos — e so olha o clima delas.
 *
 * A nota serve para ordenar. O que o app mostra e `porque`, em numero.
 */
export function sugerirJanelas(
  pacote: PacoteDestino,
  opcoes: {
    duracaoEmDias: number;
    cidadesDeInteresse: string[];
    /** Primeiro dia possivel, AAAA-MM-DD. */
    aPartirDe: string;
    /** Quantas janelas devolver. */
    quantas?: number;
    /** De quantos em quantos dias testar. 1 = todo dia. */
    passo?: number;
  },
): JanelaSugerida[] {
  const { duracaoEmDias, cidadesDeInteresse, aPartirDe, quantas = 5, passo = 3 } = opcoes;
  if (duracaoEmDias < 1) return [];

  const cidades = pacote.cidades.filter(
    (c) => cidadesDeInteresse.length === 0 || cidadesDeInteresse.includes(c.id),
  );
  const comClima = cidades.filter((c) => c.climaPorMes.length > 0);
  if (comClima.length === 0) return [];

  const inicioMs = Date.parse(`${aPartirDe}T00:00:00Z`);
  const janelas: JanelaSugerida[] = [];

  // Um ano a frente, de `passo` em `passo` dias.
  for (let deslocamento = 0; deslocamento <= 365; deslocamento += passo) {
    const inicioData = new Date(inicioMs + deslocamento * 86_400_000);
    const fimData = new Date(inicioMs + (deslocamento + duracaoEmDias - 1) * 86_400_000);
    const inicio = inicioData.toISOString().slice(0, 10);
    const fim = fimData.toISOString().slice(0, 10);

    // Meses que a janela cobre.
    const meses = new Set<number>();
    for (let d = 0; d < duracaoEmDias; d += 1) {
      meses.add(new Date(inicioMs + (deslocamento + d) * 86_400_000).getUTCMonth() + 1);
    }

    let somaChuva = 0;
    let somaDias = 0;
    let amostras = 0;
    const porque: string[] = [];

    for (const cidade of comClima) {
      for (const mes of meses) {
        const clima = cidade.climaPorMes.find((c) => c.mes === mes);
        if (!clima) continue;
        somaChuva += clima.chuvaMm;
        somaDias += clima.diasDeChuva;
        amostras += 1;
      }
    }
    if (amostras === 0) continue;

    const chuvaMedia = somaChuva / amostras;
    const diasChuvaMedia = somaDias / amostras;

    // 0 mm = 100 pontos; 350 mm ou mais = 0.
    const notaDeChuva = Math.max(0, 100 - (chuvaMedia / 350) * 100);

    const eventos = pacote.calendario
      .filter((e) => {
        const fimDoEvento = e.dataFim ?? e.dataInicio;
        return e.dataInicio <= fim && fimDoEvento >= inicio;
      })
      .filter(
        (e) => e.escopo === 'nacional' || cidadesDeInteresse.length === 0 || cidadesDeInteresse.includes(e.escopo),
      );

    let penalidade = 0;
    for (const e of eventos) {
      if (e.valeEstarPresente === 'evite') penalidade += 25;
      else if (e.impacto.lotacao === 'alta') penalidade += 8;
      if (e.impacto.preco === 'sobe-muito') penalidade += 10;
      else if (e.impacto.preco === 'sobe') penalidade += 4;
    }

    const nota = Math.max(0, Math.round(notaDeChuva - penalidade));

    porque.push(
      `Media de ${Math.round(chuvaMedia)} mm e ${diasChuvaMedia.toFixed(0)} dias de chuva nas bases escolhidas.`,
    );
    const fechados = eventos.filter((e) => e.valeEstarPresente === 'evite');
    if (fechados.length > 0) {
      porque.push(`Pega ${fechados.map((e) => e.nome).join('; ')}.`);
    }
    const lotados = eventos.filter(
      (e) => e.impacto.lotacao === 'alta' && e.valeEstarPresente !== 'evite',
    );
    if (lotados.length > 0) {
      porque.push(`Lotacao alta por ${lotados.length} evento(s) no periodo.`);
    }
    if (eventos.length === 0) porque.push('Nenhum feriado ou festa grande no periodo.');

    janelas.push({
      inicio,
      fim,
      nota,
      chuvaMediaMm: Math.round(chuvaMedia),
      diasDeChuvaMedia: Number(diasChuvaMedia.toFixed(1)),
      porque,
      eventos: eventos.slice(0, 6).map((e) => ({
        nome: e.nome,
        data: e.dataInicio,
        ...(e.valeEstarPresente ? { veredito: e.valeEstarPresente } : {}),
      })),
    });
  }

  // Ordena por nota e evita devolver cinco janelas que se sobrepoem.
  const ordenadas = janelas.sort((a, b) => b.nota - a.nota);
  const escolhidas: JanelaSugerida[] = [];
  for (const janela of ordenadas) {
    const colide = escolhidas.some((j) => j.inicio <= janela.fim && janela.inicio <= j.fim);
    if (colide) continue;
    escolhidas.push(janela);
    if (escolhidas.length >= quantas) break;
  }
  return escolhidas;
}
