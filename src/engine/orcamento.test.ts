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
import { pacoteParaRegras } from './fixtures-regras.ts';
import { dia, viagemDeTeste } from './fixtures-de-teste.ts';
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
