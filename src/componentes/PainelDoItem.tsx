/**
 * Detalhe do item. Mostra tudo que o banco sabe e, com igual destaque, o que
 * ele NAO sabe — e oferece a mensagem pronta para o usuario ir atras.
 */
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  AtSign,
  MapPin,
  MessageCircle,
  Phone,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { linkDeWhatsApp, mensagemDeConfirmacao } from '../engine/geradores.ts';
import { procedenciaDoItem } from '../engine/procedencia.ts';
import { formatarDuracao } from '../engine/tempo.ts';
import { acoes } from '../store/viagem.ts';
import { Fontes, IdadeDoDado, PrecoExibido, SeloDeConfianca } from './procedencia.tsx';
import { Botao, Cartao, Painel, Selo } from './ui.tsx';

const DIAS: Array<[string, string]> = [
  ['seg', 'Segunda'],
  ['ter', 'Terca'],
  ['qua', 'Quarta'],
  ['qui', 'Quinta'],
  ['sex', 'Sexta'],
  ['sab', 'Sabado'],
  ['dom', 'Domingo'],
];

export function PainelDoItem({
  item,
  pacote,
  viagem,
  hoje,
  aoFechar,
}: {
  item: Item | undefined;
  pacote: PacoteDestino;
  viagem: Viagem;
  hoje: string;
  aoFechar: () => void;
}) {
  const [copiado, definirCopiado] = useState(false);

  if (!item) return null;

  const cidade = pacote.cidades.find((c) => c.id === item.cidadeId);
  const favorito = viagem.favoritos.includes(item.id);
  const procedencia = procedenciaDoItem(item, hoje, viagem);
  const mensagem = mensagemDeConfirmacao(item);
  const zap = mensagem ? linkDeWhatsApp(mensagem) : undefined;
  const imagem = item.imagens[0];

  return (
    <Painel aberto={Boolean(item)} aoFechar={aoFechar} largura="max-w-3xl" titulo={item.nome}>
      <div className="space-y-5">
        {imagem && (
          <figure>
            <img
              alt={imagem.descricao ?? item.nome}
              className="h-56 w-full rounded-[var(--raio)] object-cover"
              loading="lazy"
              src={imagem.url}
            />
            <figcaption className="mt-1 text-2xs text-[var(--cor-texto-fraco)]">
              {imagem.credito} · {imagem.licenca} ·{' '}
              <a
                className="underline decoration-dotted"
                href={imagem.fonte}
                rel="noreferrer noopener"
                target="_blank"
              >
                origem
              </a>
            </figcaption>
          </figure>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <SeloDeConfianca nivel={item.confianca} />
          <IdadeDoDado coletadoEm={item.coletadoEm} hoje={hoje} />
          <Selo tom="neutro">{item.categoria}</Selo>
          {cidade && <Selo tom="neutro">{cidade.nome}</Selo>}
          {item.selos.map((s) => (
            <Selo key={s} tom={s === 'pega-turista' ? 'atencao' : 'acento'}>
              {s.replaceAll('-', ' ')}
            </Selo>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-[var(--cor-texto)]">{item.descricaoCurta}</p>
        {item.descricaoLonga && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--cor-texto-suave)]">
            {item.descricaoLonga}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Bloco icone={<Clock size={14} />} titulo="Duracao">
            {item.duracao
              ? `${formatarDuracao(item.duracao.min)} a ${formatarDuracao(item.duracao.max)}, tipico ${formatarDuracao(item.duracao.tipica)}`
              : 'Cartao de referencia: nao se agenda.'}
          </Bloco>

          <Bloco icone={<MapPin size={14} />} titulo="Preco">
            {item.gratuito ? (
              'Gratuito'
            ) : item.preco ? (
              <PrecoExibido
                hoje={hoje}
                pessoas={viagem.viajantes.adultos + viagem.viajantes.criancas}
                preco={item.preco}
                taxas={viagem.cambio.taxas}
              />
            ) : (
              <span className="text-[var(--cor-estimado)]">
                Preco nao encontrado em fonte confiavel
              </span>
            )}
          </Bloco>
        </div>

        {item.preco?.inclui && (
          <p className="text-xs text-[var(--cor-texto-suave)]">
            <span className="font-medium">Inclui:</span> {item.preco.inclui}
          </p>
        )}
        {item.preco?.observacao && (
          <p className="text-xs text-[var(--cor-parcial)]">{item.preco.observacao}</p>
        )}

        {item.horarios && Object.keys(item.horarios).length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
              Horarios
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs sm:grid-cols-3">
              {DIAS.map(([chave, nome]) => {
                const h = item.horarios?.[chave as keyof typeof item.horarios];
                return (
                  <div className="flex justify-between gap-2" key={chave}>
                    <dt className="text-[var(--cor-texto-suave)]">{nome}</dt>
                    <dd className="tabular text-right">
                      {h === undefined ? (
                        <span className="text-[var(--cor-texto-fraco)]">nao sei</span>
                      ) : h === 'fechado' ? (
                        <span className="text-[var(--cor-estimado)]">fechado</span>
                      ) : h === '24h' ? (
                        '24 h'
                      ) : (
                        h.map((j) => `${j.abre}–${j.fecha}`).join(', ')
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {item.horariosObservacao && (
              <p className="mt-1.5 text-2xs leading-relaxed text-[var(--cor-texto-fraco)]">
                {item.horariosObservacao}
              </p>
            )}
          </div>
        )}

        {item.aluguel && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
              Veiculos e precos
            </h3>
            <ul className="divide-y divide-[var(--cor-borda)] rounded-[var(--raio)] border border-[var(--cor-borda)] text-xs">
              {item.aluguel.tipos.map((t) => (
                <li className="flex items-baseline justify-between gap-3 px-3 py-2" key={`${t.veiculo}-${t.periodo}`}>
                  <span>
                    {t.veiculo}
                    <span className="text-[var(--cor-texto-fraco)]"> · {t.periodo}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {t.preco ? (
                      <PrecoExibido preco={t.preco} taxas={viagem.cambio.taxas} />
                    ) : (
                      <span className="text-[var(--cor-estimado)]">sem preco</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 text-xs text-[var(--cor-texto-suave)]">
              {item.aluguel.documentosExigidos.length > 0 && (
                <ItemDeLista rotulo="Documentos">
                  {item.aluguel.documentosExigidos.join('; ')}
                </ItemDeLista>
              )}
              {item.aluguel.deposito && (
                <ItemDeLista rotulo="Caucao">{item.aluguel.deposito}</ItemDeLista>
              )}
              {item.aluguel.seguro && (
                <ItemDeLista rotulo="Seguro">{item.aluguel.seguro}</ItemDeLista>
              )}
              {item.aluguel.combustivel && (
                <ItemDeLista rotulo="Combustivel">{item.aluguel.combustivel}</ItemDeLista>
              )}
            </dl>
            {item.aluguel.regras.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-[var(--cor-texto-suave)]">
                {item.aluguel.regras.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {item.passeio && (
          <div className="text-xs">
            <h3 className="mb-1 font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
              Saida
            </h3>
            <p className="text-[var(--cor-texto-suave)]">
              {item.passeio.pontoPartida ?? 'Ponto de partida nao informado na fonte.'}
              {item.passeio.horariosDeSaida.length > 0 &&
                ` · sai as ${item.passeio.horariosDeSaida.join(', ')}`}
              {item.passeio.horarioFixo && ' · horario fixo'}
            </p>
          </div>
        )}

        {item.dicas.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
              Do agente de viagens
            </h3>
            <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--cor-texto-suave)]">
              {item.dicas.map((d) => (
                <li className="flex gap-2" key={d}>
                  <BadgeCheck className="mt-0.5 shrink-0 text-[var(--cor-acento)]" size={13} />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.alertas.length > 0 && (
          <Cartao className="border-[var(--cor-atencao-borda)] bg-[var(--cor-atencao-fundo)] p-3">
            <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--cor-texto)]">
              {item.alertas.map((a) => (
                <li className="flex gap-2" key={a}>
                  <TriangleAlert className="mt-0.5 shrink-0 text-[var(--cor-atencao)]" size={13} />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        {(item.contato.telefone ||
          item.contato.whatsapp ||
          item.contato.site ||
          item.contato.instagram) && (
          <div className="flex flex-wrap gap-2">
            {item.contato.site && (
              <Botao
                onClick={() => window.open(item.contato.site, '_blank', 'noopener')}
                tamanho="pequeno"
                variante="contorno"
              >
                <Globe size={13} /> Site <ExternalLink size={11} />
              </Botao>
            )}
            {item.contato.whatsapp && (
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
                <MessageCircle size={13} /> {item.contato.whatsapp}
              </Botao>
            )}
            {item.contato.telefone && (
              <Botao
                onClick={() => window.open(`tel:${item.contato.telefone}`)}
                tamanho="pequeno"
                variante="contorno"
              >
                <Phone size={13} /> {item.contato.telefone}
              </Botao>
            )}
            {item.contato.instagram && (
              <Selo tom="neutro">
                <AtSign size={11} /> {item.contato.instagram}
              </Selo>
            )}
          </div>
        )}

        {mensagem && (
          <Cartao className="bg-[var(--cor-fundo-afundado)] p-3">
            <p className="mb-2 text-xs font-medium">
              O banco nao sabe tudo sobre este item. Mensagem pronta para perguntar:
            </p>
            <pre className="whitespace-pre-wrap rounded border border-[var(--cor-borda)] bg-[var(--cor-fundo-elevado)] p-2.5 text-2xs leading-relaxed">
              {mensagem.texto}
            </pre>
            <details className="mt-1.5">
              <summary className="cursor-pointer text-2xs text-[var(--cor-texto-fraco)]">
                ver em portugues
              </summary>
              <pre className="mt-1 whitespace-pre-wrap text-2xs text-[var(--cor-texto-suave)]">
                {mensagem.traducao}
              </pre>
            </details>
            <div className="mt-2 flex gap-2">
              <Botao
                onClick={() => {
                  void navigator.clipboard.writeText(mensagem.texto).then(() => {
                    definirCopiado(true);
                    setTimeout(() => definirCopiado(false), 2000);
                  });
                }}
                tamanho="pequeno"
              >
                {copiado ? <Check size={13} /> : <Copy size={13} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Botao>
              {zap && (
                <Botao
                  onClick={() => window.open(zap, '_blank', 'noopener')}
                  tamanho="pequeno"
                  variante="principal"
                >
                  <MessageCircle size={13} /> Mandar no WhatsApp
                </Botao>
              )}
            </div>
          </Cartao>
        )}

        <div className="border-t border-[var(--cor-borda)] pt-3">
          <p className="mb-2 text-xs text-[var(--cor-texto-suave)]">{procedencia.frase}</p>
          <Fontes fontes={item.fontes} limite={6} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--cor-borda)] pt-4">
          <Botao
            onClick={() => acoes.alternarFavorito(item.id)}
            variante={favorito ? 'principal' : 'contorno'}
          >
            <Heart fill={favorito ? 'currentColor' : 'none'} size={15} />
            {favorito ? 'Nos favoritos' : 'Favoritar'}
          </Botao>
          <Botao
            onClick={() => {
              acoes.confirmarDado(item.id, 'preco e horario', undefined, 'conferido por mim');
            }}
            variante="contorno"
          >
            <BadgeCheck size={15} /> Eu confirmei isto
          </Botao>
          <Botao onClick={() => acoes.descartar(item.id, 'ja-fui')} variante="fantasma">
            <Check size={15} /> Ja fui
          </Botao>
          <Botao onClick={() => acoes.descartar(item.id, 'nao-quero')} variante="fantasma">
            <Ban size={15} /> Nao quero
          </Botao>
        </div>

        {procedencia.confirmacoesDoUsuario.length > 0 && (
          <ul className="space-y-1 text-2xs text-[var(--cor-verificado)]">
            {procedencia.confirmacoesDoUsuario.map((c) => (
              <li className="flex items-center gap-1" key={`${c.campo}-${c.confirmadoEm}`}>
                <CalendarClock size={11} />
                Voce confirmou {c.campo} em {c.confirmadoEm}
                {c.valorApurado ? `: ${c.valorApurado}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Painel>
  );
}

function Bloco({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--raio)] border border-[var(--cor-borda)] p-3">
      <p className="mb-1 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-[var(--cor-texto-fraco)]">
        {icone}
        {titulo}
      </p>
      <div className="text-xs text-[var(--cor-texto)]">{children}</div>
    </div>
  );
}

function ItemDeLista({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-medium text-[var(--cor-texto)]">{rotulo}: </span>
      {children}
    </div>
  );
}
