/**
 * Procura, no OpenStreetMap, a coordenada dos itens que estao sem ela.
 *
 * Regras que este script nao quebra:
 * - So grava o que a API devolveu. Nada de id de OSM lembrado de cabeca.
 * - A fonte gravada e a URL que a propria resposta permite montar
 *   (osm_type + osm_id), com a data de hoje.
 * - Match duvidoso e descartado, nao "aproximado": preferimos o campo
 *   vazio a uma coordenada que pode estar na cidade errada.
 * - Item nao agendavel (um aviso, um "vale alugar carro?") nao e lugar e
 *   nem e tentado.
 *
 * Uso:
 *   npm run coords -- colombia            # so mostra o que acharia
 *   npm run coords -- colombia --gravar   # grava
 *
 * Politica do Nominatim: 1 requisicao por segundo e User-Agent proprio.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Ajustes, configDe } from './lib/ajustes.ts';

const AGENTE = 'Rumo/0.1 (planejador de viagem pessoal; github.com/edufms4321/rumo)';
const ESPERA_MS = 1100;
/** Fora deste raio da cidade, o resultado e de outro lugar com nome parecido. */
const RAIO_MAX_KM = 45;

type Coord = { lat: number; lng: number };
type Item = {
  id: string;
  nome: string;
  cidadeId: string;
  categoria: string;
  agendavel?: boolean;
  coords?: Coord;
  fontes: Array<{ url: string; titulo?: string }>;
  observacaoDeConfianca?: string;
  descricaoLonga?: string;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const g = Math.PI / 180;
  const dLat = (b.lat - a.lat) * g;
  const dLng = (b.lng - a.lng) * g;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * g) * Math.cos(b.lat * g) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Tira acento, pontuacao e caixa: so o que serve para comparar palavras. */
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
    'de da do das dos e em a o as os the of and la el los las y con por para um uma no na ' +
      'centro cidade zona bar bares cafe restaurante hotel tour tours passeio aluguel rental ' +
      'opcao barata barato comida mergulho escuela escola',
  ).split(' '),
);

function palavrasFortes(t: string): string[] {
  return normalizar(t)
    .split(' ')
    .filter((p) => p.length >= 4 && !VAZIAS.has(p));
}

/**
 * O nome do item e escrito para humano: "Parchill (mulitas XS, 4010 e PRO
 * Kawasaki)". O que serve de busca e o pedaco antes do parentese, do travessao
 * ou dos dois-pontos.
 */
function termoDeBusca(nome: string): string {
  return (
    nome
      .split(/\s[—–-]\s|:\s|\(/)[0]
      ?.replace(/[«»"']/g, '')
      .trim() ?? nome
  );
}

type Resultado = {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  osm_type?: string;
  osm_id?: number;
  category?: string;
  type?: string;
  addresstype?: string;
};

type Caixa = { latMin: number; latMax: number; lngMin: number; lngMax: number };

async function buscar(q: string, caixa: Caixa): Promise<Resultado[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '8');
  url.searchParams.set('accept-language', 'pt-BR,es,en');
  // viewbox do Nominatim: <lng esquerda>,<lat topo>,<lng direita>,<lat base>
  url.searchParams.set(
    'viewbox',
    `${caixa.lngMin},${caixa.latMax},${caixa.lngMax},${caixa.latMin}`,
  );
  url.searchParams.set('bounded', '1');

  const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`Nominatim ${r.status} em "${q}"`);
  return (await r.json()) as Resultado[];
}

function escolher(
  resultados: Resultado[],
  termo: string,
  centroDaCidade: Coord | undefined,
): { coord: Coord; fonte: string; nomeOsm: string; distKm: number | null } | undefined {
  const alvo = palavrasFortes(termo);
  if (alvo.length === 0) return undefined;

  for (const r of resultados) {
    const coord = { lat: Number(r.lat), lng: Number(r.lon) };
    if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) continue;

    const dist = centroDaCidade ? haversineKm(centroDaCidade, coord) : null;
    if (dist !== null && dist > RAIO_MAX_KM) continue;

    // So o NOME do objeto conta, nunca o display_name.
    //
    // O display_name traz o endereco inteiro ("..., Filandia, Quindio,
    // Colombia"), entao buscar "Filandia" casava com qualquer padaria
    // dentro de Filandia. Na primeira rodada isso me deu um cafe no lugar
    // da cidade, uma pousada no lugar da praia e uma area rural no lugar
    // de Pereira. Exigir todas as palavras fortes dentro de r.name derruba
    // os tres.
    const nomeOsm = normalizar(r.name ?? '');
    if (!nomeOsm) continue;
    if (!alvo.every((p) => nomeOsm.includes(p))) continue;

    // Conter as palavras nao basta: "Jeeps a Cocora y Filandia" contem
    // "filandia" e nao e a cidade de Filandia. Exigimos que os conjuntos de
    // palavras fortes se pareçam de verdade (metade ou mais em comum).
    const doOsm = new Set(palavrasFortes(r.name ?? ''));
    const comuns = alvo.filter((p) => doOsm.has(p)).length;
    const uniao = new Set([...alvo, ...doOsm]).size;
    if (uniao === 0 || comuns / uniao < 0.5) continue;

    if (!r.osm_type || !r.osm_id) continue;
    return {
      coord: {
        lat: Number(coord.lat.toFixed(6)),
        lng: Number(coord.lng.toFixed(6)),
      },
      fonte: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
      nomeOsm: r.display_name,
      distKm: dist,
    };
  }
  return undefined;
}

async function main() {
  const [destino, ...resto] = process.argv.slice(2);
  const gravar = resto.includes('--gravar');
  if (!destino) {
    console.error('uso: npm run coords -- <destino> [--gravar]');
    process.exit(1);
  }

  const config = configDe(destino);
  const ajustes = new Ajustes(config);
  const raiz = join('data', destino);
  const info = JSON.parse(readFileSync(join(raiz, 'destino.json'), 'utf8')) as {
    caixaDelimitadora: Caixa;
  };
  const cidadesCru = JSON.parse(readFileSync(join(raiz, 'cidades.json'), 'utf8')) as unknown;
  const cidades = (Array.isArray(cidadesCru) ? cidadesCru : []) as Array<{
    id: string;
    nome: string;
    coords?: Coord;
  }>;
  const porCidade = new Map(cidades.map((c) => [c.id, c]));

  const hoje = new Date().toISOString().slice(0, 10);
  let achados = 0;
  let tentados = 0;
  const semResposta: string[] = [];

  for (const arquivo of readdirSync(join(raiz, 'itens'))) {
    const caminho = join(raiz, 'itens', arquivo);
    const itens = JSON.parse(readFileSync(caminho, 'utf8')) as Item[];

    for (const item of itens) {
      if (item.coords) continue;
      if (item.agendavel === false) continue;

      const cidade = porCidade.get(item.cidadeId);
      const termo = termoDeBusca(item.nome);
      const q = `${termo}, ${cidade?.nome ?? ''}`.replace(/,\s*$/, '');

      tentados += 1;
      await dormir(ESPERA_MS);
      let resultados: Resultado[] = [];
      try {
        resultados = await buscar(q, info.caixaDelimitadora);
      } catch (erro) {
        console.error(`  ! ${item.id}: ${(erro as Error).message}`);
        continue;
      }

      const escolhido = escolher(resultados, termo, cidade?.coords);
      if (!escolhido) {
        semResposta.push(`${item.cidadeId}/${item.nome}`);
        continue;
      }

      achados += 1;
      const d = escolhido.distKm === null ? '?' : `${escolhido.distKm.toFixed(1)} km do centro`;
      console.log(`  + ${item.nome}\n      ${escolhido.nomeOsm}\n      ${d} · ${escolhido.fonte}`);

      if (gravar) {
        const nota =
          `Coordenada vinda da busca do OpenStreetMap em ${hoje}, nao conferida ` +
          'no local; serve para o mapa e para a estimativa de deslocamento.';
        ajustes.paraItem(item.id, {
          coords: escolhido.coord,
          // `fontes` substitui a lista inteira, entao vai completa.
          fontes: [
            ...item.fontes,
            { url: escolhido.fonte, titulo: 'OpenStreetMap (coordenada)' },
          ],
          observacaoDeConfianca: item.observacaoDeConfianca
            ? `${item.observacaoDeConfianca} ${nota}`
            : nota,
        });
      }
    }

  }

  if (gravar) ajustes.gravar();
  console.log(`\n${achados} de ${tentados} tentativas acharam ponto no OSM.`);
  if (semResposta.length > 0) {
    console.log(`\nSem resposta confiavel (ficam sem coordenada, de proposito):`);
    for (const s of semResposta) console.log(`  - ${s}`);
  }
  if (!gravar) console.log('\n(nada gravado: rode com --gravar)');
}

void main();
