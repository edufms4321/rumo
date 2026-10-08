import { describe, expect, it } from 'vitest';
import { agruparPorDestino, montarPacote } from './montar-pacote.ts';

/**
 * Estes testes defendem o criterio de aceite 7 da v1: um segundo destino entra
 * criando uma pasta em /data/, sem tocar em codigo.
 */

describe('agruparPorDestino', () => {
  it('separa arquivos por pasta de destino', () => {
    const agrupado = agruparPorDestino({
      'colombia/destino.json': { id: 'colombia' },
      'colombia/itens/cartagena.json': [],
      'peru/destino.json': { id: 'peru' },
    });

    expect(Object.keys(agrupado).sort()).toEqual(['colombia', 'peru']);
    expect(Object.keys(agrupado.colombia!).sort()).toEqual([
      'destino.json',
      'itens/cartagena.json',
    ]);
  });

  it('remove o prefixo do caminho do navegador (import.meta.glob)', () => {
    const agrupado = agruparPorDestino(
      {
        '../../data/colombia/destino.json': { id: 'colombia' },
        '../../data/colombia/itens/san-andres.json': [],
      },
      '/data/',
    );

    expect(Object.keys(agrupado)).toEqual(['colombia']);
    expect(Object.keys(agrupado.colombia!).sort()).toEqual([
      'destino.json',
      'itens/san-andres.json',
    ]);
  });

  it('aceita barra invertida do Windows', () => {
    const agrupado = agruparPorDestino({ 'colombia\\itens\\baru.json': [] });
    expect(Object.keys(agrupado.colombia ?? {})).toEqual(['itens/baru.json']);
  });

  it('ignora arquivo solto na raiz de /data', () => {
    const agrupado = agruparPorDestino({ 'leia-me.json': {} });
    expect(Object.keys(agrupado)).toEqual([]);
  });
});

describe('montarPacote', () => {
  it('concatena todos os arquivos de itens/', () => {
    const { bruto, faltando, ignorados } = montarPacote({
      'destino.json': { id: 'colombia' },
      'itens/cartagena.json': [{ id: 'a' }, { id: 'b' }],
      'itens/san-andres.json': [{ id: 'c' }],
    });

    expect(faltando).toEqual([]);
    expect(ignorados).toEqual([]);
    expect(bruto.itens).toHaveLength(3);
  });

  it('mapeia voos-internacionais.json para a chave voosInternacionais', () => {
    const { bruto } = montarPacote({
      'destino.json': {},
      'voos-internacionais.json': [{ id: 'gru-bog' }],
    });
    expect(bruto.voosInternacionais).toHaveLength(1);
  });

  it('inicia todas as colecoes como lista vazia, mesmo sem arquivo', () => {
    const { bruto } = montarPacote({ 'destino.json': {} });
    for (const chave of [
      'regioes',
      'cidades',
      'aeroportos',
      'itens',
      'trechos',
      'voosInternacionais',
      'calendario',
      'hospedagem',
    ]) {
      expect(bruto[chave]).toEqual([]);
    }
  });

  it('acusa destino.json ausente', () => {
    const { faltando } = montarPacote({ 'cidades.json': [] });
    expect(faltando).toEqual(['destino.json']);
  });

  it('ignora arquivo fora da convencao, sem quebrar o resto', () => {
    const { bruto, ignorados } = montarPacote({
      'destino.json': {},
      'anotacoes.json': { rascunho: true },
      'cidades.json': [{ id: 'cartagena' }],
    });

    expect(ignorados).toEqual(['anotacoes.json']);
    expect(bruto.cidades).toHaveLength(1);
  });

  it('ignora subpasta que nao e itens/', () => {
    const { ignorados } = montarPacote({
      'destino.json': {},
      'rascunhos/cidades.json': [],
    });
    expect(ignorados).toEqual(['rascunhos/cidades.json']);
  });

  it('ignora arquivo de colecao que nao e lista, com motivo', () => {
    const { ignorados } = montarPacote({
      'destino.json': {},
      'cidades.json': { id: 'nao-sou-lista' },
    });
    expect(ignorados).toEqual(['cidades.json (esperava uma lista)']);
  });

  it('ignora arquivo de itens que nao e lista, com motivo', () => {
    const { ignorados } = montarPacote({
      'destino.json': {},
      'itens/errado.json': { id: 'nao-sou-lista' },
    });
    expect(ignorados).toEqual(['itens/errado.json (esperava uma lista)']);
  });
});
