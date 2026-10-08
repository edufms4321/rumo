import { CalendarDays, Download, FileText, Luggage, Map, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { Botao, Cartao, Secao, Selo, Vazio } from '../componentes/ui.tsx';
import { listaDeBagagem } from '../engine/geradores.ts';
import { resolverDia } from '../engine/resolver-dia.ts';
import { paraHHMM } from '../engine/tempo.ts';
import { usarLoja, usarPacote, usarViagem } from '../store/viagem.ts';

function baixar(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** Escapa o que o formato .ics trata como separador. */
function ics(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function carimbo(data: string, minutos: number, offsetMinutos: number): string {
  const base = Date.parse(`${data}T00:00:00Z`) + (minutos - offsetMinutos) * 60_000;
  return `${new Date(base).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

export function Exportar() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const viagens = usarLoja((e) => e.viagens);

  const bagagem = useMemo(
    () => (viagem && pacote ? listaDeBagagem(viagem, pacote) : undefined),
    [viagem, pacote],
  );

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  function exportarIcs() {
    if (!viagem || !pacote) return;
    const offset = pacote.destino.fusoOffsetMinutos;
    const linhas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rumo//Roteiro//PT',
      'CALSCALE:GREGORIAN',
    ];

    for (const dia of viagem.dias) {
      const cidade = pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
      const offsetDoDia = cidade?.fusoOffsetMinutos ?? offset;
      const resolvido = resolverDia(viagem, dia, pacote);

      for (const b of resolvido.blocos) {
        const item = b.item;
        linhas.push(
          'BEGIN:VEVENT',
          `UID:${b.bloco.id}@rumo`,
          `DTSTAMP:${carimbo(dia.data, 0, offsetDoDia)}`,
          `DTSTART:${carimbo(dia.data, b.intervalo.inicio, offsetDoDia)}`,
          `DTEND:${carimbo(dia.data, b.intervalo.fim, offsetDoDia)}`,
          `SUMMARY:${ics(b.rotulo)}`,
          `LOCATION:${ics(cidade?.nome ?? '')}`,
          `DESCRIPTION:${ics(
            [
              item?.descricaoCurta,
              item?.contato.telefone && `Tel: ${item.contato.telefone}`,
              item?.contato.site,
              item && `Confianca do dado: ${item.confianca}, coletado em ${item.coletadoEm}`,
            ]
              .filter(Boolean)
              .join('\n'),
          )}`,
          'END:VEVENT',
        );
      }
    }

    linhas.push('END:VCALENDAR');
    baixar(`${viagem.nome.replace(/\W+/g, '-').toLowerCase()}.ics`, linhas.join('\r\n'), 'text/calendar');
  }

  function exportarJson() {
    baixar(
      `rumo-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ versaoSchema: 1, viagens, exportadoEm: new Date().toISOString() }, null, 2),
      'application/json',
    );
  }

  function linkDoMapa(diaId: string): string | undefined {
    if (!viagem || !pacote) return undefined;
    const dia = viagem.dias.find((d) => d.id === diaId);
    if (!dia) return undefined;
    const pontos = resolverDia(viagem, dia, pacote)
      .blocos.map((b) => b.entrada?.coords)
      .filter((c): c is { lat: number; lng: number } => Boolean(c));
    if (pontos.length < 2) return undefined;
    const [origem, ...resto] = pontos;
    const destino = resto.pop()!;
    const paradas = resto.map((p) => `${p.lat},${p.lng}`).join('|');
    return (
      'https://www.google.com/maps/dir/?api=1' +
      `&origin=${origem!.lat},${origem!.lng}&destination=${destino.lat},${destino.lng}` +
      (paradas ? `&waypoints=${encodeURIComponent(paradas)}` : '')
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Exportar</h1>

      <Secao titulo="Levar a viagem com voce">
        <div className="grid gap-3 sm:grid-cols-2">
          <Acao
            aoClicar={() => window.print()}
            descricao="Abre a caixa de impressao do navegador. Escolha 'Salvar como PDF'. Sai com o roteiro dia a dia, contatos e fontes."
            icone={<Printer size={18} />}
            titulo="Roteiro em PDF"
          />
          <Acao
            aoClicar={exportarIcs}
            descricao="Um arquivo .ics com todos os blocos, no fuso de cada cidade. Importa no Google Agenda, Apple e Outlook."
            icone={<CalendarDays size={18} />}
            titulo="Agenda (.ics)"
          />
          <Acao
            aoClicar={exportarJson}
            descricao={`Backup completo das suas ${viagens.length} viagem(ns). Guarde este arquivo: e a unica copia fora deste navegador.`}
            icone={<Download size={18} />}
            titulo="Backup (.json)"
          />
          <Acao
            aoClicar={() => window.print()}
            descricao="A mesma impressao, mas use 'Salvar como PDF' e marque 'Graficos de fundo' para manter as cores dos alertas."
            icone={<FileText size={18} />}
            titulo="Versao para imprimir"
          />
        </div>
      </Secao>

      <Secao titulo="Abrir no Google Maps, por dia">
        {viagem.dias.length === 0 ? (
          <p className="text-xs text-[var(--cor-texto-fraco)]">A viagem ainda nao tem dias.</p>
        ) : (
          <ul className="divide-y divide-[var(--cor-borda)] overflow-hidden rounded-[var(--raio)] border border-[var(--cor-borda)]">
            {viagem.dias.map((d) => {
              const link = linkDoMapa(d.id);
              return (
                <li className="flex items-center justify-between gap-3 px-3.5 py-2.5" key={d.id}>
                  <span className="text-sm">
                    {d.data.split('-').reverse().join('/')}
                    <span className="ml-2 text-xs text-[var(--cor-texto-fraco)]">
                      {pacote.cidades.find((c) => c.id === d.cidadeBaseId)?.nome ?? 'sem base'}
                    </span>
                  </span>
                  {link ? (
                    <Botao
                      onClick={() => window.open(link, '_blank', 'noopener')}
                      tamanho="pequeno"
                      variante="contorno"
                    >
                      <Map size={13} /> Rota do dia
                    </Botao>
                  ) : (
                    <span className="text-2xs text-[var(--cor-texto-fraco)]">
                      precisa de 2 pontos com coordenada
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {bagagem && bagagem.total > 0 && (
        <Secao titulo="Lista de bagagem">
          <p className="mb-3 text-xs text-[var(--cor-texto-suave)]">
            Montada a partir do clima dos meses que a sua viagem cobre e das atividades que voce
            agendou. Cada linha diz por que esta ali.
          </p>
          <div className="space-y-3">
            {Object.entries(bagagem.categorias).map(([categoria, itens]) => (
              <Cartao className="p-3.5" key={categoria}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
                  <Luggage className="mr-1 inline" size={12} />
                  {categoria}
                </h3>
                <ul className="space-y-1.5">
                  {itens.map((i) => (
                    <li className="flex flex-wrap items-baseline gap-x-2 text-xs" key={i.nome}>
                      <span className={i.essencial ? 'font-medium' : ''}>{i.nome}</span>
                      {i.essencial && <Selo tom="acento">essencial</Selo>}
                      <span className="text-2xs text-[var(--cor-texto-fraco)]">{i.porque}</span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            ))}
          </div>
        </Secao>
      )}

      <RoteiroParaImpressao />
    </div>
  );
}

function Acao({
  icone,
  titulo,
  descricao,
  aoClicar,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  aoClicar: () => void;
}) {
  return (
    <Cartao className="flex flex-col p-4">
      <div className="mb-2 text-[var(--cor-acento)]">{icone}</div>
      <h3 className="text-sm font-medium">{titulo}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-[var(--cor-texto-suave)]">
        {descricao}
      </p>
      <Botao className="mt-3 self-start" onClick={aoClicar} tamanho="pequeno" variante="contorno">
        Gerar
      </Botao>
    </Cartao>
  );
}

/**
 * O roteiro completo, escondido na tela e visivel so na impressao. E daqui
 * que sai o PDF: o navegador ja sabe quebrar pagina e manter tipografia.
 */
function RoteiroParaImpressao() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  if (!viagem || !pacote) return null;

  return (
    <div className="hidden print:block">
      <h1 className="mb-1 text-2xl font-semibold">{viagem.nome}</h1>
      <p className="mb-6 text-sm">
        {pacote.destino.nome} · {viagem.dias.length} dias ·{' '}
        {viagem.viajantes.adultos + viagem.viajantes.criancas} viajante(s)
      </p>

      {pacote.destino.emergencia && (
        <section className="nao-quebrar mb-6 border border-current p-3 text-xs">
          <h2 className="mb-1 font-semibold">Emergencia</h2>
          {pacote.destino.emergencia.numeroUnico && (
            <p>Numero unico: {pacote.destino.emergencia.numeroUnico}</p>
          )}
          {pacote.destino.emergencia.representacaoBrasileira.map((r) => (
            <p key={r.nome}>
              {r.nome} ({r.cidade}): {r.plantao ?? r.telefone ?? 'sem telefone'}
            </p>
          ))}
        </section>
      )}

      {viagem.dias.map((dia) => {
        const resolvido = resolverDia(viagem, dia, pacote);
        const cidade = pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
        return (
          <section className="nao-quebrar mb-5" key={dia.id}>
            <h2 className="border-b border-current pb-1 text-base font-semibold">
              {dia.data.split('-').reverse().join('/')}
              {cidade && ` — ${cidade.nome}`}
            </h2>
            {dia.hospedagem?.nome && <p className="mt-1 text-xs">Dorme em: {dia.hospedagem.nome}</p>}
            {resolvido.blocos.length === 0 ? (
              <p className="mt-1 text-xs italic">sem nada agendado</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {resolvido.blocos.map((b) => (
                  <li className="text-xs" key={b.bloco.id}>
                    <strong className="tabular">
                      {paraHHMM(b.intervalo.inicio)}–{paraHHMM(b.intervalo.fim)}
                    </strong>{' '}
                    {b.rotulo}
                    {b.item?.contato.telefone && (
                      <span className="block pl-14">tel {b.item.contato.telefone}</span>
                    )}
                    {b.item?.passeio?.pontoPartida && (
                      <span className="block pl-14">saida: {b.item.passeio.pontoPartida}</span>
                    )}
                    {b.item && (
                      <span className="block pl-14 italic">
                        dado {b.item.confianca}, coletado em {b.item.coletadoEm}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="mt-8 border-t border-current pt-2 text-2xs">
        Gerado pelo Rumo. Preco e horario mudam: confira o que for decisivo antes de ir. Cada item
        traz sua fonte no aplicativo.
      </p>
    </div>
  );
}
