/**
 * Onde dormir.
 *
 * Por que esta tela existe: o banco ja tinha 33 sugestoes de hospedagem e
 * NENHUMA aparecia em lugar nenhum do app. O usuario digitava o nome do
 * hotel a mao na tela do dia, num campo de texto livre, sem nada que o
 * ajudasse a escolher. Pesquisa que nao chega na tela e pesquisa perdida.
 *
 * O recorte e o perfil do dono do app: dupla, economico, prefere hostel.
 * Por isso a ordenacao e por preco e o filtro de hostel esta a um clique —
 * sem esconder as outras opcoes, que continuam todas na lista.
 */
import { BedDouble, Coffee, CookingPot, ExternalLink, MapPin, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IdadeDoDado, SeloDeConfianca } from '../componentes/procedencia.tsx';
import { Botao, Cartao, Selo, Vazio } from '../componentes/ui.tsx';
import { cn } from '../lib/cn.ts';
import type { SugestaoHospedagem } from '../schema/hospedagem.ts';
import { acoes, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

function formatar(moeda: string, min: number, max: number): string {
  const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return min === max ? `${moeda} ${n(min)}` : `${moeda} ${n(min)}-${n(max)}`;
}

/** Menor valor comparavel, para ordenar. Sem preco vai para o fim. */
function piso(h: SugestaoHospedagem): number {
  return h.diaria?.min ?? h.diariaPrivativo?.min ?? Number.POSITIVE_INFINITY;
}

export function Dormir() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();

  const [soHostel, definirSoHostel] = useState(false);
  const [soComPreco, definirSoComPreco] = useState(false);
  const [cidade, definirCidade] = useState<string>();

  /*
    As cidades onde ele realmente dorme vem primeiro, com a contagem de
    noites. As outras continuam na lista: o roteiro ainda esta sendo
    montado, e esconder uma base so porque ela nao entrou ainda atrapalha
    exatamente a decisao de para onde ir.
  */
  const noitesPorCidade = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of viagem?.dias ?? []) {
      if (d.cidadeBaseId) m.set(d.cidadeBaseId, (m.get(d.cidadeBaseId) ?? 0) + 1);
    }
    return m;
  }, [viagem]);

  const porCidade = useMemo(() => {
    if (!pacote) return [];
    const filtradas = pacote.hospedagem
      .filter((h) => (soHostel ? h.tipo === 'hostel' : true))
      .filter((h) => (soComPreco ? Boolean(h.diaria ?? h.diariaPrivativo) : true))
      .filter((h) => (cidade ? h.cidadeId === cidade : true));

    const grupos = new Map<string, SugestaoHospedagem[]>();
    for (const h of filtradas) {
      if (!grupos.has(h.cidadeId)) grupos.set(h.cidadeId, []);
      grupos.get(h.cidadeId)?.push(h);
    }
    return [...grupos.entries()]
      .map(([id, lista]) => ({
        id,
        nome: pacote.cidades.find((c) => c.id === id)?.nome ?? id,
        noites: noitesPorCidade.get(id) ?? 0,
        // Dentro da cidade, do mais barato ao mais caro; sem preco por ultimo.
        lista: [...lista].sort((a, b) => piso(a) - piso(b)),
      }))
      .sort((a, b) => b.noites - a.noites || a.nome.localeCompare(b.nome));
  }, [pacote, soHostel, soComPreco, cidade, noitesPorCidade]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  const total = pacote.hospedagem.length;
  const comNome = pacote.hospedagem.filter((h) => h.nome).length;
  const cidadesComOpcao = [...new Set(pacote.hospedagem.map((h) => h.cidadeId))];

  if (total === 0) {
    return (
      <Vazio icone={<BedDouble size={26} />} titulo="Nenhuma hospedagem pesquisada neste destino">
        O banco deste pacote ainda nao tem onde dormir. Voce continua podendo escrever o nome a mao
        na tela de cada dia.
      </Vazio>
    );
  }

  return (
    <div>
      <h2 className="sr-only">Onde dormir</h2>
      <p className="mb-3 text-xs text-[var(--cor-texto-suave)]">
        {total} opcoes em {cidadesComOpcao.length} bases, sendo {comNome} com nome. A diaria e
        sempre faixa com a data da coleta — confirme no site antes de contar com ela.
      </p>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Botao
          onClick={() => definirSoHostel(!soHostel)}
          tamanho="pequeno"
          variante={soHostel ? 'principal' : 'contorno'}
        >
          <BedDouble size={13} />
          so hostel
        </Botao>
        <Botao
          onClick={() => definirSoComPreco(!soComPreco)}
          tamanho="pequeno"
          variante={soComPreco ? 'principal' : 'contorno'}
        >
          so com preco
        </Botao>
        {cidade && (
          <Botao onClick={() => definirCidade(undefined)} tamanho="pequeno" variante="fantasma">
            ver todas as bases
          </Botao>
        )}
      </div>

      {porCidade.length === 0 ? (
        <Vazio titulo="Nada com esses filtros">Tire o filtro de hostel ou o de preco.</Vazio>
      ) : (
        <div className="space-y-6">
          {porCidade.map((grupo) => (
            <section key={grupo.id}>
              <h3 className="mb-2 flex items-baseline gap-2 text-sm font-medium">
                <button
                  className="hover:text-[var(--cor-acento)]"
                  onClick={() => definirCidade(grupo.id)}
                  type="button"
                >
                  {grupo.nome}
                </button>
                <span className="text-xs font-normal text-[var(--cor-texto-suave)]">
                  {grupo.noites > 0
                    ? `${grupo.noites} noite${grupo.noites > 1 ? 's' : ''} no seu roteiro`
                    : 'nao esta no roteiro'}
                </span>
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grupo.lista.map((h) => (
                  <li key={h.id}>
                    <CartaoDeHospedagem
                      hoje={hoje}
                      hospedagem={h}
                      moedaDoPacote={pacote.destino.moeda}
                      noites={viagem.dias.filter((d) => d.cidadeBaseId === grupo.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoDeHospedagem({
  hospedagem: h,
  noites,
  hoje,
  moedaDoPacote,
}: {
  hospedagem: SugestaoHospedagem;
  noites: Array<{ id: string; data: string }>;
  hoje: string;
  moedaDoPacote: string;
}) {
  const [usada, definirUsada] = useState(false);

  function usarNaNoite(diaId: string) {
    acoes.definirHospedagem(diaId, {
      nome: h.nome ?? h.bairro,
      bairro: h.bairro,
      /*
        Guarda o PISO da faixa, nao o meio. Subestimar aqui e menos ruim que
        o app prometer um valor que a cotacao real nao sustenta: o viajante
        ajusta para cima quando fechar a reserva, e o alerta de estouro de
        orcamento dispara cedo em vez de tarde.
      */
      // A moeda do pacote e o padrao quando a hospedagem entrou sem preco:
      // o campo e obrigatorio e inventar BRL numa viagem em peso seria pior.
      moeda: h.diaria?.moeda ?? moedaDoPacote,
      ...(h.diaria ? { custoPorNoite: h.diaria.min } : {}),
      confirmada: false,
      ...(h.link ? { link: h.link } : {}),
    });
    definirUsada(true);
  }

  return (
    <Cartao className="flex h-full flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-snug">{h.nome ?? h.bairro}</h4>
        <SeloDeConfianca compacto nivel={h.confianca} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {h.tipo && <Selo tom="neutro">{h.tipo}</Selo>}
        <Selo tom={h.perfil === 'economico' ? 'verificado' : 'neutro'}>{h.perfil}</Selo>
        {h.cafeIncluso && (
          <Selo tom="neutro">
            <Coffee size={10} /> cafe
          </Selo>
        )}
        {h.cozinhaCompartilhada && (
          <Selo tom="neutro">
            <CookingPot size={10} /> cozinha
          </Selo>
        )}
      </div>

      {h.nome && (
        <p className="mt-1.5 flex items-start gap-1 text-2xs text-[var(--cor-texto-suave)]">
          <MapPin className="mt-0.5 shrink-0" size={11} />
          <span>
            {h.bairro}
            {h.endereco ? ` · ${h.endereco}` : ''}
          </span>
        </p>
      )}

      {h.porQue && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--cor-texto-suave)]">{h.porQue}</p>
      )}

      {h.seguranca && (
        <p className="mt-1.5 text-2xs leading-relaxed text-[var(--cor-texto-suave)]">
          {h.seguranca}
        </p>
      )}

      {h.alertas.map((a) => (
        <p
          className="mt-1.5 flex items-start gap-1 text-2xs leading-relaxed text-[var(--cor-atencao-forte)]"
          key={a}
        >
          <TriangleAlert className="mt-0.5 shrink-0" size={11} />
          <span>{a}</span>
        </p>
      ))}

      <div className="mt-auto space-y-1 pt-3 text-xs">
        {/*
          Cama em dormitorio e quarto privativo sao precos diferentes, e
          misturar os dois numa viagem de duas pessoas erra o orcamento pela
          metade. Quando o banco tem os dois, a tela mostra os dois.
        */}
        {h.diaria ? (
          <p>
            <strong>{formatar(h.diaria.moeda, h.diaria.min, h.diaria.max)}</strong>{' '}
            <span className="text-[var(--cor-texto-suave)]">
              {h.porCama ? 'por cama em dormitorio' : 'a diaria'}
            </span>
          </p>
        ) : (
          <p className="text-[var(--cor-estimado)]">
            sem preco em fonte utilizavel — confirme no site
          </p>
        )}
        {h.diariaPrivativo && (
          <p className="text-[var(--cor-texto-suave)]">
            {formatar(h.diariaPrivativo.moeda, h.diariaPrivativo.min, h.diariaPrivativo.max)} no
            quarto privativo
          </p>
        )}
        <IdadeDoDado coletadoEm={h.coletadoEm} hoje={hoje} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {h.link && (
          <Botao
            onClick={() => window.open(h.link, '_blank', 'noopener,noreferrer')}
            tamanho="pequeno"
            variante="contorno"
          >
            <ExternalLink size={12} />
            site oficial
          </Botao>
        )}
        {noites.length > 0 && (
          <select
            aria-label={`Usar ${h.nome ?? h.bairro} numa noite`}
            className={cn(
              'h-7 rounded-[var(--raio)] border border-[var(--cor-borda-forte)]',
              'bg-[var(--cor-fundo-elevado)] px-2 text-2xs',
            )}
            onChange={(e) => e.target.value && usarNaNoite(e.target.value)}
            value=""
          >
            <option value="">usar numa noite...</option>
            {noites.map((d) => (
              <option key={d.id} value={d.id}>
                {d.data.split('-').reverse().join('/')}
              </option>
            ))}
          </select>
        )}
        {usada && (
          <span className="text-2xs text-[var(--cor-acento-forte)]" role="status">
            anotado no dia
          </span>
        )}
      </div>
    </Cartao>
  );
}
