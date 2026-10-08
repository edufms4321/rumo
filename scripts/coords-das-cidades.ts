/**
 * Gera `pesquisa/<destino>/coords-cidades.json`: centro e altitude de cada
 * cidade-base, de fonte aberta.
 *
 * Por que existe: os arquivos de Colombia e Mexico foram montados a mao, e
 * foi exatamente ai que eu escrevi IDs de relacao do OpenStreetMap de
 * cabeca — cinco dos seis estavam errados. Nunca mais: aqui so entra o que
 * a API devolveu, e a URL gravada e montada a partir do osm_type/osm_id da
 * propria resposta.
 *
 * A altitude vem da API de elevacao do Open-Meteo (sem chave), e importa
 * porque o motor tem uma regra de altitude no primeiro dia.
 *
 * Uso: npm run coords:cidades -- nordeste
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configDe } from './lib/ajustes.ts';

const AGENTE = 'Rumo/0.1 (planejador de viagem pessoal; github.com/edufms4321/rumo)';
const ESPERA_MS = 1100;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Registro = {
  lat: number;
  lng: number;
  altitudeM: number;
  osm: string;
  nomeOsm: string;
  elevacaoDe?: string;
};

type Resultado = {
  lat: string;
  lon: string;
  display_name: string;
  osm_type?: string;
  osm_id?: number;
  addresstype?: string;
};

async function procurarCidade(
  nome: string,
  caixa: { latMin: number; latMax: number; lngMin: number; lngMax: number },
): Promise<Resultado | undefined> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', nome);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('accept-language', 'pt-BR');
  url.searchParams.set('viewbox', `${caixa.lngMin},${caixa.latMax},${caixa.lngMax},${caixa.latMin}`);
  url.searchParams.set('bounded', '1');
  // So lugar habitado: sem isto, "Pipa" devolve um bar chamado Pipa.
  url.searchParams.set('featureType', 'settlement');

  const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`Nominatim ${r.status} em "${nome}"`);
  const lista = (await r.json()) as Resultado[];
  return lista[0];
}

async function elevacao(lat: number, lng: number): Promise<{ m: number; fonte: string }> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const corpo = (await r.json()) as { elevation?: number[] };
  const m = corpo.elevation?.[0];
  // Sem resposta, 0 — e o arquivo diz que 0 aqui pode ser "sem dado".
  return { m: typeof m === 'number' ? Math.round(m) : 0, fonte: url };
}

async function main() {
  const destino = process.argv[2];
  if (!destino) {
    console.error('uso: npm run coords:cidades -- <destino>');
    process.exit(1);
  }
  const config = configDe(destino);
  const caminho = join(config.pastaDePesquisa, 'coords-cidades.json');
  const anterior: Record<string, Registro> = existsSync(caminho)
    ? (JSON.parse(readFileSync(caminho, 'utf8')) as Record<string, Registro>)
    : {};

  const bases = Object.keys(config.regiaoDaCidade);
  const saida: Record<string, Registro> = { ...anterior };
  const faltaram: string[] = [];

  for (const base of bases) {
    if (saida[base]) continue; // ja resolvido numa rodada anterior
    const nome = config.nomeDaCidade[base] ?? base;
    await dormir(ESPERA_MS);

    let achado: Resultado | undefined;
    try {
      achado = await procurarCidade(`${nome}, ${config.nome}`, config.caixaDelimitadora);
      if (!achado) achado = await procurarCidade(nome, config.caixaDelimitadora);
    } catch (erro) {
      console.error(`  ! ${base}: ${(erro as Error).message}`);
    }

    if (!achado?.osm_type || !achado.osm_id) {
      faltaram.push(base);
      console.log(`  ? ${nome}: nao achei lugar habitado no OSM`);
      continue;
    }

    const lat = Number(Number(achado.lat).toFixed(5));
    const lng = Number(Number(achado.lon).toFixed(5));
    await dormir(400);
    let alt = { m: 0, fonte: '' };
    try {
      alt = await elevacao(lat, lng);
    } catch (erro) {
      console.error(`  ! altitude de ${base}: ${(erro as Error).message}`);
    }

    saida[base] = {
      lat,
      lng,
      altitudeM: alt.m,
      osm: `https://www.openstreetmap.org/${achado.osm_type}/${achado.osm_id}`,
      nomeOsm: achado.display_name,
      ...(alt.fonte ? { elevacaoDe: alt.fonte } : {}),
    };
    console.log(`  + ${nome}: ${lat}, ${lng} · ${alt.m} m`);
    console.log(`      ${achado.display_name.slice(0, 95)}`);
  }

  writeFileSync(caminho, `${JSON.stringify(saida, null, 1)}\n`);
  console.log(
    `\n${Object.keys(saida).length} de ${bases.length} bases em ${caminho}.` +
      (faltaram.length > 0 ? `\nSem resposta: ${faltaram.join(', ')}` : ''),
  );
}

void main();
