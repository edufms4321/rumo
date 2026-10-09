import { Compass, Heart, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PainelDoItem } from '../componentes/PainelDoItem.tsx';
import { IdadeDoDado, PrecoExibido, SeloDeConfianca } from '../componentes/procedencia.tsx';
import { Botao, Campo, Cartao, Selo, Vazio } from '../componentes/ui.tsx';
import {
  DICA_DO_GRUPO,
  type Grupo,
  NOME_DO_GRUPO,
  grupoDoItem,
  gruposDoItem,
} from '../engine/grupos.ts';
import { formatarDuracao } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import type { Item } from '../schema/item.ts';
import { acoes, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function Descobrir() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();

  const [busca, definirBusca] = useState('');
  const [cidade, definirCidade] = useState<string>();
  const [estado, definirEstado] = useState<string>();
  const [grupo, definirGrupo] = useState<Grupo>();
  const [categoria, definirCategoria] = useState<string>();
  const [soFavoritos, definirSoFavoritos] = useState(false);
  const [mostrarDescartados, definirMostrarDescartados] = useState(false);
  const [aberto, definirAberto] = useState<string>();
  const [filtrosVisiveis, definirFiltrosVisiveis] = useState(false);

  /** cidade -> estado, para o filtro por estado. */
  const estadoDaCidade = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of pacote?.cidades ?? []) if (c.estadoId) m.set(c.id, c.estadoId);
    return m;
  }, [pacote]);

  /*
    Os filtros entram em duas etapas de proposito. `semGrupo` tem tudo menos o
    recorte de grupo, e e dali que saem as CONTAGENS das pilulas de grupo -
    assim "Comer 12" quer dizer doze itens de comer dentro do que esta
    filtrado agora, nao doze no pacote inteiro. Contagem que nao reage ao
    filtro vira mentira na tela: o usuario clica em "Bares 25" com a Bahia
    selecionada e recebe tres.
  */
  const semGrupo = useMemo(() => {
    if (!pacote || !viagem) return [];
    const termo = semAcento(busca.trim());

    return pacote.itens
      .filter((i) => (mostrarDescartados ? viagem.descartados[i.id] : !viagem.descartados[i.id]))
      .filter((i) => (soFavoritos ? viagem.favoritos.includes(i.id) : true))
      .filter((i) => (estado ? estadoDaCidade.get(i.cidadeId) === estado : true))
      .filter((i) => (cidade ? i.cidadeId === cidade : true))
      .filter((i) => (categoria ? i.categoria === categoria : true))
      .filter((i) => {
        if (!termo) return true;
        const alvo = semAcento(`${i.nome} ${i.descricaoCurta} ${i.tags.join(' ')} ${i.categoria}`);
        return termo.split(/\s+/).every((p) => alvo.includes(p));
      });
  }, [
    pacote,
    viagem,
    busca,
    cidade,
    estado,
    categoria,
    soFavoritos,
    mostrarDescartados,
    estadoDaCidade,
  ]);

  const contagemPorGrupo = useMemo(() => {
    const conta = new Map<Grupo, number>();
    // Conta por PERTENCIMENTO, nao pelo grupo principal: quem filtra Cultura
    // quer o bate-volta a Sao Cristovao, que e classificado como Passeio.
    for (const i of semGrupo) for (const g of gruposDoItem(i)) conta.set(g, (conta.get(g) ?? 0) + 1);
    return conta;
  }, [semGrupo]);

  const itens = useMemo(() => {
    if (!viagem) return [];
    return semGrupo
      .filter((i) => (grupo ? gruposDoItem(i).includes(grupo) : true))
      .sort((a, b) => {
        const fa = viagem.favoritos.includes(a.id) ? 0 : 1;
        const fb = viagem.favoritos.includes(b.id) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        const ordem = { verificado: 0, parcial: 1, estimado: 2 };
        return ordem[a.confianca] - ordem[b.confianca];
      });
  }, [semGrupo, grupo, viagem]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  const estados = pacote.estados
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      sigla: e.sigla,
      n: pacote.itens.filter((i) => estadoDaCidade.get(i.cidadeId) === e.id).length,
    }))
    .filter((e) => e.n > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // A lista de bases obedece ao estado escolhido: com a Bahia selecionada,
  // mostrar as 23 bases do Nordeste faria o filtro parecer quebrado.
  const cidades = pacote.cidades
    .filter((c) => (estado ? c.estadoId === estado : true))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      n: pacote.itens.filter((i) => i.cidadeId === c.id).length,
    }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const categorias = [...new Set(pacote.itens.map((i) => i.categoria))].sort();
  const gruposVisiveis = [...contagemPorGrupo.entries()].filter(([, n]) => n > 0);
  const quantosDescartados = Object.keys(viagem.descartados).length;
  const temFiltro = Boolean(cidade || estado || categoria || grupo || busca || soFavoritos);

  function limpar() {
    definirBusca('');
    definirCidade(undefined);
    definirEstado(undefined);
    definirGrupo(undefined);
    definirCategoria(undefined);
    definirSoFavoritos(false);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cor-texto-fraco)]"
            size={15}
          />
          <Campo
            aria-label="Buscar"
            className="pl-9"
            onChange={(e) => definirBusca(e.target.value)}
            placeholder={`Buscar entre ${pacote.itens.length} itens...`}
            value={busca}
          />
          {busca && (
            <button
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--cor-texto-fraco)] hover:text-[var(--cor-texto)]"
              onClick={() => definirBusca('')}
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Botao
          onClick={() => definirSoFavoritos(!soFavoritos)}
          variante={soFavoritos ? 'principal' : 'contorno'}
        >
          <Heart fill={soFavoritos ? 'currentColor' : 'none'} size={15} />
          {viagem.favoritos.length}
        </Botao>

        <Botao
          aria-expanded={filtrosVisiveis}
          onClick={() => definirFiltrosVisiveis(!filtrosVisiveis)}
          variante={cidade || estado || categoria ? 'principal' : 'contorno'}
        >
          <SlidersHorizontal size={15} />
          Filtros
        </Botao>
      </div>

      {/*
        A fileira de grupos fica SEMPRE visivel, fora do painel de filtros.
        Ela e a organizacao principal do acervo: esconde-la atras de um botao
        era o que fazia a tela parecer uma lista unica de centenas de itens.
      */}
      {gruposVisiveis.length > 1 && (
        <nav aria-label="Grupos" className="mb-4 flex flex-wrap gap-1.5">
          <Pilula ativo={!grupo} aoClicar={() => definirGrupo(undefined)}>
            tudo <span className="opacity-60">{semGrupo.length}</span>
          </Pilula>
          {gruposVisiveis.map(([g, n]) => (
            <Pilula
              ativo={grupo === g}
              aoClicar={() => definirGrupo(grupo === g ? undefined : g)}
              key={g}
              titulo={DICA_DO_GRUPO[g]}
            >
              {NOME_DO_GRUPO[g]} <span className="opacity-60">{n}</span>
            </Pilula>
          ))}
        </nav>
      )}

      {filtrosVisiveis && (
        <Cartao className="mb-5 p-4">
          {estados.length > 1 && (
            <Grupo titulo="Estado">
              <Pilula ativo={!estado} aoClicar={() => definirEstado(undefined)}>
                todos
              </Pilula>
              {estados.map((e) => (
                <Pilula
                  ativo={estado === e.id}
                  aoClicar={() => {
                    // Trocar de estado zera a base: Salvador nao existe no Ceara.
                    definirCidade(undefined);
                    definirEstado(estado === e.id ? undefined : e.id);
                  }}
                  key={e.id}
                >
                  {e.nome} <span className="opacity-60">{e.n}</span>
                </Pilula>
              ))}
            </Grupo>
          )}
          <Grupo titulo="Base">
            <Pilula ativo={!cidade} aoClicar={() => definirCidade(undefined)}>
              todas
            </Pilula>
            {cidades.map((c) => (
              <Pilula
                ativo={cidade === c.id}
                aoClicar={() => definirCidade(cidade === c.id ? undefined : c.id)}
                key={c.id}
              >
                {c.nome} <span className="opacity-60">{c.n}</span>
              </Pilula>
            ))}
          </Grupo>
          <Grupo titulo="Tipo exato (refina o grupo)">
            <Pilula ativo={!categoria} aoClicar={() => definirCategoria(undefined)}>
              todas
            </Pilula>
            {categorias.map((c) => (
              <Pilula
                ativo={categoria === c}
                aoClicar={() => definirCategoria(categoria === c ? undefined : c)}
                key={c}
              >
                {c.replaceAll('-', ' ')}
              </Pilula>
            ))}
          </Grupo>
          {quantosDescartados > 0 && (
            <div className="mt-3 border-t border-[var(--cor-borda)] pt-3">
              <Botao
                onClick={() => definirMostrarDescartados(!mostrarDescartados)}
                tamanho="pequeno"
                variante={mostrarDescartados ? 'principal' : 'fantasma'}
              >
                <RotateCcw size={13} />
                {mostrarDescartados ? 'Voltar aos ativos' : `Ver ${quantosDescartados} descartados`}
              </Botao>
            </div>
          )}
        </Cartao>
      )}

      {/* Degrau entre o h1 do Layout e os h3 dos cartoes: sem ele o leitor
          de tela pula um nivel. */}
      <h2 className="sr-only">Resultados</h2>
      <p className="mb-3 text-xs text-[var(--cor-texto-suave)]">
        {itens.length} {itens.length === 1 ? 'resultado' : 'resultados'}
        {temFiltro && (
          <button
            className="ml-2 underline decoration-dotted hover:text-[var(--cor-texto)]"
            onClick={limpar}
            type="button"
          >
            limpar filtros
          </button>
        )}
      </p>

      {itens.length === 0 ? (
        <Vazio icone={<Compass size={26} />} titulo="Nada com esses filtros">
          Tente outra palavra, ou limpe os filtros.
        </Vazio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {itens.map((item) => (
            <li key={item.id}>
              <CartaoDeItem
                aoAbrir={() => definirAberto(item.id)}
                favorito={viagem.favoritos.includes(item.id)}
                hoje={hoje}
                item={item}
                pessoas={viagem.viajantes.adultos + viagem.viajantes.criancas}
                taxas={viagem.cambio.taxas}
              />
            </li>
          ))}
        </ul>
      )}

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

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-[var(--cor-texto-fraco)]">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pilula({
  ativo,
  aoClicar,
  children,
  titulo,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
  titulo?: string;
}) {
  return (
    <button
      className={cn(
        'rounded-full px-2.5 py-1 text-xs transition-colors',
        ativo
          ? 'bg-[var(--cor-acento)] text-[var(--cor-acento-texto)]'
          : 'bg-[var(--cor-fundo-afundado)] text-[var(--cor-texto-suave)] hover:text-[var(--cor-texto)]',
      )}
      onClick={aoClicar}
      title={titulo}
      type="button"
    >
      {children}
    </button>
  );
}

function CartaoDeItem({
  item,
  favorito,
  hoje,
  taxas,
  pessoas,
  aoAbrir,
}: {
  item: Item;
  favorito: boolean;
  hoje: string;
  taxas: Record<string, number>;
  pessoas: number;
  aoAbrir: () => void;
}) {
  const imagem = item.imagens[0];

  return (
    <Cartao className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[var(--sombra-flutuante)]">
      <button
        aria-label={`Abrir ${item.nome}`}
        className="relative block h-32 w-full shrink-0 overflow-hidden bg-[var(--cor-fundo-afundado)] text-left"
        onClick={aoAbrir}
        type="button"
      >
        {imagem ? (
          <img
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            src={imagem.url}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-2xs text-[var(--cor-texto-fraco)]">
            sem imagem com licenca livre
          </span>
        )}
        <span className="absolute left-2 top-2">
          <SeloDeConfianca compacto nivel={item.confianca} />
        </span>
      </button>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <button className="min-w-0 text-left" onClick={aoAbrir} type="button">
            <h3 className="text-sm font-medium leading-snug hover:text-[var(--cor-acento)]">
              {item.nome}
            </h3>
          </button>
          <button
            aria-label={favorito ? 'Remover dos favoritos' : 'Favoritar'}
            aria-pressed={favorito}
            className={cn(
              'shrink-0 rounded p-1 transition-colors',
              favorito
                ? 'text-[var(--cor-acento)]'
                : 'text-[var(--cor-texto-fraco)] hover:text-[var(--cor-acento)]',
            )}
            onClick={() => acoes.alternarFavorito(item.id)}
            type="button"
          >
            <Heart fill={favorito ? 'currentColor' : 'none'} size={16} />
          </button>
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--cor-texto-suave)]">
          {item.descricaoCurta}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          {/* O grupo no cartao responde "por que isto apareceu no filtro
              Cultura?" sem precisar abrir o item. */}
          <Selo tom="neutro">{NOME_DO_GRUPO[grupoDoItem(item)]}</Selo>
          {item.selos.slice(0, 2).map((s) => (
            <Selo key={s} tom={s === 'pega-turista' ? 'atencao' : 'neutro'}>
              {s.replaceAll('-', ' ')}
            </Selo>
          ))}
        </div>

        <div className="mt-auto space-y-1 pt-3 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[var(--cor-texto-fraco)]">
              {item.duracao ? formatarDuracao(item.duracao.tipica) : 'referencia'}
            </span>
            {item.gratuito ? (
              <Selo tom="verificado">gratuito</Selo>
            ) : item.preco ? (
              <PrecoExibido pessoas={pessoas} preco={item.preco} taxas={taxas} />
            ) : (
              <span className="text-2xs text-[var(--cor-estimado)]">sem preco</span>
            )}
          </div>
          <IdadeDoDado coletadoEm={item.coletadoEm} hoje={hoje} />
        </div>
      </div>
    </Cartao>
  );
}
