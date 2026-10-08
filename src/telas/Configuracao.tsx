import { CalendarRange, RefreshCw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Fontes, SeloDeConfianca } from '../componentes/procedencia.tsx';
import {
  Botao,
  Campo,
  Cartao,
  Chave,
  Rotulo,
  Secao,
  Selecao,
  Selo,
  Vazio,
} from '../componentes/ui.tsx';
import { buscarCambio } from '../dados-externos/cambio.ts';
import { type JanelaSugerida, sugerirJanelas } from '../engine/sugestoes.ts';
import { porExtenso } from '../engine/tempo.ts';
import { acoes, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

export function Configuracao() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();
  const [buscandoCambio, definirBuscando] = useState(false);
  const [recadoDoCambio, definirRecadoDoCambio] = useState<string>();

  const janelas = useMemo(() => {
    if (!viagem || !pacote) return [];
    const favoritos = pacote.itens.filter((i) => viagem.favoritos.includes(i.id));
    const cidades = [...new Set(favoritos.map((i) => i.cidadeId))];
    const duracao = viagem.dias.length || 10;
    return sugerirJanelas(pacote, {
      duracaoEmDias: duracao,
      cidadesDeInteresse: cidades,
      aPartirDe: hoje,
    });
  }, [viagem, pacote, hoje]);

  if (!viagem || !pacote) return <Vazio titulo="Viagem nao encontrada" />;

  const inicio = viagem.dias[0]?.data ?? '';
  const fim = viagem.dias.at(-1)?.data ?? '';
  const requisito =
    pacote.destino.entrada.find((e) => e.nacionalidade === viagem.viajantes.nacionalidade) ??
    pacote.destino.entrada[0];

  async function atualizarCambio() {
    if (!viagem) return;
    definirBuscando(true);
    const moedas = [pacote!.destino.moeda, 'USD'];
    const r = await buscarCambio({ ...viagem.cambio, manual: false }, moedas);
    definirRecadoDoCambio(r.explicacao);
    if (r.atualizou) acoes.atualizarViagem({ cambio: r.cambio });
    definirBuscando(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Configuracao da viagem</h2>

      {requisito?.vistoNecessario && (
        <Cartao className="mb-6 border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)] p-4">
          <p className="text-sm font-semibold text-[var(--cor-erro)]">
            {pacote.destino.nome} exige visto de quem tem passaporte {requisito.nacionalidade}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--cor-texto)]">
            {requisito.observacoes || requisito.documento}
          </p>
          <div className="mt-2">
            <Fontes fontes={requisito.fontes} />
          </div>
        </Cartao>
      )}

      <Secao titulo="Basico">
        <Cartao className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="nome">Nome da viagem</Rotulo>
            <Campo
              id="nome"
              onChange={(e) => acoes.atualizarViagem({ nome: e.target.value })}
              value={viagem.nome}
            />
          </div>
          <div>
            <Rotulo htmlFor="inicio">Primeiro dia</Rotulo>
            <Campo
              id="inicio"
              onChange={(e) => e.target.value && acoes.definirDatas(e.target.value, fim || e.target.value)}
              type="date"
              value={inicio}
            />
          </div>
          <div>
            <Rotulo htmlFor="fim">Ultimo dia</Rotulo>
            <Campo
              id="fim"
              min={inicio}
              onChange={(e) => inicio && e.target.value && acoes.definirDatas(inicio, e.target.value)}
              type="date"
              value={fim}
            />
          </div>
          <div>
            <Rotulo htmlFor="adultos">Adultos</Rotulo>
            <Campo
              id="adultos"
              min={1}
              onChange={(e) =>
                acoes.atualizarViagem({
                  viajantes: { ...viagem.viajantes, adultos: Math.max(1, Number(e.target.value)) },
                })
              }
              type="number"
              value={viagem.viajantes.adultos}
            />
          </div>
          <div>
            <Rotulo htmlFor="criancas">Criancas</Rotulo>
            <Campo
              id="criancas"
              min={0}
              onChange={(e) =>
                acoes.atualizarViagem({
                  viajantes: { ...viagem.viajantes, criancas: Math.max(0, Number(e.target.value)) },
                })
              }
              type="number"
              value={viagem.viajantes.criancas}
            />
          </div>
          <div>
            <Rotulo htmlFor="estilo">Estilo</Rotulo>
            <Selecao
              id="estilo"
              onChange={(e) => acoes.atualizarViagem({ estilo: e.target.value as never })}
              value={viagem.estilo}
            >
              <option value="economico">Economico</option>
              <option value="conforto">Conforto</option>
              <option value="premium">Premium</option>
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="ritmo">Ritmo</Rotulo>
            <Selecao
              id="ritmo"
              onChange={(e) => acoes.atualizarViagem({ ritmo: e.target.value as never })}
              value={viagem.ritmo}
            >
              <option value="tranquilo">Tranquilo — ate 6 h por dia</option>
              <option value="equilibrado">Equilibrado — ate 9 h por dia</option>
              <option value="intenso">Intenso — ate 12 h por dia</option>
            </Selecao>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo="Orcamento">
        <Cartao className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Rotulo htmlFor="teto">Teto por pessoa, em reais</Rotulo>
              <Campo
                id="teto"
                min={0}
                onChange={(e) => {
                  const valor = Number(e.target.value);
                  acoes.atualizarViagem({
                    orcamento:
                      valor > 0
                        ? {
                            moeda: 'BRL',
                            porPessoa: valor,
                            incluiVoosInternacionais:
                              viagem.orcamento?.incluiVoosInternacionais ?? true,
                          }
                        : undefined,
                  });
                }}
                placeholder="deixe vazio para nao ter teto"
                type="number"
                value={viagem.orcamento?.porPessoa ?? ''}
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Chave
                aoMudar={(v) =>
                  viagem.orcamento &&
                  acoes.atualizarViagem({
                    orcamento: { ...viagem.orcamento, incluiVoosInternacionais: v },
                  })
                }
                marcado={viagem.orcamento?.incluiVoosInternacionais ?? true}
                rotulo="Inclui voos internacionais"
              />
              <span className="text-xs text-[var(--cor-texto-suave)]">
                O teto inclui os voos internacionais
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--cor-texto-fraco)]">
            Orcamento e opcional. Sem teto, o app so mostra quanto a viagem esta custando.
          </p>
        </Cartao>
      </Secao>

      <Secao
        acao={
          <Botao disabled={buscandoCambio} onClick={() => void atualizarCambio()} tamanho="pequeno">
            <RefreshCw className={buscandoCambio ? 'animate-spin' : ''} size={13} />
            Buscar cotacao
          </Botao>
        }
        titulo="Cambio"
      >
        <Cartao className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[pacote.destino.moeda, 'USD'].map((moeda) => (
              <div key={moeda}>
                <Rotulo htmlFor={`cambio-${moeda}`}>1 {moeda} em reais</Rotulo>
                <Campo
                  id={`cambio-${moeda}`}
                  onChange={(e) => acoes.definirCambio(moeda, Number(e.target.value) || 0)}
                  step="0.00001"
                  type="number"
                  value={viagem.cambio.taxas[moeda] ?? 0}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--cor-texto-fraco)]">
            Atualizado em {viagem.cambio.atualizadoEm}.{' '}
            {viagem.cambio.manual
              ? 'Travado por voce: o app nao sobrescreve.'
              : 'O app pode atualizar sozinho.'}
            {recadoDoCambio && ` ${recadoDoCambio}`}
          </p>
        </Cartao>
      </Secao>

      <Secao titulo="Quando ir">
        {janelas.length === 0 ? (
          <Vazio icone={<CalendarRange size={24} />} titulo="Sem sugestao de data ainda">
            Favorite alguns itens em Descobrir. O app usa o clima das bases que voce escolheu, mes a
            mes, para sugerir a melhor janela.
          </Vazio>
        ) : (
          <ul className="space-y-2">
            {janelas.map((j) => (
              <li key={j.inicio}>
                <JanelaDeData janela={j} />
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Entrada e saude">
        <Cartao className="space-y-3 p-4 text-xs leading-relaxed">
          {requisito && (
            <>
              <Linha rotulo="Documento">{requisito.documento}</Linha>
              {requisito.observacoes && <Linha rotulo="Visto">{requisito.observacoes}</Linha>}
              {requisito.vacinaFebreAmarela && (
                <Linha rotulo="Vacina">{requisito.vacinaFebreAmarela}</Linha>
              )}
              {requisito.formularioMigratorio && (
                <Linha rotulo="Formulario">{requisito.formularioMigratorio}</Linha>
              )}
              <Fontes fontes={requisito.fontes} />
            </>
          )}
          {pacote.destino.emergencia && (
            <div className="mt-3 border-t border-[var(--cor-borda)] pt-3">
              <p className="mb-1.5 font-medium">Emergencia</p>
              {pacote.destino.emergencia.numeroUnico && (
                <Linha rotulo="Numero unico">{pacote.destino.emergencia.numeroUnico}</Linha>
              )}
              {pacote.destino.emergencia.representacaoBrasileira.map((r) => (
                <Linha key={r.nome} rotulo={r.cidade}>
                  {r.nome}
                  {r.plantao && ` · plantao ${r.plantao}`}
                  {r.telefone && ` · ${r.telefone}`}
                  {r.horario && ` · ${r.horario}`}
                </Linha>
              ))}
              {pacote.destino.emergencia.observacoes && (
                <p className="mt-2 text-[var(--cor-texto-fraco)]">
                  {pacote.destino.emergencia.observacoes}
                </p>
              )}
            </div>
          )}
        </Cartao>
      </Secao>

      <Secao titulo="Procedencia do banco">
        <Cartao className="p-4 text-xs">
          <div className="mb-2 flex items-center gap-2">
            <SeloDeConfianca nivel={pacote.destino.confianca} />
            <span className="text-[var(--cor-texto-suave)]">
              coletado em {pacote.destino.coletadoEm}
            </span>
          </div>
          <p className="leading-relaxed text-[var(--cor-texto-suave)]">
            {pacote.itens.length} itens, {pacote.cidades.length} bases, {pacote.trechos.length}{' '}
            trechos entre cidades. Cada item mostra sua propria fonte e data.
          </p>
        </Cartao>
      </Secao>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-medium text-[var(--cor-texto)]">{rotulo}: </span>
      <span className="text-[var(--cor-texto-suave)]">{children}</span>
    </p>
  );
}

function JanelaDeData({ janela }: { janela: JanelaSugerida }) {
  const temEvite = janela.eventos.some((e) => e.veredito === 'evite');
  return (
    <Cartao className="p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[var(--cor-acento)]" size={15} />
          <span className="text-sm font-medium">
            {porExtenso(janela.inicio)} a {porExtenso(janela.fim)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Selo tom={janela.nota >= 70 ? 'verificado' : janela.nota >= 45 ? 'parcial' : 'estimado'}>
            nota {janela.nota}
          </Selo>
          <Botao
            onClick={() => acoes.definirDatas(janela.inicio, janela.fim)}
            tamanho="pequeno"
            variante="contorno"
          >
            Usar estas datas
          </Botao>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-[var(--cor-texto-suave)]">
        {janela.porque.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {temEvite && (
        <p className="mt-1.5 text-xs text-[var(--cor-atencao)]">
          Pega data que o banco marca como melhor evitar.
        </p>
      )}
    </Cartao>
  );
}
