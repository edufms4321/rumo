/**
 * Componentes de procedencia: o que diferencia este app de uma planilha.
 *
 * Toda vez que o app mostra um numero, mostra junto de onde ele veio e
 * quando. Nao e rodape de letra miuda: e parte do dado.
 */
import { BadgeCheck, CircleHelp, Clock, ExternalLink, TriangleAlert } from 'lucide-react';
import type { Confianca, Fonte, Preco } from '../schema/base.ts';
import type { Item } from '../schema/item.ts';
import { avaliarIdade } from '../engine/procedencia.ts';
import { cn } from '../lib/cn.ts';
import { ComDica, Selo } from './ui.tsx';

const CONFIANCA = {
  verificado: {
    rotulo: 'verificado',
    tom: 'verificado' as const,
    icone: BadgeCheck,
    explica: 'Site oficial, ou duas fontes independentes que concordam.',
  },
  parcial: {
    rotulo: 'parcial',
    tom: 'parcial' as const,
    icone: CircleHelp,
    explica: 'Uma fonte razoavel apenas. Confira o que for decisivo.',
  },
  estimado: {
    rotulo: 'estimado',
    tom: 'estimado' as const,
    icone: TriangleAlert,
    explica: 'Deduzido pelo pesquisador, sem fonte direta. Trate como ordem de grandeza.',
  },
};

export function SeloDeConfianca({ nivel, compacto }: { nivel: Confianca; compacto?: boolean }) {
  const c = CONFIANCA[nivel];
  const Icone = c.icone;
  return (
    <ComDica texto={c.explica}>
      <Selo tom={c.tom}>
        <Icone size={11} strokeWidth={2.5} />
        {!compacto && c.rotulo}
      </Selo>
    </ComDica>
  );
}

export function IdadeDoDado({ coletadoEm, hoje }: { coletadoEm: string; hoje: string }) {
  const idade = avaliarIdade(coletadoEm, hoje);
  const cor =
    idade.nivel === 'velho'
      ? 'text-[var(--cor-estimado)]'
      : idade.nivel === 'envelhecendo'
        ? 'text-[var(--cor-parcial)]'
        : 'text-[var(--cor-texto-fraco)]';

  return (
    <ComDica
      texto={
        idade.nivel === 'velho'
          ? `Coletado em ${coletadoEm}. Preco e horario mudam: confirme antes de contar com isto.`
          : `Coletado em ${coletadoEm}.`
      }
    >
      <span className={cn('inline-flex items-center gap-1 text-2xs', cor)}>
        <Clock size={10} />
        {idade.rotulo}
      </span>
    </ComDica>
  );
}

export function Fontes({ fontes, limite = 3 }: { fontes: Fonte[]; limite?: number }) {
  if (fontes.length === 0) {
    return <span className="text-2xs text-[var(--cor-estimado)]">sem fonte</span>;
  }
  const mostradas = fontes.slice(0, limite);
  const resto = fontes.length - mostradas.length;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-[var(--cor-texto-fraco)]">
      <span>{fontes.length === 1 ? 'fonte:' : `${fontes.length} fontes:`}</span>
      {mostradas.map((f) => {
        let hospedeiro = f.url;
        try {
          hospedeiro = new URL(f.url).hostname.replace(/^www\./, '');
        } catch {
          /* url estranha: mostra inteira */
        }
        return (
          <a
            className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 hover:text-[var(--cor-acento)]"
            href={f.url}
            key={f.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {f.titulo ?? hospedeiro}
            <ExternalLink size={9} />
          </a>
        );
      })}
      {resto > 0 && <span>e mais {resto}</span>}
    </span>
  );
}

/** Moeda local + conversao, com a data da coleta sempre junto. */
export function PrecoExibido({
  preco,
  taxas,
  pessoas = 1,
  hoje,
}: {
  preco: Preco;
  taxas: Record<string, number>;
  pessoas?: number;
  hoje?: string;
}) {
  const n = (v: number) =>
    v.toLocaleString('pt-BR', { maximumFractionDigits: v < 100 ? 2 : 0 });
  const faixa = preco.min === preco.max ? n(preco.min) : `${n(preco.min)} a ${n(preco.max)}`;

  const taxa = preco.moeda === 'BRL' ? 1 : taxas[preco.moeda];
  const multiplicador = preco.por === 'pessoa' ? pessoas : 1;
  const emReais =
    taxa === undefined
      ? undefined
      : `${(preco.min * taxa * multiplicador).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 0,
        })}${preco.min === preco.max ? '' : '+'}`;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className="tabular font-medium text-[var(--cor-texto)]">
        {preco.moeda} {faixa}
      </span>
      <span className="text-2xs text-[var(--cor-texto-fraco)]">
        por {preco.por}
        {emReais && pessoas > 1 && preco.por === 'pessoa' ? `, ${pessoas} pessoas` : ''}
      </span>
      {emReais && (
        <ComDica
          texto={`Convertido pela taxa que voce definiu. ${preco.coletadoEm ? `Preco coletado em ${preco.coletadoEm}.` : ''}`}
        >
          <span className="tabular text-2xs text-[var(--cor-acento)]">~{emReais}</span>
        </ComDica>
      )}
      {hoje && <IdadeDoDado coletadoEm={preco.coletadoEm} hoje={hoje} />}
    </span>
  );
}

/** Linha de procedencia que vai embaixo do card. */
export function RodapeDeProcedencia({ item, hoje }: { item: Item; hoje: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--cor-borda)] pt-2.5">
      <SeloDeConfianca nivel={item.confianca} />
      <IdadeDoDado coletadoEm={item.coletadoEm} hoje={hoje} />
      <Fontes fontes={item.fontes} />
      {item.observacaoDeConfianca && (
        <ComDica texto={item.observacaoDeConfianca}>
          <span className="cursor-help text-2xs text-[var(--cor-texto-fraco)] underline decoration-dotted">
            ressalva
          </span>
        </ComDica>
      )}
    </div>
  );
}
