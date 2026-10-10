/**
 * Casca do app: navegacao, tema e a barra fixa de situacao.
 *
 * A barra fixa existe porque o briefing pede quatro numeros sempre a vista
 * durante o planejamento: tempo livre, horas ocupadas, gasto contra
 * orcamento e quantidade de conflitos. Ela e recalculada do motor a cada
 * mudanca - nao ha copia de estado.
 */
import {
  BedDouble,
  CalendarDays,
  Compass,
  Download,
  FileText,
  Heart,
  Moon,
  Radar,
  Redo2,
  Settings2,
  Sun,
  TicketCheck,
  TriangleAlert,
  type LucideIcon,
  Undo2,
  Wallet,
} from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router';
import { formatarFaixaBRL } from '../engine/orcamento.ts';
import { calcularOrcamento } from '../engine/orcamento.ts';
import { validarViagem } from '../engine/regras.ts';
import { resolverDia } from '../engine/resolver-dia.ts';
import { formatarDuracao } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import {
  usarHoje,
  usarLoja,
  usarPacote,
  usarStatusDoPacote,
  usarViagem,
} from '../store/viagem.ts';
import { Botao, ComDica } from './ui.tsx';

const ABAS: Array<{ para: string; rotulo: string; icone: LucideIcon }> = [
  { para: 'agora', rotulo: 'Agora', icone: Radar },
  { para: 'descobrir', rotulo: 'Descobrir', icone: Compass },
  { para: 'selecao', rotulo: 'Selecao', icone: Heart },
  { para: 'dormir', rotulo: 'Dormir', icone: BedDouble },
  { para: 'calendario', rotulo: 'Calendario', icone: CalendarDays },
  { para: 'orcamento', rotulo: 'Orcamento', icone: Wallet },
  { para: 'reservas', rotulo: 'Reservas', icone: TicketCheck },
  { para: 'documentos', rotulo: 'Documentos', icone: FileText },
  { para: 'exportar', rotulo: 'Exportar', icone: Download },
  { para: 'config', rotulo: 'Ajustes', icone: Settings2 },
];

function usarTema() {
  const [tema, definirTema] = useState<'claro' | 'escuro' | 'sistema'>(() => {
    if (typeof localStorage === 'undefined') return 'sistema';
    try {
      return (localStorage.getItem('rumo:tema') as 'claro' | 'escuro' | 'sistema') ?? 'sistema';
    } catch {
      return 'sistema';
    }
  });

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === 'sistema') raiz.removeAttribute('data-tema');
    else raiz.setAttribute('data-tema', tema);
    try {
      localStorage.setItem('rumo:tema', tema);
    } catch {
      /* armazenamento bloqueado: o tema vale so nesta sessao */
    }
  }, [tema]);

  return { tema, definirTema };
}

function BarraDeSituacao() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();

  const numeros = useMemo(() => {
    if (!viagem || !pacote) return undefined;
    const dias = viagem.dias.map((d) => resolverDia(viagem, d, pacote));
    const alertas = validarViagem(viagem, pacote, { hoje });
    const orcamento = calcularOrcamento(viagem, pacote);
    return {
      livre: dias.reduce((s, d) => s + d.minutosLivres, 0),
      ocupado: dias.reduce((s, d) => s + d.minutosEmAtividades + d.minutosEmDeslocamento, 0),
      orcamento,
      erros: alertas.filter((a) => a.nivel === 'erro').length,
      atencoes: alertas.filter((a) => a.nivel === 'atencao').length,
    };
  }, [viagem, pacote, hoje]);

  if (!numeros || !viagem?.dias.length) return null;

  const estourou = numeros.orcamento.estourou;

  return (
    // Landmark de verdade: sem isso o resumo fica fora de qualquer regiao e
    // quem navega por landmarks nunca chega nele.
    <footer
      aria-label="Resumo da viagem"
      className="nao-imprimir sticky bottom-0 z-30 border-t border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2 text-xs sm:px-6">
        <Numero rotulo="Tempo livre" valor={formatarDuracao(numeros.livre)} />
        <Numero rotulo="Ocupado" valor={formatarDuracao(numeros.ocupado)} />
        <Numero
          alerta={estourou}
          rotulo="Gasto planejado"
          valor={
            numeros.orcamento.orcado
              ? `${formatarFaixaBRL(numeros.orcamento.total)} de ${formatarFaixaBRL(numeros.orcamento.orcado)}`
              : formatarFaixaBRL(numeros.orcamento.total)
          }
        />
        <div className="ml-auto flex items-center gap-3">
          {numeros.erros > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-[var(--cor-erro)]">
              <TriangleAlert size={13} />
              {numeros.erros} conflito{numeros.erros > 1 ? 's' : ''}
            </span>
          )}
          {numeros.atencoes > 0 && (
            <span className="text-[var(--cor-atencao)]">{numeros.atencoes} em atencao</span>
          )}
          {numeros.erros === 0 && numeros.atencoes === 0 && (
            <span className="text-[var(--cor-verificado)]">sem conflito</span>
          )}
        </div>
      </div>
    </footer>
  );
}

function Numero({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[var(--cor-texto-fraco)]">{rotulo}</span>
      <span
        className={cn(
          'tabular font-medium',
          alerta ? 'text-[var(--cor-erro)]' : 'text-[var(--cor-texto)]',
        )}
      >
        {valor}
      </span>
    </span>
  );
}

function Desfazer() {
  const temporal = usarLoja.temporal;
  const [estado, definirEstado] = useState(() => temporal.getState());

  useEffect(() => temporal.subscribe(definirEstado), [temporal]);

  return (
    <div className="flex items-center gap-0.5">
      <ComDica texto="Desfazer (Ctrl+Z)">
        <Botao
          aria-label="Desfazer"
          disabled={estado.pastStates.length === 0}
          onClick={() => temporal.getState().undo()}
          tamanho="icone"
          variante="fantasma"
        >
          <Undo2 size={16} />
        </Botao>
      </ComDica>
      <ComDica texto="Refazer (Ctrl+Shift+Z)">
        <Botao
          aria-label="Refazer"
          disabled={estado.futureStates.length === 0}
          onClick={() => temporal.getState().redo()}
          tamanho="icone"
          variante="fantasma"
        >
          <Redo2 size={16} />
        </Botao>
      </ComDica>
    </div>
  );
}

export function Layout() {
  const { tema, definirTema } = usarTema();
  const viagem = usarViagem();
  const { viagemId } = useParams();
  const abrirViagem = usarLoja((e) => e.abrirViagem);
  const garantirPacote = usarLoja((e) => e.garantirPacote);
  const viagemAtivaId = usarLoja((e) => e.viagemAtivaId);
  const statusDoPacote = usarStatusDoPacote();
  const { pathname } = useLocation();

  const tituloDaTela = (() => {
    if (!viagemId) return 'Rumo — planejamento de viagem';
    if (/\/dia\//.test(pathname)) return `Montar o dia — ${viagem?.nome ?? 'viagem'}`;
    const aba = ABAS.find((a) => pathname.endsWith(`/${a.para}`));
    return `${aba?.rotulo ?? 'Viagem'} — ${viagem?.nome ?? 'viagem'}`;
  })();

  // A URL manda: entrar por link direto abre a viagem certa.
  useEffect(() => {
    if (viagemId && viagemId !== viagemAtivaId) abrirViagem(viagemId);
  }, [viagemId, viagemAtivaId, abrirViagem]);

  // O pacote do destino so e baixado quando ha uma viagem aberta.
  useEffect(() => {
    if (viagem?.destinoId) void garantirPacote(viagem.destinoId);
  }, [viagem?.destinoId, garantirPacote]);

  // Ctrl+Z e Ctrl+Shift+Z no app inteiro.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) usarLoja.temporal.getState().redo();
      else usarLoja.temporal.getState().undo();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="nao-imprimir sticky top-0 z-30 border-b border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <NavLink className="flex items-baseline gap-2" to="/">
            <span className="text-lg font-semibold tracking-tight">Rumo</span>
          </NavLink>

          {viagem && (
            <span className="hidden min-w-0 truncate text-sm text-[var(--cor-texto-suave)] sm:block">
              / {viagem.nome}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Desfazer />
            <ComDica texto={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}>
              <Botao
                aria-label="Alternar tema"
                onClick={() => definirTema(tema === 'escuro' ? 'claro' : 'escuro')}
                tamanho="icone"
                variante="fantasma"
              >
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
              </Botao>
            </ComDica>
          </div>
        </div>

        {viagemId && (
          <nav className="mx-auto max-w-[1600px] overflow-x-auto px-2 sm:px-4">
            <ul className="flex gap-0.5">
              {ABAS.map((aba) => {
                const Icone = aba.icone;
                return (
                  <li key={aba.para}>
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                          isActive
                            ? 'border-[var(--cor-acento)] text-[var(--cor-acento)]'
                            : 'border-transparent text-[var(--cor-texto-suave)] hover:text-[var(--cor-texto)]',
                        )
                      }
                      to={`/viagem/${viagemId}/${aba.para}`}
                    >
                      <Icone size={14} />
                      {aba.rotulo}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      {/*
        O h1 da pagina mora aqui, nao em cada tela.

        Motivo: varias telas trocam o conteudo inteiro por um estado vazio
        ("ainda nao tem datas") e, quando faziam isso, a pagina ficava sem
        nenhum cabecalho — o leitor de tela perdia a referencia de onde
        esta. No Layout ele existe sempre. E invisivel porque as telas ja
        se anunciam visualmente; quem le com os olhos nao precisa de dois
        titulos.
      */}

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        {viagemId && <h1 className="nao-imprimir sr-only">{tituloDaTela}</h1>}
        {viagemId && statusDoPacote === 'carregando' ? (
          <CarregandoPacote />
        ) : viagemId && statusDoPacote === 'erro' ? (
          <ErroNoPacote />
        ) : (
          <Suspense fallback={<CarregandoPacote />}>
            <Outlet />
          </Suspense>
        )}
      </main>

      <BarraDeSituacao />
    </div>
  );
}

function CarregandoPacote() {
  return (
    <div className="space-y-3 py-10">
      <div className="mx-auto h-4 w-48 animate-pulse rounded bg-[var(--cor-fundo-afundado)]" />
      <p className="text-center text-xs text-[var(--cor-texto-fraco)]">
        Baixando o banco do destino...
      </p>
    </div>
  );
}

function ErroNoPacote() {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-[var(--cor-erro)]">
        O banco deste destino nao passou na validacao.
      </p>
      <p className="mt-1 text-xs text-[var(--cor-texto-suave)]">
        Rode <code>npm run validate:data</code> para ver o que esta errado.
      </p>
    </div>
  );
}
