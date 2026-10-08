/**
 * MELHORIA 10 — cambio automatico com trava manual.
 *
 * Fica FORA de src/engine/ de proposito: o motor e puro e nao faz rede.
 * Aqui dentro pode falhar, e falhar e o caso normal — viagem se planeja em
 * aviao, em hotel com wi-fi ruim, offline.
 *
 * Regras:
 * - se o usuario travou a taxa (`manual: true`), nada sobrescreve;
 * - se a rede falhar, mantem a taxa que ja estava e diz por que nao atualizou;
 * - a taxa buscada vem sempre com a data, que a interface mostra ao lado.
 *
 * Fonte: open.er-api.com, publica e sem chave. Se sair do ar, o app continua
 * funcionando com a taxa digitada a mao — nenhuma funcionalidade depende disto.
 */
import type { Cambio } from '../schema/viagem.ts';

const ENDERECO = 'https://open.er-api.com/v6/latest/BRL';
const TEMPO_LIMITE_MS = 6000;

export interface ResultadoDoCambio {
  cambio: Cambio;
  atualizou: boolean;
  /** Frase para a interface: por que atualizou, ou por que nao. */
  explicacao: string;
}

interface RespostaDaApi {
  result?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
}

/**
 * @param moedas codigos ISO que interessam, ex.: ['COP', 'MXN', 'USD'].
 */
export async function buscarCambio(
  atual: Cambio,
  moedas: readonly string[],
  buscar: typeof fetch = fetch,
): Promise<ResultadoDoCambio> {
  if (atual.manual) {
    return {
      cambio: atual,
      atualizou: false,
      explicacao: 'Voce travou o cambio a mao; o app nao sobrescreve.',
    };
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await buscar(ENDERECO, { signal: controle.signal });
    if (!resposta.ok) {
      return {
        cambio: atual,
        atualizou: false,
        explicacao: `A cotacao nao respondeu (HTTP ${resposta.status}). Mantida a taxa de ${atual.atualizadoEm}.`,
      };
    }

    const dados = (await resposta.json()) as RespostaDaApi;
    if (dados.result !== 'success' || !dados.rates) {
      return {
        cambio: atual,
        atualizou: false,
        explicacao: `A cotacao veio incompleta. Mantida a taxa de ${atual.atualizadoEm}.`,
      };
    }

    // A API devolve quanto vale 1 BRL em cada moeda; o app guarda o inverso,
    // quantos BRL vale 1 unidade da moeda.
    const taxas: Record<string, number> = { ...atual.taxas };
    const atualizadas: string[] = [];
    for (const moeda of moedas) {
      const porBrl = dados.rates[moeda];
      if (typeof porBrl === 'number' && porBrl > 0) {
        taxas[moeda] = 1 / porBrl;
        atualizadas.push(moeda);
      }
    }

    if (atualizadas.length === 0) {
      return {
        cambio: atual,
        atualizou: false,
        explicacao: `A cotacao nao trouxe nenhuma das moedas pedidas. Mantida a taxa de ${atual.atualizadoEm}.`,
      };
    }

    const data = (dados.time_last_update_utc ? new Date(dados.time_last_update_utc) : new Date())
      .toISOString()
      .slice(0, 10);

    return {
      cambio: { taxas, atualizadoEm: data, manual: false },
      atualizou: true,
      explicacao: `Cotacao de ${data} para ${atualizadas.join(', ')}.`,
    };
  } catch (erro) {
    const motivo =
      erro instanceof Error && erro.name === 'AbortError'
        ? 'demorou demais para responder'
        : 'nao foi possivel alcancar a cotacao';
    return {
      cambio: atual,
      atualizou: false,
      explicacao: `A cotacao ${motivo}. Mantida a taxa de ${atual.atualizadoEm}.`,
    };
  } finally {
    clearTimeout(relogio);
  }
}

/** Trava a taxa atual para o app parar de atualizar sozinho. */
export function travarCambio(cambio: Cambio): Cambio {
  return { ...cambio, manual: true };
}

export function destravarCambio(cambio: Cambio): Cambio {
  return { ...cambio, manual: false };
}
