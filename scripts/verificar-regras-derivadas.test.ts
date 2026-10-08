/**
 * O banco e gerado, entao os erros de derivacao aparecem nele, nao no
 * motor. Este teste le o que foi gerado e cobra coerencia.
 *
 * Nasceu de um defeito real: a regra "nao voar depois de mergulhar" —
 * que gera alerta de ERRO — estava pendurada em 32 itens, entre eles um
 * mercado, um taxi-aereo e uma praia de surfe, porque a palavra
 * "mergulho" aparecia em algum lugar da descricao. Alerta falso em nivel
 * de erro estraga a confianca em todos os outros.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESTINOS = readdirSync('data', { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join('data', e.name, 'destino.json')))
  .map((e) => e.name);

type Item = {
  nome: string;
  tags: string[];
  agendavel?: boolean;
  restricoes?: { naoVoarDepoisHoras?: number };
};

function itens(destino: string): Item[] {
  const pasta = join('data', destino, 'itens');
  return readdirSync(pasta).flatMap(
    (f) => JSON.parse(readFileSync(join(pasta, f), 'utf8')) as Item[],
  );
}

const MERGULHO = /mergulho|scuba|diving|buceo|padi|open water|batismo/i;

describe('regras derivadas do banco', () => {
  for (const destino of DESTINOS) {
    it(`${destino}: a regra de nao voar so aparece em mergulho agendavel`, () => {
      const errados = itens(destino)
        .filter((i) => i.restricoes?.naoVoarDepoisHoras)
        .filter((i) => i.agendavel === false || !MERGULHO.test([i.nome, ...i.tags].join(' ')))
        .map((i) => i.nome);
      expect(errados, errados.join('\n')).toEqual([]);
    });
  }
});
