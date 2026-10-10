/**
 * Mudar de cidade dentro do roteiro.
 *
 * Esta tela existe porque o bloco de trecho era inalcancavel. O schema tinha
 * `BlocoTrecho` desde o primeiro commit, o motor sabia somar acesso ao
 * terminal, antecedencia e traslado, a matriz entre cidades estava pesquisada
 * com fonte, as regras liam `tipo === 'trecho'` para saber se o dia tinha
 * troca de base — e NENHUMA tela criava um. O pacote do Mexico tem trinta
 * trechos pesquisados, inclusive o Cancun-Valladolid de trem, e nenhum deles
 * podia entrar na agenda. "Troca de cidade e bloco salvo" era verdade no
 * codigo e mentira no app.
 *
 * A duracao sugerida vem do mesmo `estimarDeslocamento` que a tela do dia usa
 * nas lacunas: um lugar so para a conta, com a camada, os passos e as fontes
 * a vista. Quando o pacote nao tem o par pesquisado, o campo entra vazio em
 * vez de um numero inventado.
 */
import { useMemo, useState } from 'react';
import { estimarDeslocamento } from '../engine/deslocamento.ts';
import { converterRelogio, offsetDaCidade, offsetDoDia, seloDeFuso } from '../engine/fusos.ts';
import { formatarDuracao, paraHHMM, paraMinutos } from '../engine/tempo.ts';
import type { Modal } from '../schema/base.ts';
import type { Bloco, Dia } from '../schema/viagem.ts';
import { acoes, novoId, usarPacote } from '../store/viagem.ts';
import { Botao, Campo, Cartao, Painel, Rotulo, Selecao } from './ui.tsx';

export function TrocaDeCidade({
  aberto,
  aoFechar,
  dia,
  baseAnterior,
}: {
  aberto: boolean;
  aoFechar: () => void;
  dia: Dia;
  /** Onde ele dormiu na noite anterior: e de la que o trecho costuma sair. */
  baseAnterior?: string;
}) {
  const pacote = usarPacote();
  const [de, definirDe] = useState(baseAnterior ?? dia.cidadeBaseId ?? '');
  const [para, definirPara] = useState(
    dia.cidadeBaseId && dia.cidadeBaseId !== baseAnterior ? dia.cidadeBaseId : '',
  );
  const [modal, definirModal] = useState<Modal | ''>('');
  const [hora, definirHora] = useState('09:00');
  const [minutos, definirMinutos] = useState('');
  const [escalaFora, definirEscalaFora] = useState('');

  /* Trechos pesquisados para este par, nos dois sentidos. */
  const opcoes = useMemo(() => {
    if (!pacote || !de || !para || de === para) return [];
    return pacote.trechos
      .filter(
        (t) =>
          (t.deCidadeId === de && t.paraCidadeId === para) ||
          (t.deCidadeId === para && t.paraCidadeId === de),
      )
      .map((t) => ({
        trecho: t,
        /* Pesquisado no sentido contrario: usavel, mas o app diz isso. */
        invertido: t.deCidadeId !== de,
      }));
  }, [pacote, de, para]);

  /* A conta do motor para o par e o modal escolhidos. */
  const sugestao = useMemo(() => {
    if (!pacote || !de || !para || de === para) return undefined;
    return estimarDeslocamento(
      { nome: de, cidadeId: de, ancora: 'terminal-de-onibus' },
      { nome: para, cidadeId: para, ancora: 'terminal-de-onibus' },
      { pacote, ...(modal ? { modalEscolhido: modal } : {}) },
    );
  }, [pacote, de, para, modal]);

  const duracaoFinal = minutos ? Number(minutos) : sugestao?.minutos;
  const nomeDaCidade = (id: string) => pacote?.cidades.find((c) => c.id === id)?.nome ?? id;
  const modaisPesquisados = [...new Set(opcoes.map((o) => o.trecho.modal))];

  /*
    O horario que ele digita e o do BILHETE, no relogio de onde embarca; o
    `startMin` do bloco e a posicao na linha do tempo, que esta no relogio da
    cidade-base do dia. Entre Cancun e Valladolid isso e uma hora inteira:
    gravar o numero digitado sem converter desenharia o trecho na hora errada
    e desfaria, na gravacao, exatamente a conta que a tela acerta na leitura.
  */
  const quadro = pacote ? offsetDoDia(pacote, dia) : 0;
  const offsetDeSaida = pacote && de ? offsetDaCidade(pacote, de) : quadro;
  const inicioNoQuadro = converterRelogio(paraMinutos(hora), offsetDeSaida, quadro);
  const transbordaODia = inicioNoQuadro < 0 || inicioNoQuadro > 1439;

  function confirmar() {
    if (!de || !para || de === para || !duracaoFinal) return;
    const bloco: Bloco = {
      id: novoId('bloco'),
      tipo: 'trecho',
      modal: modal || sugestao?.modal || 'onibus',
      deCidadeId: de,
      paraCidadeId: para,
      startMin: Math.max(0, Math.min(1439, inicioNoQuadro)),
      durationMin: Math.max(10, Math.min(2880, Math.round(duracaoFinal))),
      statusDeReserva: 'precisa-reservar',
      ...(escalaFora.trim() ? { escalaEmOutroPais: escalaFora.trim() } : {}),
    };
    acoes.adicionarBloco(dia.id, bloco);
    aoFechar();
  }

  return (
    <Painel
      aberto={aberto}
      aoFechar={aoFechar}
      descricao="O trecho entra na agenda como bloco, com horario e duracao. A linha do tempo mostra a hora local de cada ponta."
      titulo="Mudar de cidade neste dia"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="trecho-de">Sai de</Rotulo>
            <Selecao id="trecho-de" onChange={(e) => definirDe(e.target.value)} value={de}>
              <option value="">escolha a cidade</option>
              {pacote?.cidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="trecho-para">Chega em</Rotulo>
            <Selecao id="trecho-para" onChange={(e) => definirPara(e.target.value)} value={para}>
              <option value="">escolha a cidade</option>
              {pacote?.cidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </div>
        </div>

        {de !== '' && de === para && (
          <p className="text-xs text-[var(--cor-atencao-forte)]">
            Sair e chegar na mesma cidade nao e um trecho.
          </p>
        )}

        {modaisPesquisados.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium">
              Pesquisado para este par — escolha como vai
            </legend>
            <div className="space-y-1.5">
              {modaisPesquisados.map((m) => {
                const dele = opcoes.filter((o) => o.trecho.modal === m);
                const primeiro = dele[0];
                if (!primeiro) return null;
                const duracoes = dele
                  .map((o) => o.trecho.duracaoPortaAPortaMin ?? o.trecho.duracaoVeiculoMin)
                  .filter((d): d is number => d !== undefined);
                return (
                  <label
                    className="flex cursor-pointer items-start gap-2 rounded-[var(--raio)] border border-[var(--cor-borda)] p-2 text-xs hover:border-[var(--cor-borda-forte)]"
                    key={m}
                  >
                    <input
                      checked={modal === m}
                      className="mt-0.5"
                      name="modal-do-trecho"
                      onChange={() => definirModal(m)}
                      type="radio"
                    />
                    <span className="min-w-0">
                      <strong>{m}</strong>
                      {duracoes.length > 0 && <> · {formatarDuracao(Math.min(...duracoes))}</>}
                      {primeiro.trecho.operadoras.length > 0 && (
                        <span className="block text-[var(--cor-texto-fraco)]">
                          {primeiro.trecho.operadoras.join(', ')}
                        </span>
                      )}
                      {primeiro.invertido && (
                        <span className="block text-[var(--cor-estimado)]">
                          pesquisado no sentido inverso
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {de !== '' && para !== '' && de !== para && opcoes.length === 0 && (
          <p className="text-xs text-[var(--cor-estimado)]">
            O banco nao tem este par pesquisado. A duracao abaixo e estimativa do motor — confirme
            com a operadora antes de contar com ela.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="trecho-hora">
              Sai as (horario de {de ? nomeDaCidade(de) : 'onde embarca'})
            </Rotulo>
            <Campo
              id="trecho-hora"
              onChange={(e) => definirHora(e.target.value)}
              type="time"
              value={hora}
            />
          </div>
          <div>
            <Rotulo htmlFor="trecho-minutos">Duracao em minutos</Rotulo>
            <Campo
              id="trecho-minutos"
              onChange={(e) => definirMinutos(e.target.value)}
              placeholder={sugestao?.minutos ? String(sugestao.minutos) : 'sem sugestao'}
              type="number"
              value={minutos}
            />
          </div>
        </div>

        {offsetDeSaida !== quadro && (
          <p className="text-xs text-[var(--cor-texto-suave)]">
            {nomeDaCidade(de)} esta {seloDeFuso(offsetDeSaida - quadro)} em relacao ao relogio
            deste dia, que e o de {dia.cidadeBaseId ? nomeDaCidade(dia.cidadeBaseId) : 'onde dorme'}
            . Na linha do tempo o bloco aparece as{' '}
            <strong className="tabular">{paraHHMM(inicioNoQuadro)}</strong>
            .
          </p>
        )}

        {transbordaODia && (
          <p className="text-xs text-[var(--cor-atencao-forte)]">
            Com a conversao de fuso este horario cai em outro dia. O bloco vai entrar na borda
            deste dia; mova-o para o dia certo depois.
          </p>
        )}

        {/*
          Escala fora do pais e o unico dado daqui que nao da para deduzir do
          pacote: a matriz liga cidades do destino e nao sabe que a conexao
          mais barata passa pelo Panama. Sem este campo, a regra de visto de
          entrada unica nunca teria o que ler.
        */}
        <div>
          <Rotulo htmlFor="trecho-escala">Faz escala em outro pais? (opcional)</Rotulo>
          <Campo
            id="trecho-escala"
            onChange={(e) => definirEscalaFora(e.target.value)}
            placeholder="ex.: Panama, Colombia"
            value={escalaFora}
          />
          <p className="mt-1 text-2xs text-[var(--cor-texto-suave)]">
            Sair do pais no meio do roteiro queima visto de entrada unica. Se houver, o app
            avisa antes de voce comprar.
          </p>
        </div>

        {sugestao && (
          <Cartao className="bg-[var(--cor-fundo-afundado)] p-3 text-xs">
            <p>{sugestao.resumo}</p>
            <ul className="mt-1.5 space-y-0.5 text-[var(--cor-texto-suave)]">
              {sugestao.passos.map((passo) => (
                <li key={passo.rotulo}>
                  {passo.rotulo}: {passo.valor}
                  {passo.estimado && ' (estimativa)'}
                </li>
              ))}
            </ul>
            {sugestao.avisos.map((a) => (
              <p className="mt-1.5 text-[var(--cor-atencao-forte)]" key={a}>
                {a}
              </p>
            ))}
          </Cartao>
        )}

        <div className="flex flex-wrap gap-2">
          <Botao disabled={!de || !para || de === para || !duracaoFinal} onClick={confirmar}>
            Colocar na agenda
          </Botao>
          <Botao onClick={aoFechar} variante="contorno">
            Cancelar
          </Botao>
        </div>
      </div>
    </Painel>
  );
}
