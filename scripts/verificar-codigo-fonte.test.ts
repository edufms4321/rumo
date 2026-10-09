/**
 * Varredura do codigo-fonte por caractere de controle.
 *
 * Por que isto e um teste e nao uma regra de lint: o oxlint e o tsc passam
 * limpos com o arquivo corrompido, porque `/<backspace>(mapa|map)/` e uma
 * expressao regular VALIDA — ela so nao casa com nada.
 *
 * O estrago era real e estava no repositorio desde antes de eu procurar.
 * Cinco linhas tinham o `\b` de fim de palavra trocado por um caractere de
 * backspace de verdade (0x08), porque foram escritas por uma ferramenta de
 * substituicao que come uma camada de barra invertida:
 *
 *  - completar-imagens.ts: o filtro que deveria recusar nome de arquivo com
 *    cara de mapa nunca recusou nada;
 *  - pesquisa-itens.ts: `scuba` e `diving` nunca foram reconhecidos como
 *    mergulho, entao item com esse nome passava sem a regra de nao voar;
 *  - pesquisa-colecoes.ts: dois filtros de taxa com a mesma falha.
 *
 * Nenhum teste pegava, porque nenhum deles afirmava sobre a expressao em si.
 * Este afirma sobre o arquivo.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const IGNORAR = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);

/** Tudo abaixo de 0x20 menos tabulacao, nova linha e retorno de carro. */
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

function fontes(pasta: string, achados: string[] = []): string[] {
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) fontes(caminho, achados);
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho);
  }
  return achados;
}

describe('codigo-fonte', () => {
  it('nao tem caractere de controle em nenhum .ts (barra invertida comida)', () => {
    const problemas: string[] = [];
    for (const arquivo of fontes('.')) {
      const linhas = readFileSync(arquivo, 'utf8').split('\n');
      linhas.forEach((linha, i) => {
        if (CONTROLE.test(linha)) problemas.push(`${arquivo}:${i + 1}`);
      });
    }
    expect(problemas, problemas.join('\n')).toEqual([]);
  });
});
