/**
 * MELHORIA 1 — matriz de rotas reais, calculada uma vez e guardada.
 *
 *   npm run matriz -- colombia
 *   npm run matriz -- mexico
 *   npm run importar:pesquisa -- colombia   # para a matriz entrar no banco
 *
 * Sobe a camada 3 do estimador (linha reta x fator de rota) para a camada 2
 * (trecho medido) nos pares que importam: os itens de cada cidade, dois a
 * dois, por rota de carro de verdade.
 *
 * Por que e script separado e nao parte do build:
 * - usa o servidor publico de demonstracao do OSRM, que existe para teste e
 *   desenvolvimento, nao para carga. Rodamos UMA requisicao por cidade e
 *   esperamos entre elas. Nada no app depende disto em tempo de execucao:
 *   sem a matriz, o estimador cai na camada 3 e diz que e estimativa;
 * - o resultado e dado estavel: rua nao muda toda semana.
 *
 * Limite honesto: o servidor publico so roteia CARRO. Caminhada continua
 * saindo por haversine, que e justamente onde a linha reta erra menos.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { colombia } from './destinos/colombia.ts';
import { mexico } from './destinos/mexico.ts';
import type { ConfigDeDestino } from './destinos/tipos.ts';

const RAIZ = resolve(import.meta.dirname, '..');
const DESTINOS: Record<string, ConfigDeDestino> = { colombia, mexico };

const SERVIDOR = 'https://router.project-osrm.org';
const ESPERA_ENTRE_CIDADES_MS = 1500;
/** O servidor publico limita o tamanho da tabela; 90 e folgado. */
const MAXIMO_DE_PONTOS = 90;
/** Acima disto nao e mais deslocamento urbano: nao vale pedir rota. */
const DISTANCIA_MAXIMA_KM = 80;

interface Ponto {
  id: string;
  lat: number;
  lng: number;
}

interface ParDaMatriz {
  de: string;
  para: string;
  modal: string;
  minutos: number;
  fontes: Array<{ url: string }>;
}

const RAIO_KM = 6371;
function distanciaKm(a: Ponto, b: Ponto): number {
  const r = (g: number) => (g * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(r(a.lat)) * Math.cos(r(b.lat));
  return 2 * RAIO_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function esperar(ms: number): Promise<void> {
  return new Promise((pronto) => setTimeout(pronto, ms));
}

async function tabelaDaCidade(pontos: Ponto[]): Promise<{ matriz: number[][]; url: string } | undefined> {
  const coordenadas = pontos.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${SERVIDOR}/table/v1/driving/${coordenadas}?annotations=duration`;

  const resposta = await fetch(url, {
    headers: { 'User-Agent': 'Rumo-trip-planner/0.1 (projeto pessoal, uso pontual)' },
  });
  if (!resposta.ok) {
    console.log(`    o servidor respondeu ${resposta.status}: esta cidade fica sem matriz`);
    return undefined;
  }
  const dados = (await resposta.json()) as { code?: string; durations?: number[][] };
  if (dados.code !== 'Ok' || !dados.durations) {
    console.log(`    resposta sem matriz (code ${dados.code}): esta cidade fica sem matriz`);
    return undefined;
  }
  return { matriz: dados.durations, url };
}

async function main(): Promise<void> {
  const pedido = process.argv[2] ?? 'colombia';
  const config = DESTINOS[pedido];
  if (!config) {
    console.error(`Destino desconhecido: ${pedido}`);
    process.exit(1);
  }

  const PESQUISA = join(RAIZ, config.pastaDePesquisa);
  const SAIDA = join(PESQUISA, 'matriz-interna.json');
  const PASTA_DE_ITENS = join(RAIZ, 'data', config.id, 'itens');

  if (!existsSync(PASTA_DE_ITENS)) {
    console.error(`Rode a importacao antes: ${PASTA_DE_ITENS} nao existe.`);
    process.exit(1);
  }

  console.log(`Matriz de rotas reais para ${config.nome}`);
  console.log('Servidor publico de demonstracao do OSRM, uma requisicao por cidade.\n');

  const cidades: Json = JSON.parse(
    readFileSync(join(RAIZ, 'data', config.id, 'cidades.json'), 'utf8'),
  );
  const existente: Record<string, ParDaMatriz[]> = existsSync(SAIDA)
    ? JSON.parse(readFileSync(SAIDA, 'utf8'))
    : {};

  for (const cidade of cidades as Array<{ id: string; nome: string }>) {
    const caminho = join(PASTA_DE_ITENS, `${cidade.id}.json`);
    if (!existsSync(caminho)) continue;

    const itens = JSON.parse(readFileSync(caminho, 'utf8')) as Array<{
      id: string;
      coords?: { lat: number; lng: number };
      agendavel?: boolean;
    }>;

    const pontos: Ponto[] = itens
      .filter((i) => i.coords && i.agendavel !== false)
      .slice(0, MAXIMO_DE_PONTOS)
      .map((i) => ({ id: i.id, lat: i.coords!.lat, lng: i.coords!.lng }));

    if (pontos.length < 2) {
      console.log(`  ${cidade.nome.padEnd(26)} ${pontos.length} ponto(s) com coordenada: pulada`);
      continue;
    }

    const resultado = await tabelaDaCidade(pontos);
    if (!resultado) {
      await esperar(ESPERA_ENTRE_CIDADES_MS);
      continue;
    }

    const pares: ParDaMatriz[] = [];
    for (let i = 0; i < pontos.length; i += 1) {
      for (let j = i + 1; j < pontos.length; j += 1) {
        const a = pontos[i];
        const b = pontos[j];
        if (!a || !b) continue;
        if (distanciaKm(a, b) > DISTANCIA_MAXIMA_KM) continue;

        const segundos = resultado.matriz[i]?.[j];
        if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) continue;

        pares.push({
          de: a.id,
          para: b.id,
          modal: 'carro-app',
          minutos: Math.max(1, Math.round(segundos / 60)),
          fontes: [{ url: 'https://project-osrm.org/' }],
        });
      }
    }

    existente[cidade.id] = pares;
    console.log(
      `  ${cidade.nome.padEnd(26)} ${String(pontos.length).padStart(3)} pontos -> ${String(pares.length).padStart(4)} pares`,
    );
    await esperar(ESPERA_ENTRE_CIDADES_MS);
  }

  writeFileSync(SAIDA, `${JSON.stringify(existente, null, 2)}\n`);
  const total = Object.values(existente).reduce((n, lista) => n + lista.length, 0);
  console.log(`\n${total} pares gravados em ${config.pastaDePesquisa}/matriz-interna.json`);
  console.log(`Rode agora: npm run importar:pesquisa -- ${config.id}`);
}

type Json = unknown;

main();
