/**
 * Primitivos da conversao pesquisa -> banco.
 *
 * Regra geral: campo vazio na pesquisa continua vazio aqui. Nada e preenchido
 * por conveniencia. O que o script DEDUZ do texto passa por `derivado()` e
 * aparece no relatorio final, para ninguem confundir inferencia com fonte.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type Json = Record<string, any>;

/** Data da onda A da pesquisa. */
export const COLETADO_EM = '2026-10-08';

export const RE_URL = /^https?:\/\/[^\s]+$/;

export const avisos: string[] = [];
const derivacoes = new Map<string, number>();

export function derivado(rotulo: string): void {
  derivacoes.set(rotulo, (derivacoes.get(rotulo) ?? 0) + 1);
}

export function relatorioDeDerivacoes(): Array<[string, number]> {
  return [...derivacoes].sort((a, b) => b[1] - a[1]);
}

export function gravar(pastaDeSaida: string, arquivo: string, conteudo: unknown): void {
  const caminho = join(pastaDeSaida, arquivo);
  mkdirSync(resolve(caminho, '..'), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(conteudo, null, 2)}\n`);
  const n = Array.isArray(conteudo) ? conteudo.length : 1;
  console.log(`  ${arquivo.padEnd(28)} ${String(n).padStart(4)} registro(s)`);
}

export function slug(texto: string, limite = 52): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, limite)
    .replace(/-+$/g, '');
}

/** Aceita lista de URLs em texto ou de objetos; descarta o que nao e http(s). */
export function fontes(bruto: unknown): Array<{ url: string }> {
  const lista = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];
  const urls = new Set<string>();
  for (const f of lista) {
    const url = typeof f === 'string' ? f : (f as Json)?.url;
    if (typeof url === 'string' && RE_URL.test(url.trim())) urls.add(url.trim());
  }
  return [...urls].map((url) => ({ url }));
}

const CONFIANCA_VALIDA = new Set(['verificado', 'parcial', 'estimado']);

/**
 * A pesquisa as vezes devolve o enum ("parcial"), as vezes prosa
 * ("alta para os normais; media para o risco de furacao"). Na prosa tomamos o
 * nivel MAIS FRACO citado e preservamos o texto, para nao arredondar
 * incerteza para cima.
 */
export function confianca(bruto: unknown): {
  confianca: string;
  observacaoDeConfianca?: string;
} {
  const texto = String(bruto ?? '').trim();
  if (CONFIANCA_VALIDA.has(texto)) return { confianca: texto };
  if (!texto) {
    derivado('confianca ausente tratada como estimado');
    return { confianca: 'estimado', observacaoDeConfianca: 'a fonte nao declarou confianca' };
  }
  const t = texto.toLowerCase();
  let nivel = 'parcial';
  if (/baixa|estimad/.test(t)) nivel = 'estimado';
  else if (/media|média|parcial/.test(t)) nivel = 'parcial';
  else if (/alta|verificad/.test(t)) nivel = 'verificado';
  derivado('confianca em prosa mapeada para o nivel mais fraco citado');
  return { confianca: nivel, observacaoDeConfianca: texto.slice(0, 600) };
}

// ------------------------------------------------------------------ horarios

export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const RE_HHMM =
  /\b([01]?\d|2[0-3])[:h]([0-5]\d)\s*(?:–|—|-|\ba\b|\bas\b|\bàs\b)\s*([01]?\d|2[0-3])[:h]([0-5]\d)/g;
const RE_HH = /\b([01]?\d|2[0-3])\s*h\s*(?:–|—|-|\ba\b)\s*([01]?\d|2[0-3])\s*h\b/g;
const RE_FECHADO = /\bfechado\b|\bcerrado\b|\bclosed\b/i;
const RE_24H = /\b24\s*h\b|\b24\s*horas\b/i;

function dd(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Le janelas de funcionamento de um texto em prosa.
 * Janela que atravessa a meia-noite (ex.: 22h-3h) e descartada, porque o
 * schema exige abre < fecha. O texto fica na observacao, entao nada se perde.
 */
export function janelasDe(texto: string): Array<{ abre: string; fecha: string }> {
  const janelas: Array<{ abre: string; fecha: string }> = [];

  for (const m of texto.matchAll(RE_HHMM)) {
    const abre = `${dd(Number(m[1]))}:${m[2]}`;
    const fecha = `${dd(Number(m[3]))}:${m[4]}`;
    if (abre < fecha) janelas.push({ abre, fecha });
  }
  if (janelas.length === 0) {
    for (const m of texto.matchAll(RE_HH)) {
      const abre = `${dd(Number(m[1]))}:00`;
      const fecha = `${dd(Number(m[2]))}:00`;
      if (abre < fecha) janelas.push({ abre, fecha });
    }
  }

  const vistas = new Set<string>();
  return janelas.filter((j) => {
    const chave = `${j.abre}-${j.fecha}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/**
 * Duas janelas que se sobrepoem no mesmo dia nao sao "manha e tarde": sao
 * DUAS FONTES DISCORDANDO do mesmo horario (ex.: "08:00-17:15 (El Universal)
 * ou 08:30-17:30"). Tratar como dois periodos faria o motor concluir que o
 * lugar abre das 08:00 as 17:30, que nenhuma fonte afirma.
 *
 * Mantemos a PRIMEIRA janela, que e a que a pesquisa citou como principal, e
 * sinalizamos o conflito para virar alerta no item.
 */
function resolverConflitos(janelas: Array<{ abre: string; fecha: string }>): {
  janelas: Array<{ abre: string; fecha: string }>;
  conflito: boolean;
} {
  const mantidas: Array<{ abre: string; fecha: string }> = [];
  let conflito = false;

  for (const janela of janelas) {
    const sobrepoe = mantidas.some((m) => janela.abre < m.fecha && m.abre < janela.fecha);
    if (sobrepoe) {
      conflito = true;
      derivado('janelas sobrepostas tratadas como fontes divergentes: mantida a primeira');
      continue;
    }
    mantidas.push(janela);
  }
  return { janelas: mantidas, conflito };
}

/**
 * Janelas que a pesquisa ja gravou estruturadas: `[{ abre, fecha }]` ou um
 * `{ abre, fecha }` solto. Devolve vazio para qualquer outra coisa, e quem
 * chama cai no caminho da prosa.
 *
 * A mesma regra do parser de prosa vale aqui: janela que atravessa a
 * meia-noite e descartada, porque o schema exige abre < fecha.
 */
export function janelasEstruturadas(valor: unknown): Array<{ abre: string; fecha: string }> {
  const lista = Array.isArray(valor) ? valor : [valor];
  const janelas: Array<{ abre: string; fecha: string }> = [];

  for (const bruta of lista) {
    if (!bruta || typeof bruta !== 'object') continue;
    const j = bruta as Record<string, unknown>;
    const abre = typeof j.abre === 'string' ? j.abre : undefined;
    const fecha = typeof j.fecha === 'string' ? j.fecha : undefined;
    if (!abre || !fecha) continue;
    if (!RE_HORA_EXATA.test(abre) || !RE_HORA_EXATA.test(fecha)) continue;
    if (abre >= fecha) continue;
    janelas.push({ abre, fecha });
  }

  const vistas = new Set<string>();
  return janelas.filter((j) => {
    const chave = `${j.abre}-${j.fecha}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

const RE_HORA_EXATA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function converterHorarios(bruto: unknown): {
  horarios?: Json;
  horariosObservacao?: string;
  conflitoDeHorario?: boolean;
} {
  if (!bruto || typeof bruto !== 'object') return {};
  const entrada = bruto as Record<string, unknown>;
  const horarios: Json = {};
  const prosas = new Set<string>();
  let houveConflito = false;

  for (const dia of DIAS) {
    const valor = entrada[dia];
    if (valor === undefined || valor === null || valor === '') continue;

    /*
      A pesquisa grava o horario de duas formas, e as duas sao legitimas:
      prosa ("09:00-12:30 e 14:30-19:00") e estruturada
      ([{ abre, fecha }]). A primeira versao desta funcao fazia
      `String(valor)` em cima das duas; na forma estruturada isso da
      "[object Object]", nenhum HH:MM casa, o dia sai AUSENTE e a
      observacao do item fica com a string "[object Object]" gravada em
      /data. Nove itens da onda da Bahia perderam o horario assim, em
      silencio, e o pacote inteiro do Nordeste ficou com 4 itens com
      horario em 459. Agora a forma estruturada entra direto.
    */
    const estruturadas = janelasEstruturadas(valor);
    if (estruturadas.length > 0) {
      const { janelas, conflito } = resolverConflitos(estruturadas);
      if (conflito) houveConflito = true;
      if (janelas.length > 0) {
        horarios[dia] = janelas;
        prosas.add(janelas.map((j) => `${j.abre}-${j.fecha}`).join(' e '));
      }
      continue;
    }

    const texto = String(valor).trim();
    if (!texto || texto === '[object Object]') continue;
    prosas.add(texto);

    const brutas = janelasDe(texto);
    if (RE_FECHADO.test(texto) && brutas.length === 0) {
      horarios[dia] = 'fechado';
      continue;
    }
    if (RE_24H.test(texto) && brutas.length === 0) {
      horarios[dia] = '24h';
      continue;
    }
    const { janelas, conflito } = resolverConflitos(brutas);
    if (conflito) houveConflito = true;
    if (janelas.length > 0) {
      horarios[dia] = janelas;
      derivado('janela de horario lida de texto em prosa');
    }
    // Sem HH:MM legivel o dia fica AUSENTE, que no schema significa
    // "desconhecido" e nao "fechado": o motor cala em vez de alertar errado.
  }

  const observacao = [...prosas].join(' | ').slice(0, 900);
  return {
    horarios: Object.keys(horarios).length > 0 ? horarios : undefined,
    horariosObservacao: observacao || undefined,
    ...(houveConflito ? { conflitoDeHorario: true } : {}),
  };
}

// --------------------------------------------------------------------- preco

export function converterPreco(bruto: unknown): { preco?: Json; alerta?: string } {
  if (!bruto || typeof bruto !== 'object') return {};
  const p = bruto as Json;
  const min = Number(p.min ?? 0);
  let max = Number(p.max ?? 0);

  if (!Number.isFinite(min) || !Number.isFinite(max) || (min === 0 && max === 0)) {
    return { alerta: 'preco nao encontrado em fonte confiavel; confirmar no local' };
  }
  if (max < min) {
    max = min;
    derivado('preco com max menor que min corrigido para max = min');
  }

  const extras = [
    typeof p.observacao === 'string' ? p.observacao : '',
    p.menorSoIda ? `menor so-ida observado: ${p.menorSoIda}` : '',
    typeof p.tipo === 'string' ? `tipo: ${p.tipo}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    preco: {
      moeda: p.moeda || 'COP',
      min,
      max,
      por: p.por === 'grupo' ? 'grupo' : 'pessoa',
      inclui: String(p.inclui ?? ''),
      coletadoEm: p.coletadoEm || COLETADO_EM,
      fontes: fontes(p.fontes),
      ...(extras ? { observacao: extras.slice(0, 600) } : {}),
    },
  };
}

// ------------------------------------------------------------ mescla manual

/**
 * Mescla profunda usada pelos ajustes manuais. `null` no patch apaga a chave.
 * Lista no patch substitui a lista inteira (nao concatena), porque meio-termo
 * em lista costuma produzir dado duplicado silencioso.
 */
export function mesclar(alvo: Json, patch: Json): Json {
  const saida: Json = { ...alvo };
  for (const [chave, valor] of Object.entries(patch)) {
    if (valor === null) {
      delete saida[chave];
    } else if (
      valor &&
      typeof valor === 'object' &&
      !Array.isArray(valor) &&
      saida[chave] &&
      typeof saida[chave] === 'object' &&
      !Array.isArray(saida[chave])
    ) {
      saida[chave] = mesclar(saida[chave], valor);
    } else {
      saida[chave] = valor;
    }
  }
  return saida;
}

/**
 * Remove registros sem nenhuma fonte, com aviso.
 * O validador tambem reprovaria, mas o lugar certo de barrar e aqui: o banco
 * nunca recebe registro sem procedencia, e o achado vai para as pendencias.
 * Caso real da onda A: "nao existe voo direto Brasil -> San Andres" e um
 * achado negativo honesto, nao um registro de rota.
 */
export function filtrarSemFonte(lista: Json[], rotulo: string): Json[] {
  return lista.filter((registro) => {
    if ((registro.fontes ?? []).length > 0) return true;
    avisos.push(
      `${rotulo} "${registro.nome ?? registro.id ?? '(sem nome)'}" sem nenhuma fonte: fora do banco`,
    );
    return false;
  });
}
