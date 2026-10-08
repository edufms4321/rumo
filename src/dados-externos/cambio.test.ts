import { describe, expect, it } from 'vitest';
import type { Cambio } from '../schema/viagem.ts';
import { buscarCambio, destravarCambio, travarCambio } from './cambio.ts';

const ATUAL: Cambio = {
  taxas: { COP: 0.00155, USD: 5.4 },
  atualizadoEm: '2026-10-01',
  manual: false,
};

function respostaFalsa(corpo: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({
      ok,
      status,
      json: async () => corpo,
    }) as unknown as Response) as unknown as typeof fetch;
}

describe('melhoria 10: cambio automatico com trava manual', () => {
  it('nao sobrescreve taxa travada pelo usuario', async () => {
    const travado = travarCambio(ATUAL);
    const r = await buscarCambio(travado, ['COP'], respostaFalsa({ result: 'success', rates: { COP: 1000 } }));
    expect(r.atualizou).toBe(false);
    expect(r.cambio.taxas.COP).toBe(0.00155);
    expect(r.explicacao).toMatch(/travou o cambio a mao/);
  });

  it('converte a cotacao para "quantos BRL vale 1 unidade"', async () => {
    const r = await buscarCambio(
      destravarCambio(ATUAL),
      ['COP', 'MXN'],
      respostaFalsa({
        result: 'success',
        time_last_update_utc: 'Thu, 08 Oct 2026 00:00:01 +0000',
        rates: { COP: 800, MXN: 3.4 },
      }),
    );
    expect(r.atualizou).toBe(true);
    expect(r.cambio.taxas.COP).toBeCloseTo(1 / 800, 8);
    expect(r.cambio.taxas.MXN).toBeCloseTo(1 / 3.4, 6);
    expect(r.cambio.atualizadoEm).toBe('2026-10-08');
  });

  it('mantem a taxa anterior quando a rede falha, e diz por que', async () => {
    const quebrado: typeof fetch = (async () => {
      throw new Error('rede fora');
    }) as unknown as typeof fetch;
    const r = await buscarCambio(ATUAL, ['COP'], quebrado);
    expect(r.atualizou).toBe(false);
    expect(r.cambio).toEqual(ATUAL);
    expect(r.explicacao).toMatch(/Mantida a taxa de 2026-10-01/);
  });

  it('mantem a taxa anterior quando a resposta nao e 200', async () => {
    const r = await buscarCambio(ATUAL, ['COP'], respostaFalsa({}, false, 503));
    expect(r.atualizou).toBe(false);
    expect(r.explicacao).toMatch(/HTTP 503/);
  });

  it('mantem a taxa anterior quando a moeda pedida nao veio', async () => {
    const r = await buscarCambio(
      ATUAL,
      ['MXN'],
      respostaFalsa({ result: 'success', rates: { EUR: 0.16 } }),
    );
    expect(r.atualizou).toBe(false);
    expect(r.explicacao).toMatch(/nenhuma das moedas pedidas/);
  });

  it('preserva moedas que nao estavam no pedido', async () => {
    const r = await buscarCambio(
      ATUAL,
      ['MXN'],
      respostaFalsa({ result: 'success', rates: { MXN: 3.4 } }),
    );
    expect(r.cambio.taxas.USD).toBe(5.4);
  });
});
