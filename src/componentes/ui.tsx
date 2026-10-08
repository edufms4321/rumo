/**
 * Primitivas da interface. Construidas sobre Radix onde ha comportamento
 * (foco, teclado, acessibilidade) e sobre nada onde nao ha.
 *
 * Nenhuma delas usa cor direta: so os tokens semanticos de index.css. Trocar
 * o tema e trocar os tokens, nao cacar hex pelo codigo.
 */
import * as Dialogo from '@radix-ui/react-dialog';
import * as Interruptor from '@radix-ui/react-switch';
import * as Dica from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

// ------------------------------------------------------------------ botao

type VarianteDeBotao = 'principal' | 'secundario' | 'fantasma' | 'perigo' | 'contorno';
type TamanhoDeBotao = 'pequeno' | 'medio' | 'grande' | 'icone';

const VARIANTES: Record<VarianteDeBotao, string> = {
  principal:
    'bg-[var(--cor-acento)] text-[var(--cor-acento-texto)] hover:bg-[var(--cor-acento-forte)] shadow-[var(--sombra-card)]',
  secundario:
    'bg-[var(--cor-fundo-afundado)] text-[var(--cor-texto)] hover:bg-[var(--cor-borda)]',
  contorno:
    'border border-[var(--cor-borda-forte)] bg-[var(--cor-fundo-elevado)] text-[var(--cor-texto)] hover:bg-[var(--cor-fundo-afundado)]',
  fantasma: 'text-[var(--cor-texto-suave)] hover:bg-[var(--cor-fundo-afundado)] hover:text-[var(--cor-texto)]',
  perigo: 'bg-[var(--cor-erro)] text-white hover:opacity-90',
};

const TAMANHOS: Record<TamanhoDeBotao, string> = {
  pequeno: 'h-8 px-3 text-xs gap-1.5',
  medio: 'h-10 px-4 text-sm gap-2',
  grande: 'h-12 px-6 text-base gap-2',
  icone: 'h-9 w-9 justify-center',
};

export interface PropsDeBotao extends ComponentProps<'button'> {
  variante?: VarianteDeBotao;
  tamanho?: TamanhoDeBotao;
}

export function Botao({
  variante = 'secundario',
  tamanho = 'medio',
  className,
  ...resto
}: PropsDeBotao) {
  return (
    <button
      className={cn(
        'inline-flex items-center rounded-[var(--raio)] font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      type="button"
      {...resto}
    />
  );
}

// ----------------------------------------------------------------- cartao

export function Cartao({ className, ...resto }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[var(--raio)] border border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)]',
        'shadow-[var(--sombra-card)]',
        className,
      )}
      {...resto}
    />
  );
}

// ------------------------------------------------------------------- selo

type TomDeSelo =
  | 'neutro'
  | 'acento'
  | 'verificado'
  | 'parcial'
  | 'estimado'
  | 'erro'
  | 'atencao'
  | 'dica';

const TONS: Record<TomDeSelo, string> = {
  neutro:
    'bg-[var(--cor-fundo-afundado)] text-[var(--cor-texto-suave)] ring-[var(--cor-borda)]',
  acento: 'bg-[var(--cor-acento-fraco)] text-[var(--cor-acento-forte)] ring-[var(--cor-acento-borda)]',
  verificado:
    'bg-[var(--cor-verificado-fundo)] text-[var(--cor-verificado)] ring-[var(--cor-verificado)]/25',
  parcial: 'bg-[var(--cor-parcial-fundo)] text-[var(--cor-parcial)] ring-[var(--cor-parcial)]/25',
  estimado: 'bg-[var(--cor-estimado-fundo)] text-[var(--cor-estimado)] ring-[var(--cor-estimado)]/25',
  erro: 'bg-[var(--cor-erro-fundo)] text-[var(--cor-erro)] ring-[var(--cor-erro-borda)]',
  atencao: 'bg-[var(--cor-atencao-fundo)] text-[var(--cor-atencao)] ring-[var(--cor-atencao-borda)]',
  dica: 'bg-[var(--cor-dica-fundo)] text-[var(--cor-dica)] ring-[var(--cor-dica-borda)]',
};

export function Selo({
  tom = 'neutro',
  className,
  ...resto
}: ComponentProps<'span'> & { tom?: TomDeSelo }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5',
        'text-2xs font-medium ring-1 ring-inset',
        TONS[tom],
        className,
      )}
      {...resto}
    />
  );
}

// ------------------------------------------------------------------ campo

export function Campo({ className, ...resto }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-[var(--raio)] border border-[var(--cor-borda-forte)]',
        'bg-[var(--cor-fundo-elevado)] px-3 text-sm text-[var(--cor-texto)]',
        'placeholder:text-[var(--cor-texto-fraco)]',
        'focus:border-[var(--cor-acento)]',
        className,
      )}
      {...resto}
    />
  );
}

export function AreaDeTexto({ className, ...resto }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-[var(--raio)] border border-[var(--cor-borda-forte)]',
        'bg-[var(--cor-fundo-elevado)] p-3 text-sm text-[var(--cor-texto)]',
        'placeholder:text-[var(--cor-texto-fraco)] focus:border-[var(--cor-acento)]',
        className,
      )}
      {...resto}
    />
  );
}

export function Selecao({ className, ...resto }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-[var(--raio)] border border-[var(--cor-borda-forte)]',
        'bg-[var(--cor-fundo-elevado)] px-3 text-sm text-[var(--cor-texto)]',
        'focus:border-[var(--cor-acento)]',
        className,
      )}
      {...resto}
    />
  );
}

export function Rotulo({ className, ...resto }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-medium text-[var(--cor-texto-suave)]', className)}
      {...resto}
    />
  );
}

export function Chave({
  marcado,
  aoMudar,
  rotulo,
}: {
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
}) {
  return (
    <Interruptor.Root
      aria-label={rotulo}
      checked={marcado}
      className={cn(
        'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
        'data-[state=checked]:bg-[var(--cor-acento)] data-[state=unchecked]:bg-[var(--cor-borda-forte)]',
      )}
      onCheckedChange={aoMudar}
    >
      <Interruptor.Thumb
        className={cn(
          'block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform',
          'data-[state=checked]:translate-x-[1.375rem]',
        )}
      />
    </Interruptor.Root>
  );
}

// ------------------------------------------------------------------ dica

export function ComDica({ texto, children }: { texto: ReactNode; children: ReactNode }) {
  return (
    <Dica.Provider delayDuration={250}>
      <Dica.Root>
        <Dica.Trigger asChild>{children}</Dica.Trigger>
        <Dica.Portal>
          <Dica.Content
            className={cn(
              'z-50 max-w-xs rounded-[var(--raio)] border border-[var(--cor-borda)]',
              'bg-[var(--cor-fundo-elevado)] px-3 py-2 text-xs text-[var(--cor-texto)]',
              'shadow-[var(--sombra-flutuante)]',
            )}
            sideOffset={6}
          >
            {texto}
            <Dica.Arrow className="fill-[var(--cor-borda)]" />
          </Dica.Content>
        </Dica.Portal>
      </Dica.Root>
    </Dica.Provider>
  );
}

// --------------------------------------------------------------- dialogo

export function Painel({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  largura = 'max-w-2xl',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  largura?: string;
}) {
  return (
    <Dialogo.Root onOpenChange={(v) => !v && aoFechar()} open={aberto}>
      <Dialogo.Portal>
        <Dialogo.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
        <Dialogo.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--cor-borda)]',
            'bg-[var(--cor-fundo-elevado)] shadow-[var(--sombra-flutuante)]',
            largura,
          )}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)] px-5 py-4">
            <div>
              <Dialogo.Title className="text-base font-semibold">{titulo}</Dialogo.Title>
              {descricao && (
                <Dialogo.Description className="mt-0.5 text-xs text-[var(--cor-texto-suave)]">
                  {descricao}
                </Dialogo.Description>
              )}
            </div>
            <Dialogo.Close asChild>
              <Botao aria-label="Fechar" tamanho="icone" variante="fantasma">
                <X size={18} />
              </Botao>
            </Dialogo.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </Dialogo.Content>
      </Dialogo.Portal>
    </Dialogo.Root>
  );
}

// ----------------------------------------------------------- estado vazio

export function Vazio({
  icone,
  titulo,
  children,
}: {
  icone?: ReactNode;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--raio)] border border-dashed border-[var(--cor-borda-forte)] px-6 py-14 text-center">
      {icone && <div className="mb-3 text-[var(--cor-texto-fraco)]">{icone}</div>}
      <p className="text-sm font-medium text-[var(--cor-texto)]">{titulo}</p>
      {children && (
        <div className="mt-1.5 max-w-sm text-xs text-[var(--cor-texto-suave)]">{children}</div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- esqueleto

export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--raio)] bg-[var(--cor-fundo-afundado)]', className)}
    />
  );
}

// ------------------------------------------------------------- separador

export function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
