import { ArrowRight, MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Botao, Cartao, Painel, Selo, Vazio } from '../componentes/ui.tsx';
import { ArvoreDeLugares } from '../componentes/ArvoreDeLugares.tsx';
import { type IndiceDeDestino, indices } from '../data/carregar.ts';
import { type Grupo, NOME_DO_GRUPO } from '../engine/grupos.ts';
import { usarLoja } from '../store/viagem.ts';

export function Inicio() {
  const navegar = useNavigate();
  const viagens = usarLoja((e) => e.viagens);
  const criarViagem = usarLoja((e) => e.criarViagem);
  const apagarViagem = usarLoja((e) => e.apagarViagem);
  const importarJson = usarLoja((e) => e.importarJson);

  const [criando, definirCriando] = useState(false);
  const [destinoEscolhido, definirDestino] = useState(indices[0]?.id ?? '');
  const [nome, definirNome] = useState('');
  const [recado, definirRecado] = useState<string>();
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  /*
    Um pacote cobre um RECORTE de pais ("Nordeste brasileiro"), nao o pais.
    Agrupar por codigo de pais faz dois recortes do mesmo pais virarem um
    cartao so quando chegar o segundo - sem isso, "Brasil - Nordeste" e
    "Brasil - Sudeste" apareceriam como paises diferentes na lista.
  */
  const porPais = useMemo(() => {
    const mapa = new Map<string, { chave: string; nome: string; pacotes: IndiceDeDestino[] }>();
    for (const d of indices) {
      const chave = d.codigoPais ?? d.id;
      const grupo = mapa.get(chave) ?? { chave, nome: d.paisNome ?? d.nome, pacotes: [] };
      grupo.pacotes.push(d);
      mapa.set(chave, grupo);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, []);

  function criar() {
    const indice = indices.find((d) => d.id === destinoEscolhido);
    if (!indice) return;
    const id = criarViagem(
      destinoEscolhido,
      nome.trim() || `${indice.nome} ${new Date().getFullYear()}`,
    );
    definirCriando(false);
    definirNome('');
    navegar(`/viagem/${id}/config`);
  }

  async function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const resultado = importarJson(await arquivo.text());
    definirRecado(resultado.mensagem);
    // Quem restaura um backup quer ver a viagem, nao a lista.
    if (resultado.viagemId) navegar(`/viagem/${resultado.viagemId}/calendario`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10 mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Planeje a viagem inteira, sem sair daqui
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--cor-texto-suave)]">
          Escolha o que te interessa, arraste para os dias e o app calcula deslocamento, conflito,
          tempo livre e orcamento na hora. Cada informacao mostra de onde veio e quando foi
          coletada.
        </p>
      </header>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
            Suas viagens
          </h2>
          <div className="flex gap-2">
            <input
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
              ref={entradaDeArquivo}
              type="file"
            />
            <Botao onClick={() => entradaDeArquivo.current?.click()} tamanho="pequeno">
              <Upload size={14} />
              Importar backup
            </Botao>
            <Botao onClick={() => definirCriando(true)} tamanho="pequeno" variante="principal">
              <Plus size={14} />
              Nova viagem
            </Botao>
          </div>
        </div>

        {recado && (
          <p
            className="mb-3 rounded-[var(--raio)] bg-[var(--cor-acento-fraco)] px-3 py-2 text-xs text-[var(--cor-acento-forte)]"
            role="status"
          >
            {recado}
          </p>
        )}

        {viagens.length === 0 ? (
          <Vazio icone={<MapPin size={28} />} titulo="Nenhuma viagem ainda">
            Crie a primeira e escolha o destino. Voce pode ter varias ao mesmo tempo, e comparar.
          </Vazio>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {viagens.map((v) => {
              const destino = indices.find((d) => d.id === v.destinoId);
              const noites = v.dias.length;
              const agendados = v.dias.reduce((n, d) => n + d.blocos.length, 0);
              return (
                <li key={v.id}>
                  <Cartao className="group flex h-full flex-col p-4 transition-shadow hover:shadow-[var(--sombra-flutuante)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{v.nome}</h3>
                        <p className="mt-0.5 text-xs text-[var(--cor-texto-suave)]">
                          {destino?.nome ?? v.destinoId}
                          {noites > 0 && ` · ${noites} dia${noites > 1 ? 's' : ''}`}
                          {agendados > 0 && ` · ${agendados} na agenda`}
                          {v.favoritos.length > 0 && ` · ${v.favoritos.length} favoritos`}
                        </p>
                      </div>
                      <Botao
                        aria-label={`Apagar ${v.nome}`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => {
                          if (confirm(`Apagar "${v.nome}"? Isto nao tem volta.`)) apagarViagem(v.id);
                        }}
                        tamanho="icone"
                        variante="fantasma"
                      >
                        <Trash2 size={15} />
                      </Botao>
                    </div>
                    <Botao
                      className="mt-4 self-start"
                      onClick={() => navegar(`/viagem/${v.id}/descobrir`)}
                      tamanho="pequeno"
                      variante="contorno"
                    >
                      Abrir
                      <ArrowRight size={14} />
                    </Botao>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
          Destinos disponiveis
        </h2>
        <p className="mb-3 text-xs text-[var(--cor-texto-suave)]">
          Agrupados por pais. Abra para ver os estados e as bases de cada um, e o que cada pacote
          ainda nao cobre.
        </p>
        <ul className="space-y-3">
          {porPais.map((pais) => (
            <li key={pais.chave}>
              <Cartao className="p-4">
                <h3 className="text-base font-medium">{pais.nome}</h3>
                {pais.pacotes.map((d) => (
                  <div className="mt-2 border-t border-[var(--cor-borda)] pt-2.5" key={d.id}>
                    <p className="text-sm font-medium text-[var(--cor-texto-suave)]">{d.nome}</p>
                    <p className="mt-0.5 text-xs text-[var(--cor-texto-suave)]">
                      {d.totais.itens} itens em {d.totais.cidades} bases
                      {d.totais.estados ? ` · ${d.totais.estados} estados` : ''} ·{' '}
                      {d.totais.trechos} trechos entre cidades · {d.totais.eventos} datas no
                      calendario
                    </p>

                    {d.cobertura && (
                      <p className="mt-2 rounded-[var(--raio)] bg-[var(--cor-fundo-afundado)] px-2.5 py-1.5 text-2xs leading-relaxed text-[var(--cor-texto-suave)]">
                        {d.cobertura}
                      </p>
                    )}

                    {d.grupos && d.grupos.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {d.grupos.map((g) => (
                          <Selo key={g.grupo} tom="neutro">
                            {g.n} {NOME_DO_GRUPO[g.grupo as Grupo] ?? g.grupo}
                          </Selo>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Selo tom="verificado">{d.confianca.verificado} verificado</Selo>
                      <Selo tom="parcial">{d.confianca.parcial} parcial</Selo>
                      <Selo tom="estimado">{d.confianca.estimado} estimado</Selo>
                    </div>

                    {d.arvore && d.arvore.length > 0 ? (
                      <ArvoreDeLugares arvore={d.arvore} />
                    ) : (
                      <p className="mt-2 text-2xs text-[var(--cor-estimado)]">
                        Divisao por estado ainda nao pesquisada neste pacote.
                      </p>
                    )}
                  </div>
                ))}
              </Cartao>
            </li>
          ))}
        </ul>
      </section>

      <Painel
        aoFechar={() => definirCriando(false)}
        aberto={criando}
        descricao="Depois voce ajusta datas, viajantes e orcamento."
        largura="max-w-md"
        titulo="Nova viagem"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--cor-texto-suave)]">
              Destino
            </label>
            <select
              className="h-10 w-full rounded-[var(--raio)] border border-[var(--cor-borda-forte)] bg-[var(--cor-fundo-elevado)] px-3 text-sm"
              onChange={(e) => definirDestino(e.target.value)}
              value={destinoEscolhido}
            >
              {indices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.paisNome && d.paisNome !== d.nome ? `${d.paisNome} — ` : ''}
                  {d.nome} ({d.totais.itens} itens)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--cor-texto-suave)]">
              Nome da viagem
            </label>
            <input
              className="h-10 w-full rounded-[var(--raio)] border border-[var(--cor-borda-forte)] bg-[var(--cor-fundo-elevado)] px-3 text-sm"
              onChange={(e) => definirNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && criar()}
              placeholder="Opcional"
              value={nome}
            />
          </div>
          <Botao className="w-full" onClick={criar} variante="principal">
            Criar e configurar
          </Botao>
        </div>
      </Painel>
    </div>
  );
}
