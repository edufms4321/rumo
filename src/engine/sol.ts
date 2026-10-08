/**
 * Nascer e por do sol calculados a partir de coordenada e data.
 *
 * Por que calcular em vez de guardar no banco: o horario muda todo dia e com
 * a latitude. Guardar "anoitece as 17:45" seria verdade para uma data e
 * mentira para as outras - e a data da viagem e livre.
 *
 * Algoritmo solar padrao do NOAA, com o zenite de 90,833 graus que inclui a
 * refracao atmosferica e o raio aparente do Sol. Precisao de poucos minutos,
 * o bastante para a regra "esta atividade termina depois de escurecer".
 */
import type { Coord } from '../schema/base.ts';

const GRAUS = Math.PI / 180;
const ZENITE_OFICIAL = 90.833;

/** Dia do ano, 1 a 366, a partir de uma data AAAA-MM-DD. */
export function diaDoAno(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  if (!ano || !mes || !dia) throw new Error(`data invalida: ${dataIso}`);
  const inicio = Date.UTC(ano, 0, 1);
  const alvo = Date.UTC(ano, mes - 1, dia);
  return Math.round((alvo - inicio) / 86_400_000) + 1;
}

export interface LuzDoDia {
  /** Minutos desde a meia-noite local. */
  amanhecerMin: number;
  anoitecerMin: number;
  /** false quando o sol nao nasce ou nao se poe (latitudes polares). */
  temNoiteEDia: boolean;
}

/**
 * @param offsetMinutos offset fixo do fuso local, em minutos (Colombia: -300).
 */
export function luzDoDia(coord: Coord, dataIso: string, offsetMinutos: number): LuzDoDia {
  const n = diaDoAno(dataIso);

  // Angulo fracionario do ano, em radianos, no meio do dia.
  const g = ((2 * Math.PI) / 365) * (n - 1 + 0.5);

  const equacaoDoTempo =
    229.18 *
    (0.000_075 +
      0.001_868 * Math.cos(g) -
      0.032_077 * Math.sin(g) -
      0.014_615 * Math.cos(2 * g) -
      0.040_849 * Math.sin(2 * g));

  const declinacao =
    0.006_918 -
    0.399_912 * Math.cos(g) +
    0.070_257 * Math.sin(g) -
    0.006_758 * Math.cos(2 * g) +
    0.000_907 * Math.sin(2 * g) -
    0.002_697 * Math.cos(3 * g) +
    0.001_48 * Math.sin(3 * g);

  const lat = coord.lat * GRAUS;
  const cosHa =
    Math.cos(ZENITE_OFICIAL * GRAUS) / (Math.cos(lat) * Math.cos(declinacao)) -
    Math.tan(lat) * Math.tan(declinacao);

  // Sol de meia-noite ou noite polar: a regra de luz do dia nao se aplica.
  if (cosHa > 1 || cosHa < -1) {
    return { amanhecerMin: 0, anoitecerMin: 1440, temNoiteEDia: false };
  }

  const haGraus = Math.acos(cosHa) / GRAUS;

  const amanhecerUtc = 720 - 4 * (coord.lng + haGraus) - equacaoDoTempo;
  const anoitecerUtc = 720 - 4 * (coord.lng - haGraus) - equacaoDoTempo;

  return {
    amanhecerMin: Math.round(amanhecerUtc + offsetMinutos),
    anoitecerMin: Math.round(anoitecerUtc + offsetMinutos),
    temNoiteEDia: true,
  };
}
