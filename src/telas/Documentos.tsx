/**
 * Documentos da viagem.
 *
 * Por que uma tela so para isso: o requisito de entrada existia no banco como
 * um paragrafo enorme dentro de `destino.entrada.observacoes`. Ele aparecia
 * no alerta da viagem, inteiro, e ninguem le um paragrafo de dez linhas
 * procurando o que tem de fazer hoje. O que o viajante precisa e uma lista
 * curta: o que e, quanto custa, ate quando, o link oficial, e em que pe esta.
 *
 * O status mora na viagem, nao no pacote: `/data` e somente leitura, e o
 * mesmo e-visto tem situacao diferente em cada viagem.
 *
 * O que esta tela NAO faz: pedir o visto. Nenhum campo aqui manda dado para
 * lugar nenhum — ela abre o site oficial numa aba nova e o resto e com ele.
 */
import {
  BadgeCheck,
  CircleDot,
  ExternalLink,
  FileText,
  Info,
  Plane,
  Syringe,
  TriangleAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { Fontes, IdadeDoDado, SeloDeConfianca } from '../componentes/procedencia.tsx';
import { AreaDeTexto, Botao, Campo, Cartao, Rotulo, Selecao, Selo, Vazio } from '../componentes/ui.tsx';
import { documentosDaViagem } from '../engine/documentos.ts';
import { diferencaEmDias, emQuantosDias, porExtenso } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import type { StatusDoDocumento, TipoDeDocumento } from '../schema/documento.ts';
import { acoes, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

const STATUS: Array<{ valor: StatusDoDocumento; rotulo: string }> = [
  { valor: 'pendente', rotulo: 'pendente' },
  { valor: 'em-andamento', rotulo: 'em andamento' },
  { valor: 'pronto', rotulo: 'pronto' },
  { valor: 'nao-se-aplica', rotulo: 'nao se aplica a mim' },
];

const ICONE: Record<TipoDeDocumento, typeof FileText> = {
  passaporte: FileText,
  visto: Plane,
  taxa: CircleDot,
  formulario: FileText,
  vacina: Syringe,
  seguro: BadgeCheck,
};

function formatarPreco(moeda: string, min: number, max: number): string {
  const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return min === max ? `${moeda} ${n(min)}` : `${moeda} ${n(min)}-${n(max)}`;
}

export function Documentos() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();

  const lista = useMemo(
    () => (viagem && pacote ? documentosDaViagem(viagem, pacote) : []),
    [viagem, pacote],
  );

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  const pendentes = lista.filter((d) => {
    const status = viagem.documentos[d.documento.id]?.status ?? 'pendente';
    return status === 'pendente' || status === 'em-andamento';
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Documentos da viagem</h2>
        <p className="mt-1.5 text-sm text-[var(--cor-texto-suave)]">
          {lista.length === 0
            ? 'Este pacote ainda nao tem documentos de entrada pesquisados em campos. O alerta da viagem continua mostrando o texto do requisito.'
            : `${pendentes.length} em aberto de ${lista.length}. Ordenado pelo prazo mais apertado. Confirme sempre no site oficial: regra de entrada muda sem aviso.`}
        </p>
      </header>

      {lista.length === 0 ? (
        <Vazio icone={<FileText size={26} />} titulo="Nenhum documento estruturado" />
      ) : (
        <ul className="space-y-2.5">
          {lista.map(({ documento: d, prazo, motivoDoEscopo }) => {
            const anotacao = viagem.documentos[d.id];
            const status = anotacao?.status ?? 'pendente';
            const resolvido = status === 'pronto' || status === 'nao-se-aplica';
            const diasAteOPrazo = prazo ? diferencaEmDias(hoje, prazo) : undefined;
            const vencido = diasAteOPrazo !== undefined && diasAteOPrazo < 0 && !resolvido;
            const apertado =
              diasAteOPrazo !== undefined &&
              diasAteOPrazo >= 0 &&
              diasAteOPrazo <= 15 &&
              !resolvido;
            const Icone = ICONE[d.tipo];

            return (
              <li key={d.id}>
                <Cartao
                  className={cn(
                    'p-3.5',
                    vencido && 'border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)]',
                    apertado && !vencido && 'border-[var(--cor-atencao-borda)]',
                    resolvido && 'border-[var(--cor-verificado)]/30',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center gap-1.5 text-sm font-medium">
                        <Icone className="shrink-0" size={14} />
                        {d.nome}
                        {!d.obrigatorio && <Selo tom="neutro">recomendado</Selo>}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--cor-texto-suave)]">
                        {d.resumo}
                      </p>
                    </div>
                    <SeloDeConfianca compacto nivel={d.confianca} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {d.custo && (
                      <Selo tom={d.custo.fontes.length > 0 ? 'parcial' : 'estimado'}>
                        {formatarPreco(d.custo.moeda, d.custo.min, d.custo.max)} por{' '}
                        {d.custo.por}
                      </Selo>
                    )}
                    {d.entradasPermitidas !== undefined && (
                      <Selo tom={d.entradasPermitidas === 1 ? 'atencao' : 'neutro'}>
                        {d.entradasPermitidas === 1
                          ? 'entrada unica'
                          : `${d.entradasPermitidas} entradas`}
                      </Selo>
                    )}
                    {d.vias.length > 0 && <Selo tom="neutro">so via {d.vias.join(' e ')}</Selo>}
                    {d.validadeDias !== undefined && (
                      <Selo tom="neutro">vale {d.validadeDias} dias</Selo>
                    )}
                    {motivoDoEscopo && <Selo tom="acento">cobrado em {motivoDoEscopo}</Selo>}
                  </div>

                  {/* O prazo e o que faz esta tela valer: data e contagem. */}
                  <div className="mt-2.5 space-y-1 text-xs">
                    {prazo ? (
                      <p
                        className={cn(
                          vencido && 'font-medium text-[var(--cor-erro)]',
                          apertado && !vencido && 'font-medium text-[var(--cor-atencao-forte)]',
                        )}
                      >
                        Resolver ate {porExtenso(prazo)} — {emQuantosDias(diasAteOPrazo ?? 0)}
                        {d.prazo ? ` (${d.prazo})` : ''}
                      </p>
                    ) : (
                      d.prazo && <p>Prazo: {d.prazo}</p>
                    )}
                    {d.comoPedir && (
                      <p className="text-[var(--cor-texto-suave)]">{d.comoPedir}</p>
                    )}
                    {d.isencoes.length > 0 && (
                      <p className="text-[var(--cor-texto-suave)]">
                        <strong>Dispensado quem tem:</strong> {d.isencoes.join('; ')}.
                      </p>
                    )}
                    {d.observacoes && (
                      <p className="flex items-start gap-1 leading-relaxed text-[var(--cor-atencao-forte)]">
                        <TriangleAlert className="mt-0.5 shrink-0" size={11} />
                        <span>{d.observacoes}</span>
                      </p>
                    )}
                    {d.custo?.observacao && (
                      <p className="flex items-start gap-1 leading-relaxed text-[var(--cor-texto-suave)]">
                        <Info className="mt-0.5 shrink-0" size={11} />
                        <span>{d.custo.observacao}</span>
                      </p>
                    )}
                    <IdadeDoDado coletadoEm={d.coletadoEm} hoje={hoje} />
                    <Fontes fontes={d.fontes} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div>
                      <Rotulo htmlFor={`status-${d.id}`}>Situacao</Rotulo>
                      <Selecao
                        className="h-8 text-xs"
                        id={`status-${d.id}`}
                        onChange={(e) =>
                          acoes.anotarDocumento(d.id, {
                            status: e.target.value as StatusDoDocumento,
                          })
                        }
                        value={status}
                      >
                        {STATUS.map((s) => (
                          <option key={s.valor} value={s.valor}>
                            {s.rotulo}
                          </option>
                        ))}
                      </Selecao>
                    </div>
                    <div className="min-w-[10rem] flex-1">
                      <Rotulo htmlFor={`codigo-${d.id}`}>Codigo ou protocolo</Rotulo>
                      <Campo
                        className="h-8 text-xs"
                        id={`codigo-${d.id}`}
                        onChange={(e) => acoes.anotarDocumento(d.id, { codigo: e.target.value })}
                        placeholder="o numero que o site devolveu"
                        value={anotacao?.codigo ?? ''}
                      />
                    </div>
                    {d.linkOficial && (
                      <Botao
                        onClick={() =>
                          window.open(d.linkOficial, '_blank', 'noopener,noreferrer')
                        }
                        tamanho="pequeno"
                        variante="contorno"
                      >
                        <ExternalLink size={12} /> site oficial
                      </Botao>
                    )}
                  </div>

                  <div className="mt-2">
                    <Rotulo htmlFor={`obs-${d.id}`}>Suas anotacoes</Rotulo>
                    <AreaDeTexto
                      className="min-h-[3rem] text-xs"
                      id={`obs-${d.id}`}
                      onChange={(e) => acoes.anotarDocumento(d.id, { observacao: e.target.value })}
                      placeholder="o que o consulado respondeu, onde esta o comprovante impresso..."
                      value={anotacao?.observacao ?? ''}
                    />
                  </div>
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
