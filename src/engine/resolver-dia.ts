/**
 * Transforma um dia salvo (blocos crus) no dia que a interface desenha:
 * blocos posicionados, deslocamentos DERIVADOS entre eles, lacunas, tempo
 * ocupado e tempo livre.
 *
 * O deslocamento dentro da cidade nao e salvo em lugar nenhum - nasce aqui a
 * cada calculo. E isso que impede trajeto velho de sobrar na agenda depois de
 * o usuario arrastar uma atividade.
 *
 * O id da lacuna (`${blocoA}>${blocoB}`) e a chave de
 * `viagem.deslocamentos`, onde fica a escolha de modal do usuario.
 */
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Bloco, Dia, Viagem } from '../schema/viagem.ts';
import { type Deslocamento, type Ponto, estimarDeslocamento } from './deslocamento.ts';
import { type Intervalo, intervaloDe, minutosDeSobreposicao, ordenarPorInicio } from './tempo.ts';

export interface BlocoResolvido {
  bloco: Bloco;
  intervalo: Intervalo;
  item?: Item;
  rotulo: string;
  /** Onde o viajante esta quando o bloco comeca e quando termina. */
  entrada?: Ponto;
  saida?: Ponto;
}

/**
 * Os tres tipos tem perguntas diferentes, e confundi-los gera alerta falso:
 * - entre-blocos: "o trajeto cabe no intervalo?" (pode nao caber)
 * - saida-da-hospedagem: "a que horas preciso sair?" (nunca "nao cabe")
 * - volta-para-hospedagem: "a que horas chego de volta?" (idem)
 */
export type TipoDeLacuna = 'saida-da-hospedagem' | 'entre-blocos' | 'volta-para-hospedagem';

export interface LacunaResolvida {
  /** Chave estavel: casa com viagem.deslocamentos. */
  id: string;
  tipo: TipoDeLacuna;
  depoisDe: string;
  antesDe: string;
  inicioMin: number;
  fimMin: number;
  /** Tempo entre o fim de um bloco e o inicio do proximo. */
  minutosDisponiveis: number;
  deslocamento: Deslocamento | null;
  /** Sobra depois do deslocamento. Negativo quando nao cabe. */
  minutosLivres: number | null;
  cabe: boolean;
  /** 0 quando cabe; quantos minutos faltam quando nao cabe. */
  faltamMin: number;
  /** So em saida-da-hospedagem: a que horas sair para chegar na hora. */
  horarioDeSaidaMin?: number;
  /** So em volta-para-hospedagem: a que horas o viajante chega de volta. */
  horarioDeChegadaMin?: number;
}

export interface Sobreposicao {
  a: string;
  b: string;
  minutos: number;
}

export interface DiaResolvido {
  dia: Dia;
  blocos: BlocoResolvido[];
  lacunas: LacunaResolvida[];
  sobreposicoes: Sobreposicao[];
  minutosEmAtividades: number;
  minutosEmDeslocamento: number;
  /** Trechos entre blocos que ficaram sem conta por falta de coordenada. */
  trajetosSemDados: number;
  /** Lacunas que sobram depois de descontar o deslocamento. */
  minutosLivres: number;
  /** Lacunas cujo deslocamento nao cabe. */
  minutosEmFalta: number;
}

const ID_HOSPEDAGEM_INICIO = 'hospedagem-inicio';
const ID_HOSPEDAGEM_FIM = 'hospedagem-fim';

function rotuloDoBloco(bloco: Bloco, item?: Item): string {
  switch (bloco.tipo) {
    case 'atividade':
      return item?.nome ?? bloco.itemId;
    case 'refeicao':
      return bloco.nome;
    case 'tempo-livre':
      return 'Tempo livre';
    case 'nota':
      return bloco.texto.slice(0, 60);
    case 'trecho':
      return `${bloco.deCidadeId} para ${bloco.paraCidadeId}`;
  }
}

function pontosDoBloco(
  bloco: Bloco,
  item: Item | undefined,
  cidadeDoDia: string | undefined,
): { entrada?: Ponto; saida?: Ponto } {
  if (bloco.tipo === 'trecho') {
    // Um trecho ENTRA numa cidade e SAI em outra: por isso entrada e saida
    // sao pontos diferentes. E o que faz a conta do voo fechar.
    return {
      entrada: { nome: bloco.deCidadeId, cidadeId: bloco.deCidadeId, ancora: 'terminal-de-onibus' },
      saida: { nome: bloco.paraCidadeId, cidadeId: bloco.paraCidadeId, ancora: 'terminal-de-onibus' },
    };
  }

  if (bloco.tipo === 'atividade' || (bloco.tipo === 'refeicao' && bloco.itemId)) {
    if (!item) return {};
    const ponto: Ponto = {
      nome: item.nome,
      cidadeId: item.cidadeId,
      itemId: item.id,
      ...(item.coords ? { coords: item.coords } : {}),
    };
    return { entrada: ponto, saida: ponto };
  }

  if (bloco.tipo === 'refeicao' && cidadeDoDia) {
    const ponto: Ponto = { nome: bloco.nome, cidadeId: cidadeDoDia };
    return { entrada: ponto, saida: ponto };
  }

  // Tempo livre e nota nao tem lugar: nao geram deslocamento.
  return {};
}

export interface OpcoesDeResolucao {
  /**
   * Inclui o trajeto da hospedagem ate o primeiro bloco e a volta depois do
   * ultimo. Sem isso o tempo livre do dia fica otimista demais.
   */
  incluirHospedagem?: boolean;
}

export function resolverDia(
  viagem: Viagem,
  dia: Dia,
  pacote: PacoteDestino,
  opcoes: OpcoesDeResolucao = {},
): DiaResolvido {
  const { incluirHospedagem = true } = opcoes;
  const porId = new Map(pacote.itens.map((i) => [i.id, i]));

  const ordenados = ordenarPorInicio(dia.blocos);
  const blocos: BlocoResolvido[] = ordenados.map((bloco) => {
    const item =
      bloco.tipo === 'atividade' || (bloco.tipo === 'refeicao' && bloco.itemId)
        ? porId.get(bloco.tipo === 'atividade' ? bloco.itemId : (bloco.itemId as string))
        : undefined;
    return {
      bloco,
      intervalo: intervaloDe(bloco.startMin, bloco.durationMin),
      item,
      rotulo: rotuloDoBloco(bloco, item),
      ...pontosDoBloco(bloco, item, dia.cidadeBaseId),
    };
  });

  // ------------------------------------------------------------ sobreposicao
  const sobreposicoes: Sobreposicao[] = [];
  for (let i = 0; i < blocos.length; i += 1) {
    for (let j = i + 1; j < blocos.length; j += 1) {
      const a = blocos[i];
      const b = blocos[j];
      if (!a || !b) continue;
      const minutos = minutosDeSobreposicao(a.intervalo, b.intervalo);
      if (minutos > 0) sobreposicoes.push({ a: a.bloco.id, b: b.bloco.id, minutos });
    }
  }

  // ----------------------------------------------------------------- lacunas
  const cidade = dia.cidadeBaseId
    ? pacote.cidades.find((c) => c.id === dia.cidadeBaseId)
    : undefined;

  const pontoDaHospedagem: Ponto | undefined =
    incluirHospedagem && dia.cidadeBaseId
      ? {
          nome: dia.hospedagem?.nome?.trim() || 'sua hospedagem',
          cidadeId: dia.cidadeBaseId,
          ancora: 'hospedagem',
          ...(cidade?.coords ? { coords: cidade.coords } : {}),
        }
      : undefined;

  const lacunas: LacunaResolvida[] = [];

  function montarLacuna(
    tipo: TipoDeLacuna,
    id: string,
    depoisDe: string,
    antesDe: string,
    inicioMin: number,
    fimMin: number,
    de: Ponto | undefined,
    para: Ponto | undefined,
  ): void {
    const minutosDisponiveis = fimMin - inicioMin;
    if (!de || !para) {
      lacunas.push({
        id,
        tipo,
        depoisDe,
        antesDe,
        inicioMin,
        fimMin,
        minutosDisponiveis,
        deslocamento: null,
        minutosLivres: tipo === 'entre-blocos' ? minutosDisponiveis : 0,
        cabe: true,
        faltamMin: 0,
      });
      return;
    }

    const escolha = viagem.deslocamentos[id];
    const deslocamento = estimarDeslocamento(de, para, {
      pacote,
      ...(escolha?.modal ? { modalEscolhido: escolha.modal } : {}),
      ...(escolha?.minutosManuais !== undefined
        ? { minutosManuais: escolha.minutosManuais }
        : {}),
    });

    const minutos = deslocamento.minutos;

    // Sair da hospedagem e voltar para ela nao disputam espaco com nada:
    // a pergunta e "a que horas?", nao "cabe?". Tratar como lacuna comum
    // marcaria conflito em todo dia que tem hospedagem.
    if (tipo !== 'entre-blocos') {
      lacunas.push({
        id,
        tipo,
        depoisDe,
        antesDe,
        inicioMin,
        fimMin,
        minutosDisponiveis: 0,
        deslocamento,
        minutosLivres: 0,
        cabe: true,
        faltamMin: 0,
        ...(tipo === 'saida-da-hospedagem' && minutos !== null
          ? { horarioDeSaidaMin: fimMin - minutos }
          : {}),
        ...(tipo === 'volta-para-hospedagem' && minutos !== null
          ? { horarioDeChegadaMin: inicioMin + minutos }
          : {}),
      });
      return;
    }

    const minutosLivres = minutos === null ? null : minutosDisponiveis - minutos;
    const cabe = minutos === null ? true : minutos <= minutosDisponiveis;

    lacunas.push({
      id,
      tipo,
      depoisDe,
      antesDe,
      inicioMin,
      fimMin,
      minutosDisponiveis,
      deslocamento,
      minutosLivres,
      cabe,
      faltamMin: cabe || minutos === null ? 0 : minutos - minutosDisponiveis,
    });
  }

  const comLugar = blocos.filter((b) => b.entrada || b.saida);

  if (pontoDaHospedagem && comLugar.length > 0) {
    const primeiro = comLugar[0];
    if (primeiro?.entrada) {
      montarLacuna(
        'saida-da-hospedagem',
        `${ID_HOSPEDAGEM_INICIO}>${primeiro.bloco.id}`,
        ID_HOSPEDAGEM_INICIO,
        primeiro.bloco.id,
        primeiro.intervalo.inicio,
        primeiro.intervalo.inicio,
        pontoDaHospedagem,
        primeiro.entrada,
      );
    }
  }

  for (let i = 0; i < comLugar.length - 1; i += 1) {
    const a = comLugar[i];
    const b = comLugar[i + 1];
    if (!a || !b) continue;
    montarLacuna(
      'entre-blocos',
      `${a.bloco.id}>${b.bloco.id}`,
      a.bloco.id,
      b.bloco.id,
      a.intervalo.fim,
      b.intervalo.inicio,
      a.saida,
      b.entrada,
    );
  }

  if (pontoDaHospedagem && comLugar.length > 0) {
    const ultimo = comLugar.at(-1);
    if (ultimo?.saida) {
      montarLacuna(
        'volta-para-hospedagem',
        `${ultimo.bloco.id}>${ID_HOSPEDAGEM_FIM}`,
        ultimo.bloco.id,
        ID_HOSPEDAGEM_FIM,
        ultimo.intervalo.fim,
        ultimo.intervalo.fim,
        ultimo.saida,
        pontoDaHospedagem,
      );
    }
  }

  // ------------------------------------------------------------------ totais
  const minutosEmAtividades = blocos
    .filter((b) => b.bloco.tipo !== 'tempo-livre' && b.bloco.tipo !== 'nota')
    .reduce((soma, b) => soma + b.bloco.durationMin, 0);

  const minutosEmDeslocamento = lacunas.reduce(
    (soma, l) => soma + (l.deslocamento?.minutos ?? 0),
    0,
  );

  /*
    Quantos trajetos o motor NAO conseguiu calcular (falta coordenada).

    Sem isto o rodape somava zero e escrevia "0 min de deslocamento", que o
    usuario le como "nao ha deslocamento" quando a verdade e "nao sei".
    Um dia montado com tres itens sem coordenada aparecia como um dia sem
    nenhum trajeto — e o orcamento de tempo ficava otimista de graca.
  */
  const trajetosSemDados = lacunas.filter(
    (l) => l.tipo === 'entre-blocos' && (l.deslocamento?.minutos ?? null) === null,
  ).length;

  const minutosLivres = lacunas.reduce(
    (soma, l) => soma + Math.max(0, l.minutosLivres ?? 0),
    0,
  );

  const minutosEmFalta = lacunas.reduce((soma, l) => soma + l.faltamMin, 0);

  return {
    dia,
    blocos,
    lacunas,
    sobreposicoes,
    minutosEmAtividades,
    minutosEmDeslocamento,
    trajetosSemDados,
    minutosLivres,
    minutosEmFalta,
  };
}
