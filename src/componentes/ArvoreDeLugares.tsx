/**
 * A arvore de lugares de um pacote: regiao > estado > cidade-base.
 *
 * Por que isto existe: a tela inicial listava "Nordeste brasileiro" como UMA
 * opcao com 23 bases soltas dentro, e nao havia como ver que a Bahia tem
 * cinco delas nem que Noronha e um distrito de Pernambuco. Quem planeja
 * pensa por estado, entao o estado precisa aparecer.
 *
 * Usa <details> de proposito: abre e fecha pelo teclado sem codigo nenhum, e
 * continua funcionando com JavaScript travado.
 */
import { ChevronRight } from 'lucide-react';
import type { RegiaoNoIndice } from '../data/carregar.ts';

function plural(n: number, um: string, muitos: string): string {
  return `${n} ${n === 1 ? um : muitos}`;
}

export function ArvoreDeLugares({ arvore }: { arvore: RegiaoNoIndice[] }) {
  if (arvore.length === 0) return null;

  return (
    <ul className="mt-3 space-y-1.5">
      {arvore.map((regiao) => {
        const bases = regiao.estados.reduce((n, e) => n + e.cidades.length, 0);
        return (
          <li key={regiao.id}>
            <details className="group/r rounded-[var(--raio)] bg-[var(--cor-fundo-afundado)]">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium">
                <ChevronRight
                  className="shrink-0 transition-transform group-open/r:rotate-90"
                  size={13}
                />
                {regiao.nome}
                <span className="font-normal text-[var(--cor-texto-fraco)]">
                  {plural(regiao.estados.length, 'estado', 'estados')} ·{' '}
                  {plural(bases, 'base', 'bases')}
                </span>
              </summary>

              <ul className="space-y-0.5 px-2.5 pb-2 pl-6">
                {regiao.estados.map((estado) => (
                  <li key={estado.id}>
                    <details className="group/e">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-xs">
                        <ChevronRight
                          className="shrink-0 text-[var(--cor-texto-fraco)] transition-transform group-open/e:rotate-90"
                          size={12}
                        />
                        <span>{estado.nome}</span>
                        <span className="text-2xs text-[var(--cor-texto-fraco)]">
                          {estado.sigla} · {plural(estado.cidades.length, 'base', 'bases')}
                        </span>
                      </summary>
                      <p className="pb-1 pl-5 text-2xs leading-relaxed text-[var(--cor-texto-suave)]">
                        {estado.descricaoCurta}
                      </p>
                      <ul className="space-y-0.5 pb-1.5 pl-5">
                        {estado.cidades.map((cidade) => (
                          <li className="text-2xs text-[var(--cor-texto-suave)]" key={cidade.id}>
                            <span className="text-[var(--cor-texto)]">{cidade.nome}</span>
                            {/* A zona turistica repetindo o nome do estado nao
                                informa nada: "Fortaleza · Ceara" dentro do
                                estado do Ceara e ruido. */}
                            {cidade.zona && cidade.zona !== estado.nome && ` · ${cidade.zona}`}
                            {' — '}
                            {plural(cidade.itens, 'item', 'itens')}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
