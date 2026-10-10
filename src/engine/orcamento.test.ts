/**
 * Testes do orcamento, com foco nas taxas obrigatorias.
 *
 * Por que comecam por aqui: as taxas sao o maior custo FIXO de um pacote e
 * o unico que o viajante nao pode cortar. As duas de Fernando de Noronha
 * ficaram fora do orcamento por meses — o filtro de "percentual nao e taxa"
 * lia a prosa explicativa e derrubava a TPA porque o texto dela diz
 * "reajuste de 4,4%". Nao havia teste de unidade nenhum sobre orcamento.
 */
import { describe, expect, it } from 'vitest';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { pacoteParaRegras } from './fixtures-regras.ts';
import { dia, pacoteDeTeste, viagemDeTeste } from './fixtures-de-teste.ts';
import { calcularOrcamento } from './orcamento.ts';

/** Tabela progressiva de brinquedo: 1 dia 100, 2 dias 180, 3 dias 240. */
const TABELA = [
  { dias: 1, valor: 100 },
  { dias: 2, valor: 180 },
  { dias: 3, valor: 240 },
];

function pacoteComTaxa(tabelaPorDias: Array<{ dias: number; valor: number }>): PacoteDestino {
  const pacote = pacoteParaRegras();
  const rio = pacote.cidades.find((c) => c.id === 'rio');
  if (!rio) throw new Error('fixture sem a cidade rio');
  rio.taxasObrigatorias = [
    {
      nome: 'Taxa progressiva de teste',
      tabelaPorDias,
      preco: {
        moeda: 'BRL',
        min: 100,
        max: 240,
        por: 'pessoa',
        inclui: 'entrada',
        coletadoEm: '2026-10-09',
        fontes: [{ url: 'https://exemplo.test/taxa' }],
      },
      comoSePaga: '',
      quemPaga: 'todo visitante',
    },
  ];
  return pacote;
}

function taxaNoOrcamento(pacote: PacoteDestino, noites: number) {
  const dias = Array.from({ length: noites }, (_, i) =>
    dia(`d${i + 1}`, `2027-05-${String(10 + i).padStart(2, '0')}`, 'rio', []),
  );
  const orcamento = calcularOrcamento(viagemDeTeste(dias), pacote);
  return orcamento.linhas.find((l) => l.categoria === 'taxas-obrigatorias');
}

describe('taxas obrigatorias no orcamento', () => {
  it('cobra a taxa da cidade onde se dorme', () => {
    const linha = taxaNoOrcamento(pacoteComTaxa([]), 2);
    expect(linha).toBeDefined();
    expect(linha?.rotulo).toContain('Taxa progressiva de teste');
  });

  it('usa a linha exata da tabela para o numero de noites', () => {
    const pacote = pacoteComTaxa(TABELA);
    // 2 viajantes no fixture: 180 na tabela vira 360 na conta.
    const duas = taxaNoOrcamento(pacote, 2);
    expect(duas?.faixaOriginal).toEqual({ min: 180, max: 180 });
    expect(duas?.faixaBRL.min).toBe(duas?.faixaBRL.max);

    const tres = taxaNoOrcamento(pacote, 3);
    expect(tres?.faixaOriginal).toEqual({ min: 240, max: 240 });
  });

  it('nao e a diaria multiplicada: 2 dias custam menos que 2 x 1 dia', () => {
    // E o ponto inteiro da tabela. A TPA de Noronha cobra R$ 520,50 por 5
    // dias, e nao os R$ 528,95 que a conta linear daria — e R$ 7.460,56 por
    // 30, que e MUITO mais que linear.
    const pacote = pacoteComTaxa(TABELA);
    const um = taxaNoOrcamento(pacote, 1)?.faixaOriginal.min ?? 0;
    const dois = taxaNoOrcamento(pacote, 2)?.faixaOriginal.min ?? 0;
    expect(dois).toBeLessThan(um * 2);
  });

  it('volta para a faixa quando a viagem passa do alcance da tabela', () => {
    // Extrapolar uma curva progressiva de que so se conhece o fim seria
    // inventar numero. A faixa diz "entre X e Y" e isso e honesto.
    const linha = taxaNoOrcamento(pacoteComTaxa(TABELA), 5);
    expect(linha?.faixaOriginal).toEqual({ min: 100, max: 240 });
  });

  it('sem tabela, a faixa do preco e o que entra', () => {
    const linha = taxaNoOrcamento(pacoteComTaxa([]), 2);
    expect(linha?.faixaOriginal).toEqual({ min: 100, max: 240 });
  });
});

describe('folga, mais caras e ponto de estouro', () => {
  /*
    O caso do briefing: plano fechando em R$ 11.624 de um teto de R$ 12.000,
    com uma unica linha (o voo) decidindo se cabe.
  */
  function viagemComTeto(precoDoVoo: number, tetoPorPessoa: number): Viagem {
    return {
      ...viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]),
      viajantes: { adultos: 2, criancas: 0, nacionalidade: 'BR' },
      orcamento: {
        moeda: 'BRL',
        porPessoa: tetoPorPessoa,
        incluiVoosInternacionais: true,
      },
      voo: {
        rotulo: 'GRU ida e volta',
        precoPorPessoa: precoDoVoo,
        moeda: 'BRL',
        comprado: false,
      },
    };
  }

  it('a folga e o teto menos o gasto, nos dois extremos', () => {
    const o = calcularOrcamento(viagemComTeto(3850, 12000), pacoteDeTeste());
    // 2 pessoas: voo soma 7700, teto soma 24000.
    expect(o.orcado).toEqual({ min: 24000, max: 24000 });
    expect(o.folga).toEqual({ min: 24000 - 7700, max: 24000 - 7700 });
    expect(o.estourou).toBe(false);
  });

  it('o voo a 4300 por pessoa ainda cabe; a 12100 nao', () => {
    expect(calcularOrcamento(viagemComTeto(4300, 12000), pacoteDeTeste()).estourou).toBe(false);
    const estourada = calcularOrcamento(viagemComTeto(12100, 12000), pacoteDeTeste());
    expect(estourada.estourou).toBe(true);
    expect(estourada.folga?.max).toBeLessThan(0);
  });

  it('sem teto nao ha folga: folga sem teto nao significa nada', () => {
    const semTeto = { ...viagemComTeto(3850, 12000) };
    delete semTeto.orcamento;
    const o = calcularOrcamento(semTeto, pacoteDeTeste());
    expect(o.folga).toBeUndefined();
    expect(o.pontoDeEstouro).toBeUndefined();
  });

  it('as mais caras vem da maior para a menor, no maximo tres', () => {
    const o = calcularOrcamento(viagemComTeto(3850, 12000), pacoteDeTeste());
    expect(o.maisCaras.length).toBeLessThanOrEqual(3);
    expect(o.maisCaras[0]?.rotulo).toBe('GRU ida e volta');
  });

  it('o ponto de estouro diz quanto a linha incerta ainda pode subir', () => {
    const o = calcularOrcamento(viagemComTeto(3850, 12000), pacoteDeTeste());
    // Com uma linha so, ela pode ir ate o teto inteiro.
    expect(o.pontoDeEstouro?.rotulo).toBe('GRU ida e volta');
    expect(o.pontoDeEstouro?.tetoDaLinhaBRL).toBe(24000);
    expect(o.pontoDeEstouro?.podeSubirBRL).toBe(24000 - 7700);
  });

  it('quando ja estourou, o ponto de estouro diz para quanto teria de cair', () => {
    const o = calcularOrcamento(viagemComTeto(15000, 12000), pacoteDeTeste());
    expect(o.pontoDeEstouro?.podeSubirBRL).toBeLessThan(0);
    expect(o.pontoDeEstouro?.tetoDaLinhaBRL).toBe(24000);
  });
});
