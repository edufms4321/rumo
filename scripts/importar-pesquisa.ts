/**
 * Converte a saida crua dos subagentes de pesquisa (pesquisa/onda-*.json) no
 * banco validado (data/colombia/*.json). Rode com:
 *
 *   npm run importar:pesquisa
 *   npm run validate:data
 *
 * Por que script e nao edicao a mao: as ondas B e C vem no mesmo formato e o
 * mapeamento precisa ser auditavel e repetivel.
 *
 * O script nunca inventa valor factual. Campo vazio na pesquisa continua
 * vazio; preco zerado vira ausencia de preco mais um alerta no item;
 * coordenada 0,0 vira ausencia de coordenada; horario em prosa so vira janela
 * estruturada quando da para ler HH:MM sem ambiguidade. Tudo que ele DEDUZ
 * aparece no relatorio final, separado do que veio de fonte.
 *
 * Julgamento humano vive em pesquisa/ajustes-manuais.json e e mesclado por
 * cima, para que reexecutar o script nao perca trabalho manual.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  relatorioDeDerivacoes,
} from './lib/pesquisa-utils.ts';

const RAIZ = resolve(import.meta.dirname, '..');
const PESQUISA = join(RAIZ, 'pesquisa');
const SAIDA = join(RAIZ, 'data', 'colombia');

function ler(arquivo: string): Json {
  return JSON.parse(readFileSync(join(PESQUISA, arquivo), 'utf8'));
}

function main(): void {
  console.log('Importando pesquisa -> data/colombia\n');

  const logistica = ler('onda-a-logistica.json');
  const coords = ler('coords-cidades.json');

  // Le TODA onda de pesquisa que declare uma `base`. Assim a onda C entra
  // sem tocar neste arquivo: basta soltar o JSON em pesquisa/.
  const bases: Json = {};
  for (const arquivo of readdirSync(PESQUISA).sort()) {
    if (!/^onda-.*\.json$/.test(arquivo)) continue;
    const conteudo = ler(arquivo);
    if (!conteudo.base || !Array.isArray(conteudo.itens)) continue;
    if (bases[conteudo.base]) {
      console.log(`  aviso: ${arquivo} repete a base "${conteudo.base}"`);
    }
    bases[conteudo.base] = conteudo;
  }
  console.log(`  bases lidas: ${Object.keys(bases).join(', ')}
`);

  const ajustes: Json = existsSync(join(PESQUISA, 'ajustes-manuais.json'))
    ? ler('ajustes-manuais.json')
    : {};
  if (!ajustes.itens) console.log('  (sem pesquisa/ajustes-manuais.json)\n');

  gravar(SAIDA, 'destino.json', construirDestino(logistica));
  gravar(SAIDA, 'regioes.json', filtrarSemFonte(construirRegioes(logistica), 'regiao'));
  gravar(SAIDA, 'aeroportos.json', filtrarSemFonte(construirAeroportos(logistica), 'aeroporto'));
  gravar(SAIDA, 'cidades.json', filtrarSemFonte(construirCidades(logistica, coords, bases, ajustes), 'cidade'));

  const itensPorCidade = construirItens(Object.values(bases), ajustes);
  for (const [cidadeId, itens] of Object.entries(itensPorCidade)) {
    gravar(SAIDA, join('itens', `${cidadeId}.json`), filtrarSemFonte(itens, 'item'));
  }

  gravar(SAIDA, 'trechos.json', filtrarSemFonte(construirTrechos(logistica), 'trecho'));
  gravar(SAIDA, 'voos-internacionais.json', filtrarSemFonte(construirVoos(logistica), 'voo internacional'));
  // Eventos escritos a mao entram por cima: sao os que exigiram verificacao
  // em fonte primaria pelo agente principal (datas de fechamento, desastres).
  const calendario = [
    ...construirCalendario(logistica),
    ...((ajustes.calendario ?? []) as Json[]),
  ];
  gravar(SAIDA, 'calendario.json', filtrarSemFonte(calendario, 'evento'));
  gravar(SAIDA, 'hospedagem.json', filtrarSemFonte(construirHospedagem(bases), 'hospedagem'));

  console.log('\nDeduzido pelo script (nao e dado de fonte):');
  for (const [rotulo, n] of relatorioDeDerivacoes()) {
    console.log(`  ${String(n).padStart(4)}x ${rotulo}`);
  }

  if (avisos.length > 0) {
    console.log(`\n${avisos.length} aviso(s) - material para docs/pendencias-de-verificacao.md:`);
    for (const aviso of avisos) console.log(`  - ${aviso}`);
  }

  console.log('\nAgora rode: npm run validate:data');
}

main();
