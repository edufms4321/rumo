import { CalendarPlus, Clock, Heart, MapPin, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PainelDoItem } from '../componentes/PainelDoItem.tsx';
import { PrecoExibido, SeloDeConfianca } from '../componentes/procedencia.tsx';
import { Botao, Cartao, Selo, Vazio } from '../componentes/ui.tsx';
import { formatarBRL } from '../engine/orcamento.ts';
import { formatarDuracao } from '../engine/tempo.ts';
import type { Item } from '../schema/item.ts';
import { acoes, novoId, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

export function Selecao() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();
  const navegar = useNavigate();
  const { viagemId } = useParams();
  const [aberto, definirAberto] = useState<string>();

  const grupos = useMemo(() => {
    if (!viagem || !pacote) return [];
    const favoritos = pacote.itens.filter((i) => viagem.favoritos.includes(i.id));
    const porCidade = new Map<string, Item[]>();
    for (const item of favoritos) {
      const lista = porCidade.get(item.cidadeId) ?? [];
      lista.push(item);
      porCidade.set(item.cidadeId, lista);
    }
    return [...porCidade.entries()]
      .map(([cidadeId, itens]) => {
        const cidade = pacote.cidades.find((c) => c.id === cidadeId);
        const minutos = itens.reduce((s, i) => s + (i.duracao?.tipica ?? 0), 0);
        const pessoas = viagem.viajantes.adultos + viagem.viajantes.criancas;
        let custoMin = 0;
        let semPreco = 0;
        for (const i of itens) {
          if (i.gratuito) continue;
          if (!i.preco) {
            semPreco += 1;
            continue;
          }
          const taxa = i.preco.moeda === 'BRL' ? 1 : viagem.cambio.taxas[i.preco.moeda];
          if (taxa === undefined) {
            semPreco += 1;
            continue;
          }
          custoMin += i.preco.min * taxa * (i.preco.por === 'pessoa' ? pessoas : 1);
        }
        const noitesAgendadas = viagem.dias.filter((d) => d.cidadeBaseId === cidadeId).length;
        return { cidadeId, cidade, itens, minutos, custoMin, semPreco, noitesAgendadas };
      })
      .sort((a, b) => b.itens.length - a.itens.length);
  }, [viagem, pacote]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  const totalDeMinutos = grupos.reduce((s, g) => s + g.minutos, 0);
  const totalDeCusto = grupos.reduce((s, g) => s + g.custoMin, 0);

  if (grupos.length === 0) {
    return (
      <Vazio icone={<Heart size={26} />} titulo="Nenhum favorito ainda">
        Vá em Descobrir e toque no coracao do que te interessa. Aqui eles aparecem agrupados por
        base, com soma de tempo e de custo, e a sugestao de quantas noites ficar em cada lugar.
      </Vazio>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Minha selecao</h1>
        <p className="mt-1.5 text-sm text-[var(--cor-texto-suave)]">
          {viagem.favoritos.length} itens em {grupos.length} base
          {grupos.length > 1 ? 's' : ''} · {formatarDuracao(totalDeMinutos)} de atividade ·{' '}
          a partir de {formatarBRL(totalDeCusto)}
        </p>
      </header>

      <div className="space-y-6">
        {grupos.map((g) => {
          const recomendadas = g.cidade?.noitesRecomendadas;
          const faltamNoites = recomendadas ? recomendadas.ideal - g.noitesAgendadas : 0;

          return (
            <section key={g.cidadeId}>
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <MapPin className="text-[var(--cor-acento)]" size={16} />
                  {g.cidade?.nome ?? g.cidadeId}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--cor-texto-suave)]">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} /> {formatarDuracao(g.minutos)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wallet size={12} /> a partir de {formatarBRL(g.custoMin)}
                  </span>
                  {g.semPreco > 0 && (
                    <Selo tom="estimado">{g.semPreco} sem preco no banco</Selo>
                  )}
                </div>
              </div>

              {recomendadas && (
                <p className="mb-2.5 text-xs text-[var(--cor-texto-suave)]">
                  A pesquisa recomenda {recomendadas.min} a {recomendadas.max} noites, idealmente{' '}
                  {recomendadas.ideal}. Voce agendou {g.noitesAgendadas}.
                  {faltamNoites > 0 && (
                    <span className="text-[var(--cor-atencao)]">
                      {' '}
                      Faltam {faltamNoites} para o ideal.
                    </span>
                  )}
                </p>
              )}

              <ul className="divide-y divide-[var(--cor-borda)] overflow-hidden rounded-[var(--raio)] border border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)]">
                {g.itens.map((item) => (
                  <li
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5"
                    key={item.id}
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => definirAberto(item.id)}
                      type="button"
                    >
                      <span className="block truncate text-sm hover:text-[var(--cor-acento)]">
                        {item.nome}
                      </span>
                      <span className="text-2xs text-[var(--cor-texto-fraco)]">
                        {item.categoria}
                        {item.duracao && ` · ${formatarDuracao(item.duracao.tipica)}`}
                      </span>
                    </button>
                    <SeloDeConfianca compacto nivel={item.confianca} />
                    {item.gratuito ? (
                      <Selo tom="verificado">gratuito</Selo>
                    ) : item.preco ? (
                      <PrecoExibido
                        pessoas={viagem.viajantes.adultos + viagem.viajantes.criancas}
                        preco={item.preco}
                        taxas={viagem.cambio.taxas}
                      />
                    ) : (
                      <span className="text-2xs text-[var(--cor-estimado)]">sem preco</span>
                    )}
                    <Botao
                      aria-label={`Tirar ${item.nome} dos favoritos`}
                      onClick={() => acoes.alternarFavorito(item.id)}
                      tamanho="icone"
                      variante="fantasma"
                    >
                      <Heart fill="currentColor" size={14} />
                    </Botao>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <Cartao className="mt-8 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-[var(--cor-texto-suave)]">
          Pronto para montar os dias? O calendario mostra tudo que voce escolheu num painel ao
          lado, para arrastar.
        </p>
        <Botao onClick={() => navegar(`/viagem/${viagemId}/calendario`)} variante="principal">
          <CalendarPlus size={15} />
          Ir para o calendario
        </Botao>
      </Cartao>

      <PainelDoItem
        aoFechar={() => definirAberto(undefined)}
        hoje={hoje}
        item={pacote.itens.find((i) => i.id === aberto)}
        pacote={pacote}
        viagem={viagem}
      />
    </div>
  );
}

export { novoId };
