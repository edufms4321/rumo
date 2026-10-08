/**
 * Converte a saida crua dos subagentes de pesquisa no banco validado.
 *
 *   npm run importar:pesquisa            # colombia (padrao)
 *   npm run importar:pesquisa -- mexico
 *   npm run validate:data
 *
 * Por que script e nao edicao a mao: as ondas de pesquisa vem todas no mesmo
 * formato, e o mapeamento precisa ser auditavel e repetivel.
 *
 * O script nunca inventa valor factual. Campo vazio na pesquisa continua
 * vazio; preco zerado vira ausencia de preco mais um alerta no item;
 * coordenada 0,0 vira ausencia de coordenada; registro sem nenhuma fonte nao
 * entra no banco. Tudo que ele DEDUZ sai no relatorio final, separado do que
 * veio de fonte.
 *
 * Julgamento humano vive em <pasta>/ajustes-manuais.json e e mesclado por
 * cima, para que reexecutar nao perca trabalho manual.
 *
 * O conhecimento especifico de cada pais (quais lugares sao base, como o
 * agente escreveu cada nome, que aeroporto serve que base) vive em
 * scripts/destinos/. Isso e da FERRAMENTA DE PESQUISA, nao do app: o app le
 * /data/<destino>/ por import.meta.glob e nao precisa de nada disto.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { colombia } from './destinos/colombia.ts';
import { mexico } from './destinos/mexico.ts';
import { nordeste } from './destinos/nordeste.ts';
import { puntaCana } from './destinos/punta-cana.ts';
import type { ConfigDeDestino } from './destinos/tipos.ts';
import {
  construirAeroportos,
  construirCalendario,
  construirCidades,
  construirDestino,
  construirHospedagem,
  construirRegioes,
  construirTrechos,
  construirVoos,
} from './lib/pesquisa-colecoes.ts';
import { construirItens } from './lib/pesquisa-itens.ts';
import {
  type Json,
  avisos,
  filtrarSemFonte,
  gravar,
  mesclar,
  relatorioDeDerivacoes,
} from './lib/pesquisa-utils.ts';

const RAIZ = resolve(import.meta.dirname, '..');

const DESTINOS: Record<string, ConfigDeDestino> = { colombia, mexico, nordeste, 'punta-cana': puntaCana };

function escolherDestino(): ConfigDeDestino {
  const pedido = process.argv[2] ?? 'colombia';
  const config = DESTINOS[pedido];
  if (!config) {
    console.error(
      `Destino desconhecido: "${pedido}". Disponiveis: ${Object.keys(DESTINOS).join(', ')}.`,
    );
    process.exit(1);
  }
  return config;
}

function main(): void {
  const config = escolherDestino();
  const PESQUISA = join(RAIZ, config.pastaDePesquisa);
  const SAIDA = join(RAIZ, 'data', config.id);

  const ler = (arquivo: string): Json => JSON.parse(readFileSync(join(PESQUISA, arquivo), 'utf8'));

  console.log(`Importando ${config.pastaDePesquisa} -> data/${config.id}\n`);

  const arquivosDaPasta = readdirSync(PESQUISA, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name)
    .sort();

  const arquivoDeLogistica = arquivosDaPasta.find((a) => a.includes('logistica'));
  if (!arquivoDeLogistica) {
    console.error(`Nenhum arquivo de logistica em ${config.pastaDePesquisa}.`);
    process.exit(1);
  }
  const logistica = ler(arquivoDeLogistica);
  const coords = ler('coords-cidades.json');

  // Onda dedicada de clima e calendario anual, quando existe: ela traz os 12
  // meses por cidade e as datas de mais de um ano. Entra por cima da tabela
  // regional de um mes so que veio na onda de logistica.
  for (const arquivo of arquivosDaPasta) {
    if (arquivo === arquivoDeLogistica) continue;
    const conteudo = ler(arquivo);
    if (Array.isArray(conteudo.climaPorCidadeEMes)) {
      logistica.climaPorCidadeEMes = conteudo.climaPorCidadeEMes;
      console.log(`  clima dos 12 meses vindo de ${arquivo}`);
    }
    if (Array.isArray(conteudo.calendarioAnual)) {
      logistica.calendarioAnual = [
        ...((logistica.calendarioAnual ?? []) as Json[]),
        ...conteudo.calendarioAnual,
      ];
    }
  }

  // Le TODA onda que declare uma `base`. Uma onda nova entra so soltando o
  // JSON na pasta - nenhuma mudanca de codigo.
  const bases: Json = {};
  const semBase = new Map<string, number>();
  for (const arquivo of arquivosDaPasta) {
    if (!arquivo.startsWith('onda-')) continue;
    const conteudo = ler(arquivo);
    if (!Array.isArray(conteudo.itens)) continue;

    /*
      Duas formas de onda, as duas validas.

      A simples (`base` + `notasDaBase`) foi o suficiente para a Colombia,
      onde cada onda cobria uma cidade. Para destinos grandes isso nao se
      sustenta: o Nordeste tem 23 bases, e pesquisar uma por arquivo seria
      23 ondas. Entao uma onda pode trazer `notasPorBase` — um mapa — e os
      itens de varias bases juntos. O repartidor usa `cidadeDoItem` para
      saber de quem e cada item, que e o mesmo mapa que o resto do
      conversor ja usa.
    */
    const notasPorBase = conteudo.notasPorBase as Record<string, Json> | undefined;
    if (notasPorBase && typeof notasPorBase === 'object') {
      const itens = conteudo.itens as Array<{ cidade?: string }>;
      for (const [baseId, notas] of Object.entries(notasPorBase)) {
        const meus = itens.filter((i) => config.cidadeDoItem[i.cidade ?? ''] === baseId);
        if (bases[baseId]) console.log(`  aviso: ${arquivo} repete a base "${baseId}"`);
        bases[baseId] = { base: baseId, coletadoEm: conteudo.coletadoEm, notasDaBase: notas, itens: meus };
      }
      // Item cuja cidade nao esta no mapa de apelidos some sem aviso: e o
      // jeito mais facil de perder pesquisa sem perceber.
      for (const i of itens) {
        const chave = i.cidade ?? '(sem cidade)';
        if (!config.cidadeDoItem[chave]) semBase.set(chave, (semBase.get(chave) ?? 0) + 1);
      }
      continue;
    }

    if (!conteudo.base) continue;
    if (bases[conteudo.base]) console.log(`  aviso: ${arquivo} repete a base "${conteudo.base}"`);
    bases[conteudo.base] = conteudo;
  }
  if (semBase.size > 0) {
    console.log('  AVISO: itens cuja cidade nao esta em cidadeDoItem (ficaram de fora):');
    for (const [cidade, n] of [...semBase].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${cidade}: ${n} item(ns)`);
    }
  }
  console.log(`  bases lidas: ${Object.keys(bases).join(', ') || '(nenhuma)'}\n`);

  const ajustes: Json = existsSync(join(PESQUISA, 'ajustes-manuais.json'))
    ? ler('ajustes-manuais.json')
    : {};

  // MELHORIA 1: matriz de rotas reais, se ja foi calculada (npm run matriz).
  const matriz: Json = existsSync(join(PESQUISA, 'matriz-interna.json'))
    ? ler('matriz-interna.json')
    : {};
  const paresDeMatriz = Object.values(matriz).reduce(
    (n: number, lista) => n + (Array.isArray(lista) ? lista.length : 0),
    0,
  );
  if (paresDeMatriz > 0) console.log(`  matriz de rotas reais: ${paresDeMatriz} pares
`);

  const destino = construirDestino(logistica, config);
  const cidades = filtrarSemFonte(
    construirCidades(logistica, coords, bases, ajustes, config, matriz),
    'cidade',
  );
  const trechos = filtrarSemFonte(construirTrechos(logistica, config), 'trecho');
  const itensPorCidade = construirItens(Object.values(bases), ajustes, config);

  gravar(SAIDA, 'destino.json', ajustes.destino ? mesclar(destino, ajustes.destino) : destino);
  gravar(SAIDA, 'regioes.json', filtrarSemFonte(construirRegioes(logistica, config), 'regiao'));
  gravar(SAIDA, 'aeroportos.json', filtrarSemFonte(construirAeroportos(logistica), 'aeroporto'));
  gravar(SAIDA, 'cidades.json', cidades);

  let totalDeItens = 0;
  const porConfianca = { verificado: 0, parcial: 0, estimado: 0 };
  for (const [cidadeId, itens] of Object.entries(itensPorCidade)) {
    const filtrados = filtrarSemFonte(itens, 'item');
    totalDeItens += filtrados.length;
    for (const i of filtrados) {
      const nivel = String(i.confianca) as keyof typeof porConfianca;
      if (nivel in porConfianca) porConfianca[nivel] += 1;
    }
    gravar(SAIDA, join('itens', `${cidadeId}.json`), filtrados);
  }

  gravar(SAIDA, 'trechos.json', trechos);
  gravar(SAIDA, 'voos-internacionais.json', filtrarSemFonte(construirVoos(logistica), 'voo'));

  // Eventos escritos a mao entram por cima: sao os que exigiram verificacao
  // em fonte primaria pelo agente principal (fechamentos, desastres).
  const calendario = [
    ...construirCalendario(logistica, config),
    ...((ajustes.calendario ?? []) as Json[]),
  ];
  const eventos = filtrarSemFonte(calendario, 'evento');
  gravar(SAIDA, 'calendario.json', eventos);
  gravar(SAIDA, 'hospedagem.json', filtrarSemFonte(construirHospedagem(bases), 'hospedagem'));

  // Indice leve: a tela inicial lista os destinos sem baixar o pacote inteiro.
  // Sem isto, abrir o app puxaria os dois paises antes de desenhar a 1a tela.
  gravar(SAIDA, 'indice.json', {
    id: config.id,
    nome: config.nome,
    moeda: config.moeda,
    totais: {
      itens: totalDeItens,
      cidades: cidades.length,
      trechos: trechos.length,
      eventos: eventos.length,
    },
    confianca: porConfianca,
  });

  console.log('\nDeduzido pelo script (nao e dado de fonte):');
  for (const [rotulo, n] of relatorioDeDerivacoes()) {
    console.log(`  ${String(n).padStart(4)}x ${rotulo}`);
  }

  if (avisos.length > 0) {
    console.log(`\n${avisos.length} aviso(s) - material para docs/pendencias-de-verificacao.md:`);
    for (const aviso of avisos) console.log(`  - ${aviso}`);
  }

  /*
    Grava o que NAO entrou no banco.

    Ate aqui isso vivia so no terminal, e terminal se fecha. Pesquisa cara
    — um evento sem data exata, um bairro sem faixa de diaria, um item com
    a cidade fora do mapa — sumia sem deixar rastro, e ninguem ficava
    sabendo que faltava. Agora vira arquivo, e o gerador de pendencias le
    dali.
  */
  writeFileSync(
    join(PESQUISA, 'descartados.json'),
    `${JSON.stringify({ geradoEm: new Date().toISOString().slice(0, 10), avisos }, null, 1)}
`,
  );

  console.log('\nAgora rode: npm run validate:data');
}

main();
