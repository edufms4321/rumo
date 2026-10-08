import { Plus, Trash2, TriangleAlert, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Botao, Campo, Cartao, Rotulo, Secao, Selecao, Selo, Vazio } from '../componentes/ui.tsx';
import {
  type CategoriaDeCusto,
  calcularOrcamento,
  formatarBRL,
  formatarFaixaBRL,
} from '../engine/orcamento.ts';
import { cn } from '../lib/cn.ts';
import { acoes, novoId, usarPacote, usarViagem } from '../store/viagem.ts';

const NOME_DA_CATEGORIA: Record<CategoriaDeCusto, string> = {
  atividades: 'Atividades',
  refeicoes: 'Refeicoes',
  hospedagem: 'Hospedagem',
  'transporte-entre-cidades': 'Transporte entre cidades',
  'taxas-obrigatorias': 'Taxas obrigatorias',
};

export function Orcamento() {
  const viagem = usarViagem();
  const pacote = usarPacote();

  const orcamento = useMemo(
    () => (viagem && pacote ? calcularOrcamento(viagem, pacote) : undefined),
    [viagem, pacote],
  );

  const gastoReal = useMemo(() => {
    if (!viagem) return { total: 0, porCategoria: {} as Record<string, number> };
    let total = 0;
    const porCategoria: Record<string, number> = {};
    for (const g of viagem.gastos) {
      const taxa = g.moeda === 'BRL' ? 1 : (viagem.cambio.taxas[g.moeda] ?? 0);
      const emReais = g.valor * taxa;
      total += emReais;
      porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + emReais;
    }
    return { total, porCategoria };
  }, [viagem]);

  if (!viagem || !pacote || !orcamento) return <Vazio titulo="Viagem nao encontrada" />;

  const pessoas = viagem.viajantes.adultos + viagem.viajantes.criancas;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Orcamento</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Numero
          rotulo="Planejado"
          sub={`${formatarFaixaBRL(orcamento.totalPorPessoa)} por pessoa`}
          valor={formatarFaixaBRL(orcamento.total)}
        />
        <Numero
          alerta={orcamento.estourou}
          rotulo="Seu teto"
          sub={viagem.orcamento ? `${pessoas} pessoa(s)` : 'sem teto definido'}
          valor={orcamento.orcado ? formatarFaixaBRL(orcamento.orcado) : '—'}
        />
        <Numero
          rotulo="Gasto de verdade"
          sub={`${viagem.gastos.length} lancamento(s)`}
          valor={formatarBRL(gastoReal.total)}
        />
      </div>

      {orcamento.estourou && (
        <Cartao className="mb-6 flex gap-2 border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)] p-3 text-xs">
          <TriangleAlert className="mt-0.5 shrink-0 text-[var(--cor-erro)]" size={14} />
          <p>
            Ate o melhor caso do planejado ja passa do seu teto. E ha{' '}
            {orcamento.semPreco.length} item(ns) sem preco no banco, entao o real tende a ser
            maior.
          </p>
        </Cartao>
      )}

      <Secao titulo="Por categoria">
        <Cartao className="divide-y divide-[var(--cor-borda)]">
          {(Object.keys(NOME_DA_CATEGORIA) as CategoriaDeCusto[]).map((cat) => {
            const faixa = orcamento.porCategoria[cat];
            const real = gastoReal.porCategoria[cat] ?? 0;
            const proporcao =
              orcamento.total.max > 0 ? (faixa.max / orcamento.total.max) * 100 : 0;
            return (
              <div className="px-4 py-3" key={cat}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{NOME_DA_CATEGORIA[cat]}</span>
                  <span className="tabular shrink-0">
                    {faixa.max === 0 ? (
                      <span className="text-[var(--cor-texto-fraco)]">—</span>
                    ) : (
                      formatarFaixaBRL(faixa)
                    )}
                    {real > 0 && (
                      <span className="ml-2 text-xs text-[var(--cor-verificado)]">
                        real {formatarBRL(real)}
                      </span>
                    )}
                  </span>
                </div>
                {proporcao > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--cor-fundo-afundado)]">
                    <div
                      className="h-full rounded-full bg-[var(--cor-acento)]"
                      style={{ width: `${Math.min(100, proporcao)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </Cartao>
      </Secao>

      {Object.keys(orcamento.porCidade).length > 0 && (
        <Secao titulo="Por base">
          <Cartao className="divide-y divide-[var(--cor-borda)] text-sm">
            {Object.entries(orcamento.porCidade)
              .sort((a, b) => b[1].max - a[1].max)
              .map(([cidadeId, faixa]) => (
                <div className="flex justify-between gap-3 px-4 py-2.5" key={cidadeId}>
                  <span>{pacote.cidades.find((c) => c.id === cidadeId)?.nome ?? cidadeId}</span>
                  <span className="tabular">{formatarFaixaBRL(faixa)}</span>
                </div>
              ))}
          </Cartao>
        </Secao>
      )}

      {(orcamento.semPreco.length > 0 || orcamento.semConversao.length > 0) && (
        <Secao titulo="O que nao entrou na conta">
          <Cartao className="p-4 text-xs">
            {orcamento.semPreco.length > 0 && (
              <>
                <p className="mb-1.5 font-medium">
                  {orcamento.semPreco.length} item(ns) agendado(s) sem preco no banco
                </p>
                <p className="mb-3 leading-relaxed text-[var(--cor-texto-suave)]">
                  A pesquisa nao achou preco em fonte confiavel para: {orcamento.semPreco.join(', ')}
                  . O total acima esta menor do que a realidade.
                </p>
              </>
            )}
            {orcamento.semConversao.length > 0 && (
              <>
                <p className="mb-1.5 font-medium">Valores sem taxa de cambio</p>
                <ul className="space-y-0.5 text-[var(--cor-texto-suave)]">
                  {orcamento.semConversao.map((s) => (
                    <li key={s.rotulo}>
                      {s.rotulo}: {s.moeda} {s.faixa.min}–{s.faixa.max}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[var(--cor-texto-fraco)]">
                  Defina a taxa em Ajustes para estes entrarem no total. O app prefere deixar de
                  fora a somar com taxa inventada.
                </p>
              </>
            )}
          </Cartao>
        </Secao>
      )}

      <Secao titulo="Gasto real durante a viagem">
        <LancarGasto />
        {viagem.gastos.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--cor-texto-fraco)]">
            Nada lancado ainda. Durante a viagem, anote aqui o que gastou de verdade para comparar
            com o planejado.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--cor-borda)] overflow-hidden rounded-[var(--raio)] border border-[var(--cor-borda)]">
            {[...viagem.gastos].reverse().map((g) => (
              <li className="flex items-center gap-3 px-3 py-2 text-sm" key={g.id}>
                <span className="tabular w-20 shrink-0 text-xs text-[var(--cor-texto-fraco)]">
                  {g.data.slice(8, 10)}/{g.data.slice(5, 7)}
                </span>
                <span className="min-w-0 flex-1 truncate">{g.descricao}</span>
                <Selo tom="neutro">{g.categoria}</Selo>
                <span className="tabular shrink-0">
                  {g.moeda} {g.valor.toLocaleString('pt-BR')}
                </span>
                <Botao
                  aria-label="Remover lancamento"
                  onClick={() => acoes.removerGasto(g.id)}
                  tamanho="icone"
                  variante="fantasma"
                >
                  <Trash2 size={13} />
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  sub,
  alerta,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  alerta?: boolean;
}) {
  return (
    <Cartao className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-[var(--cor-texto-suave)]">
        <Wallet size={12} />
        {rotulo}
      </p>
      <p
        className={cn(
          'tabular mt-1 text-lg font-semibold',
          alerta && 'text-[var(--cor-erro)]',
        )}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-2xs text-[var(--cor-texto-fraco)]">{sub}</p>}
    </Cartao>
  );
}

function LancarGasto() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const [descricao, definirDescricao] = useState('');
  const [valor, definirValor] = useState('');
  const [moeda, definirMoeda] = useState(pacote?.destino.moeda ?? 'BRL');
  const [categoria, definirCategoria] = useState('atividades');

  function lancar() {
    const n = Number(valor);
    if (!descricao.trim() || !Number.isFinite(n) || n <= 0) return;
    acoes.registrarGasto({
      id: novoId('gasto'),
      data: new Date().toISOString().slice(0, 10),
      descricao: descricao.trim(),
      valor: n,
      moeda,
      categoria: categoria as never,
    });
    definirDescricao('');
    definirValor('');
  }

  if (!viagem) return null;

  return (
    <Cartao className="grid gap-2 p-3 sm:grid-cols-[1fr_7rem_6rem_10rem_auto]">
      <div>
        <Rotulo htmlFor="g-desc">O que foi</Rotulo>
        <Campo
          className="h-9"
          id="g-desc"
          onChange={(e) => definirDescricao(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lancar()}
          placeholder="almoco, taxi, ingresso..."
          value={descricao}
        />
      </div>
      <div>
        <Rotulo htmlFor="g-valor">Valor</Rotulo>
        <Campo
          className="h-9"
          id="g-valor"
          onChange={(e) => definirValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lancar()}
          type="number"
          value={valor}
        />
      </div>
      <div>
        <Rotulo htmlFor="g-moeda">Moeda</Rotulo>
        <Selecao
          className="h-9"
          id="g-moeda"
          onChange={(e) => definirMoeda(e.target.value)}
          value={moeda}
        >
          {[...new Set([pacote?.destino.moeda ?? 'BRL', 'BRL', 'USD'])].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Selecao>
      </div>
      <div>
        <Rotulo htmlFor="g-cat">Categoria</Rotulo>
        <Selecao
          className="h-9"
          id="g-cat"
          onChange={(e) => definirCategoria(e.target.value)}
          value={categoria}
        >
          {[
            'atividades',
            'refeicoes',
            'hospedagem',
            'transporte-entre-cidades',
            'transporte-local',
            'compras',
            'taxas-obrigatorias',
            'outros',
          ].map((c) => (
            <option key={c} value={c}>
              {c.replaceAll('-', ' ')}
            </option>
          ))}
        </Selecao>
      </div>
      <div className="flex items-end">
        <Botao className="h-9" onClick={lancar} variante="principal">
          <Plus size={14} /> Lancar
        </Botao>
      </div>
    </Cartao>
  );
}
