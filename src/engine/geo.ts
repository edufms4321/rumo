import type { Coord } from '../schema/base.ts';

const RAIO_DA_TERRA_KM = 6371;

function emRadianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/**
 * Distancia em linha reta sobre a superficie (haversine).
 * E o chao da camada 3 do estimador: nunca e a distancia que se percorre,
 * por isso sempre sai multiplicada por um fator de rota e rotulada como
 * estimativa na interface.
 */
export function distanciaKm(a: Coord, b: Coord): number {
  const dLat = emRadianos(b.lat - a.lat);
  const dLng = emRadianos(b.lng - a.lng);
  const lat1 = emRadianos(a.lat);
  const lat2 = emRadianos(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "850 m", "2,1 km", "361 km" — sempre em pt-BR. */
export function formatarKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  return `${Math.round(km).toLocaleString('pt-BR')} km`;
}
