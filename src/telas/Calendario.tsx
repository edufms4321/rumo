import {
  ArrowRight,
  CalendarDays,
  CloudRain,
  Hotel,
  PartyPopper,
  TriangleAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { Botao, Cartao, Selo, Vazio } from '../componentes/ui.tsx';
import { calcularOrcamento, formatarBRL } from '../engine/orcamento.ts';
import { diaDaSemanaDe, validarViagem } from '../engine/regras.ts';
import { resolverDia } from '../engine/resolver-dia.ts';
import { formatarDuracao } from '../engine/tempo.ts';
import { cn } from '../lib/cn.ts';
import { acoes, usarHoje, usarPacote, usarViagem } from '../store/viagem.ts';

const NOME_DO_DIA: Record<string, string> = {
  seg: 'seg',
  ter: 'ter',
  qua: 'qua',
  qui: 'qui',
  sex: 'sex',
  sab: 'sab',
  dom: 'dom',
};

export function Calendario() {
  const viagem = usarViagem();
  const pacote = usarPacote();
  const hoje = usarHoje();
  const { viagemId } = useParams();

  const dados = useMemo(() => {
    if (!viagem || !pacote) return undefined;
    const resolvidos = viagem.dias.map((d) => resolverDia(viagem, d, pacote));
    const alertas = validarViagem(viagem, pacote, { hoje });
    const orcamento = calcularOrcamento(viagem, pacote);
    return { resolvidos, alertas, orcamento };
  }, [viagem, pacote, hoje]);

  if (!viagem || !pacote || !dados) return <Vazio titulo="Viagem nao encontrada" />;

  // Alerta sem diaId vale para a viagem inteira.
  const alertasDaViagem = dados.alertas.filter((a) => !a.diaId);

  if (viagem.dias.length === 0) {
    return (
      <Vazio icone={<CalendarDays size={26} />} titulo="A viagem ainda nao tem datas">
        Defina o primeiro e o ultimo dia em Ajustes. Se voce ainda nao sabe quando ir, favorite
        alguns itens e o app sugere a melhor janela a partir do clima de cada base.
        <div className="mt-3">
          <Link to={`/viagem/${viagemId}/config`}>
            <Botao tamanho="pequeno" variante="principal">
              Definir datas
            </Botao>
          </Link>
        </div>
      </Vazio>
    );
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Calendario da viagem</h2>
          <p className="mt-1 text-sm text-[var(--cor-texto-suave)]">
            {viagem.dias.length} dias · {dados.orcamento.total.min > 0 && `a partir de ${formatarBRL(dados.orcamento.total.min)} · `}
            {dados.alertas.filter((a) => a.nivel === 'erro').length} conflito(s)
          </p>
        </div>
      </header>

      {/*
        Alertas da viagem inteira, nao de um dia.

        Visto, vacina, documento de entrada e estouro de orcamento nao
        pertencem a nenhum dia, e por isso sumiam: a tela do dia filtra
        por diaId e descartava justamente estes. A barra de baixo
        contava-os e nao dizia quais eram — o usuario via "2 em atencao"
        sem nenhum jeito de descobrir que uma delas era a vacina que
        precisa de 10 dias. Agora moram aqui, na visao da viagem toda.
      */}
      {alertasDaViagem.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-suave)]">
            Antes de viajar
          </h3>
          <ul className="space-y-2">
            {alertasDaViagem.map((a) => (
              <li key={a.codigo}>
                <Cartao
                  className={cn(
                    'p-3',
                    a.nivel === 'erro'
                      ? 'border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)]'
                      : a.nivel === 'atencao'
                        ? 'border-[var(--cor-atencao-borda)] bg-[var(--cor-atencao-fundo)]'
                        : 'border-[var(--cor-dica-borda)] bg-[var(--cor-dica-fundo)]',
                  )}
                >
                  <p className="flex items-start gap-1.5 text-sm font-medium">
                    {a.nivel === 'erro' && (
                      <TriangleAlert className="mt-0.5 shrink-0 text-[var(--cor-erro)]" size={14} />
                    )}
                    {a.titulo}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cor-texto-suave)]">
                    {a.mensagem}
                  </p>
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dados.resolvidos.map((r) => {
          const dia = r.dia;
          const cidade = pacote.cidades.find((c) => c.id === dia.cidadeBaseId);
          const dow = diaDaSemanaDe(dia.data);
          const alertasDoDia = dados.alertas.filter((a) => a.diaId === dia.id);
          const erros = alertasDoDia.filter((a) => a.nivel === 'erro').length;
          const atencoes = alertasDoDia.filter((a) => a.nivel === 'atencao').length;

          const mes = Number(dia.data.slice(5, 7));
          const clima = cidade?.climaPorMes.find((c) => c.mes === mes);
          const eventos = pacote.calendario.filter((e) => {
            const fim = e.dataFim ?? e.dataInicio;
            return (
              dia.data >= e.dataInicio &&
              dia.data <= fim &&
              (e.escopo === 'nacional' || e.escopo === dia.cidadeBaseId)
            );
          });

          const custoDoDia = dados.orcamento.porDia[dia.id];

          return (
            <li key={dia.id}>
              <Cartao
                className={cn(
                  'flex h-full flex-col p-3.5 transition-shadow hover:shadow-[var(--sombra-flutuante)]',
                  erros > 0 && 'border-[var(--cor-erro-borda)]',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--cor-texto-fraco)]">
                      {NOME_DO_DIA[dow]} · {dia.data.slice(8, 10)}/{dia.data.slice(5, 7)}
                    </p>
                    <select
                      aria-label={`Cidade-base de ${dia.data}`}
                      className="-ml-1 mt-0.5 w-full rounded bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-[var(--cor-fundo-afundado)]"
                      onChange={(e) => acoes.definirCidadeDoDia(dia.id, e.target.value || undefined)}
                      value={dia.cidadeBaseId ?? ''}
                    >
                      <option value="">onde eu durmo?</option>
                      {pacote.cidades.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  {erros > 0 ? (
                    <Selo tom="erro">
                      <TriangleAlert size={10} />
                      {erros}
                    </Selo>
                  ) : atencoes > 0 ? (
                    <Selo tom="atencao">{atencoes}</Selo>
                  ) : null}
                </div>

                <div className="mt-2.5 space-y-1 text-xs text-[var(--cor-texto-suave)]">
                  <p>
                    {r.blocos.length === 0
                      ? 'nada agendado'
                      : `${r.blocos.length} ${r.blocos.length === 1 ? 'bloco' : 'blocos'} · ${formatarDuracao(
                          r.minutosEmAtividades,
                        )} de atividade`}
                  </p>
                  {r.minutosEmDeslocamento > 0 && (
                    <p>{formatarDuracao(r.minutosEmDeslocamento)} de deslocamento</p>
                  )}
                  {r.minutosLivres > 0 && (
                    <p className="text-[var(--cor-verificado)]">
                      {formatarDuracao(r.minutosLivres)} livres
                    </p>
                  )}
                  {custoDoDia && custoDoDia.min > 0 && <p>{formatarBRL(custoDoDia.min)}</p>}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {dia.hospedagem?.nome ? (
                    <Selo tom="neutro">
                      <Hotel size={10} /> {dia.hospedagem.nome}
                    </Selo>
                  ) : (
                    dia.cidadeBaseId && <Selo tom="atencao">sem hospedagem</Selo>
                  )}
                  {clima && clima.pesoNaDecisao === 'alto' && (
                    <Selo tom="parcial">
                      <CloudRain size={10} /> {Math.round(clima.chuvaMm)} mm no mes
                    </Selo>
                  )}
                  {eventos.slice(0, 2).map((e) => (
                    <Selo key={e.id} tom={e.valeEstarPresente === 'evite' ? 'atencao' : 'dica'}>
                      <PartyPopper size={10} />
                      {e.nome.slice(0, 28)}
                      {e.nome.length > 28 ? '...' : ''}
                    </Selo>
                  ))}
                </div>

                <Link className="mt-3" to={`/viagem/${viagemId}/dia/${dia.id}`}>
                  <Botao className="w-full justify-center" tamanho="pequeno" variante="contorno">
                    Abrir o dia
                    <ArrowRight size={13} />
                  </Botao>
                </Link>
              </Cartao>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
