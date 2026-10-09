/**
 * Imprime como o classificador de grupos distribuiu o banco inteiro.
 *
 * Existe porque classificador escrito a olho erra em silencio: a unica forma
 * de saber se "Bar do Zé" caiu em Bares e o forro caiu em Festas e olhar a
 * lista. Rode depois de mexer em src/engine/grupos.ts.
 *
 * Uso: npm run grupos [destino] [--todos]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GRUPOS, type Grupo, grupoDoItem } from '../src/engine/grupos.ts';
import type { Item } from '../src/schema/item.ts';

const alvo = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : undefined;
const todos = process.argv.includes('--todos');

for (const d of readdirSync('data')) {
  if (alvo && d !== alvo) continue;
  if (!existsSync(join('data', d, 'itens'))) continue;
  const itens: Item[] = [];
  for (const f of readdirSync(join('data', d, 'itens'))) {
    itens.push(...(JSON.parse(readFileSync(join('data', d, 'itens', f), 'utf8')) as Item[]));
  }
  const porGrupo = new Map<Grupo, Item[]>();
  for (const i of itens) {
    const g = grupoDoItem(i);
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g)?.push(i);
  }
  console.log(`\n##### ${d} — ${itens.length} itens`);
  for (const g of GRUPOS) {
    const l = porGrupo.get(g) ?? [];
    if (l.length === 0) continue;
    console.log(`\n  ${g} — ${l.length}`);
    const mostra = todos ? l : l.slice(0, 8);
    for (const i of mostra) console.log(`    ${i.categoria.padEnd(16)} ${i.nome}`);
    if (l.length > mostra.length) console.log(`    ...e mais ${l.length - mostra.length}`);
  }
}
