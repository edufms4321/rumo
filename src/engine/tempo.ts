/**
 * Aritmetica de tempo da agenda. Tudo em MINUTOS inteiros desde a meia-noite
 * local do dia. Sem fuso, sem Date, sem biblioteca: a agenda e hora de parede.
 */

export const MINUTOS_POR_DIA = 1440;

export function paraMinutos(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`horario invalido: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Aceita minuto alem de 1440 e devolve a hora do dia seguinte. */
export function paraHHMM(minutos: number): string {
  const normalizado = ((Math.round(minutos) % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  const h = Math.floor(normalizado / 60);
  const m = normalizado % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Quantos dias o minuto passou da meia-noite do dia de referencia. */
export function diasDeTransbordo(minutos: number): number {
  return Math.floor(minutos / MINUTOS_POR_DIA);
}

/**
 * Texto de duracao para humano. "1 h 25 min", "45 min", "2 h".
 * Arredonda para minuto inteiro porque segundo nao significa nada aqui.
 */
export function formatarDuracao(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "14:30" ou "02:15 do dia seguinte". */
export function formatarMomento(minutos: number): string {
  const dias = diasDeTransbordo(minutos);
  const hora = paraHHMM(minutos);
  if (dias === 0) return hora;
  if (dias === 1) return `${hora} do dia seguinte`;
  return `${hora} em ${dias} dias`;
}

export interface Intervalo {
  inicio: number;
  fim: number;
}

export function intervaloDe(startMin: number, durationMin: number): Intervalo {
  return { inicio: startMin, fim: startMin + durationMin };
}

/** Dois intervalos se cruzam? Encostar nao conta: fim === inicio esta ok. */
export function seSobrepoem(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

export function minutosDeSobreposicao(a: Intervalo, b: Intervalo): number {
  return Math.max(0, Math.min(a.fim, b.fim) - Math.max(a.inicio, b.inicio));
}

/** Ordena por inicio e, em empate, pelo que termina primeiro. */
export function ordenarPorInicio<T extends { startMin: number; durationMin: number }>(
  blocos: readonly T[],
): T[] {
  return [...blocos].sort(
    (a, b) => a.startMin - b.startMin || a.startMin + a.durationMin - (b.startMin + b.durationMin),
  );
}
