/**
 * Mostra o motor de regras funcionando com os dados reais da Colombia, antes
 * de existir interface. Rode com:
 *
 *   npm run demo:dia
 *
 * Imprime um dia em Cartagena com os deslocamentos DERIVADOS entre os blocos,
 * cada um com a conta aberta. Serve para conferir o comportamento sem abrir
 * o navegador, e para ver na pratica a diferenca entre um numero com fonte e
 * uma estimativa do motor.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { agruparPorDestino, montarPacote } from '../src/data/montar-pacote.ts';
import { validarPacote } from '../src/schema/pacote.ts';
import { resolverDia } from '../src/engine/resolver-dia.ts';
import { formatarDuracao, paraHHMM, paraMinutos } from '../src/engine/tempo.ts';
import type { Bloco, Dia, Viagem } from '../src/schema/viagem.ts';
import { VERSAO_SCHEMA_VIAGEM } from '../src/schema/viagem.ts';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA_DE_DADOS = join(RAIZ, 'data');

const cor = {
  reset: '\u001B[0m',
  cinza: '\u001B[90m',
  verde: '\u001B[32m',
  amarelo: '\u001B[33m',
  vermelho: '\u001B[31m',
  azul: '\u001B[36m',
  negrito: '\u001B[1m',
};

function listarJson(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta)) {
    const caminho = join(pasta, entrada);
    if (statSync(caminho).isDirectory()) achados.push(...listarJson(caminho));
    else if (entrada.endsWith('.json')) achados.push(caminho);
  }
  return achados;
}

function carregarColombia() {
  const arquivos: Record<string, unknown> = {};
  for (const caminho of listarJson(PASTA_DE_DADOS)) {
    arquivos[relative(PASTA_DE_DADOS, caminho).replaceAll('\\', '/')] = JSON.parse(
      readFileSync(caminho, 'utf8'),
    );
  }
  const colombia = agruparPorDestino(arquivos).colombia;
  if (!colombia) throw new Error('data/colombia nao encontrado');
  const { pacote } = validarPacote(montarPacote(colombia).bruto);
  if (!pacote) throw new Error('o pacote da Colombia nao passou na validacao');
  return pacote;
}

function atividade(id: string, itemId: string, hhmm: string, duracao: number): Bloco {
  return {
    id,
    tipo: 'atividade',
    itemId,
    startMin: paraMinutos(hhmm),
    durationMin: duracao,
    statusDeReserva: 'nao-precisa',
  };
}

function main(): void {
  const pacote = carregarColombia();

  // Um dia plausivel em Cartagena, com um erro de proposito no fim:
  // a ultima atividade e em San Andres, que fica noutra ilha.
  const blocos: Bloco[] = [
    atividade('b1', 'co-ctg-castillo-san-felipe-de-barajas', '09:00', 90),
    atividade('b2', 'co-ctg-museo-del-oro-zenu', '11:00', 45),
    atividade('b3', 'co-ctg-ciudad-amurallada-e-muralhas-ao-por-do-sol', '16:30', 150),
    atividade('b4', 'co-adz-playa-spratt-bight', '20:00', 90),
  ];

  const dia: Dia = {
    id: 'dia-1',
    data: '2026-11-18',
    cidadeBaseId: 'cartagena',
    hospedagem: { nome: 'Hotel em Getsemani', moeda: 'COP', confirmada: false },
    blocos,
  };

  const viagem: Viagem = {
    versaoSchema: VERSAO_SCHEMA_VIAGEM,
    id: 'demo',
    nome: 'Demonstracao',
    destinoId: 'colombia',
    origem: { cidade: 'Sao Paulo', aeroportos: ['GRU'] },
    viajantes: { adultos: 2, criancas: 0 },
    estilo: 'economico',
    ritmo: 'intenso',
    interesses: [],
    cambio: { COP: 0.00155, USD: 5.4, atualizadoEm: '2026-10-08', manual: true },
    dias: [dia],
    favoritos: [],
    reservas: [],
    deslocamentos: {},
    criadoEm: '2026-10-08T12:00:00Z',
    atualizadoEm: '2026-10-08T12:00:00Z',
  };

  const r = resolverDia(viagem, dia, pacote);

  console.log(`\n${cor.negrito}${dia.data} — base em Cartagena${cor.reset}\n`);

  const porDepois = new Map(r.lacunas.map((l) => [l.depoisDe, l]));
  const primeira = r.lacunas.find((l) => l.depoisDe === 'hospedagem-inicio');

  function imprimirLacuna(l: (typeof r.lacunas)[number]): void {
    const d = l.deslocamento;
    if (!d) return;
    const marca = l.cabe ? `${cor.cinza}│${cor.reset}` : `${cor.vermelho}│${cor.reset}`;
    const selo =
      d.camada === 'estimativa' || d.camada === 'trecho-calculado'
        ? `${cor.amarelo}[estimativa]${cor.reset}`
        : d.camada === 'sem-dados'
          ? `${cor.vermelho}[sem dados]${cor.reset}`
          : `${cor.verde}[do banco]${cor.reset}`;

    console.log(`${marca}  ${cor.azul}${d.resumo}${cor.reset} ${selo}`);
    for (const passo of d.passos) {
      const sufixo = passo.estimado ? `${cor.amarelo} (estimado)${cor.reset}` : '';
      console.log(`${marca}     ${cor.cinza}${passo.rotulo}:${cor.reset} ${passo.valor}${sufixo}`);
    }
    if (l.tipo === 'saida-da-hospedagem' && l.horarioDeSaidaMin !== undefined) {
      console.log(
        `${marca}  ${cor.verde}saia da hospedagem as ${paraHHMM(l.horarioDeSaidaMin)}${cor.reset}`,
      );
    } else if (l.tipo === 'volta-para-hospedagem' && l.horarioDeChegadaMin !== undefined) {
      console.log(
        `${marca}  ${cor.verde}voce chega de volta as ${paraHHMM(l.horarioDeChegadaMin)}${cor.reset}`,
      );
    } else if (!l.cabe) {
      console.log(
        `${marca}  ${cor.vermelho}NAO CABE: faltam ${formatarDuracao(l.faltamMin)}.${cor.reset}`,
      );
      console.log(
        `${marca}  ${cor.cinza}correcoes: empurrar os proximos · encurtar a atividade · mover para outro dia${cor.reset}`,
      );
    } else if (l.minutosLivres !== null && l.minutosLivres > 0) {
      console.log(`${marca}  ${cor.cinza}sobram ${formatarDuracao(l.minutosLivres)} livres${cor.reset}`);
    }
    for (const aviso of d.avisos) console.log(`${marca}  ${cor.amarelo}! ${aviso}${cor.reset}`);
    console.log(`${marca}`);
  }

  if (primeira) imprimirLacuna(primeira);

  for (const b of r.blocos) {
    const inicio = paraHHMM(b.intervalo.inicio);
    const fim = paraHHMM(b.intervalo.fim);
    console.log(
      `${cor.negrito}${inicio}–${fim}${cor.reset}  ${b.rotulo} ${cor.cinza}(${formatarDuracao(
        b.bloco.durationMin,
      )})${cor.reset}`,
    );
    const seguinte = porDepois.get(b.bloco.id);
    if (seguinte) imprimirLacuna(seguinte);
  }

  console.log(`${cor.negrito}Resumo do dia${cor.reset}`);
  console.log(`  em atividades:    ${formatarDuracao(r.minutosEmAtividades)}`);
  console.log(`  em deslocamento:  ${formatarDuracao(r.minutosEmDeslocamento)}`);
  console.log(`  tempo livre:      ${formatarDuracao(r.minutosLivres)}`);
  console.log(
    `  conflitos:        ${r.lacunas.filter((l) => !l.cabe).length} (faltam ${formatarDuracao(
      r.minutosEmFalta,
    )} no total)`,
  );
  console.log(`  sobreposicoes:    ${r.sobreposicoes.length}\n`);
}

main();
