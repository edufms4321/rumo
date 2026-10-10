/**
 * O caso que originou este modulo e real e esta no briefing do dono do app:
 * Cancun e Isla Mujeres estao 1h a frente de Valladolid, a 150 km. Um onibus
 * que sai 11h de Cancun "chega antes" do esperado se o app subtrair relogios
 * em vez de somar duracao real.
 *
 * O pacote de teste do motor e Brasil (um fuso so), entao aqui ele e vestido
 * de Mexico: dois fusos vizinhos, que e a unica coisa que estes testes
 * precisam. Os offsets sao os reais — Quintana Roo UTC-5, Yucatan UTC-6.
 */
import { describe, expect, it } from 'vitest';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Bloco } from '../schema/viagem.ts';
import { dia, pacoteDeTeste, viagemDeTeste } from './fixtures-de-teste.ts';
import {
  converterRelogio,
  diferencaParaCasa,
  horariosDoTrecho,
  mudancaDeFusoNoDia,
  offsetDaCidade,
  seloDeFuso,
} from './fusos.ts';
import { paraMinutos } from './tempo.ts';

/** Duas bases vizinhas em fusos diferentes, como Quintana Roo e Yucatan. */
function pacoteComDoisFusos(): PacoteDestino {
  const pacote = pacoteDeTeste();
  const cancun = pacote.cidades[0];
  const valladolid = pacote.cidades[1];
  if (!cancun || !valladolid) throw new Error('fixture mudou');
  return {
    ...pacote,
    destino: { ...pacote.destino, fusoOffsetMinutos: -360 },
    cidades: [
      { ...cancun, nome: 'Cancun', fusoOffsetMinutos: -300 },
      // Valladolid NAO declara offset: herda o -360 do destino, que e o caso
      // comum (declarar em cada cidade repetiria o mesmo numero 20 vezes).
      { ...valladolid, nome: 'Valladolid' },
    ],
  };
}

function trecho(startMin: number, durationMin: number): Extract<Bloco, { tipo: 'trecho' }> {
  return {
    id: 'bloco-trecho',
    tipo: 'trecho',
    modal: 'onibus',
    deCidadeId: 'sao-paulo',
    paraCidadeId: 'rio',
    startMin,
    durationMin,
    statusDeReserva: 'precisa-reservar',
  };
}

describe('offsetDaCidade', () => {
  it('usa o fuso do destino quando a cidade nao declara o seu', () => {
    const pacote = pacoteComDoisFusos();
    expect(offsetDaCidade(pacote, 'rio')).toBe(-360);
    expect(offsetDaCidade(pacote, 'sao-paulo')).toBe(-300);
  });

  it('cidade desconhecida cai no fuso do destino em vez de explodir', () => {
    expect(offsetDaCidade(pacoteComDoisFusos(), 'nao-existe')).toBe(-360);
  });
});

describe('converterRelogio', () => {
  it('11h em Cancun e 10h em Valladolid', () => {
    expect(converterRelogio(paraMinutos('11:00'), -300, -360)).toBe(paraMinutos('10:00'));
  });

  it('e reversivel', () => {
    const ida = converterRelogio(600, -360, -300);
    expect(converterRelogio(ida, -300, -360)).toBe(600);
  });
});

describe('horariosDoTrecho', () => {
  /*
    O teste que o briefing pediu. A linha do tempo esta no relogio de
    Valladolid (base do dia, UTC-6). O onibus sai 11:00 de Cancun, ou seja
    10:00 no relogio em que o bloco esta desenhado, e leva 2h30 REAIS.
    Chegada correta: 12:30 em Valladolid. Quem subtrai relogio erra para
    13:30 — uma hora de folga que nao existe.
  */
  it('Cancun para Valladolid: sai 11:00 la, chega 12:30 aqui, selo -1 h', () => {
    const pacote = pacoteComDoisFusos();
    const h = horariosDoTrecho(pacote, trecho(paraMinutos('10:00'), 150), -360);

    expect(h.saida.cidadeNome).toBe('Cancun');
    expect(h.saida.hhmm).toBe('11:00');
    expect(h.chegada.cidadeNome).toBe('Valladolid');
    expect(h.chegada.hhmm).toBe('12:30');
    expect(h.duracaoMin).toBe(150);
    expect(h.mudaDeFuso).toBe(true);
    expect(seloDeFuso(h.diferencaMinutos)).toBe('-1 h');
  });

  it('a duracao e tempo real, nao diferenca de relogio', () => {
    const pacote = pacoteComDoisFusos();
    const h = horariosDoTrecho(pacote, trecho(paraMinutos('10:00'), 150), -360);
    // 11:00 -> 12:30 no relogio da chegada e 1h30; a viagem durou 2h30.
    const peloRelogio = h.chegada.localMin - h.saida.localMin;
    expect(peloRelogio).toBe(90);
    expect(h.duracaoMin).toBe(150);
  });

  it('sem mudanca de fuso nao ha selo', () => {
    const pacote = pacoteDeTeste();
    const h = horariosDoTrecho(pacote, trecho(600, 150), -180);
    expect(h.mudaDeFuso).toBe(false);
    expect(seloDeFuso(h.diferencaMinutos)).toBe('');
  });

  it('offsetChegadaMinutos do bloco tem precedencia sobre o fuso da cidade', () => {
    const pacote = pacoteComDoisFusos();
    const base = trecho(paraMinutos('10:00'), 150);
    const h = horariosDoTrecho(pacote, { ...base, offsetChegadaMinutos: -420 }, -360);
    expect(h.chegada.hhmm).toBe('11:30');
    expect(seloDeFuso(h.diferencaMinutos)).toBe('-2 h');
  });
});

describe('mudancaDeFusoNoDia', () => {
  const pacote = pacoteComDoisFusos();

  it('aponta a mudanca entre o dia anterior e este', () => {
    const viagem = viagemDeTeste([
      dia('d1', '2026-11-22', 'sao-paulo', []),
      dia('d2', '2026-11-23', 'rio', []),
    ]);
    const m = mudancaDeFusoNoDia(viagem, pacote, 'd2');
    expect(m?.deCidadeNome).toBe('Cancun');
    expect(m?.paraCidadeNome).toBe('Valladolid');
    expect(seloDeFuso(m?.diferencaMinutos ?? 0)).toBe('-1 h');
  });

  it('nao avisa quando o fuso e o mesmo', () => {
    const viagem = viagemDeTeste([
      dia('d1', '2026-11-22', 'rio', []),
      dia('d2', '2026-11-23', 'rio', []),
    ]);
    expect(mudancaDeFusoNoDia(viagem, pacote, 'd2')).toBeUndefined();
  });

  it('o primeiro dia da viagem nao tem de onde mudar', () => {
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'sao-paulo', [])]);
    expect(mudancaDeFusoNoDia(viagem, pacote, 'd1')).toBeUndefined();
  });

  it('dia sem base no meio nao zera o relogio: olha mais para tras', () => {
    const viagem = viagemDeTeste([
      dia('d1', '2026-11-22', 'sao-paulo', []),
      { id: 'd2', data: '2026-11-23', blocos: [] },
      dia('d3', '2026-11-24', 'rio', []),
    ]);
    const m = mudancaDeFusoNoDia(viagem, pacote, 'd3');
    expect(m?.deCidadeNome).toBe('Cancun');
  });
});

describe('diferencaParaCasa', () => {
  const pacote = pacoteComDoisFusos();

  it('Valladolid esta 3 h atras de Brasilia', () => {
    const viagem = {
      ...viagemDeTeste([dia('d1', '2026-11-22', 'rio', [])]),
      origem: { cidade: 'Sao Paulo', aeroportos: ['GRU'], fusoOffsetMinutos: -180 },
    };
    const d = viagem.dias[0];
    if (!d) throw new Error('sem dia');
    expect(diferencaParaCasa(viagem, pacote, d)).toBe(-180);
    expect(seloDeFuso(-180)).toBe('-3 h');
  });

  it('viagem antiga sem fuso de casa nao chuta um numero', () => {
    const viagem = viagemDeTeste([dia('d1', '2026-11-22', 'rio', [])]);
    const d = viagem.dias[0];
    if (!d) throw new Error('sem dia');
    expect(diferencaParaCasa(viagem, pacote, d)).toBeUndefined();
  });
});
