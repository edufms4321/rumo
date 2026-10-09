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
import { contarPorGrupo } from '../src/engine/grupos.ts';
import type { Item } from '../src/schema/item.ts';
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
  construirTrechos,
  construirVoos,
  construirZonas,
} from './lib/pesquisa-colecoes.ts';
import { lerDivisoes } from './lib/pesquisa-divisoes.ts';
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

/*
  Junta o que duas ondas dizem da MESMA base, em vez de uma apagar a outra.

  Isto foi um estrago de verdade: a onda de noite e aventura da Colombia
  cobria 6 bases que as ondas antigas ja cobriam, e o conversor fazia
  `bases[baseId] = conteudo`. Resultado: a Colombia caiu de 169 itens para
  47 num unico import. Pior, a linha acima do atalho IMPRIMIA
  "aviso: repete a base" — um aviso que anunciava a perda e seguia em frente.

  Regras da fusao:
  - itens: concatena. Id repetido o validador reprova, e e o que queremos.
  - nota em texto: uma onda especializada manda uma FRASE onde a onda de base
    manda um OBJETO (comoCircular, bairros, taxas). Trocar o objeto pela
    frase apagava a pesquisa de base inteira, entao a frase vai para
    `notasExtras` e nunca sobrescreve nada.
  - lista: concatena.
  - valor simples: o primeiro que chegou fica, e divergencia vira aviso. O
    conversor nao tem como saber qual onda esta mais certa; o pendencias tem
    de mostrar as duas.
*/
function mesclarNotasDaBase(
  atual: Json | undefined,
  nova: unknown,
  baseId: string,
  arquivo: string,
): Json {
  const saida: Json = { ...atual };

  if (typeof nova === 'string') {
    saida.notasExtras = [...((saida.notasExtras as string[]) ?? []), nova];
    return saida;
  }
  if (!nova || typeof nova !== 'object') return saida;

  for (const [chave, valor] of Object.entries(nova as Json)) {
    const existente = saida[chave];
    if (Array.isArray(valor) && Array.isArray(existente)) {
      saida[chave] = [...existente, ...valor];
    } else if (existente === undefined || existente === null || existente === '') {
      saida[chave] = valor;
    } else if (JSON.stringify(existente) !== JSON.stringify(valor)) {
      avisos.push(
        `base ${baseId}: ${arquivo} traz "${chave}" diferente do que outra onda ja dizia; mantive o primeiro`,
      );
    }
  }
  return saida;
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
        const anterior = bases[baseId] as Json | undefined;
        if (anterior) console.log(`  ${arquivo} soma ${meus.length} item(ns) a base "${baseId}"`);
        bases[baseId] = {
          base: baseId,
          coletadoEm: (anterior?.coletadoEm as string) ?? conteudo.coletadoEm,
          notasDaBase: mesclarNotasDaBase(anterior?.notasDaBase as Json | undefined, notas, baseId, arquivo),
          itens: [...((anterior?.itens as Json[]) ?? []), ...meus],
        };
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
    const baseUnica = String(conteudo.base);
    const anteriorUnica = bases[baseUnica] as Json | undefined;
    if (anteriorUnica) {
      console.log(`  ${arquivo} soma ${(conteudo.itens as Json[]).length} item(ns) a base "${baseUnica}"`);
    }
    bases[baseUnica] = {
      ...conteudo,
      coletadoEm: (anteriorUnica?.coletadoEm as string) ?? conteudo.coletadoEm,
      notasDaBase: mesclarNotasDaBase(
        anteriorUnica?.notasDaBase as Json | undefined,
        conteudo.notasDaBase,
        baseUnica,
        arquivo,
      ),
      itens: [...((anteriorUnica?.itens as Json[]) ?? []), ...(conteudo.itens as Json[])],
    };
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

  /*
    Arvore de lugares: pais > macrorregiao > estado > cidade, mais a zona
    turistica como etiqueta. As duas primeiras vem de `pesquisa/_divisoes`,
    que e dado com fonte oficial (IBGE, DANE, INEGI, ONE). Sem o arquivo o
    conversor usa a zona como regiao e nao grava estados: um nivel so, igual
    a antes. Nunca grava arvore pela metade.
  */
  const divisoes = lerDivisoes(config.id, Object.keys(config.regiaoDaCidade));
  const arvoreCompleta = Boolean(divisoes && divisoes.estados.length > 0 && divisoes.regioes.length > 0);
  if (divisoes) for (const a of divisoes.avisos) avisos.push(a);
  if (!arvoreCompleta) {
    avisos.push(
      'sem pesquisa/_divisoes/divisoes.json utilizavel: o pacote fica com um nivel de regiao so, e as cidades sem estado',
    );
  }

  const cidades = filtrarSemFonte(
    construirCidades(logistica, coords, bases, ajustes, config, matriz, arvoreCompleta ? divisoes : undefined),
    'cidade',
  );
  const trechos = filtrarSemFonte(construirTrechos(logistica, config), 'trecho');
  const itensPorCidade = construirItens(Object.values(bases), ajustes, config);

  gravar(SAIDA, 'destino.json', ajustes.destino ? mesclar(destino, ajustes.destino) : destino);
  const zonas = construirZonas(config);
  gravar(SAIDA, 'zonas.json', zonas);
  if (arvoreCompleta && divisoes) {
    gravar(SAIDA, 'regioes.json', filtrarSemFonte(divisoes.regioes, 'regiao'));
    gravar(SAIDA, 'estados.json', filtrarSemFonte(divisoes.estados, 'estado'));
  } else {
    /*
      Sem divisao pesquisada o pacote fica SEM macrorregiao e SEM estado, e a
      arvore degrada para pais > cidade. A primeira versao deste trecho
      gravava as zonas como regioes com uma URL da Wikipedia que eu nao abri,
      so para satisfazer `fontes.min(1)` - o mesmo erro que acabei de tirar
      do gerador de regioes. Arquivo vazio e a resposta honesta.
    */
    gravar(SAIDA, 'regioes.json', []);
    gravar(SAIDA, 'estados.json', []);
  }
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
  /*
    O indice carrega a ARVORE e as contagens por grupo porque a tela inicial
    precisa desenhar "Brasil > Nordeste > Bahia > Salvador" e dizer quantas
    praias e quantos restaurantes tem ali - e precisa fazer isso sem baixar o
    pacote inteiro, que tem centenas de itens com descricao longa.
  */
  const todosOsItens = Object.values(itensPorCidade).flat() as unknown as Item[];
  const estadosDoIndice = arvoreCompleta && divisoes ? divisoes.estados : [];
  const regioesDoIndice = arvoreCompleta && divisoes ? divisoes.regioes : [];

  gravar(SAIDA, 'indice.json', {
    id: config.id,
    nome: config.nome,
    paisNome: config.paisNome ?? config.nome,
    codigoPais: config.codigoPais,
    moeda: config.moeda,
    ...(config.cobertura ? { cobertura: config.cobertura } : {}),
    totais: {
      itens: totalDeItens,
      cidades: cidades.length,
      trechos: trechos.length,
      eventos: eventos.length,
      estados: estadosDoIndice.length,
      regioes: regioesDoIndice.length,
    },
    confianca: porConfianca,
    grupos: contarPorGrupo(todosOsItens),
    arvore: regioesDoIndice.map((r: Json) => ({
      id: String(r.id),
      nome: String(r.nome),
      descricaoCurta: String(r.descricaoCurta),
      estados: estadosDoIndice
        .filter((e: Json) => e.regiaoId === r.id)
        .map((e: Json) => ({
          id: String(e.id),
          nome: String(e.nome),
          sigla: String(e.sigla),
          tipo: String(e.tipo),
          descricaoCurta: String(e.descricaoCurta),
          cidades: cidades
            .filter((c) => c.estadoId === e.id)
            .map((c) => ({
              id: String(c.id),
              nome: String(c.nome),
              ...(c.zonaId ? { zona: zonas.find((z) => z.id === c.zonaId)?.nome ?? '' } : {}),
              itens: todosOsItens.filter((i) => i.cidadeId === c.id).length,
            })),
        }))
        .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome)),
    })),
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
