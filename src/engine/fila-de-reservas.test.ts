/**
 * Critério do briefing, item 4: "a lista abre com voo, visto e Frida no topo,
 * e marcar como reservado tira o item da fila."
 *
 * A ordem e o ponto. Antes, a fila so tinha atividade: o visto e a passagem
 * — as duas coisas que estragam a viagem se atrasarem — nao apareciam.
 */
import { describe, expect, it } from 'vitest';
import type { DocumentoDeEntrada } from '../schema/documento.ts';
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { filaDeReservas } from './fila-de-reservas.ts';
import { atividade, dia, pacoteDeTeste, viagemDeTeste } from './fixtures-de-teste.ts';

const HOJE = '2026-10-09';
const COMUM = {
  fontes: [{ url: 'https://exemplo.test/f' }],
  coletadoEm: '2026-10-08',
  confianca: 'verificado' as const,
};

function pacoteComFila(): PacoteDestino {
  const p = pacoteDeTeste();
  const visto: DocumentoDeEntrada = {
    ...COMUM,
    id: 'visto',
    nome: 'e-visto',
    tipo: 'visto',
    obrigatorio: true,
    nacionalidades: ['BR'],
    resumo: 'visto de teste',
    diasAntesDaViagem: 30,
    entradasPermitidas: 1,
    vias: ['aerea'],
    isencoes: [],
    escopo: 'nacional',
    linkOficial: 'https://exemplo.test/visto',
  };
  /* Uma atividade que pede reserva com 7 dias, como o museu da Frida. */
  const comReserva: Item = {
    ...(p.itens[2] as Item),
    id: 'museu-com-reserva',
    nome: 'Museu que exige reserva',
    reserva: { necessaria: true, antecedenciaDias: 7, esgotaRapido: true },
  };
  return {
    ...p,
    destino: { ...p.destino, documentos: [visto] },
    itens: [...p.itens, comReserva],
    voosInternacionais: [],
  };
}

function viagemComTudo(): Viagem {
  return {
    ...viagemDeTeste([
      dia('d1', '2026-11-22', 'sao-paulo', [atividade('b1', 'museu-com-reserva', 600, 90)]),
    ]),
    voo: { rotulo: 'GRU para o destino', moeda: 'BRL', comprado: false },
  };
}

describe('filaDeReservas', () => {
  it('abre com o voo, depois o visto, depois a atividade', () => {
    const fila = filaDeReservas(viagemComTudo(), pacoteComFila(), HOJE);
    expect(fila.map((p) => p.origem.tipo)).toEqual(['voo', 'documento', 'atividade']);
  });

  it('o voo entra sem data, porque nenhuma fonte diz "compre ate dia X"', () => {
    const voo = filaDeReservas(viagemComTudo(), pacoteComFila(), HOJE)[0];
    expect(voo?.urgencia).toBe('comprar-antes');
    expect(voo?.prazo).toBeUndefined();
    expect(voo?.nota).toMatch(/encarece/);
  });

  it('o prazo do visto sai de inicio menos antecedencia', () => {
    const visto = filaDeReservas(viagemComTudo(), pacoteComFila(), HOJE)[1];
    expect(visto?.prazo).toBe('2026-10-23');
    expect(visto?.diasAteOPrazo).toBe(14);
    expect(visto?.urgencia).toBe('apertado');
    expect(visto?.nota).toMatch(/entrada unica/);
  });

  it('prazo que ja passou vem antes de tudo, inclusive do voo', () => {
    const viagem = {
      ...viagemComTudo(),
      dias: [
        dia('d1', '2026-10-12', 'sao-paulo', [atividade('b1', 'museu-com-reserva', 600, 90)]),
      ],
    };
    /*
      Inicio 12/10. A reserva vence 05/10 e o visto vence 12/09, os dois
      antes de hoje (09/10). Os dois vencidos vem antes do voo, e entre eles
      o que venceu primeiro — porque e o que esta pior.
    */
    const fila = filaDeReservas(viagem, pacoteComFila(), HOJE);
    expect(fila.slice(0, 2).map((p) => p.urgencia)).toEqual(['vencido', 'vencido']);
    expect(fila.map((p) => p.origem.tipo)).toEqual(['documento', 'atividade', 'voo']);
    expect(fila[0]?.prazo).toBe('2026-09-12');
  });

  it('marcar como reservado tira o item da fila', () => {
    const viagem = viagemComTudo();
    const dia1 = viagem.dias[0];
    if (!dia1) throw new Error('sem dia');
    const bloco = dia1.blocos[0];
    if (!bloco || bloco.tipo !== 'atividade') throw new Error('sem bloco');
    const comReserva: Viagem = {
      ...viagem,
      dias: [{ ...dia1, blocos: [{ ...bloco, statusDeReserva: 'reservado' }] }],
    };
    const fila = filaDeReservas(comReserva, pacoteComFila(), HOJE);
    expect(fila.find((p) => p.origem.tipo === 'atividade')?.resolvida).toBe(true);
  });

  it('documento marcado como pronto sai resolvido', () => {
    const viagem: Viagem = { ...viagemComTudo(), documentos: { visto: { status: 'pronto' } } };
    const visto = filaDeReservas(viagem, pacoteComFila(), HOJE).find(
      (p) => p.origem.tipo === 'documento',
    );
    expect(visto?.resolvida).toBe(true);
  });

  it('voo comprado nao entra na fila', () => {
    const viagem: Viagem = {
      ...viagemComTudo(),
      voo: { rotulo: 'ja comprado', moeda: 'BRL', comprado: true },
    };
    const fila = filaDeReservas(viagem, pacoteComFila(), HOJE);
    expect(fila.find((p) => p.origem.tipo === 'voo')).toBeUndefined();
  });

  it('atividade sem antecedencia no banco vai para o fim, dizendo isso', () => {
    const pacote = pacoteComFila();
    const semAntecedencia = {
      ...pacote,
      itens: pacote.itens.map((i) =>
        i.id === 'museu-com-reserva' ? { ...i, reserva: { necessaria: true } } : i,
      ),
    };
    const fila = filaDeReservas(viagemComTudo(), semAntecedencia, HOJE);
    expect(fila[fila.length - 1]?.urgencia).toBe('sem-prazo');
  });
});
