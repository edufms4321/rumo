/**
 * Le a divisao administrativa pesquisada em `pesquisa/_divisoes/divisoes.json`
 * e devolve as colecoes `regioes` (macrorregiao do pais) e `estados`
 * (estado / departamento / provincia), mais o mapa cidade -> estado.
 *
 * Por que num arquivo de pesquisa e nao na configuracao do destino: a que
 * estado pertence Fernando de Noronha e um FATO, com fonte (IBGE), e fato
 * mora em /pesquisa junto com os outros. Configuracao e so o que a
 * ferramenta precisa saber para traduzir texto de agente.
 *
 * O arquivo e opcional. Sem ele o conversor cai no comportamento antigo
 * (um nivel de regiao so) em vez de quebrar.
 */
import { existsSync, readFileSync } from 'node:fs';

const CAMINHO = 'pesquisa/_divisoes/divisoes.json';

type Json = Record<string, any>;

export interface Divisoes {
  /** Macrorregioes que este pacote realmente usa, prontas para regioes.json. */
  regioes: Json[];
  /** Estados/departamentos/provincias usados, prontos para estados.json. */
  estados: Json[];
  /** cidade-base -> id do estado. */
  estadoDaCidade: Record<string, string>;
  /** cidade-base -> id da macrorregiao (derivado do estado). */
  regiaoDaCidade: Record<string, string>;
  avisos: string[];
}

const TIPOS = new Set(['estado', 'departamento', 'provincia', 'distrito', 'arquipelago']);

/**
 * @param destinoId id do pacote (a chave em `destinos` do arquivo)
 * @param bases cidades-base do pacote; so os estados delas entram no banco
 */
export function lerDivisoes(destinoId: string, bases: string[]): Divisoes | undefined {
  if (!existsSync(CAMINHO)) return undefined;

  const arquivo = JSON.parse(readFileSync(CAMINHO, 'utf8')) as Json;
  const d = arquivo.destinos?.[destinoId] as Json | undefined;
  if (!d) return undefined;

  const coletadoEm = String(arquivo.coletadoEm ?? new Date().toISOString().slice(0, 10));
  const avisos: string[] = [];

  const mapa = (d.cidadeParaEstado ?? {}) as Record<string, string>;
  const estadoDaCidade: Record<string, string> = {};
  for (const base of bases) {
    const estadoId = mapa[base];
    if (!estadoId) {
      avisos.push(`divisoes: cidade ${base} sem estado no arquivo; fica sem agrupamento`);
      continue;
    }
    estadoDaCidade[base] = estadoId;
  }

  const porId = new Map<string, Json>();
  for (const e of (d.estados ?? []) as Json[]) porId.set(String(e.id), e);

  // So entra no banco o estado de alguma base. O arquivo pode trazer o pais
  // inteiro; o pacote carrega o que ele cobre.
  const usados = new Set(Object.values(estadoDaCidade));
  const estados: Json[] = [];
  const regiaoDaCidade: Record<string, string> = {};

  for (const id of usados) {
    const e = porId.get(id);
    if (!e) {
      avisos.push(`divisoes: estado ${id} referenciado por uma cidade mas nao declarado`);
      continue;
    }
    const fontesDoEstado = (e.fontes ?? []).map((u: unknown) => ({ url: String(u) }));
    if (fontesDoEstado.length === 0) {
      avisos.push(`divisoes: estado ${id} sem fonte: descartado`);
      continue;
    }
    const tipo = TIPOS.has(String(e.tipo)) ? String(e.tipo) : 'estado';
    if (!TIPOS.has(String(e.tipo))) avisos.push(`divisoes: tipo "${e.tipo}" de ${id} desconhecido, usei estado`);

    estados.push({
      id,
      fontes: fontesDoEstado,
      coletadoEm: String(e.coletadoEm ?? coletadoEm),
      // Duas fontes ou uma oficial seria `verificado`; aqui o conversor nao
      // sabe distinguir, entao assume `parcial` e deixa o pendencias apontar.
      confianca: fontesDoEstado.length >= 2 ? 'verificado' : 'parcial',
      ...(e.observacao ? { observacaoDeConfianca: String(e.observacao).slice(0, 2000) } : {}),
      nome: String(e.nome ?? id),
      /*
        Nem truncar nem forcar maiuscula. Truncar em 5 transformava CO-BOL
        (Bolivar) e CO-BOY (Boyaca) no mesmo "CO-BO", dois departamentos com
        a mesma sigla na arvore; e maiuscula a forca estragava as abreviaturas
        mexicanas, que sao "Q. Roo" e "Pue.", nao "Q. ROO".
      */
      sigla: String(e.sigla ?? id).slice(0, 10),
      tipo,
      regiaoId: String(e.regiaoId ?? ''),
      ...(e.capital ? { capital: String(e.capital) } : {}),
      descricaoCurta: String(e.descricaoCurta ?? `${e.nome ?? id}.`),
    });
  }

  for (const [base, estadoId] of Object.entries(estadoDaCidade)) {
    const e = estados.find((x) => x.id === estadoId);
    if (e?.regiaoId) regiaoDaCidade[base] = String(e.regiaoId);
  }

  const regioesUsadas = new Set(estados.map((e) => String(e.regiaoId)).filter(Boolean));
  const regioes: Json[] = [];
  for (const r of (d.macrorregioes ?? []) as Json[]) {
    if (!regioesUsadas.has(String(r.id))) continue;
    const f = (r.fontes ?? []).map((u: unknown) => ({ url: String(u) }));
    if (f.length === 0) {
      avisos.push(`divisoes: macrorregiao ${r.id} sem fonte: descartada`);
      continue;
    }
    regioes.push({
      id: String(r.id),
      fontes: f,
      coletadoEm: String(r.coletadoEm ?? coletadoEm),
      confianca: f.length >= 2 ? 'verificado' : 'parcial',
      nome: String(r.nome ?? r.id),
      descricaoCurta: String(r.descricaoCurta ?? `${r.nome ?? r.id}.`),
    });
  }

  for (const id of regioesUsadas) {
    if (!regioes.some((r) => r.id === id)) {
      avisos.push(`divisoes: macrorregiao ${id} usada por um estado mas nao declarada (ou sem fonte)`);
    }
  }

  // Sem regiao ou sem estado o conversor nao consegue montar a arvore: o
  // chamador cai no comportamento antigo em vez de gravar banco meio feito.
  if (estados.length === 0 || regioes.length === 0) {
    return { regioes, estados, estadoDaCidade, regiaoDaCidade, avisos };
  }
  return { regioes, estados, estadoDaCidade, regiaoDaCidade, avisos };
}
