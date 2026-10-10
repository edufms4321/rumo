/**
 * A tela do dia: linha do tempo vertical, painel lateral com a selecao ainda
 * nao agendada, e os deslocamentos DERIVADOS entre os blocos.
 *
 * Decisoes de interacao que valem explicar:
 * - arrastar e so um dos caminhos. Todo bloco tem botoes de mover e de
 *   redimensionar que funcionam no teclado, porque arrastar com teclado e
 *   sempre pior que um botao claro;
 * - o deslocamento que NAO cabe aparece em vermelho sobrepondo o bloco
 *   seguinte, com "faltam X min" e as correcoes de um clique;
 * - o zoom da linha do tempo (melhoria 5) muda a densidade sem mudar nada
 *   do dado.
 */
import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  Clock,
  GripVertical,
  Hotel,
  Globe,
  Map as MapaIcone,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import { Botao, Campo, Cartao, ComDica, Painel, Selo, Vazio } from '../componentes/ui.tsx';
import type { Deslocamento } from '../engine/deslocamento.ts';
import {
  diferencaParaCasa,
  frasedeFuso,
  horariosDoTrecho,
  mudancaDeFusoNoDia,
  offsetDoDia,
  seloDeFuso,
} from '../engine/fusos.ts';
import { type Alerta, type TipoDeCorrecao, validarViagem } from '../engine/regras.ts';
import { type LacunaResolvida, resolverDia } from '../engine/resolver-dia.ts';
import { planoBDeChuva } from '../engine/sugestoes.ts';
import { formatarDuracao, paraHHMM } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import type { Bloco } from '../schema/viagem.ts';
import { acoes, novoId, usarHoje, usarLoja, usarPacote, usarViagem } from '../store/viagem.ts';

/* O mapa so e baixado quando o painel abre: maplibre pesa mais que o resto
   da tela somado, e a maioria das sessoes nunca o abre. */
const MapaDoDia = lazy(() =>
  import('../componentes/MapaDoDia.tsx').then((m) => ({ default: m.MapaDoDia })),
);

const ZOOMS = [0.7, 1.1, 1.8] as const;
const HORA_INICIAL = 5;
const HORA_FINAL = 24;

export function DiaDaViagem() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();
  const { viagemId, diaId } = useParams();
  const navegar = useNavigate();

  const [zoom, definirZoom] = useState(1);
  const [busca, definirBusca] = useState('');
  const [mapaAberto, definirMapaAberto] = useState(false);
  const [planoBAberto, definirPlanoBAberto] = useState(false);

  const pixelsPorMinuto = (ZOOMS[zoom] ?? 1.1) * 1.1;
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dados = useMemo(() => {
    if (!viagem || !pacote || !diaId) return undefined;
    const dia = viagem.dias.find((d) => d.id === diaId);
    if (!dia) return undefined;
    return {
      dia,
      resolvido: resolverDia(viagem, dia, pacote),
      alertas: validarViagem(viagem, pacote, { hoje }).filter((a) => a.diaId === dia.id),
    };
  }, [viagem, pacote, diaId, hoje]);

  const naoAgendados = useMemo(() => {
    if (!viagem || !pacote || !dados) return [];
    const jaNaAgenda = new Set(
      viagem.dias.flatMap((d) => d.blocos).flatMap((b) => (b.tipo === 'atividade' ? [b.itemId] : [])),
    );
    const termo = busca.trim().toLowerCase();
    return pacote.itens
      .filter((i) => viagem.favoritos.includes(i.id) && !jaNaAgenda.has(i.id) && i.agendavel)
      .filter((i) => (termo ? i.nome.toLowerCase().includes(termo) : true))
      .sort((a, b) => {
        // Primeiro os da cidade-base do dia: sao os que fazem sentido aqui.
        const ca = a.cidadeId === dados.dia.cidadeBaseId ? 0 : 1;
        const cb = b.cidadeId === dados.dia.cidadeBaseId ? 0 : 1;
        return ca - cb || a.nome.localeCompare(b.nome);
      });
  }, [viagem, pacote, dados, busca]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;
  if (!dados) return <Vazio titulo="Dia nao encontrado" />;

  const { dia, resolvido, alertas } = dados;
  const cidade = pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
  /* O relogio em que esta linha do tempo esta desenhada: o da cidade-base. */
  const quadro = offsetDoDia(pacote, dia);
  const mudouDeFuso = mudancaDeFusoNoDia(viagem, pacote, dia.id);
  const paraCasa = diferencaParaCasa(viagem, pacote, dia);
  const indice = viagem.dias.findIndex((d) => d.id === dia.id);
  const anterior = viagem.dias[indice - 1];
  const proximo = viagem.dias[indice + 1];

  function aoSoltar(evento: DragEndEvent) {
    const itemId = String(evento.active.id);
    const sobre = evento.over?.id;
    if (sobre !== 'linha-do-tempo') return;

    const item = pacote!.itens.find((i) => i.id === itemId);
    if (!item) return;

    // Posicao vertical do ponteiro vira horario.
    const retangulo = document.getElementById('linha-do-tempo')?.getBoundingClientRect();
    const y =
      (evento.activatorEvent as PointerEvent).clientY + (evento.delta?.y ?? 0) - (retangulo?.top ?? 0);
    const minutoBruto = HORA_INICIAL * 60 + y / pixelsPorMinuto;
    const minuto = Math.max(0, Math.min(1439, Math.round(minutoBruto / 15) * 15));

    const bloco: Bloco = {
      id: novoId('bloco'),
      tipo: 'atividade',
      itemId: item.id,
      startMin: minuto,
      durationMin: item.duracao?.tipica ?? 60,
      statusDeReserva: item.reserva.necessaria ? 'precisa-reservar' : 'nao-precisa',
    };
    acoes.adicionarBloco(dia.id, bloco, item.cidadeId);
  }

  return (
    <DndContext onDragEnd={aoSoltar} sensors={sensores}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            className="text-xs text-[var(--cor-texto-suave)] hover:text-[var(--cor-acento)]"
            to={`/viagem/${viagemId}/calendario`}
          >
            ← calendario
          </Link>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight">
            {dia.data.split('-').reverse().join('/')}
            {cidade && (
              <span className="font-normal text-[var(--cor-texto-suave)]"> · {cidade.nome}</span>
            )}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {anterior && (
            <Botao
              onClick={() => navegar(`/viagem/${viagemId}/dia/${anterior.id}`)}
              tamanho="pequeno"
              variante="fantasma"
            >
              <ChevronUp size={14} /> dia anterior
            </Botao>
          )}
          {proximo && (
            <Botao
              onClick={() => navegar(`/viagem/${viagemId}/dia/${proximo.id}`)}
              tamanho="pequeno"
              variante="fantasma"
            >
              dia seguinte <ChevronDown size={14} />
            </Botao>
          )}
          <ComDica texto="Diminuir a escala do dia">
            <Botao
              aria-label="Diminuir zoom"
              disabled={zoom === 0}
              onClick={() => definirZoom(Math.max(0, zoom - 1))}
              tamanho="icone"
              variante="contorno"
            >
              <ZoomOut size={14} />
            </Botao>
          </ComDica>
          <ComDica texto="Aumentar a escala do dia">
            <Botao
              aria-label="Aumentar zoom"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => definirZoom(Math.min(ZOOMS.length - 1, zoom + 1))}
              tamanho="icone"
              variante="contorno"
            >
              <ZoomIn size={14} />
            </Botao>
          </ComDica>
          <Botao onClick={() => definirMapaAberto(true)} tamanho="pequeno" variante="contorno">
            <MapaIcone size={14} /> Mapa do dia
          </Botao>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HospedagemDoDia diaId={dia.id} key={dia.id} nome={dia.hospedagem?.nome ?? ''} />
        {resolvido.blocos.some((b) => b.item?.restricoes.dependeDeClima) && (
          <Botao onClick={() => definirPlanoBAberto(true)} tamanho="pequeno" variante="contorno">
            <CloudRain size={14} /> Plano B de chuva
          </Botao>
        )}
      </div>

      {mudouDeFuso && (
        <Cartao className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-[var(--cor-acento-borda)] bg-[var(--cor-acento-fraco)] p-3 text-xs">
          <Globe className="shrink-0 self-center" size={14} />
          <span>
            <strong>O fuso mudou hoje.</strong> {mudouDeFuso.paraCidadeNome} esta{' '}
            {frasedeFuso(mudouDeFuso.diferencaMinutos)} de {mudouDeFuso.deCidadeNome}.
          </span>
          <Selo tom="acento">{seloDeFuso(mudouDeFuso.diferencaMinutos)}</Selo>
          <span className="text-[var(--cor-texto-suave)]">
            A linha do tempo abaixo esta no relogio de {mudouDeFuso.paraCidadeNome}.
          </span>
        </Cartao>
      )}

      <PainelDeAlertas alertas={alertas} diaId={dia.id} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <LinhaDoTempo
          cidade={cidade?.nome}
          diaId={dia.id}
          diferencaParaCasaMin={paraCasa}
          pixelsPorMinuto={pixelsPorMinuto}
          quadro={quadro}
          resolvido={resolvido}
        />

        <aside className="order-first min-w-0 lg:order-last">
          <Cartao className="sticky top-32 p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
              Selecao ainda nao agendada
            </h2>
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cor-texto-fraco)]"
                size={13}
              />
              <Campo
                aria-label="Buscar nos favoritos"
                className="h-8 pl-8 text-xs"
                onChange={(e) => definirBusca(e.target.value)}
                placeholder="buscar"
                value={busca}
              />
            </div>

            {naoAgendados.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--cor-texto-fraco)]">
                {viagem.favoritos.length === 0
                  ? 'Favorite itens em Descobrir para ve-los aqui.'
                  : 'Tudo que voce favoritou ja esta na agenda.'}
              </p>
            ) : (
              <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1">
                {naoAgendados.map((item) => (
                  <li key={item.id}>
                    <ItemArrastavel
                      cidadeDoDia={dia.cidadeBaseId}
                      cidadeDoItem={
                        pacote.cidades.find((c) => c.id === item.cidadeId)?.nome ?? item.cidadeId
                      }
                      duracao={item.duracao?.tipica ?? 60}
                      foraDaCidade={item.cidadeId !== dia.cidadeBaseId}
                      id={item.id}
                      nome={item.nome}
                      aoAdicionar={() =>
                        acoes.adicionarItemAoDia(
                          dia.id,
                          item.id,
                          item.duracao?.tipica ?? 60,
                          item.reserva.necessaria,
                          item.cidadeId,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </aside>
      </div>

      <Painel
        aberto={mapaAberto}
        aoFechar={() => definirMapaAberto(false)}
        descricao="Pontos na ordem do dia. Clique num numero para ver qual e."
        largura="max-w-4xl"
        titulo="Mapa do dia"
      >
        {mapaAberto && (
          <Suspense
            fallback={
              <p className="py-10 text-center text-xs text-[var(--cor-texto-fraco)]">
                carregando o mapa...
              </p>
            }
          >
            <MapaDoDia resolvido={resolvido} />
          </Suspense>
        )}
      </Painel>

      <Painel
        aberto={planoBAberto}
        aoFechar={() => definirPlanoBAberto(false)}
        descricao="Alternativas cobertas na mesma base, que cabem na mesma duracao."
        titulo="Plano B de chuva"
      >
        <PlanoB diaId={dia.id} />
      </Painel>
    </DndContext>
  );
}

// ---------------------------------------------------------- linha do tempo

/**
 * Distribui blocos que se cruzam em colunas lado a lado.
 *
 * Sem isto, dois blocos no mesmo horario sao desenhados um POR CIMA do
 * outro e o de baixo some — justamente no caso em que o usuario precisa ver
 * os dois para resolver o conflito.
 */
function distribuirEmColunas(
  blocos: ReturnType<typeof resolverDia>['blocos'],
): Map<string, { coluna: number; colunas: number }> {
  const mapa = new Map<string, { coluna: number; colunas: number }>();
  const ordenados = [...blocos].sort((a, b) => a.intervalo.inicio - b.intervalo.inicio);

  let grupo: typeof ordenados = [];
  let fimDoGrupo = -1;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;
    // Primeiro que couber: cada bloco pega a coluna livre mais a esquerda.
    const fimPorColuna: number[] = [];
    const colunaDe = new Map<string, number>();
    for (const b of grupo) {
      let coluna = fimPorColuna.findIndex((fim) => fim <= b.intervalo.inicio);
      if (coluna === -1) {
        coluna = fimPorColuna.length;
        fimPorColuna.push(0);
      }
      fimPorColuna[coluna] = b.intervalo.fim;
      colunaDe.set(b.bloco.id, coluna);
    }
    const colunas = fimPorColuna.length;
    for (const b of grupo) {
      mapa.set(b.bloco.id, { coluna: colunaDe.get(b.bloco.id) ?? 0, colunas });
    }
    grupo = [];
  };

  for (const b of ordenados) {
    if (grupo.length > 0 && b.intervalo.inicio >= fimDoGrupo) fecharGrupo();
    grupo.push(b);
    fimDoGrupo = Math.max(fimDoGrupo, b.intervalo.fim);
  }
  fecharGrupo();

  return mapa;
}

function LinhaDoTempo({
  resolvido,
  pixelsPorMinuto,
  cidade,
  diaId,
  quadro,
  diferencaParaCasaMin,
}: {
  resolvido: ReturnType<typeof resolverDia>;
  pixelsPorMinuto: number;
  cidade?: string;
  diaId: string;
  /** Offset do relogio em que esta linha do tempo esta desenhada. */
  quadro: number;
  /** Quanto o relogio do dia difere do de casa. Ausente = a viagem nao sabe. */
  diferencaParaCasaMin?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'linha-do-tempo' });
  const alturaTotal = (HORA_FINAL - HORA_INICIAL) * 60 * pixelsPorMinuto;

  const lacunaDepois = new Map<string, LacunaResolvida>();
  for (const l of resolvido.lacunas) lacunaDepois.set(l.depoisDe, l);
  const colunas = distribuirEmColunas(resolvido.blocos);
  const saidaDaHospedagem = resolvido.lacunas.find((l) => l.tipo === 'saida-da-hospedagem');

  return (
    <Cartao
      className={cn(
        'relative min-w-0 overflow-hidden p-0 transition-colors',
        isOver && 'ring-2 ring-[var(--cor-acento)]',
      )}
    >
      {saidaDaHospedagem?.horarioDeSaidaMin !== undefined && (
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 border-b border-[var(--cor-borda)] bg-[var(--cor-fundo-afundado)] px-3 py-2 text-xs">
          <Hotel className="shrink-0 self-center" size={13} />
          <span>
            Saia da hospedagem as{' '}
            <strong className="tabular">{paraHHMM(saidaDaHospedagem.horarioDeSaidaMin)}</strong>
          </span>
          <span className="min-w-0 text-[var(--cor-texto-fraco)]">
            {saidaDaHospedagem.deslocamento?.resumo}
          </span>
        </p>
      )}

      <div className="relative" id="linha-do-tempo" ref={setNodeRef} style={{ height: alturaTotal }}>
        {/* grade de horas */}
        {Array.from({ length: HORA_FINAL - HORA_INICIAL + 1 }, (_, i) => {
          const hora = HORA_INICIAL + i;
          return (
            <div
              className="absolute left-0 right-0 flex items-start gap-2 border-t border-[var(--cor-borda)]"
              key={hora}
              style={{ top: i * 60 * pixelsPorMinuto }}
            >
              <span className="tabular -mt-2 w-12 shrink-0 pl-2 text-2xs text-[var(--cor-texto-fraco)]">
                {String(hora).padStart(2, '0')}:00
              </span>
            </div>
          );
        })}

        {resolvido.blocos.length === 0 && (
          <p className="absolute inset-x-0 top-24 text-center text-xs text-[var(--cor-texto-fraco)]">
            Arraste algo do painel ao lado, ou use o botao +.
          </p>
        )}

        {resolvido.blocos.map((b) => {
          const topo = (b.intervalo.inicio - HORA_INICIAL * 60) * pixelsPorMinuto;
          const altura = Math.max(26, b.bloco.durationMin * pixelsPorMinuto);
          const lacuna = lacunaDepois.get(b.bloco.id);
          const coluna = colunas.get(b.bloco.id) ?? { coluna: 0, colunas: 1 };
          return (
            <BlocoNaLinha
              altura={altura}
              coluna={coluna}
              diaId={diaId}
              key={b.bloco.id}
              lacuna={lacuna}
              pixelsPorMinuto={pixelsPorMinuto}
              quadro={quadro}
              resolvido={b}
              topo={topo}
            />
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--cor-borda)] bg-[var(--cor-fundo-afundado)] px-3 py-2 text-xs text-[var(--cor-texto-suave)]">
        <span>{formatarDuracao(resolvido.minutosEmAtividades)} de atividade</span>
        <span>
          {formatarDuracao(resolvido.minutosEmDeslocamento)} de deslocamento
          {resolvido.trajetosSemDados > 0 && (
            <span className="text-[var(--cor-atencao)]">
              {' '}
              + {resolvido.trajetosSemDados} sem dados
            </span>
          )}
        </span>
        <span className="text-[var(--cor-verificado)]">
          {formatarDuracao(resolvido.minutosLivres)} livres
        </span>
        {resolvido.minutosEmFalta > 0 && (
          <span className="text-[var(--cor-erro)]">
            faltam {formatarDuracao(resolvido.minutosEmFalta)}
          </span>
        )}
        {cidade && (
          <span className="ml-auto text-[var(--cor-texto-fraco)]">
            base: {cidade}
            {/* Nao e enfeite: e o que evita ligar para casa as 3 da manha. */}
            {diferencaParaCasaMin !== undefined && diferencaParaCasaMin !== 0 && (
              <> · {frasedeFuso(diferencaParaCasaMin)} de casa</>
            )}
          </span>
        )}
      </footer>
    </Cartao>
  );
}

function BlocoNaLinha({
  resolvido,
  topo,
  altura,
  lacuna,
  pixelsPorMinuto,
  coluna,
  diaId,
  quadro,
}: {
  resolvido: ReturnType<typeof resolverDia>['blocos'][number];
  topo: number;
  altura: number;
  lacuna?: LacunaResolvida;
  pixelsPorMinuto: number;
  coluna: { coluna: number; colunas: number };
  diaId: string;
  quadro: number;
}) {
  const bloco = resolvido.bloco;
  const pacote = usarPacote();

  /*
    Um trecho tem DUAS pontas, cada uma no seu relogio. O bloco na linha do
    tempo mostra o horario do quadro do dia (que e onde ele foi solto); o que
    o viajante precisa ler no bilhete e a hora local de cada ponta.
  */
  const fusos =
    bloco.tipo === 'trecho' && pacote ? horariosDoTrecho(pacote, bloco, quadro) : undefined;
  const [detalheAberto, definirDetalhe] = useState(false);
  const arrastandoRef = useRef<{ inicioY: number; duracaoInicial: number } | undefined>(undefined);

  function aoApertarAlca(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastandoRef.current = { inicioY: e.clientY, duracaoInicial: bloco.durationMin };
  }

  function aoMoverAlca(e: React.PointerEvent) {
    const estado = arrastandoRef.current;
    if (!estado) return;
    const delta = (e.clientY - estado.inicioY) / pixelsPorMinuto;
    const nova = Math.round((estado.duracaoInicial + delta) / 5) * 5;
    acoes.redimensionarBloco(bloco.id, Math.max(10, nova));
  }

  function aoSoltarAlca(e: React.PointerEvent) {
    arrastandoRef.current = undefined;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const cor =
    bloco.tipo === 'trecho'
      ? 'border-[var(--cor-acento-borda)] bg-[var(--cor-acento-fraco)]'
      : bloco.tipo === 'refeicao'
        ? 'border-[var(--cor-parcial)]/30 bg-[var(--cor-parcial-fundo)]'
        : bloco.tipo === 'tempo-livre'
          ? 'border-dashed border-[var(--cor-borda-forte)] bg-transparent'
          : 'border-[var(--cor-borda-forte)] bg-[var(--cor-fundo-elevado)]';

  /**
   * Teclado na linha do tempo.
   *
   * Arrastar com o mouse e otimo e, para quem usa teclado, inacessivel. O
   * dnd-kit tem sensor de teclado, mas aqui a linha do tempo e posicao
   * livre, nao lista ordenavel: o bloco cai onde o ponteiro esta, e um
   * evento de teclado nao tem ponteiro. Entao, em vez de simular um
   * arrasto, o bloco responde direto as setas — que, na pratica, e mais
   * preciso do que arrastar, inclusive com mouse.
   *
   * Setas: move de 15 em 15 min. Com Shift: muda a duracao.
   */
  function aoTeclar(e: React.KeyboardEvent) {
    const passo = 15;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const sinal = e.key === 'ArrowUp' ? -1 : 1;
      if (e.shiftKey) acoes.redimensionarBloco(bloco.id, bloco.durationMin + sinal * passo);
      else acoes.moverBloco(bloco.id, diaId, bloco.startMin + sinal * passo);
    }
  }

  return (
    <>
      <div
        aria-label={
          `${resolvido.rotulo}, das ${paraHHMM(resolvido.intervalo.inicio)} as ${paraHHMM(resolvido.intervalo.fim)}. ` +
          // Quem usa leitor de tela nao ve o selo de fuso: vai na etiqueta.
          (fusos?.mudaDeFuso
            ? `Sai as ${fusos.saida.hhmm} no horario de ${fusos.saida.cidadeNome} e chega as ${fusos.chegada.hhmm} no horario de ${fusos.chegada.cidadeNome}. `
            : '') +
          'Setas movem de 15 em 15 minutos; com Shift, mudam a duracao.'
        }
        className={cn(
          'absolute rounded-[var(--raio)] border p-2 shadow-sm',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cor-acento)]',
          cor,
        )}
        onKeyDown={aoTeclar}
        role="group"
        style={{
          top: topo,
          height: altura,
          left: `calc(3.5rem + (100% - 4rem) * ${coluna.coluna / coluna.colunas})`,
          width: `calc((100% - 4rem) / ${coluna.colunas} - 0.25rem)`,
        }}
        tabIndex={0}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium leading-tight">{resolvido.rotulo}</p>
              <p className="tabular text-2xs text-[var(--cor-texto-fraco)]">
                {paraHHMM(resolvido.intervalo.inicio)}–{paraHHMM(resolvido.intervalo.fim)} ·{' '}
                {formatarDuracao(bloco.durationMin)}
              </p>
              {fusos?.mudaDeFuso && (
                <p className="mt-0.5 flex flex-wrap items-center gap-1 text-2xs leading-tight">
                  <span className="tabular">
                    sai <strong>{fusos.saida.hhmm}</strong> em {fusos.saida.cidadeNome} · chega{' '}
                    <strong>{fusos.chegada.hhmm}</strong> em {fusos.chegada.cidadeNome}
                  </span>
                  <Selo tom="acento">{seloDeFuso(fusos.diferencaMinutos)}</Selo>
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Botao
                aria-label="Ajustar horario"
                className="h-6 w-6"
                onClick={() => definirDetalhe(true)}
                tamanho="icone"
                variante="fantasma"
              >
                <Clock size={12} />
              </Botao>
              <Botao
                aria-label={`Remover ${resolvido.rotulo}`}
                className="h-6 w-6"
                onClick={() => acoes.removerBloco(bloco.id)}
                tamanho="icone"
                variante="fantasma"
              >
                <Trash2 size={12} />
              </Botao>
            </div>
          </div>
        </div>

        <div
          aria-label="Redimensionar"
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
          onPointerDown={aoApertarAlca}
          onPointerMove={aoMoverAlca}
          onPointerUp={aoSoltarAlca}
          role="separator"
        >
          <span className="mx-auto block h-0.5 w-8 rounded-full bg-[var(--cor-borda-forte)]" />
        </div>
      </div>

      {lacuna?.deslocamento && (
        <BlocoDeDeslocamento
          deslocamento={lacuna.deslocamento}
          lacuna={lacuna}
          pixelsPorMinuto={pixelsPorMinuto}
          topo={topo + altura}
        />
      )}

      <AjusteDeHorario
        aberto={detalheAberto}
        aoFechar={() => definirDetalhe(false)}
        bloco={bloco}
        rotulo={resolvido.rotulo}
      />
    </>
  );
}

function BlocoDeDeslocamento({
  deslocamento,
  lacuna,
  topo,
  pixelsPorMinuto,
}: {
  deslocamento: Deslocamento;
  lacuna: LacunaResolvida;
  topo: number;
  pixelsPorMinuto: number;
}) {
  const [aberto, definirAberto] = useState(false);
  const minutos = deslocamento.minutos ?? 0;
  /*
    A altura e limitada: um voo de 4 h pintaria uma faixa gigante que engole
    a linha do tempo. O tempo real continua no texto e no painel de detalhe.
  */
  const altura = Math.min(56, Math.max(18, minutos * pixelsPorMinuto));
  const naoCabe = !lacuna.cabe;

  return (
    <>
      <button
        className={cn(
          'absolute left-14 right-2 overflow-hidden rounded border px-2 text-left text-2xs',
          naoCabe
            ? 'z-10 border-[var(--cor-erro)] bg-[var(--cor-erro-fundo)] text-[var(--cor-erro)] shadow-md'
            : 'border-transparent bg-[var(--cor-fundo-afundado)] text-[var(--cor-texto-suave)]',
        )}
        onClick={() => definirAberto(true)}
        style={{ top: topo, height: altura, minHeight: 18 }}
        type="button"
      >
        <span className="flex items-center gap-1 leading-[18px]">
          {naoCabe && <TriangleAlert size={10} />}
          {naoCabe
            ? `${formatarDuracao(minutos)} de trajeto — faltam ${formatarDuracao(lacuna.faltamMin)}`
            : `${formatarDuracao(minutos)}${deslocamento.camada === 'estimativa' ? ' (estimativa)' : ''}`}
        </span>
      </button>

      <Painel
        aberto={aberto}
        aoFechar={() => definirAberto(false)}
        descricao={deslocamento.resumo}
        largura="max-w-lg"
        titulo="Como este tempo foi calculado"
      >
        <div className="space-y-4">
          <ul className="divide-y divide-[var(--cor-borda)] rounded-[var(--raio)] border border-[var(--cor-borda)] text-xs">
            {deslocamento.passos.map((p) => (
              <li className="flex items-center justify-between gap-3 px-3 py-2" key={p.rotulo}>
                <span className="text-[var(--cor-texto-suave)]">{p.rotulo}</span>
                <span className="tabular flex items-center gap-1.5">
                  {p.valor}
                  {p.estimado && <Selo tom="estimado">estimado</Selo>}
                </span>
              </li>
            ))}
          </ul>

          {deslocamento.avisos.map((a) => (
            <p className="text-xs text-[var(--cor-atencao)]" key={a}>
              {a}
            </p>
          ))}

          {!lacuna.cabe && (
            <Cartao className="border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)] p-3 text-xs">
              <p className="font-medium text-[var(--cor-erro)]">
                Faltam {formatarDuracao(lacuna.faltamMin)}.
              </p>
              <p className="mt-1 text-[var(--cor-texto)]">
                Ha {formatarDuracao(lacuna.minutosDisponiveis)} entre uma coisa e outra, e o
                trajeto precisa de {formatarDuracao(minutos)}.
              </p>
            </Cartao>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium">Como voce vai?</p>
            <div className="flex flex-wrap gap-1.5">
              {(['a-pe', 'carro-app', 'transporte-publico', 'veiculo-alugado'] as const).map((m) => (
                <Botao
                  key={m}
                  onClick={() => acoes.definirModalDaLacuna(lacuna.id, m)}
                  tamanho="pequeno"
                  variante={deslocamento.modal === m ? 'principal' : 'contorno'}
                >
                  {m.replaceAll('-', ' ')}
                </Botao>
              ))}
              <Botao
                onClick={() => acoes.limparModalDaLacuna(lacuna.id)}
                tamanho="pequeno"
                variante="fantasma"
              >
                deixar o app escolher
              </Botao>
            </div>
          </div>

          {deslocamento.fontes.length > 0 && (
            <p className="text-2xs text-[var(--cor-texto-fraco)]">
              Fonte do trecho:{' '}
              {deslocamento.fontes.map((f) => (
                <a
                  className="underline decoration-dotted"
                  href={f.url}
                  key={f.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {new URL(f.url).hostname}
                </a>
              ))}
            </p>
          )}
        </div>
      </Painel>
    </>
  );
}

// --------------------------------------------------------------- auxiliares

function AjusteDeHorario({
  aberto,
  aoFechar,
  bloco,
  rotulo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  bloco: Bloco;
  rotulo: string;
}) {
  const viagem = usarViagem();
  return (
    <Painel aberto={aberto} aoFechar={aoFechar} largura="max-w-md" titulo={rotulo}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--cor-texto-suave)]">
            Comeca as
          </label>
          <Campo
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              if (h !== undefined && m !== undefined) {
                acoes.moverBloco(
                  bloco.id,
                  viagem?.dias.find((d) => d.blocos.some((b) => b.id === bloco.id))?.id ?? '',
                  h * 60 + m,
                );
              }
            }}
            type="time"
            value={paraHHMM(bloco.startMin)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--cor-texto-suave)]">
            Dura {formatarDuracao(bloco.durationMin)}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[30, 60, 90, 120, 180, 240, 360].map((m) => (
              <Botao
                key={m}
                onClick={() => acoes.redimensionarBloco(bloco.id, m)}
                tamanho="pequeno"
                variante={bloco.durationMin === m ? 'principal' : 'contorno'}
              >
                {formatarDuracao(m)}
              </Botao>
            ))}
          </div>
        </div>
        {viagem && viagem.dias.length > 1 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--cor-texto-suave)]">
              Mover para outro dia
            </label>
            <select
              className="h-10 w-full rounded-[var(--raio)] border border-[var(--cor-borda-forte)] bg-[var(--cor-fundo-elevado)] px-3 text-sm"
              onChange={(e) => {
                if (e.target.value) {
                  acoes.moverBloco(bloco.id, e.target.value, bloco.startMin);
                  aoFechar();
                }
              }}
              value=""
            >
              <option value="">escolher dia...</option>
              {viagem.dias.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.data.split('-').reverse().join('/')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Painel>
  );
}

function ItemArrastavel({
  id,
  nome,
  duracao,
  foraDaCidade,
  cidadeDoItem,
  aoAdicionar,
}: {
  id: string;
  nome: string;
  duracao: number;
  foraDaCidade: boolean;
  cidadeDoItem: string;
  cidadeDoDia?: string;
  aoAdicionar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-[var(--raio)] border border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)] p-2',
        isDragging && 'opacity-40',
      )}
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
    >
      <button
        aria-label={`Arrastar ${nome}`}
        className="cursor-grab touch-none text-[var(--cor-texto-fraco)] active:cursor-grabbing"
        type="button"
        {...listeners}
        {...attributes}
      >
        <GripVertical size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs leading-tight">{nome}</p>
        <p className="text-2xs text-[var(--cor-texto-fraco)]">
          {formatarDuracao(duracao)}
          {foraDaCidade && <span className="text-[var(--cor-atencao)]"> · {cidadeDoItem}</span>}
        </p>
      </div>
      <Botao
        aria-label={`Adicionar ${nome} ao dia`}
        className="h-6 w-6"
        onClick={aoAdicionar}
        tamanho="icone"
        variante="fantasma"
      >
        <Plus size={13} />
      </Botao>
    </div>
  );
}

/**
 * O campo guarda o texto enquanto o usuario digita e so grava no blur.
 * Nao sincroniza o estado por efeito: o pai monta este componente com
 * `key={dia.id}`, entao trocar de dia ja recria o campo com o valor certo.
 */
function HospedagemDoDia({ diaId, nome }: { diaId: string; nome: string }) {
  const [valor, definirValor] = useState(nome);

  return (
    <div className="flex items-center gap-1.5">
      <Hotel className="text-[var(--cor-texto-fraco)]" size={14} />
      <Campo
        aria-label="Onde durmo nesta noite"
        className="h-8 w-56 text-xs"
        onBlur={() =>
          acoes.definirHospedagem(diaId, {
            nome: valor,
            moeda: 'BRL',
            confirmada: false,
          })
        }
        onChange={(e) => definirValor(e.target.value)}
        placeholder="onde durmo nesta noite"
        value={valor}
      />
    </div>
  );
}

function AlertaDoDia({ alerta, diaId }: { alerta: Alerta; diaId: string }) {
  const navegar = useNavigate();
  const viagemId = usarLoja((e) => e.viagemAtivaId) ?? '';
  const tom = alerta.nivel === 'erro' ? 'erro' : alerta.nivel === 'atencao' ? 'atencao' : 'dica';
  const corDeFundo =
    alerta.nivel === 'erro'
      ? 'border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)]'
      : alerta.nivel === 'atencao'
        ? 'border-[var(--cor-atencao-borda)] bg-[var(--cor-atencao-fundo)]'
        : 'border-[var(--cor-dica-borda)] bg-[var(--cor-dica-fundo)]';

  return (
    <Cartao className={cn('p-3', corDeFundo)}>
      <div className="flex items-start gap-2">
        <Selo tom={tom}>{alerta.nivel}</Selo>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{alerta.titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--cor-texto-suave)]">
            {alerta.mensagem}
          </p>
          {alerta.correcoes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alerta.correcoes.map((c) => (
                <Botao
                  key={c.rotulo}
                  onClick={() => aplicarCorrecao(c.tipo, c.dados, { diaId, viagemId, navegar })}
                  tamanho="pequeno"
                  variante="contorno"
                >
                  {c.rotulo}
                </Botao>
              ))}
            </div>
          )}
        </div>
      </div>
    </Cartao>
  );
}

/**
 * As correcoes que o motor sugere sao aplicadas aqui, na interface. O motor
 * descreve o conserto; quem mexe na viagem e o usuario, clicando.
 */
type DadosDaCorrecao = Record<string, unknown> | undefined;

interface ContextoDaCorrecao {
  diaId: string;
  viagemId: string;
  navegar: (para: string) => void;
}

/**
 * Um tratador por tipo de correcao, num Record EXAUSTIVO.
 *
 * Era um `switch` com `default: break`, e onze dos dezoito tipos caiam no
 * default: o alerta aparecia, o botao aparecia e o clique nao fazia nada.
 * Com `Record<TipoDeCorrecao, ...>` o compilador recusa o build enquanto
 * faltar um. Alguns conserto nao da para automatizar com honestidade
 * (redistribuir um dia cheio, por exemplo); esses LEVAM o usuario ao lugar
 * onde a decisao se toma, o que ainda e fazer alguma coisa.
 */
const TRATADORES: Record<TipoDeCorrecao, (d: DadosDaCorrecao, c: ContextoDaCorrecao) => void> = {
  'empurrar-proximos': (dados, { diaId }) => {
    const aPartirDe = String(dados?.aPartirDe ?? '');
    const minutos = Number(dados?.minutos ?? 0);
    if (!aPartirDe || !minutos) return;
    empurrarAPartirDe(diaId, aPartirDe, minutos);
  },

  'inserir-folga': (dados, { diaId }) => {
    // Folga e o mesmo movimento de empurrar, com outro nome para o usuario:
    // o que ele quer e ar antes do bloco seguinte.
    const antesDe = String(dados?.antesDe ?? '');
    const minutos = Number(dados?.minutos ?? 0);
    if (!antesDe || !minutos) return;
    empurrarAPartirDe(diaId, antesDe, minutos);
  },

  'encurtar-anterior': (dados) => {
    const blocoId = String(dados?.blocoId ?? '');
    const minutos = Number(dados?.minutos ?? 0);
    const bloco = blocoPorId(blocoId);
    if (bloco) acoes.redimensionarBloco(blocoId, Math.max(10, bloco.durationMin - minutos));
  },

  'ajustar-duracao': (dados) => {
    const blocoId = String(dados?.blocoId ?? '');
    const duracao = Number(dados?.durationMin ?? 0);
    if (blocoId && duracao) acoes.redimensionarBloco(blocoId, duracao);
  },

  'mover-para-horario': (dados, { diaId }) => {
    const blocoId = String(dados?.blocoId ?? '');
    const inicio = Number(dados?.startMin ?? 0);
    if (blocoId) acoes.moverBloco(blocoId, diaId, inicio);
  },

  'antecipar-para-terminar-antes': (dados, { diaId }) => {
    const blocoId = String(dados?.blocoId ?? '');
    const novoInicio = Number(dados?.novoInicio ?? 0);
    if (blocoId && novoInicio > 0) acoes.moverBloco(blocoId, diaId, novoInicio);
  },

  'encaixar-no-horario': (dados, { diaId }) => {
    // Primeira janela em que o bloco cabe inteiro; se nao couber em nenhuma,
    // encosta no comeco da primeira, que e o menos errado.
    const blocoId = String(dados?.blocoId ?? '');
    const janelas = (dados?.janelas ?? []) as Array<{ abre: string; fecha: string }>;
    const bloco = blocoPorId(blocoId);
    if (!bloco || janelas.length === 0) return;
    const emMinutos = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    const cabe = janelas.find(
      (j) => emMinutos(j.fecha) - emMinutos(j.abre) >= bloco.durationMin,
    );
    const alvo = cabe ?? janelas[0];
    if (alvo) acoes.moverBloco(blocoId, diaId, emMinutos(alvo.abre));
  },

  'marcar-reservado': (dados) => {
    const blocoId = String(dados?.blocoId ?? '');
    if (blocoId) acoes.definirStatusDeReserva(blocoId, 'reservado');
  },

  'inserir-refeicao': (dados, { diaId }) => {
    const janela = dados?.janela as { inicio: number } | undefined;
    acoes.adicionarBloco(diaId, {
      id: novoId('bloco'),
      tipo: 'refeicao',
      nome: 'Refeicao',
      startMin: janela?.inicio ?? 12 * 60,
      durationMin: 60,
    });
  },

  'adiar-inicio-do-dia': (dados) => {
    // Uma hora e o passo que resolve a maioria dos casos de sono curto sem
    // desmontar o dia. O usuario ajusta o resto arrastando.
    const alvo = String(dados?.diaId ?? '');
    const dia = viagemAtual()?.dias.find((d) => d.id === alvo);
    if (!dia) return;
    for (const b of [...dia.blocos].sort((x, y) => y.startMin - x.startMin)) {
      acoes.moverBloco(b.id, alvo, b.startMin + 60);
    }
  },

  'mover-para-outro-dia': (dados, { diaId, viagemId, navegar }) => {
    const blocoId = String(dados?.blocoId ?? '');
    const destino = dados?.diaDestinoId ? String(dados.diaDestinoId) : undefined;
    const bloco = blocoPorId(blocoId);
    if (!bloco) return;
    if (destino) {
      acoes.moverBloco(blocoId, destino, bloco.startMin);
      navegar(`/viagem/${viagemId}/dia/${destino}`);
      return;
    }
    // Sem dia calculado, o motor nao tem como escolher por ele: leva ao
    // calendario, onde da para ver os dias e arrastar.
    navegar(`/viagem/${viagemId}/calendario`);
    void diaId;
  },

  'inserir-trecho': (_dados, { viagemId, navegar }) => {
    navegar(`/viagem/${viagemId}/calendario`);
  },

  'adicionar-noite': (_dados, { viagemId, navegar }) => {
    navegar(`/viagem/${viagemId}/calendario`);
  },

  'aliviar-dia': (_dados, { viagemId, navegar }) => {
    // Tirar atividade por conta propria e destrutivo e o motor nao sabe de
    // qual o usuario abre mao. Leva ao calendario, onde ele redistribui.
    navegar(`/viagem/${viagemId}/calendario`);
  },

  'mover-dia': (_dados, { viagemId, navegar }) => {
    navegar(`/viagem/${viagemId}/config`);
  },

  'definir-hospedagem': (_dados, { viagemId, navegar }) => {
    navegar(`/viagem/${viagemId}/dormir`);
  },

  'abrir-orcamento': (_dados, { viagemId, navegar }) => {
    navegar(`/viagem/${viagemId}/orcamento`);
  },

  'abrir-requisitos': (_dados, { viagemId, navegar }) => {
    navegar(`/viagem/${viagemId}/config`);
  },
};

function blocoPorId(blocoId: string) {
  return viagemAtual()
    ?.dias.flatMap((d) => d.blocos)
    .find((b) => b.id === blocoId);
}

function empurrarAPartirDe(diaId: string, blocoId: string, minutos: number): void {
  const dia = viagemAtual()?.dias.find((d) => d.id === diaId);
  const alvo = dia?.blocos.find((b) => b.id === blocoId);
  if (!dia || !alvo) return;
  // De tras para frente, senao um bloco empurrado atropela o seguinte.
  for (const b of [...dia.blocos].sort((x, y) => y.startMin - x.startMin)) {
    if (b.startMin >= alvo.startMin) acoes.moverBloco(b.id, diaId, b.startMin + minutos);
  }
}

/**
 * As correcoes que o motor sugere sao aplicadas aqui, na interface. O motor
 * descreve o conserto; quem mexe na viagem e o usuario, clicando.
 */
function aplicarCorrecao(
  tipo: TipoDeCorrecao,
  dados: DadosDaCorrecao,
  contexto: ContextoDaCorrecao,
): void {
  TRATADORES[tipo](dados, contexto);
}

/** Estado atual fora de componente: as correcoes rodam num clique, nao num render. */
function viagemAtual() {
  const e = usarLoja.getState();
  return e.viagens.find((v) => v.id === e.viagemAtivaId);
}

function PlanoB({ diaId }: { diaId: string }) {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const plano = viagem && pacote ? planoBDeChuva(viagem, diaId, pacote) : undefined;

  if (!plano) return <p className="text-sm">Nada a sugerir.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--cor-texto-suave)]">{plano.motivo}</p>
      {plano.nadaParaTrocar ? (
        <p className="text-sm">Nada neste dia depende do tempo. Pode chover a vontade.</p>
      ) : (
        plano.trocas.map((t) => (
          <div key={t.blocoId}>
            <p className="mb-1.5 text-xs font-medium">
              No lugar de <span className="text-[var(--cor-acento)]">{t.itemAtual}</span>:
            </p>
            <ul className="space-y-1">
              {t.alternativas.map((a) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-[var(--raio)] border border-[var(--cor-borda)] px-3 py-2 text-xs"
                  key={a.item.id}
                >
                  <span>{a.item.nome}</span>
                  <span className="shrink-0 text-2xs text-[var(--cor-texto-fraco)]">{a.porque}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Alertas recolhidos por padrao.
 *
 * Um dia mal montado gera uma duzia de alertas, e doze cartoes abertos
 * empurram a linha do tempo para fora da tela — justo quando o usuario
 * precisa ver o que esta errado NELA. A barra resume; o detalhe abre.
 */
function PainelDeAlertas({ alertas, diaId }: { alertas: Alerta[]; diaId: string }) {
  const [aberto, definirAberto] = useState(false);
  if (alertas.length === 0) return null;

  const erros = alertas.filter((a) => a.nivel === 'erro');
  const atencoes = alertas.filter((a) => a.nivel === 'atencao');
  const dicas = alertas.filter((a) => a.nivel === 'dica');

  return (
    <div className="mb-4">
      <button
        aria-expanded={aberto}
        className={cn(
          'flex w-full items-center gap-3 rounded-[var(--raio)] border px-3 py-2 text-left text-xs transition-colors',
          erros.length > 0
            ? 'border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)]'
            : atencoes.length > 0
              ? 'border-[var(--cor-atencao-borda)] bg-[var(--cor-atencao-fundo)]'
              : 'border-[var(--cor-dica-borda)] bg-[var(--cor-dica-fundo)]',
        )}
        onClick={() => definirAberto(!aberto)}
        type="button"
      >
        {erros.length > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-[var(--cor-erro)]">
            <TriangleAlert size={13} />
            {erros.length} conflito{erros.length > 1 ? 's' : ''}
          </span>
        )}
        {atencoes.length > 0 && (
          <span className="text-[var(--cor-atencao)]">{atencoes.length} em atencao</span>
        )}
        {dicas.length > 0 && (
          <span className="text-[var(--cor-texto-suave)]">{dicas.length} dica(s)</span>
        )}
        <span className="ml-auto text-[var(--cor-texto-suave)]">
          {aberto ? 'esconder' : 'ver tudo'}
        </span>
        {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {aberto && (
        <ul className="mt-2 space-y-2">
          {alertas.map((a) => (
            <li key={`${a.codigo}-${a.blocoIds.join()}`}>
              <AlertaDoDia alerta={a} diaId={diaId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
