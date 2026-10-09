/**
 * Testes do classificador de grupos.
 *
 * Cada caso aqui e um erro que o classificador REALMENTE cometeu quando eu
 * rodei `npm run grupos` no banco de 947 itens. Nenhum e hipotetico.
 */
import { describe, expect, it } from 'vitest';
import type { Categoria, Item } from '../schema/item.ts';
import { GRUPOS, grupoDoItem, gruposDoItem } from './grupos.ts';

function item(p: {
  nome: string;
  categoria: Categoria;
  tags?: string[];
  descricaoCurta?: string;
  agendavel?: boolean;
}): Item {
  return {
    id: 'x',
    fontes: [{ url: 'https://exemplo.test' }],
    coletadoEm: '2026-10-09',
    confianca: 'parcial',
    nome: p.nome,
    cidadeId: 'c',
    categoria: p.categoria,
    tags: p.tags ?? [],
    descricaoCurta: p.descricaoCurta ?? 'descricao',
    descricaoLonga: '',
    agendavel: p.agendavel ?? true,
    duracao: { min: 30, tipica: 60, max: 120 },
    diasFechados: [],
    reserva: { necessaria: false },
    contato: {},
    imagens: [],
    restricoes: { outras: [] },
    selos: [],
    dicas: [],
    alertas: [],
  } as unknown as Item;
}

describe('grupoDoItem', () => {
  it('nao confunde a cidade de Barreirinhas com um bar', () => {
    // `\bbar` sem fim de palavra casava com "BARreirinhas".
    const i = item({
      nome: 'Planctons luminescentes na foz do Rio Preguicas',
      categoria: 'experiencia',
      tags: ['natureza', 'barreirinhas'],
    });
    expect(grupoDoItem(i)).not.toBe('bares');
  });

  it('nao manda centro historico para Bares por causa da vizinhanca', () => {
    // Lendo a descricao, este caiu em Bares: a descricao cita os bares em
    // volta. A descricao fala do entorno; o nome fala da coisa.
    const i = item({
      nome: 'Centro Historico de Joao Pessoa',
      categoria: 'atracao',
      tags: ['centro-historico', 'igrejas'],
      descricaoCurta: 'Casario colonial, com bares e restaurantes ao redor.',
    });
    expect(grupoDoItem(i)).toBe('cultura');
  });

  it('praia com kitesurf continua praia, e ganha aventura como secundario', () => {
    const i = item({
      nome: 'Praia de Atins e suas barracas',
      categoria: 'praia',
      tags: ['kitesurf', 'praia'],
    });
    expect(grupoDoItem(i)).toBe('praia-e-mar');
    expect(gruposDoItem(i)).toContain('aventura');
  });

  it('bar que abre a noite e bar; bar de forro e festa', () => {
    const comum = item({
      nome: 'Urra Beer Barreirinhas',
      categoria: 'bar',
      tags: ['vida-noturna', 'noite', 'cerveja'],
    });
    expect(grupoDoItem(comum)).toBe('bares');

    const festa = item({
      nome: 'Bar do Cachorro',
      categoria: 'bar',
      tags: ['forro', 'vida-noturna'],
    });
    expect(grupoDoItem(festa)).toBe('festas-e-musica');
  });

  it('cartao de referencia nao entra em grupo de atividade', () => {
    const i = item({
      nome: 'AVISO: a balsa do Rio Preguicas e a fila que come seu fim de tarde',
      categoria: 'experiencia',
      tags: ['logistica', 'balsa'],
      agendavel: false,
    });
    expect(grupoDoItem(i)).toBe('referencia');
    expect(gruposDoItem(i)).toEqual(['referencia']);
  });

  it('bate-volta a patrimonio da UNESCO aparece em Passeios E em Cultura', () => {
    const i = item({
      nome: 'Sao Cristovao e a Praca Sao Francisco (Patrimonio Mundial)',
      categoria: 'passeio',
      tags: ['unesco', 'bate-volta', 'historia'],
    });
    expect(grupoDoItem(i)).toBe('passeios');
    expect(gruposDoItem(i)).toContain('cultura');
  });

  it('mergulho com cilindro e aventura, nao praia', () => {
    const i = item({
      nome: 'Batismo de mergulho em Noronha',
      categoria: 'experiencia',
      tags: ['mergulho', 'praia'],
    });
    expect(grupoDoItem(i)).toBe('aventura');
  });

  it('todo grupo devolvido existe na lista de grupos', () => {
    const casos: Item[] = [
      item({ nome: 'Museu X', categoria: 'museu' }),
      item({ nome: 'Locadora Y', categoria: 'aluguel-veiculo' }),
      item({ nome: 'Mirante Z', categoria: 'mirante' }),
      item({ nome: 'Coisa sem palavra reconhecivel', categoria: 'experiencia' }),
      item({ nome: 'Outra coisa', categoria: 'atracao' }),
    ];
    for (const c of casos) {
      expect(GRUPOS).toContain(grupoDoItem(c));
      for (const g of gruposDoItem(c)) expect(GRUPOS).toContain(g);
    }
  });
});
