/**
 * O que estes testes protegem:
 *
 * 1. uma taxa de estado nao e cobrada de quem nao entra no estado — e e
 *    cobrada de quem entra so num bate-volta, porque a taxa e por entrar;
 * 2. um documento de nacionalidade errada nao aparece;
 * 3. visto de entrada unica + roteiro que sai do pais = erro, que e o caso
 *    que o briefing pediu e o unico lugar do app em que visto e itinerario
 *    se olham juntos;
 * 4. visto sem o campo `entradasPermitidas` pesquisado NAO gera alerta:
 *    supor entrada unica assustaria sem base.
 */
import { describe, expect, it } from 'vitest';
import type { DocumentoDeEntrada } from '../schema/documento.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Bloco, Viagem } from '../schema/viagem.ts';
import { documentosDaViagem, escalasForaDoPais } from './documentos.ts';
import { atividade, dia, pacoteDeTeste, viagemDeTeste } from './fixtures-de-teste.ts';
import { validarViagem } from './regras.ts';

const COMUM = {
  fontes: [{ url: 'https://exemplo.test/fonte' }],
  coletadoEm: '2026-10-08',
  confianca: 'verificado' as const,
};

function doc(extra: Partial<DocumentoDeEntrada> & { id: string }): DocumentoDeEntrada {
  return {
    ...COMUM,
    nome: extra.id,
    tipo: 'visto',
    obrigatorio: true,
    nacionalidades: [],
    resumo: 'documento de teste',
    vias: [],
    isencoes: [],
    escopo: 'nacional',
    ...extra,
  } as DocumentoDeEntrada;
}

function pacoteCom(documentos: DocumentoDeEntrada[]): PacoteDestino {
  const p = pacoteDeTeste();
  return { ...p, destino: { ...p.destino, documentos } };
}

function trecho(escalaEmOutroPais?: string): Bloco {
  return {
    id: 'b-trecho',
    tipo: 'trecho',
    modal: 'voo',
    deCidadeId: 'sao-paulo',
    paraCidadeId: 'rio',
    startMin: 600,
    durationMin: 180,
    statusDeReserva: 'precisa-reservar',
    ...(escalaEmOutroPais ? { escalaEmOutroPais } : {}),
  };
}

describe('documentosDaViagem', () => {
  it('filtra por nacionalidade e deixa passar o que vale para todos', () => {
    const pacote = pacoteCom([
      doc({ id: 'visto-br', nacionalidades: ['BR'] }),
      doc({ id: 'visto-ar', nacionalidades: ['AR'] }),
      doc({ id: 'taxa-de-todos', tipo: 'taxa' }),
    ]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]);
    const ids = documentosDaViagem(viagem, pacote).map((d) => d.documento.id);
    expect(ids).toContain('visto-br');
    expect(ids).toContain('taxa-de-todos');
    expect(ids).not.toContain('visto-ar');
  });

  it('taxa de estado nao aparece para quem nao entra no estado', () => {
    const pacote = pacoteCom([doc({ id: 'taxa-do-rio', tipo: 'taxa', escopo: 'rio-de-janeiro' })]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]);
    expect(documentosDaViagem(viagem, pacote)).toHaveLength(0);
  });

  it('mas aparece quando o roteiro encosta no estado num bate-volta', () => {
    // Dorme em Sao Paulo, passeia em Copacabana: entrou no Rio, paga a taxa.
    const pacote = pacoteCom([doc({ id: 'taxa-do-rio', tipo: 'taxa', escopo: 'rio-de-janeiro' })]);
    const viagem = viagemDeTeste([
      dia('d1', '2026-11-22', 'sao-paulo', [atividade('b1', 'br-rio-copacabana', 600, 120)]),
    ]);
    const lista = documentosDaViagem(viagem, pacote);
    expect(lista).toHaveLength(1);
    expect(lista[0]?.motivoDoEscopo).toBe('Rio de Janeiro');
  });

  it('o prazo sai da data de inicio menos a antecedencia', () => {
    const pacote = pacoteCom([doc({ id: 'visto', diasAntesDaViagem: 30 })]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]);
    expect(documentosDaViagem(viagem, pacote)[0]?.prazo).toBe('2026-10-23');
  });

  it('sem antecedencia pesquisada nao ha prazo inventado', () => {
    const pacote = pacoteCom([doc({ id: 'visto' })]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]);
    expect(documentosDaViagem(viagem, pacote)[0]?.prazo).toBeUndefined();
  });

  it('escopo que nao casa com nada do pacote aparece, em vez de desaparecer', () => {
    // Esconder por id errado e a falha silenciosa mais cara possivel aqui.
    const pacote = pacoteCom([doc({ id: 'taxa', tipo: 'taxa', escopo: 'id-que-nao-existe' })]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]);
    expect(documentosDaViagem(viagem, pacote)).toHaveLength(1);
  });
});

describe('escalasForaDoPais', () => {
  it('acha o trecho marcado e ignora o que fica dentro do pais', () => {
    const viagem: Viagem = viagemDeTeste([
      dia('d1', '2026-11-22', 'sao-paulo', [trecho()]),
      { id: 'd2', data: '2026-11-23', cidadeBaseId: 'rio', blocos: [trecho('Panama')] },
    ]);
    const saidas = escalasForaDoPais(viagem);
    expect(saidas).toHaveLength(1);
    expect(saidas[0]?.pais).toBe('Panama');
  });
});

describe('erro: visto-de-entrada-unica', () => {
  const pacote = pacoteCom([
    doc({
      id: 'e-visto',
      nome: 'e-visto de teste',
      entradasPermitidas: 1,
      vias: ['aerea'],
      nacionalidades: ['BR'],
    }),
  ]);

  function alertas(viagem: Viagem) {
    return validarViagem(viagem, pacote).filter((a) => a.codigo === 'visto-de-entrada-unica');
  }

  it('acusa roteiro que sai do pais com visto de entrada unica', () => {
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [trecho('Panama')])]);
    const a = alertas(viagem)[0];
    expect(a?.nivel).toBe('erro');
    expect(a?.titulo).toMatch(/uma entrada so/);
    expect(a?.mensagem).toMatch(/Panama/);
    expect(a?.mensagem).toMatch(/so por via aerea/);
    expect(a?.correcoes[0]?.tipo).toBe('abrir-documentos');
  });

  it('cala quando nenhum trecho sai do pais', () => {
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [trecho()])]);
    expect(alertas(viagem)).toHaveLength(0);
  });

  it('cala quando o visto nao diz quantas entradas permite', () => {
    const semCampo = pacoteCom([doc({ id: 'visto-sem-campo', nacionalidades: ['BR'] })]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [trecho('Panama')])]);
    expect(
      validarViagem(viagem, semCampo).filter((a) => a.codigo === 'visto-de-entrada-unica'),
    ).toHaveLength(0);
  });

  it('cala para visto de multiplas entradas', () => {
    const multiplas = pacoteCom([
      doc({ id: 'visto-multiplo', entradasPermitidas: 2, nacionalidades: ['BR'] }),
    ]);
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [trecho('Panama')])]);
    expect(
      validarViagem(viagem, multiplas).filter((a) => a.codigo === 'visto-de-entrada-unica'),
    ).toHaveLength(0);
  });
});
