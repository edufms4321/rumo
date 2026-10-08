import { CalendarClock, Check, Copy, MessageCircle, TicketCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Fontes } from '../componentes/procedencia.tsx';
import {
  AreaDeTexto,
  Botao,
  Campo,
  Cartao,
  Rotulo,
  Selecao,
  Selo,
  Vazio,
} from '../componentes/ui.tsx';
import { linkDeWhatsApp, mensagemDeConfirmacao } from '../engine/geradores.ts';
import { diferencaEmDias, emQuantosDias, porExtenso, somarDias } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import type { Item } from '../schema/item.ts';
import type { StatusDeReserva } from '../schema/viagem.ts';
import { acoes, novoId, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

const STATUS: Array<{ valor: StatusDeReserva; rotulo: string }> = [
  { valor: 'precisa-reservar', rotulo: 'precisa reservar' },
  { valor: 'reservado', rotulo: 'reservado' },
  { valor: 'pago', rotulo: 'pago' },
  { valor: 'cancelado', rotulo: 'cancelado' },
  { valor: 'nao-precisa', rotulo: 'nao precisa' },
];

interface Pendencia {
  blocoId: string;
  item: Item;
  data: string;
  prazo?: string;
  diasAteOPrazo?: number;
  status: StatusDeReserva;
}

export function Reservas() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();
  const [aberta, definirAberta] = useState<string>();

  const pendencias = useMemo((): Pendencia[] => {
    if (!viagem || !pacote) return [];
    const porId = new Map(pacote.itens.map((i) => [i.id, i]));
    const lista: Pendencia[] = [];

    for (const dia of viagem.dias) {
      for (const bloco of dia.blocos) {
        if (bloco.tipo !== 'atividade') continue;
        const item = porId.get(bloco.itemId);
        if (!item?.reserva.necessaria) continue;
        const antecedencia = item.reserva.antecedenciaDias;
        const prazo = antecedencia === undefined ? undefined : somarDias(dia.data, -antecedencia);
        lista.push({
          blocoId: bloco.id,
          item,
          data: dia.data,
          ...(prazo ? { prazo, diasAteOPrazo: diferencaEmDias(hoje, prazo) } : {}),
          status: bloco.statusDeReserva,
        });
      }
    }

    // Prazo mais apertado primeiro; sem prazo conhecido vai para o fim.
    return lista.sort((a, b) => {
      const pa = a.diasAteOPrazo ?? 9999;
      const pb = b.diasAteOPrazo ?? 9999;
      return pa - pb;
    });
  }, [viagem, pacote, hoje]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  const abertas = pendencias.filter(
    (p) => p.status !== 'reservado' && p.status !== 'pago' && p.status !== 'cancelado',
  );

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reservas e pendencias</h1>
        <p className="mt-1.5 text-sm text-[var(--cor-texto-suave)]">
          {pendencias.length === 0
            ? 'Nada na agenda precisa de reserva.'
            : `${abertas.length} em aberto de ${pendencias.length} que precisam de reserva. Ordenado pelo prazo mais apertado.`}
        </p>
      </header>

      {pendencias.length === 0 ? (
        <Vazio icone={<TicketCheck size={26} />} titulo="Nenhuma reserva pendente">
          Conforme voce agenda atividades que precisam de reserva, elas aparecem aqui com o prazo
          contado a partir da data do dia.
        </Vazio>
      ) : (
        <ul className="space-y-2">
          {pendencias.map((p) => {
            const resolvida = p.status === 'reservado' || p.status === 'pago';
            const vencido = p.diasAteOPrazo !== undefined && p.diasAteOPrazo < 0 && !resolvida;
            const apertado =
              p.diasAteOPrazo !== undefined && p.diasAteOPrazo >= 0 && p.diasAteOPrazo <= 7;
            const reserva = viagem.reservas.find((r) => r.blocoId === p.blocoId);
            const mensagem = mensagemDeConfirmacao(p.item);

            return (
              <li key={p.blocoId}>
                <Cartao
                  className={cn(
                    'p-3.5',
                    vencido && 'border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)]',
                    apertado && !vencido && 'border-[var(--cor-atencao-borda)]',
                    resolvida && 'opacity-70',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.item.nome}</p>
                      <p className="mt-0.5 text-xs text-[var(--cor-texto-suave)]">
                        No dia {p.data.split('-').reverse().join('/')}
                        {p.prazo ? (
                          <>
                            {' · '}
                            <span className={vencido ? 'font-medium text-[var(--cor-erro)]' : ''}>
                              {vencido
                                ? `prazo venceu ${emQuantosDias(p.diasAteOPrazo!)}`
                                : `reserve ate ${porExtenso(p.prazo)}, ${emQuantosDias(p.diasAteOPrazo!)}`}
                            </span>
                          </>
                        ) : (
                          ' · antecedencia nao informada no banco'
                        )}
                      </p>
                      {p.item.reserva.esgotaRapido && (
                        <Selo className="mt-1.5" tom="atencao">
                          costuma esgotar
                        </Selo>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Selecao
                        aria-label={`Status da reserva de ${p.item.nome}`}
                        className="h-8 w-40 text-xs"
                        onChange={(e) => acoes.definirStatusDeReserva(p.blocoId, e.target.value)}
                        value={p.status}
                      >
                        {STATUS.map((s) => (
                          <option key={s.valor} value={s.valor}>
                            {s.rotulo}
                          </option>
                        ))}
                      </Selecao>
                      <Botao
                        onClick={() => definirAberta(aberta === p.blocoId ? undefined : p.blocoId)}
                        tamanho="pequeno"
                        variante="fantasma"
                      >
                        {aberta === p.blocoId ? 'fechar' : 'detalhes'}
                      </Botao>
                    </div>
                  </div>

                  {aberta === p.blocoId && (
                    <div className="mt-4 space-y-3 border-t border-[var(--cor-borda)] pt-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Rotulo>Codigo de confirmacao</Rotulo>
                          <Campo
                            className="h-9"
                            onChange={(e) =>
                              acoes.salvarReserva({
                                id: reserva?.id ?? novoId('reserva'),
                                blocoId: p.blocoId,
                                itemId: p.item.id,
                                titulo: p.item.nome,
                                status: p.status,
                                ...reserva,
                                codigoDeConfirmacao: e.target.value,
                              })
                            }
                            placeholder="ABC123"
                            value={reserva?.codigoDeConfirmacao ?? ''}
                          />
                        </div>
                        <div>
                          <Rotulo>Valor pago</Rotulo>
                          <Campo
                            className="h-9"
                            onChange={(e) =>
                              acoes.salvarReserva({
                                id: reserva?.id ?? novoId('reserva'),
                                blocoId: p.blocoId,
                                itemId: p.item.id,
                                titulo: p.item.nome,
                                status: p.status,
                                ...reserva,
                                valorPago: Number(e.target.value) || undefined,
                              })
                            }
                            type="number"
                            value={reserva?.valorPago ?? ''}
                          />
                        </div>
                        <div>
                          <Rotulo>Contato</Rotulo>
                          <Campo
                            className="h-9"
                            onChange={(e) =>
                              acoes.salvarReserva({
                                id: reserva?.id ?? novoId('reserva'),
                                blocoId: p.blocoId,
                                itemId: p.item.id,
                                titulo: p.item.nome,
                                status: p.status,
                                ...reserva,
                                contato: e.target.value,
                              })
                            }
                            placeholder={p.item.contato.whatsapp ?? p.item.contato.telefone ?? ''}
                            value={reserva?.contato ?? ''}
                          />
                        </div>
                      </div>

                      <div>
                        <Rotulo>E-mail de confirmacao, colado inteiro</Rotulo>
                        <AreaDeTexto
                          className="text-xs"
                          onChange={(e) =>
                            acoes.salvarReserva({
                              id: reserva?.id ?? novoId('reserva'),
                              blocoId: p.blocoId,
                              itemId: p.item.id,
                              titulo: p.item.nome,
                              status: p.status,
                              ...reserva,
                              textoColado: e.target.value,
                            })
                          }
                          placeholder="Cole aqui o e-mail que a operadora mandou. O app guarda o texto inteiro, nao so os campos."
                          rows={4}
                          value={reserva?.textoColado ?? ''}
                        />
                      </div>

                      {mensagem && (
                        <div className="rounded-[var(--raio)] bg-[var(--cor-fundo-afundado)] p-3">
                          <p className="mb-1.5 text-xs font-medium">
                            Mensagem pronta, em espanhol
                          </p>
                          <pre className="whitespace-pre-wrap text-2xs leading-relaxed">
                            {mensagem.texto}
                          </pre>
                          <div className="mt-2 flex gap-1.5">
                            <Botao
                              onClick={() => void navigator.clipboard.writeText(mensagem.texto)}
                              tamanho="pequeno"
                            >
                              <Copy size={12} /> Copiar
                            </Botao>
                            {linkDeWhatsApp(mensagem) && (
                              <Botao
                                onClick={() =>
                                  window.open(linkDeWhatsApp(mensagem), '_blank', 'noopener')
                                }
                                tamanho="pequeno"
                                variante="principal"
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </Botao>
                            )}
                          </div>
                        </div>
                      )}

                      {p.item.reserva.link && (
                        <p className="text-xs">
                          <a
                            className="text-[var(--cor-acento)] underline decoration-dotted"
                            href={p.item.reserva.link}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Pagina de reserva
                          </a>
                        </p>
                      )}
                      <Fontes fontes={p.item.fontes} />
                    </div>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
          <CalendarClock size={14} />
          O que o banco admite nao saber
        </h2>
        <p className="mb-3 text-xs text-[var(--cor-texto-suave)]">
          Itens agendados cujo preco, horario ou contato a pesquisa nao conseguiu confirmar. Cada
          um vem com a mensagem pronta para voce perguntar.
        </p>
        <PendenciasDeDado />
      </section>
    </div>
  );
}

function PendenciasDeDado() {
  const viagem = usarViagem();
  const pacote = usarPacote();

  const lista = useMemo(() => {
    if (!viagem || !pacote) return [];
    const agendados = new Set(
      viagem.dias.flatMap((d) => d.blocos).flatMap((b) => (b.tipo === 'atividade' ? [b.itemId] : [])),
    );
    return pacote.itens
      .filter((i) => agendados.has(i.id))
      .map((i) => ({ item: i, mensagem: mensagemDeConfirmacao(i) }))
      .filter((x) => x.mensagem);
  }, [viagem, pacote]);

  if (lista.length === 0) {
    return (
      <p className="text-xs text-[var(--cor-texto-fraco)]">
        Tudo que esta na agenda tem preco e horario no banco.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {lista.map(({ item, mensagem }) => (
        <li
          className="flex flex-wrap items-center gap-2 rounded-[var(--raio)] border border-[var(--cor-borda)] px-3 py-2 text-xs"
          key={item.id}
        >
          <span className="min-w-0 flex-1 truncate">{item.nome}</span>
          <span className="text-2xs text-[var(--cor-texto-fraco)]">
            falta: {mensagem!.assuntos.join(', ')}
          </span>
          <Botao
            onClick={() => void navigator.clipboard.writeText(mensagem!.texto)}
            tamanho="pequeno"
            variante="fantasma"
          >
            <Copy size={11} /> copiar pergunta
          </Botao>
          {linkDeWhatsApp(mensagem!) && (
            <Botao
              onClick={() => window.open(linkDeWhatsApp(mensagem!), '_blank', 'noopener')}
              tamanho="pequeno"
              variante="contorno"
            >
              <MessageCircle size={11} />
            </Botao>
          )}
          <Botao
            onClick={() => acoes.confirmarDado(item.id, mensagem!.assuntos.join(' e '))}
            tamanho="pequeno"
            variante="fantasma"
          >
            <Check size={11} /> ja confirmei
          </Botao>
        </li>
      ))}
    </ul>
  );
}
