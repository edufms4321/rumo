/**
 * Procura, no Wikimedia Commons, uma imagem com licenca livre para os
 * itens que estao sem nenhuma.
 *
 * Regras que este script nao quebra:
 * - So entra imagem com licenca livre EXPLICITA na resposta da API
 *   (CC0, dominio publico, CC BY, CC BY-SA). Qualquer coisa marcada como
 *   "fair use", "non-free" ou sem licenca declarada e descartada.
 * - Credito e licenca vem da propria resposta, nunca escritos por mim.
 * - Sem autor declarado, a imagem nao entra: o schema exige credito.
 * - Match duvidoso e descartado. Uma foto generica de praia no cartao de
 *   um restaurante e pior do que o placeholder.
 *
 * Uso:
 *   npm run imagens -- colombia            # so mostra o que acharia
 *   npm run imagens -- colombia --gravar
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Ajustes, configDe } from './lib/ajustes.ts';

const AGENTE = 'Rumo/0.1 (planejador de viagem pessoal; github.com/edufms4321/rumo)';
const ESPERA_MS = 1200;

/** Licencas aceitas. O que nao casar com isto fica de fora. */
const LIVRES =
  /^(cc0|cc[- ]by([- ]sa)?([- ]\d(\.\d)?)?|public domain|pd[- ]|no restrictions|attribution)/i;

type Imagem = { url: string; credito: string; licenca: string; fonte: string };
type Item = {
  id: string;
  nome: string;
  cidadeId: string;
  agendavel?: boolean;
  imagens?: Imagem[];
  fontes: Array<{ url: string; titulo?: string }>;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VAZIAS = new Set(
  normalizar(
    'de da do das dos e em a o as os the of and la el los las y con por para file jpg jpeg png ' +
      'centro cidade zona bar bares cafe restaurante hotel tour tours passeio aluguel rental ' +
      'opcao barata barato comida vista view photo foto imagem',
  ).split(' '),
);

const palavrasFortes = (t: string): string[] =>
  normalizar(t)
    .split(' ')
    .filter((p) => p.length >= 4 && !VAZIAS.has(p));

/** O nome e escrito para humano; a busca quer so o nucleo dele. */
const termoDeBusca = (nome: string): string =>
  nome
    .split(/\s[—–-]\s|:\s|\(/)[0]
    ?.replace(/[«»"']/g, '')
    .trim() ?? nome;

/** O campo Artist vem como HTML ("<a href=...>Fulano</a>"). */
function limparHtml(t: string): string {
  return t
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Pagina = {
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

async function buscarNoCommons(termo: string): Promise<Pagina[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', termo);
  url.searchParams.set('gsrnamespace', '6'); // namespace de arquivo
  url.searchParams.set('gsrlimit', '12');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1280');

  // O Commons devolve 429 quando se insiste rapido demais. Recuo
  // progressivo em vez de desistir: perder a imagem por pressa e burrice.
  let r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  for (let tentativa = 1; r.status === 429 && tentativa <= 4; tentativa += 1) {
    await dormir(2000 * 2 ** tentativa);
    r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  }
  if (!r.ok) throw new Error(`Commons ${r.status}`);
  const corpo = (await r.json()) as { query?: { pages?: Record<string, Pagina> } };
  return Object.values(corpo.query?.pages ?? {});
}

function escolher(paginas: Pagina[], termo: string, cidade: string): Imagem | undefined {
  const alvo = palavrasFortes(termo);
  if (alvo.length === 0) return undefined;
  const daCidade = palavrasFortes(cidade);

  for (const p of paginas) {
    const info = p.imageinfo?.[0];
    if (!info?.thumburl || !info.descriptionurl) continue;

    // So foto: SVG, PDF, mapa e audio nao servem de capa.
    if (!/\.(jpe?g|png|webp)$/i.test(p.title)) continue;

    const meta = info.extmetadata ?? {};
    const licenca = limparHtml(meta.LicenseShortName?.value ?? '');
    if (!licenca || !LIVRES.test(licenca)) continue;

    const credito = limparHtml(meta.Artist?.value ?? meta.Credit?.value ?? '');
    if (!credito) continue; // o schema exige credito; sem autor, fora

    // O nome do ARQUIVO precisa conter todas as palavras fortes do termo.
    const doArquivo = palavrasFortes(p.title.replace(/^File:/, ''));
    const conjunto = new Set(doArquivo);
    if (!alvo.every((w) => conjunto.has(w))) continue;

    // Uma palavra so nao identifica nada: "Pereira" e tambem um sobrenome,
    // "Esmeraldas" e uma cidade do Equador, "Filandia" casa com qualquer
    // arquivo cujo nome mencione a vila. Quando o nome do item tem uma
    // unica palavra forte, o arquivo precisa trazer tambem a cidade.
    const cidadeNoArquivo = daCidade.filter((w) => conjunto.has(w));
    if (alvo.length < 2 && cidadeNoArquivo.length === 0) continue;

    // E os dois conjuntos precisam se parecer de verdade: senao
    // "Mercado del Rio" casa com uma foto de dez mercados.
    const exigido = [...new Set([...alvo, ...cidadeNoArquivo])];
    const uniao = new Set([...exigido, ...doArquivo]).size;
    if (exigido.length / uniao < 0.5) continue;

    return {
      url: info.thumburl,
      credito: credito.slice(0, 200),
      licenca,
      fonte: info.descriptionurl,
    };
  }
  return undefined;
}

async function main() {
  const [destino, ...resto] = process.argv.slice(2);
  const gravar = resto.includes('--gravar');
  if (!destino) {
    console.error('uso: npm run imagens -- <destino> [--gravar]');
    process.exit(1);
  }

  const config = configDe(destino);
  const ajustes = new Ajustes(config);
  const raiz = join('data', destino);
  const cidades = JSON.parse(readFileSync(join(raiz, 'cidades.json'), 'utf8')) as Array<{
    id: string;
    nome: string;
  }>;
  const porCidade = new Map(cidades.map((c) => [c.id, c.nome]));

  let achadas = 0;
  let tentadas = 0;

  for (const arquivo of readdirSync(join(raiz, 'itens'))) {
    const caminho = join(raiz, 'itens', arquivo);
    const itens = JSON.parse(readFileSync(caminho, 'utf8')) as Item[];

    for (const item of itens) {
      if (item.imagens && item.imagens.length > 0) continue;
      if (item.agendavel === false) continue;

      const nucleo = termoDeBusca(item.nome);
      const cidadeNome = porCidade.get(item.cidadeId) ?? '';
      tentadas += 1;
      await dormir(ESPERA_MS);

      let escolhida: Imagem | undefined;
      // Duas tentativas: com a cidade (desambigua) e sem (amplia).
      for (const termo of [`${nucleo} ${cidadeNome}`.trim(), nucleo]) {
        try {
          escolhida = escolher(await buscarNoCommons(termo), nucleo, cidadeNome);
        } catch (erro) {
          console.error(`  ! ${item.id}: ${(erro as Error).message}`);
        }
        if (escolhida) break;
        await dormir(ESPERA_MS);
      }
      if (!escolhida) continue;

      achadas += 1;
      console.log(`  + ${item.nome}\n      ${escolhida.licenca} · ${escolhida.credito}`);
      console.log(`      ${escolhida.fonte}`);

      if (gravar) {
        ajustes.paraItem(item.id, {
          imagens: [escolhida],
          fontes: [
            ...item.fontes,
            { url: escolhida.fonte, titulo: 'Wikimedia Commons (imagem)' },
          ],
        });
      }
    }

  }

  if (gravar) ajustes.gravar();
  console.log(`\n${achadas} de ${tentadas} itens ganharam imagem com licenca livre.`);
  if (!gravar) console.log('(nada gravado: rode com --gravar)');
}

void main();
