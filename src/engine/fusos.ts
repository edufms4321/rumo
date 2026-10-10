/**
 * Fuso horario por cidade-base.
 *
 * A agenda e hora de parede (minutos desde a meia-noite local do dia) e vai
 * continuar sendo: sem Date, sem biblioteca, sem aritmetica de fuso dentro do
 * resolvedor. O que este modulo faz e dizer DE QUEM e esse relogio e traduzir
 * um horario de um relogio para outro quando o dia atravessa um fuso.
 *
 * A regra, escrita em um lugar so para nao divergir:
 *
 *   o relogio do dia e o relogio da cidade-base do dia.
 *
 * `startMin` de um bloco e, portanto, a posicao dele na linha do tempo DESSE
 * relogio — que e exatamente o que o arrastar grava. Nada de dado salvo muda
 * de significado por causa deste arquivo; o que ele acrescenta e a leitura
 * local de cada ponta de um trecho.
 *
 * Por que isso importa: Cancun (UTC-5) e Valladolid (UTC-6) estao a 150 km e
 * uma hora de distancia. Um onibus que sai 11h de Cancun e leva 2h30 chega
 * 12h30 em Valladolid, nao 13h30. Sem este modulo o app erraria a chegada em
 * uma hora inteira — e erraria para MENOS, que e o lado perigoso: o viajante
 * acharia que tem folga que nao tem.
 */
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Bloco, Dia, Viagem } from '../schema/viagem.ts';
import { formatarDuracao, paraHHMM } from './tempo.ts';

/**
 * Offset da cidade. Quando a cidade nao declara o seu, vale o fuso principal
 * do destino: a maioria dos paises tem um so, e declarar em cada cidade seria
 * repetir o mesmo numero dezenas de vezes.
 */
export function offsetDaCidade(pacote: PacoteDestino, cidadeId: string | undefined): number {
  const cidade = cidadeId ? pacote.cidades.find((c) => c.id === cidadeId) : undefined;
  return cidade?.fusoOffsetMinutos ?? pacote.destino.fusoOffsetMinutos;
}

/** O relogio em que a linha do tempo deste dia esta desenhada. */
export function offsetDoDia(pacote: PacoteDestino, dia: Dia): number {
  return offsetDaCidade(pacote, dia.cidadeBaseId);
}

/**
 * O mesmo instante, lido em outro relogio. Pode passar de 1440 ou ficar
 * negativo: quem formata resolve o transbordo (`formatarMomento`).
 */
export function converterRelogio(minutos: number, deOffset: number, paraOffset: number): number {
  return minutos + (paraOffset - deOffset);
}

/**
 * Selo curto da diferenca entre dois fusos: "-1 h", "+30 min", "" quando sao
 * o mesmo. O sinal e do ponto de vista de quem viaja: negativo = o relogio
 * local atrasa, o viajante ganha a hora de volta.
 */
export function seloDeFuso(diferencaMinutos: number): string {
  if (diferencaMinutos === 0) return '';
  const sinal = diferencaMinutos > 0 ? '+' : '-';
  return `${sinal}${formatarDuracao(Math.abs(diferencaMinutos))}`;
}

/** "1 h a frente", "30 min atras", "mesmo horario". */
export function frasedeFuso(diferencaMinutos: number): string {
  if (diferencaMinutos === 0) return 'mesmo horario';
  const quanto = formatarDuracao(Math.abs(diferencaMinutos));
  return diferencaMinutos > 0 ? `${quanto} a frente` : `${quanto} atras`;
}

export interface PontaDoTrecho {
  cidadeId: string;
  cidadeNome: string;
  /** Minuto no relogio DAQUELA cidade. */
  localMin: number;
  hhmm: string;
  offsetMinutos: number;
}

export interface HorariosDoTrecho {
  saida: PontaDoTrecho;
  chegada: PontaDoTrecho;
  /** Offset da chegada menos o da saida. Negativo = o relogio atrasa. */
  diferencaMinutos: number;
  /** Duracao real, de porta a porta. Nunca uma diferenca de relogio. */
  duracaoMin: number;
  mudaDeFuso: boolean;
}

/**
 * Horarios das duas pontas de um trecho, cada uma no seu proprio relogio.
 *
 * `offsetChegadaMinutos` do bloco tem precedencia sobre o fuso da cidade:
 * o campo existe no schema desde o inicio para o voo internacional, cujo
 * aeroporto de chegada pode nem estar no pacote. Era dado morto; agora
 * alimenta a tela em vez de virar um segundo campo com o mesmo nome.
 */
export function horariosDoTrecho(
  pacote: PacoteDestino,
  bloco: Extract<Bloco, { tipo: 'trecho' }>,
  offsetDoQuadro: number,
): HorariosDoTrecho {
  const nome = (id: string) => pacote.cidades.find((c) => c.id === id)?.nome ?? id;

  const offsetSaida = offsetDaCidade(pacote, bloco.deCidadeId);
  const offsetChegada = bloco.offsetChegadaMinutos ?? offsetDaCidade(pacote, bloco.paraCidadeId);

  const saidaLocal = converterRelogio(bloco.startMin, offsetDoQuadro, offsetSaida);
  const chegadaLocal = converterRelogio(
    bloco.startMin + bloco.durationMin,
    offsetDoQuadro,
    offsetChegada,
  );

  return {
    saida: {
      cidadeId: bloco.deCidadeId,
      cidadeNome: nome(bloco.deCidadeId),
      localMin: saidaLocal,
      hhmm: paraHHMM(saidaLocal),
      offsetMinutos: offsetSaida,
    },
    chegada: {
      cidadeId: bloco.paraCidadeId,
      cidadeNome: nome(bloco.paraCidadeId),
      localMin: chegadaLocal,
      hhmm: paraHHMM(chegadaLocal),
      offsetMinutos: offsetChegada,
    },
    diferencaMinutos: offsetChegada - offsetSaida,
    duracaoMin: bloco.durationMin,
    mudaDeFuso: offsetChegada !== offsetSaida,
  };
}

export interface MudancaDeFuso {
  /** De onde vinha o relogio: o dia anterior com base definida. */
  deCidadeNome: string;
  paraCidadeNome: string;
  diferencaMinutos: number;
}

/**
 * O dia mudou de fuso em relacao ao ultimo dia com cidade-base?
 *
 * Olha para tras pulando dias sem base: um dia sem onde dormir nao zera o
 * relogio do viajante, so nao foi preenchido ainda.
 */
export function mudancaDeFusoNoDia(
  viagem: Viagem,
  pacote: PacoteDestino,
  diaId: string,
): MudancaDeFuso | undefined {
  const indice = viagem.dias.findIndex((d) => d.id === diaId);
  const dia = viagem.dias[indice];
  if (indice < 0 || !dia?.cidadeBaseId) return undefined;

  for (let i = indice - 1; i >= 0; i--) {
    const anterior = viagem.dias[i];
    if (!anterior?.cidadeBaseId) continue;
    const de = offsetDaCidade(pacote, anterior.cidadeBaseId);
    const para = offsetDaCidade(pacote, dia.cidadeBaseId);
    if (de === para) return undefined;
    const nome = (id: string) => pacote.cidades.find((c) => c.id === id)?.nome ?? id;
    return {
      deCidadeNome: nome(anterior.cidadeBaseId),
      paraCidadeNome: nome(dia.cidadeBaseId),
      diferencaMinutos: para - de,
    };
  }
  return undefined;
}

/**
 * Diferenca do relogio do dia para o de casa. `undefined` quando a viagem
 * nao sabe o fuso de casa — e nao sabe de verdade: o campo e opcional e
 * chutar -180 para todo mundo seria inventar um dado do usuario.
 */
export function diferencaParaCasa(
  viagem: Viagem,
  pacote: PacoteDestino,
  dia: Dia,
): number | undefined {
  const casa = viagem.origem.fusoOffsetMinutos;
  if (casa === undefined) return undefined;
  return offsetDoDia(pacote, dia) - casa;
}
