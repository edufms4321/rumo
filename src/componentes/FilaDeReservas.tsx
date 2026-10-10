/**
 * "O que reservar agora": a fila curta, no topo da tela de Reservas.
 *
 * Antes, a tela listava so atividades agendadas que pedem reserva. O voo
 * internacional e os documentos de entrada — as duas coisas mais caras e
 * mais irreversiveis da viagem — ficavam cada um na sua tela, sem prazo e
 * sem ordem. Quem abria a fila via o tour no topo e o visto em nenhum lugar.
 *
 * Esta lista mistura os tres tipos e ordena pelo que aperta primeiro. Os
 * cartoes completos de cada atividade continuam abaixo: aqui e so o que
 * fazer hoje, com a contagem e o link.
 *
 * Marcar como resolvido tira o item da fila na hora, e cada tipo tem o seu
 * lugar de verdade para guardar isso — o bloco, o documento, o voo. A fila
 * nao inventa um estado proprio.
 */
import { Check, ExternalLink, Plane, TicketCheck, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { type PendenciaDeReserva, filaDeReservas } from '../engine/fila-de-reservas.ts';
import { emQuantosDias, porExtenso } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import { acoes, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';
import { Botao, Cartao, Selo } from './ui.tsx';

function resolver(p: PendenciaDeReserva): void {
  switch (p.origem.tipo) {
    case 'atividade':
      acoes.definirStatusDeReserva(p.origem.blocoId, 'reservado');
      return;
    case 'documento':
      acoes.anotarDocumento(p.origem.documentoId, { status: 'pronto' });
      return;
    case 'voo':
      acoes.marcarVooComprado(true);
      return;
  }
}

const ROTULO_DA_URGENCIA: Record<PendenciaDeReserva['urgencia'], string> = {
  vencido: 'prazo vencido',
  'comprar-antes': 'quanto antes',
  apertado: 'aperta',
  tranquilo: 'com folga',
  'sem-prazo': 'sem prazo no banco',
};

export function FilaDeReservas({ viagemId }: { viagemId: string }) {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();

  const fila = useMemo(
    () => (viagem && pacote ? filaDeReservas(viagem, pacote, hoje) : []),
    [viagem, pacote, hoje],
  );

  const abertas = fila.filter((p) => !p.resolvida);
  if (abertas.length === 0) {
    if (fila.length === 0) return null;
    return (
      <Cartao className="mb-6 flex items-center gap-2 border-[var(--cor-verificado)]/30 p-3.5 text-sm">
        <Check className="shrink-0 text-[var(--cor-verificado)]" size={16} />
        Nada pendente: voo, documentos e reservas estao todos resolvidos.
      </Cartao>
    );
  }

  return (
    <section className="mb-7">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
        <TicketCheck size={13} /> O que reservar agora
      </h3>
      <ul className="space-y-1.5">
        {abertas.map((p) => {
          const vencido = p.urgencia === 'vencido';
          const aperta = p.urgencia === 'apertado' || p.urgencia === 'comprar-antes';
          return (
            <li key={p.chave}>
              <Cartao
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3',
                  vencido && 'border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)]',
                  aperta && !vencido && 'border-[var(--cor-atencao-borda)]',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {p.origem.tipo === 'voo' && <Plane className="shrink-0" size={13} />}
                    {vencido && (
                      <TriangleAlert
                        className="shrink-0 text-[var(--cor-erro)]"
                        size={13}
                      />
                    )}
                    {p.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--cor-texto-suave)]">
                    {p.prazo && p.diasAteOPrazo !== undefined ? (
                      <span
                        className={cn(
                          vencido && 'font-medium text-[var(--cor-erro)]',
                          aperta && !vencido && 'font-medium text-[var(--cor-atencao-forte)]',
                        )}
                      >
                        {vencido ? 'venceu' : 'ate'} {porExtenso(p.prazo)},{' '}
                        {emQuantosDias(p.diasAteOPrazo)}
                      </span>
                    ) : (
                      ROTULO_DA_URGENCIA[p.urgencia]
                    )}
                    {p.origem.tipo === 'atividade' && (
                      <>
                        {' · '}
                        <Link
                          className="hover:text-[var(--cor-acento)]"
                          to={`/viagem/${viagemId}/dia/${p.origem.diaId}`}
                        >
                          no dia {p.origem.data.split('-').reverse().join('/')}
                        </Link>
                      </>
                    )}
                  </p>
                  {p.nota && (
                    <p className="mt-0.5 text-2xs leading-relaxed text-[var(--cor-texto-fraco)]">
                      {p.nota}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Selo tom={vencido ? 'erro' : aperta ? 'atencao' : 'neutro'}>
                    {ROTULO_DA_URGENCIA[p.urgencia]}
                  </Selo>
                  {p.link && (
                    <Botao
                      onClick={() => window.open(p.link, '_blank', 'noopener,noreferrer')}
                      tamanho="pequeno"
                      variante="contorno"
                    >
                      <ExternalLink size={12} /> abrir
                    </Botao>
                  )}
                  <Botao onClick={() => resolver(p)} tamanho="pequeno">
                    <Check size={12} /> resolvido
                  </Botao>
                </div>
              </Cartao>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
