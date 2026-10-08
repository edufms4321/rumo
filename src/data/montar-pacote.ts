/**
 * Monta um pacote de destino a partir dos arquivos JSON de /data/<destino>/.
 *
 * Modulo puro e compartilhado: o navegador alimenta esta funcao com
 * import.meta.glob e o script de validacao alimenta com fs. Assim os dois
 * leem o banco exatamente do mesmo jeito, e adicionar um destino continua
 * sendo "criar uma pasta" - nunca mexer em codigo.
 *
 * Convencao de arquivos (ver docs/como-adicionar-destino.md):
 *   destino.json               objeto
 *   regioes.json               lista
 *   cidades.json               lista
 *   aeroportos.json            lista
 *   trechos.json               lista
 *   voos-internacionais.json   lista
 *   calendario.json            lista
 *   hospedagem.json            lista
 *   itens/<qualquer>.json      lista (varios arquivos, concatenados)
 */

/** nome do arquivo (sem .json) -> chave do pacote */
const ARQUIVOS_EM_LISTA = {
  regioes: 'regioes',
  cidades: 'cidades',
  aeroportos: 'aeroportos',
  trechos: 'trechos',
  'voos-internacionais': 'voosInternacionais',
  calendario: 'calendario',
  hospedagem: 'hospedagem',
} as const;

const CHAVES_EM_LISTA = [
  'regioes',
  'cidades',
  'aeroportos',
  'itens',
  'trechos',
  'voosInternacionais',
  'calendario',
  'hospedagem',
] as const;

export interface ResultadoDaMontagem {
  /** Pacote cru, ainda nao validado. Passe por validarPacote(). */
  bruto: Record<string, unknown>;
  /** Arquivos que a convencao nao reconhece. */
  ignorados: string[];
  /** Chaves obrigatorias que nao vieram em arquivo nenhum. */
  faltando: string[];
}

/**
 * @param arquivos caminho relativo a pasta do destino (ex.: "itens/cartagena.json")
 *                 mapeado para o JSON ja parseado.
 */
export function montarPacote(arquivos: Record<string, unknown>): ResultadoDaMontagem {
  const bruto: Record<string, unknown> = {};
  for (const chave of CHAVES_EM_LISTA) bruto[chave] = [];

  const ignorados: string[] = [];

  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    const normalizado = caminho.replace(/\\/g, '/').replace(/^\.?\//, '');
    const partes = normalizado.split('/');
    const nomeDoArquivo = partes.at(-1) ?? '';
    const base = nomeDoArquivo.replace(/\.json$/i, '');
    const pasta = partes.length > 1 ? partes.at(-2) : undefined;

    if (pasta === 'itens') {
      if (!Array.isArray(conteudo)) {
        ignorados.push(`${normalizado} (esperava uma lista)`);
        continue;
      }
      (bruto.itens as unknown[]).push(...conteudo);
      continue;
    }

    if (partes.length > 1 && pasta !== undefined && pasta !== '.') {
      // Arquivo dentro de uma subpasta que nao e itens/: fora da convencao.
      ignorados.push(normalizado);
      continue;
    }

    if (base === 'destino') {
      bruto.destino = conteudo;
      continue;
    }

    const chave = ARQUIVOS_EM_LISTA[base as keyof typeof ARQUIVOS_EM_LISTA];
    if (!chave) {
      ignorados.push(normalizado);
      continue;
    }
    if (!Array.isArray(conteudo)) {
      ignorados.push(`${normalizado} (esperava uma lista)`);
      continue;
    }
    (bruto[chave] as unknown[]).push(...conteudo);
  }

  const faltando: string[] = [];
  if (!bruto.destino) faltando.push('destino.json');

  return { bruto, ignorados, faltando };
}

/**
 * Separa um conjunto de caminhos do tipo "<destino>/<resto>" por destino.
 * Usado pelo carregador do navegador e pelo script de validacao.
 */
export function agruparPorDestino(
  arquivos: Record<string, unknown>,
  prefixoARemover = '',
): Record<string, Record<string, unknown>> {
  const porDestino: Record<string, Record<string, unknown>> = {};

  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    let normalizado = caminho.replace(/\\/g, '/');
    if (prefixoARemover && normalizado.includes(prefixoARemover)) {
      normalizado = normalizado.slice(
        normalizado.indexOf(prefixoARemover) + prefixoARemover.length,
      );
    }
    normalizado = normalizado.replace(/^\/+/, '');

    const partes = normalizado.split('/');
    const destinoId = partes[0];
    if (!destinoId || partes.length < 2) continue;

    porDestino[destinoId] ??= {};
    porDestino[destinoId][partes.slice(1).join('/')] = conteudo;
  }

  return porDestino;
}
