/**
 * Estimador de deslocamento entre dois pontos.
 *
 * Duas exigencias do produto governam este arquivo:
 * 1. e AUTOMATICO: o usuario arrasta uma atividade e o trajeto aparece;
 * 2. e DIDATICO: nenhum numero cai do ceu. Todo resultado traz `resumo`
 *    (uma frase) e `passos` (a conta aberta), dizendo quais parcelas vieram
 *    de fonte e quais o motor estimou.
 *
 * Camadas, da melhor para a pior:
 *   trecho-entre-cidades   duracao porta a porta escrita no banco, com fonte
 *   trecho-calculado       duracao do veiculo + padroes de aeroporto
 *   matriz-da-cidade       par medido e escrito no banco para aquela cidade
 *   estimativa             linha reta x fator de rota / velocidade do modal
 *   sem-dados              falta coordenada: o motor se cala em vez de chutar
 */
import type { Confianca, Coord, Fonte, Modal } from '../schema/base.ts';
import type { Aeroporto, CidadeBase } from '../schema/geo.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { TrechoEntreCidades } from '../schema/transporte.ts';
import { distanciaKm, formatarKm } from './geo.ts';
import {
  FATORES_PADRAO,
  type FatorDeModal,
  LIMITE_A_PE_KM,
  PADROES_DE_AEROPORTO,
} from './padroes.ts';
import { formatarDuracao } from './tempo.ts';

export type CamadaDeDeslocamento =
  | 'informado-pelo-usuario'
  | 'trecho-entre-cidades'
  | 'trecho-calculado'
  | 'matriz-da-cidade'
  | 'estimativa'
  | 'sem-dados';

export interface PassoDoCalculo {
  rotulo: string;
  valor: string;
  /** true quando a parcela nao veio de fonte. */
  estimado: boolean;
}

export interface Deslocamento {
  /** null quando o motor nao tem como estimar. */
  minutos: number | null;
  modal: Modal;
  camada: CamadaDeDeslocamento;
  confianca: Confianca;
  /** Frase pronta para o bloco na linha do tempo. */
  resumo: string;
  /** A conta aberta, para o usuario abrir e conferir. */
  passos: PassoDoCalculo[];
  fontes: Fonte[];
  avisos: string[];
  entreCidades: boolean;
}

/** Uma ponta do deslocamento. */
export interface Ponto {
  nome: string;
  cidadeId: string;
  coords?: Coord;
  /** id do item, para casar com a matriz interna da cidade. */
  itemId?: string;
  /** Ancora reservada: hospedagem, aeroporto, centro, porto, terminal-de-onibus. */
  ancora?: string;
}

export interface ContextoDeDeslocamento {
  pacote: PacoteDestino;
  /** Escolha do usuario para esta lacuna. */
  modalEscolhido?: Modal;
  /** Minutos informados a mao: vencem tudo. */
  minutosManuais?: number;
}

const NOME_DO_MODAL: Record<Modal, string> = {
  'a-pe': 'a pe',
  bicicleta: 'de bicicleta',
  'carro-app': 'de carro de app',
  'transporte-publico': 'de transporte publico',
  'veiculo-alugado': 'com o veiculo alugado',
  'carro-fretado': 'de carro',
  onibus: 'de onibus',
  barco: 'de barco',
  voo: 'de aviao',
};

function acharCidade(pacote: PacoteDestino, id: string): CidadeBase | undefined {
  return pacote.cidades.find((c) => c.id === id);
}

function acharAeroporto(pacote: PacoteDestino, cidade: CidadeBase | undefined): Aeroporto | undefined {
  const iata = cidade?.aeroportos[0];
  return iata ? pacote.aeroportos.find((a) => a.iata === iata) : undefined;
}

function fatorDoModal(cidade: CidadeBase | undefined, modal: Modal): {
  fator: FatorDeModal;
  daCidade: boolean;
} {
  const tabela = cidade?.fatoresDeslocamento;
  if (tabela && modal in tabela) {
    const fator = (tabela as Record<string, FatorDeModal | undefined>)[modal];
    if (fator) return { fator, daCidade: true };
  }
  return { fator: FATORES_PADRAO[modal], daCidade: false };
}

/** Modal padrao dentro da cidade, escolhido pela distancia. */
export function modalPadrao(km: number): Modal {
  return km <= LIMITE_A_PE_KM ? 'a-pe' : 'carro-app';
}

function chaveDePonto(ponto: Ponto): string | undefined {
  return ponto.itemId ?? ponto.ancora;
}

function semDados(de: Ponto, para: Ponto, modal: Modal, motivo: string): Deslocamento {
  return {
    minutos: null,
    modal,
    camada: 'sem-dados',
    confianca: 'estimado',
    resumo: `Nao da para calcular o trajeto ate ${para.nome}: ${motivo}.`,
    passos: [],
    fontes: [],
    avisos: [`Sem coordenada para ${motivo.includes(de.nome) ? de.nome : para.nome}.`],
    entreCidades: de.cidadeId !== para.cidadeId,
  };
}

// --------------------------------------------------------------- entre cidades

function escolherTrecho(
  pacote: PacoteDestino,
  deId: string,
  paraId: string,
  modalEscolhido?: Modal,
): TrechoEntreCidades | undefined {
  const candidatos = pacote.trechos.filter(
    (t) =>
      (t.deCidadeId === deId && t.paraCidadeId === paraId) ||
      (t.deCidadeId === paraId && t.paraCidadeId === deId),
  );
  if (candidatos.length === 0) return undefined;

  if (modalEscolhido) {
    const doModal = candidatos.filter((t) => t.modal === modalEscolhido);
    if (doModal.length > 0) return maisRapido(doModal);
  }
  return maisRapido(candidatos);
}

function duracaoConhecida(t: TrechoEntreCidades): number {
  return t.duracaoPortaAPortaMin ?? t.duracaoVeiculoMin ?? Number.POSITIVE_INFINITY;
}

function maisRapido(lista: TrechoEntreCidades[]): TrechoEntreCidades {
  return lista.reduce((a, b) => (duracaoConhecida(b) < duracaoConhecida(a) ? b : a));
}

function entreCidadesComTrecho(
  trecho: TrechoEntreCidades,
  de: Ponto,
  para: Ponto,
  pacote: PacoteDestino,
): Deslocamento {
  const modal = trecho.modal;
  const cidadeDestino = acharCidade(pacote, para.cidadeId);

  if (trecho.duracaoPortaAPortaMin) {
    return {
      minutos: trecho.duracaoPortaAPortaMin,
      modal,
      camada: 'trecho-entre-cidades',
      confianca: trecho.confianca,
      resumo: `${formatarDuracao(trecho.duracaoPortaAPortaMin)} ${NOME_DO_MODAL[modal]} ate ${
        cidadeDestino?.nome ?? para.cidadeId
      }, porta a porta.`,
      passos: [
        {
          rotulo: 'duracao porta a porta do banco',
          valor: formatarDuracao(trecho.duracaoPortaAPortaMin),
          estimado: trecho.confianca === 'estimado',
        },
      ],
      fontes: trecho.fontes,
      avisos: trecho.alertas,
      entreCidades: true,
    };
  }

  // So temos a duracao do veiculo: o motor soma o resto e avisa.
  const veiculo = trecho.duracaoVeiculoMin ?? 0;
  const passos: PassoDoCalculo[] = [
    {
      rotulo: modal === 'voo' ? 'tempo de voo' : 'tempo de viagem',
      valor: formatarDuracao(veiculo),
      estimado: false,
    },
  ];
  let total = veiculo;

  if (modal === 'voo') {
    const origem = acharAeroporto(pacote, acharCidade(pacote, de.cidadeId));
    const destino = acharAeroporto(pacote, cidadeDestino);

    const aoAeroporto = origem?.tempoAoCentroMin ?? PADROES_DE_AEROPORTO.tempoAoCentroMin;
    const antecedencia =
      origem?.antecedenciaDomesticaMin ?? PADROES_DE_AEROPORTO.antecedenciaDomesticaMin;
    const desembarque =
      destino?.desembarqueDomesticoMin ?? PADROES_DE_AEROPORTO.desembarqueDomesticoMin;
    const doAeroporto = destino?.tempoAoCentroMin ?? PADROES_DE_AEROPORTO.tempoAoCentroMin;

    passos.unshift(
      {
        rotulo: `ate o aeroporto${origem ? ` ${origem.iata}` : ''}`,
        valor: formatarDuracao(aoAeroporto),
        estimado: origem?.tempoAoCentroMin === undefined,
      },
      {
        rotulo: 'antecedencia de embarque',
        valor: formatarDuracao(antecedencia),
        estimado: origem?.antecedenciaDomesticaMin === undefined,
      },
    );
    passos.push(
      {
        rotulo: 'desembarque e bagagem',
        valor: formatarDuracao(desembarque),
        estimado: destino?.desembarqueDomesticoMin === undefined,
      },
      {
        rotulo: `do aeroporto${destino ? ` ${destino.iata}` : ''} ate a cidade`,
        valor: formatarDuracao(doAeroporto),
        estimado: destino?.tempoAoCentroMin === undefined,
      },
    );
    total = aoAeroporto + antecedencia + veiculo + desembarque + doAeroporto;
  }

  const algumEstimado = passos.some((p) => p.estimado);
  return {
    minutos: total,
    modal,
    camada: 'trecho-calculado',
    confianca: algumEstimado ? 'estimado' : trecho.confianca,
    resumo:
      modal === 'voo'
        ? `Cerca de ${formatarDuracao(total)} ate ${
            cidadeDestino?.nome ?? para.cidadeId
          }, somando ida ao aeroporto, antecedencia, ${formatarDuracao(
            veiculo,
          )} de voo, desembarque e traslado.`
        : `Cerca de ${formatarDuracao(total)} ${NOME_DO_MODAL[modal]} ate ${
            cidadeDestino?.nome ?? para.cidadeId
          }.`,
    passos,
    fontes: trecho.fontes,
    avisos: [
      ...trecho.alertas,
      ...(algumEstimado
        ? ['Partes desta conta sao padroes do app, nao dado do banco: confirme na hora de comprar.']
        : []),
    ],
    entreCidades: true,
  };
}

// ------------------------------------------------------------------- publico

export function estimarDeslocamento(
  de: Ponto,
  para: Ponto,
  contexto: ContextoDeDeslocamento,
): Deslocamento {
  const { pacote, modalEscolhido, minutosManuais } = contexto;
  const entreCidades = de.cidadeId !== para.cidadeId;

  if (minutosManuais !== undefined) {
    const modal = modalEscolhido ?? 'carro-app';
    return {
      minutos: minutosManuais,
      modal,
      camada: 'informado-pelo-usuario',
      confianca: 'verificado',
      resumo: `${formatarDuracao(minutosManuais)} ${NOME_DO_MODAL[modal]} — tempo que voce informou.`,
      passos: [
        { rotulo: 'informado por voce', valor: formatarDuracao(minutosManuais), estimado: false },
      ],
      fontes: [],
      avisos: [],
      entreCidades,
    };
  }

  if (entreCidades) {
    const trecho = escolherTrecho(pacote, de.cidadeId, para.cidadeId, modalEscolhido);
    if (trecho) return entreCidadesComTrecho(trecho, de, para, pacote);

    const cidadeA = acharCidade(pacote, de.cidadeId);
    const cidadeB = acharCidade(pacote, para.cidadeId);
    if (!cidadeA?.coords || !cidadeB?.coords) {
      return semDados(de, para, modalEscolhido ?? 'carro-fretado', 'nao ha trecho nem coordenada');
    }

    const modal = modalEscolhido ?? 'carro-fretado';
    const { fator } = fatorDoModal(undefined, modal);
    const km = distanciaKm(cidadeA.coords, cidadeB.coords);
    const kmReais = km * fator.fatorRota;
    const minutos = Math.round((kmReais / fator.kmh) * 60);

    return {
      minutos,
      modal,
      camada: 'estimativa',
      confianca: 'estimado',
      resumo: `Cerca de ${formatarDuracao(minutos)} ${NOME_DO_MODAL[modal]} de ${
        cidadeA.nome
      } a ${cidadeB.nome} — estimativa grosseira: nao ha trecho cadastrado entre as duas.`,
      passos: [
        { rotulo: 'distancia em linha reta', valor: formatarKm(km), estimado: false },
        {
          rotulo: 'fator de rota padrao do app',
          valor: `x ${fator.fatorRota.toLocaleString('pt-BR')}`,
          estimado: true,
        },
        { rotulo: 'distancia estimada', valor: formatarKm(kmReais), estimado: true },
        {
          rotulo: 'velocidade media considerada',
          valor: `${fator.kmh.toLocaleString('pt-BR')} km/h`,
          estimado: true,
        },
      ],
      fontes: [],
      avisos: [
        `Nenhum trecho cadastrado entre ${cidadeA.nome} e ${cidadeB.nome}. Este numero serve so para ver se o dia cabe, nao para comprar passagem.`,
      ],
      entreCidades: true,
    };
  }

  // ------------------------------------------------------- dentro da cidade
  const cidade = acharCidade(pacote, de.cidadeId);

  const chaveA = chaveDePonto(de);
  const chaveB = chaveDePonto(para);
  if (cidade && chaveA && chaveB) {
    const par = cidade.matrizInterna.find(
      (m) =>
        (m.de === chaveA && m.para === chaveB) || (m.de === chaveB && m.para === chaveA),
    );
    if (par && (!modalEscolhido || par.modal === modalEscolhido)) {
      const modal = (par.modal as Modal) ?? 'carro-app';
      return {
        minutos: par.minutos,
        modal,
        camada: 'matriz-da-cidade',
        confianca: cidade.confianca,
        resumo: `${formatarDuracao(par.minutos)} ${NOME_DO_MODAL[modal]} — trecho medido no banco.`,
        passos: [
          { rotulo: 'trecho medido no banco', valor: formatarDuracao(par.minutos), estimado: false },
        ],
        fontes: par.fontes,
        avisos: [],
        entreCidades: false,
      };
    }
  }

  if (!de.coords || !para.coords) {
    const semCoord = !de.coords ? de.nome : para.nome;
    return semDados(de, para, modalEscolhido ?? 'carro-app', `falta a coordenada de ${semCoord}`);
  }

  const km = distanciaKm(de.coords, para.coords);
  const modal = modalEscolhido ?? modalPadrao(km);
  const { fator, daCidade } = fatorDoModal(cidade, modal);
  const kmReais = km * fator.fatorRota;
  const minutos = Math.max(1, Math.round((kmReais / fator.kmh) * 60));

  return {
    minutos,
    modal,
    camada: 'estimativa',
    confianca: 'estimado',
    resumo: `Cerca de ${formatarDuracao(minutos)} ${NOME_DO_MODAL[modal]} — estimativa: ${formatarKm(
      km,
    )} em linha reta, x ${fator.fatorRota.toLocaleString('pt-BR')} do tracado real${
      daCidade && cidade ? ` de ${cidade.nome}` : ''
    }, a ${fator.kmh.toLocaleString('pt-BR')} km/h.`,
    passos: [
      { rotulo: 'distancia em linha reta', valor: formatarKm(km), estimado: false },
      {
        rotulo: daCidade && cidade ? `fator de rota de ${cidade.nome}` : 'fator de rota padrao',
        valor: `x ${fator.fatorRota.toLocaleString('pt-BR')}`,
        estimado: !daCidade,
      },
      { rotulo: 'distancia estimada', valor: formatarKm(kmReais), estimado: true },
      {
        rotulo: daCidade && cidade ? `velocidade media em ${cidade.nome}` : 'velocidade media padrao',
        valor: `${fator.kmh.toLocaleString('pt-BR')} km/h`,
        estimado: !daCidade,
      },
    ],
    fontes: [],
    avisos: daCidade
      ? []
      : ['Esta cidade ainda nao tem fatores de deslocamento proprios: o app usou o padrao.'],
    entreCidades: false,
  };
}
