import { destinos } from './data/carregar.ts';
import type { Confianca, Item } from './schema/index.ts';

/**
 * Tela da Fase 1. Nao e a interface do produto - e a prova de que o banco
 * carrega, valida e chega na tela com procedencia visivel. A tela Descobrir
 * de verdade vem na Fase 4.
 */

const ROTULO_DE_CONFIANCA: Record<Confianca, { texto: string; classe: string }> = {
  verificado: {
    texto: 'verificado',
    classe: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/20',
  },
  parcial: {
    texto: 'parcialmente verificado',
    classe: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/20',
  },
  estimado: {
    texto: 'estimado',
    classe: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-400/20',
  },
};

function formatarPreco(item: Item): string {
  if (item.gratuito) return 'gratuito';
  if (!item.preco) return 'preco nao encontrado';
  const { moeda, min, max, por } = item.preco;
  const formatador = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const faixa = min === max ? formatador.format(min) : `${formatador.format(min)} a ${formatador.format(max)}`;
  return `${moeda} ${faixa} por ${por}`;
}

function formatarDuracao(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

function Selo({ confianca }: { confianca: Confianca }) {
  const { texto, classe } = ROTULO_DE_CONFIANCA[confianca];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${classe}`}
    >
      {texto}
    </span>
  );
}

function CartaoDeItem({ item }: { item: Item }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.nome}</h3>
        <Selo confianca={item.confianca} />
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.descricaoCurta}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        <div>
          <dt className="inline font-medium">Categoria: </dt>
          <dd className="inline">{item.categoria}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Duracao tipica: </dt>
          <dd className="inline">{formatarDuracao(item.duracao.tipica)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Preco: </dt>
          <dd className="inline">{formatarPreco(item)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Coletado em: </dt>
          <dd className="inline">{item.coletadoEm}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
        {item.fontes.length} fonte(s):{' '}
        {item.fontes.map((fonte, indice) => (
          <span key={fonte.url}>
            {indice > 0 && ', '}
            <a
              className="underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:hover:text-slate-200"
              href={fonte.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {fonte.titulo ?? new URL(fonte.url).hostname}
            </a>
          </span>
        ))}
      </p>
    </li>
  );
}

export function App() {
  const totalDeErros = destinos.reduce(
    (soma, d) => soma + d.problemas.filter((p) => p.nivel === 'erro').length,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Fase 1</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Rumo</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Esqueleto, schema e validador. Esta tela existe para provar que o banco de destino
            carrega com procedencia visivel. A interface de verdade comeca na Fase 4.
          </p>
        </header>

        {destinos.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            Nenhum destino em <code>/data</code> ainda.
          </p>
        )}

        {destinos.map((destino) => {
          const erros = destino.problemas.filter((p) => p.nivel === 'erro');
          const avisos = destino.problemas.filter((p) => p.nivel === 'aviso');

          return (
            <section className="mt-10" key={destino.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">
                  {destino.pacote?.destino.nome ?? destino.id}
                </h2>
                <p className="text-xs text-slate-500">
                  {erros.length} erro(s), {avisos.length} aviso(s)
                </p>
              </div>

              {erros.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  {erros.map((problema) => (
                    <li key={`${problema.caminho}-${problema.mensagem}`}>
                      <span className="font-mono">{problema.caminho}</span> {problema.mensagem}
                    </li>
                  ))}
                </ul>
              )}

              {destino.pacote && (
                <>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    {destino.pacote.itens.length} itens em {destino.pacote.cidades.length} cidade(s),{' '}
                    {destino.pacote.trechos.length} trecho(s) entre cidades,{' '}
                    {destino.pacote.calendario.length} evento(s) no calendario.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {destino.pacote.itens.map((item) => (
                      <CartaoDeItem item={item} key={item.id} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          );
        })}

        <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800">
          Validacao no carregamento: {totalDeErros} erro(s). O mesmo codigo roda em{' '}
          <code>npm run validate:data</code>.
        </footer>
      </main>
    </div>
  );
}
