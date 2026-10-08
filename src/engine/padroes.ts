/**
 * Padroes do motor: os numeros que o app usa quando o banco NAO tem o dado.
 *
 * Este arquivo e deliberadamente separado de /data. Nada aqui tem fonte - sao
 * heuristicas de planejamento. Por isso tudo que passa por eles sai da
 * interface rotulado como ESTIMATIVA, com a conta aberta para o usuario ver.
 *
 * A alternativa seria gravar esses numeros dentro do banco, onde ficariam
 * indistinguiveis de dado com fonte. Preferimos a estimativa que se declara.
 */
import type { Modal } from '../schema/base.ts';

export interface FatorDeModal {
  /** Velocidade media porta a porta, ja descontando esperas tipicas. */
  kmh: number;
  /** Quanto o caminho real excede a linha reta (ruas, contornos, agua). */
  fatorRota: number;
}

/**
 * Usados quando a cidade nao declara `fatoresDeslocamento`.
 * Valores de cidade latino-americana media; cidade pesquisada a fundo
 * sobrescreve com os proprios.
 */
export const FATORES_PADRAO: Record<Modal, FatorDeModal> = {
  'a-pe': { kmh: 4.5, fatorRota: 1.3 },
  bicicleta: { kmh: 12, fatorRota: 1.25 },
  'carro-app': { kmh: 20, fatorRota: 1.4 },
  'transporte-publico': { kmh: 13, fatorRota: 1.55 },
  'veiculo-alugado': { kmh: 20, fatorRota: 1.4 },
  'carro-fretado': { kmh: 60, fatorRota: 1.3 },
  onibus: { kmh: 50, fatorRota: 1.35 },
  barco: { kmh: 25, fatorRota: 1.1 },
  voo: { kmh: 700, fatorRota: 1.05 },
};

/**
 * Quando o aeroporto nao declara o numero. Compativel com o que as companhias
 * recomendam na Colombia (2 h domestico, 3 h internacional de antecedencia),
 * mas sem fonte citavel por aeroporto - por isso vive aqui, nao no banco.
 */
export const PADROES_DE_AEROPORTO = {
  tempoAoCentroMin: 45,
  antecedenciaDomesticaMin: 90,
  antecedenciaInternacionalMin: 180,
  desembarqueDomesticoMin: 30,
  desembarqueInternacionalMin: 75,
} as const;

/**
 * Abaixo desta distancia, ir a pe e o padrao. Acima, carro de app.
 * 1,2 km a 4,5 km/h da uns 16 min de caminhada - o limite em que a maioria
 * das pessoas ainda prefere andar.
 */
export const LIMITE_A_PE_KM = 1.2;

/** Acima disto, duas paradas no mesmo dia viram viagem entre cidades. */
export const LIMITE_INTRA_CIDADE_KM = 60;

/**
 * Ritmo do viajante -> teto de horas ocupadas num dia antes de o app avisar
 * que o dia esta cheio demais. Nao impede nada: so avisa.
 */
export const HORAS_OCUPADAS_POR_RITMO = {
  tranquilo: 6,
  equilibrado: 9,
  intenso: 12,
} as const;

/** Horas de sono abaixo das quais o app avisa. */
export const MINIMO_DE_SONO_HORAS = 6;

/**
 * Janelas em que o app espera encontrar uma refeicao no dia.
 * Usadas pela regra "dia sem refeicao prevista".
 */
export const JANELAS_DE_REFEICAO = {
  almoco: { inicio: 11 * 60, fim: 15 * 60 },
  jantar: { inicio: 18 * 60, fim: 22 * 60 + 30 },
} as const;
