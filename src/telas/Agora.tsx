/**
 * MELHORIA 15 — modo "agora".
 *
 * A tela para usar NA viagem, no celular, com pressa: o que esta
 * acontecendo, o que vem depois, como chegar la e para quem ligar. Nada de
 * planejamento, nada de arrastar.
 *
 * O relogio e lido aqui e so aqui: o motor continua puro.
 */
import {
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Botao, Cartao, Selo, Vazio } from '../componentes/ui.tsx';
import type { BlocoResolvido } from '../engine/resolver-dia.ts';
import { resolverDia } from '../engine/resolver-dia.ts';
import { formatarDuracao, paraHHMM } from '../engine/tempo.ts';
import { usarPacote, usarViagem } from '../store/viagem.ts';

function agoraEmMinutos(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function Agora() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const { viagemId } = useParams();
  const [minutoAtual, definirMinuto] = useState(agoraEmMinutos);
  const [dataDeHoje] = useState(() => new Date().toISOString().slice(0, 10));

  // Um tique por minuto basta: a tela mostra horas, nao cronometro.
  useEffect(() => {
    const t = setInterval(() => definirMinuto(agoraEmMinutos()), 60_000);
    return () => clearInterval(t);
  }, []);

  const dados = useMemo(() => {
    if (!viagem || !pacote) return undefined;
    const dia = viagem.dias.find((d) => d.data === dataDeHoje) ?? viagem.dias[0];
    if (!dia) return undefined;
    const resolvido = resolverDia(viagem, dia, pacote);
    const ordenados = [...resolvido.blocos].sort(
      (a, b) => a.intervalo.inicio - b.intervalo.inicio,
    );
    const agora = ordenados.find(
      (b) => b.intervalo.inicio <= minutoAtual && minutoAtual < b.intervalo.fim,
    );
    const proximo = ordenados.find((b) => b.intervalo.inicio > minutoAtual);
    const lacunaAteOProximo = proximo
      ? resolvido.lacunas.find((l) => l.antesDe === proximo.bloco.id)
      : undefined;
    const eHoje = dia.data === dataDeHoje;
    return { dia, resolvido, agora, proximo, lacunaAteOProximo, ordenados, eHoje };
  }, [viagem, pacote, minutoAtual, dataDeHoje]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;
  if (!dados) {
    return (
      <Vazio icone={<Clock size={26} />} titulo="A viagem ainda nao tem dias">
        Defina as datas em Ajustes.
      </Vazio>
    );
  }

  const { dia, agora, proximo, lacunaAteOProximo, ordenados, eHoje } = dados;
  const cidade = pacote.cidades.find((c) => c.id === dia.cidadeBaseId);

  return (
    <div className="mx-auto max-w-xl">
      {!eHoje && (
        <Cartao className="mb-4 border-[var(--cor-atencao-borda)] bg-[var(--cor-atencao-fundo)] p-3 text-xs">
          Hoje nao e um dia da viagem. Mostrando{' '}
          <strong>{dia.data.split('-').reverse().join('/')}</strong>, o primeiro dia.
        </Cartao>
      )}

      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-[var(--cor-texto-fraco)]">
          {dia.data.split('-').reverse().join('/')}
          {cidade && ` · ${cidade.nome}`} · agora sao {paraHHMM(minutoAtual)}
        </p>
      </header>

      {agora ? (
        <Cartao className="mb-3 border-[var(--cor-acento-borda)] bg-[var(--cor-acento-fraco)] p-4">
          <p className="text-2xs font-medium uppercase tracking-wide text-[var(--cor-acento-forte)]">
            Agora
          </p>
          <h2 className="mt-1 text-lg font-semibold">{agora.rotulo}</h2>
          <p className="tabular mt-0.5 text-xs text-[var(--cor-texto-suave)]">
            ate {paraHHMM(agora.intervalo.fim)} · faltam{' '}
            {formatarDuracao(agora.intervalo.fim - minutoAtual)}
          </p>
          <Contatos bloco={agora} />
        </Cartao>
      ) : (
        <Cartao className="mb-3 p-4">
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Nada agendado neste momento.
            {proximo && ` O proximo compromisso e as ${paraHHMM(proximo.intervalo.inicio)}.`}
          </p>
        </Cartao>
      )}

      {proximo && (
        <Cartao className="mb-3 p-4">
          <p className="text-2xs font-medium uppercase tracking-wide text-[var(--cor-texto-fraco)]">
            Em seguida
          </p>
          <h2 className="mt-1 text-base font-semibold">{proximo.rotulo}</h2>
          <p className="tabular mt-0.5 text-xs text-[var(--cor-texto-suave)]">
            {paraHHMM(proximo.intervalo.inicio)}–{paraHHMM(proximo.intervalo.fim)}
          </p>

          {lacunaAteOProximo?.deslocamento && (
            <div className="mt-3 rounded-[var(--raio)] bg-[var(--cor-fundo-afundado)] p-2.5">
              <p className="flex items-start gap-1.5 text-xs">
                <Navigation className="mt-0.5 shrink-0 text-[var(--cor-acento)]" size={13} />
                <span>{lacunaAteOProximo.deslocamento.resumo}</span>
              </p>
              {lacunaAteOProximo.deslocamento.minutos !== null && (
                <p className="mt-1.5 text-xs font-medium">
                  Saia as{' '}
                  <span className="tabular">
                    {paraHHMM(
                      proximo.intervalo.inicio - lacunaAteOProximo.deslocamento.minutos,
                    )}
                  </span>
                  {proximo.intervalo.inicio - lacunaAteOProximo.deslocamento.minutos <=
                    minutoAtual && (
                    <span className="ml-2 text-[var(--cor-erro)]">
                      <TriangleAlert className="inline" size={11} /> ja passou da hora
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          <Contatos bloco={proximo} />
        </Cartao>
      )}

      {ordenados.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
            O resto do dia
          </h3>
          <ul className="divide-y divide-[var(--cor-borda)] overflow-hidden rounded-[var(--raio)] border border-[var(--cor-borda)]">
            {ordenados.map((b) => {
              const passou = b.intervalo.fim <= minutoAtual;
              return (
                <li
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${passou ? 'opacity-45' : ''}`}
                  key={b.bloco.id}
                >
                  <span className="tabular w-11 shrink-0 text-xs text-[var(--cor-texto-fraco)]">
                    {paraHHMM(b.intervalo.inicio)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{b.rotulo}</span>
                  {b.bloco.tipo === 'atividade' && b.bloco.statusDeReserva === 'reservado' && (
                    <Selo tom="verificado">reservado</Selo>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pacote.destino.emergencia && (
        <Cartao className="p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
            <ShieldAlert size={13} />
            Emergencia
          </h3>
          <div className="flex flex-wrap gap-2">
            {pacote.destino.emergencia.numeroUnico && (
              <Botao
                onClick={() => window.open(`tel:${pacote.destino.emergencia?.numeroUnico}`)}
                variante="perigo"
              >
                <Phone size={14} /> {pacote.destino.emergencia.numeroUnico}
              </Botao>
            )}
            {pacote.destino.emergencia.representacaoBrasileira.map((r) => {
              const numero = r.plantao ?? r.telefone;
              if (!numero) return null;
              return (
                <Botao
                  key={r.nome}
                  onClick={() => window.open(`tel:${numero.replace(/\s/g, '')}`)}
                  variante="contorno"
                >
                  <Phone size={14} /> {r.cidade}
                </Botao>
              );
            })}
          </div>
          {pacote.destino.emergencia.observacoes && (
            <p className="mt-2 text-2xs leading-relaxed text-[var(--cor-texto-fraco)]">
              {pacote.destino.emergencia.observacoes}
            </p>
          )}
        </Cartao>
      )}

      <p className="mt-4 text-center text-xs">
        <Link
          className="text-[var(--cor-acento)] underline decoration-dotted"
          to={`/viagem/${viagemId}/dia/${dia.id}`}
        >
          abrir o dia inteiro para editar
        </Link>
      </p>
    </div>
  );
}

function Contatos({ bloco }: { bloco: BlocoResolvido }) {
  const item = bloco.item;
  const coords = bloco.entrada?.coords;
  if (!item && !coords) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {coords && (
        <Botao
          onClick={() =>
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
              '_blank',
              'noopener',
            )
          }
          tamanho="pequeno"
          variante="contorno"
        >
          <MapPin size={13} /> Como chegar
        </Botao>
      )}
      {item?.contato.telefone && (
        <Botao
          onClick={() => window.open(`tel:${item.contato.telefone}`)}
          tamanho="pequeno"
          variante="contorno"
        >
          <Phone size={13} /> Ligar
        </Botao>
      )}
      {item?.contato.whatsapp && (
        <Botao
          onClick={() =>
            window.open(
              `https://wa.me/${item.contato.whatsapp?.replace(/\D/g, '')}`,
              '_blank',
              'noopener',
            )
          }
          tamanho="pequeno"
          variante="contorno"
        >
          <MessageCircle size={13} /> WhatsApp
        </Botao>
      )}
    </div>
  );
}
