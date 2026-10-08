import { describe, expect, it } from 'vitest';
import type { Bloco, Dia, Viagem } from '../schema/viagem.ts';
import { atividade, dia, viagemDeTeste } from './fixtures-de-teste.ts';
import { pacoteParaRegras } from './fixtures-regras.ts';
import { type Alerta, validarViagem } from './regras.ts';
import { paraMinutos } from './tempo.ts';

const pacote = pacoteParaRegras();

/** 2026-11-18 e uma quarta; 2026-11-16, uma segunda. */
const QUARTA = '2026-11-18';
const SEGUNDA = '2026-11-16';

function alertas(dias: Dia[], ajuste: (v: Viagem) => Viagem = (v) => v): Alerta[] {
  return validarViagem(ajuste(viagemDeTeste(dias)), pacote);
}

function codigos(lista: Alerta[]): string[] {
  return [...new Set(lista.map((a) => a.codigo))];
}

function pegar(lista: Alerta[], codigo: string): Alerta | undefined {
  return lista.find((a) => a.codigo === codigo);
}

function comHospedagem(d: Dia): Dia {
  return { ...d, hospedagem: { nome: 'Hotel de teste', moeda: 'BRL', confirmada: true } };
}

describe('erro: deslocamento-impossivel', () => {
  it('acusa o almoco em Sao Paulo seguido de praia no Rio', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-almoco', paraMinutos('12:00'), 60),
        atividade('b2', 'br-rio-copacabana', paraMinutos('14:00'), 120),
      ]),
    );
    const a = pegar(alertas([d]), 'deslocamento-impossivel');
    expect(a?.nivel).toBe('erro');
    expect(a?.titulo).toMatch(/Faltam/);
    expect(a?.correcoes.map((c) => c.tipo)).toEqual([
      'empurrar-proximos',
      'encurtar-anterior',
      'mover-para-outro-dia',
    ]);
  });

  it('a mensagem diz quanto tempo havia e quanto o trajeto precisa', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-almoco', paraMinutos('12:00'), 60),
        atividade('b2', 'br-rio-copacabana', paraMinutos('14:00'), 120),
      ]),
    );
    const a = pegar(alertas([d]), 'deslocamento-impossivel');
    expect(a?.mensagem).toMatch(/1 h entre uma coisa e outra/);
    expect(a?.mensagem).toMatch(/13:00 as 14:00/);
  });
});

describe('erro: blocos-sobrepostos', () => {
  it('acusa e mede a sobreposicao', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-almoco', paraMinutos('12:00'), 120),
        atividade('b2', 'br-sp-pinacoteca', paraMinutos('13:00'), 90),
      ]),
    );
    const a = pegar(alertas([d]), 'blocos-sobrepostos');
    expect(a?.nivel).toBe('erro');
    expect(a?.mensagem).toMatch(/se cruzam por 1 h/);
  });
});

describe('erro: fechado-neste-dia', () => {
  it('acusa museu agendado numa segunda-feira', () => {
    const d = comHospedagem(
      dia('d1', SEGUNDA, 'sao-paulo', [
        atividade('b1', 'br-sp-museu-fecha-segunda', paraMinutos('10:00'), 90),
      ]),
    );
    const a = pegar(alertas([d]), 'fechado-neste-dia');
    expect(a?.nivel).toBe('erro');
    expect(a?.mensagem).toMatch(/segunda-feira/);
  });

  it('nao acusa o mesmo museu numa quarta', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-museu-fecha-segunda', paraMinutos('10:00'), 90),
      ]),
    );
    expect(codigos(alertas([d]))).not.toContain('fechado-neste-dia');
  });
});

describe('atencao: fora-do-horario', () => {
  it('acusa atividade que comeca antes de o lugar abrir', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-museu-fecha-segunda', paraMinutos('07:00'), 90),
      ]),
    );
    const a = pegar(alertas([d]), 'fora-do-horario');
    expect(a?.nivel).toBe('atencao');
    expect(a?.mensagem).toMatch(/09:00–17:00/);
    expect(a?.correcoes[0]?.tipo).toBe('encaixar-no-horario');
  });

  it('cala quando o horario daquele dia e desconhecido', () => {
    // A Pinacoteca da fixture nao tem horarios: ausente significa "nao sei".
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-pinacoteca', paraMinutos('05:00'), 90),
      ]),
    );
    expect(codigos(alertas([d]))).not.toContain('fora-do-horario');
  });
});

describe('atencao: duracao-abaixo-do-minimo', () => {
  it('avisa e oferece a duracao tipica', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-pinacoteca', paraMinutos('10:00'), 20),
      ]),
    );
    const a = pegar(alertas([d]), 'duracao-abaixo-do-minimo');
    expect(a?.nivel).toBe('atencao');
    expect(a?.correcoes[0]?.dados).toMatchObject({ durationMin: 90 });
  });
});

describe('atencao: luz-do-dia', () => {
  it('acusa mirante terminando depois do por do sol, com a hora real', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'rio', [
        atividade('b1', 'br-rio-mirante-por-do-sol', paraMinutos('18:30'), 60),
      ]),
    );
    const a = pegar(alertas([d]), 'luz-do-dia');
    expect(a?.nivel).toBe('atencao');
    // No Rio, em 18/11, o sol se poe perto das 18:30.
    expect(a?.mensagem).toMatch(/o sol se poe as 1[78]:\d\d/);
  });

  it('usa o por do sol do lugar da ATIVIDADE, nao o da cidade onde se dorme', () => {
    // O mirante e no Rio; a base do dia e Sao Paulo. O sol se poe em horas
    // diferentes nos dois lugares, e o alerta tem de citar o do Rio.
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-rio-mirante-por-do-sol', paraMinutos('19:30'), 60),
      ]),
    );
    const a = pegar(alertas([d]), 'luz-do-dia');
    expect(a?.mensagem).toMatch(/em Rio de Janeiro/);
  });

  it('nao acusa a mesma atividade de manha', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'rio', [
        atividade('b1', 'br-rio-mirante-por-do-sol', paraMinutos('09:00'), 60),
      ]),
    );
    expect(codigos(alertas([d]))).not.toContain('luz-do-dia');
  });
});

describe('atencao: horario-fixo-de-saida', () => {
  it('acusa barco agendado fora da hora de saida e oferece a hora certa', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'rio', [
        atividade('b1', 'br-rio-passeio-de-barco', paraMinutos('11:00'), 240),
      ]),
    );
    const a = pegar(alertas([d]), 'horario-fixo-de-saida');
    expect(a?.mensagem).toMatch(/sai as 09:00/);
    expect(a?.correcoes[0]?.dados).toMatchObject({ startMin: paraMinutos('09:00') });
  });

  it('cala quando o bloco comeca na hora da saida', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'rio', [
        atividade('b1', 'br-rio-passeio-de-barco', paraMinutos('09:00'), 240),
      ]),
    );
    expect(codigos(alertas([d]))).not.toContain('horario-fixo-de-saida');
  });
});

describe('erro: voo-apos-mergulho', () => {
  function diasComMergulhoEVoo(
    horaDoVoo: string,
    diaDoVoo: string,
    horaDoMergulho = '09:00',
  ): Dia[] {
    const voo: Bloco = {
      id: 'b-voo',
      tipo: 'trecho',
      modal: 'voo',
      deCidadeId: 'rio',
      paraCidadeId: 'sao-paulo',
      startMin: paraMinutos(horaDoVoo),
      durationMin: 300,
      statusDeReserva: 'reservado',
    };
    const d1 = comHospedagem(
      dia('d1', QUARTA, 'rio', [
        atividade('b-mergulho', 'br-rio-mergulho', paraMinutos(horaDoMergulho), 180),
      ]),
    );
    const d2 = comHospedagem(dia('d2', '2026-11-19', 'rio', [voo]));
    return diaDoVoo === 'd1'
      ? [comHospedagem({ ...d1, blocos: [...d1.blocos, voo] })]
      : [d1, d2];
  }

  it('acusa voo no mesmo dia do mergulho', () => {
    const a = pegar(alertas(diasComMergulhoEVoo('18:00', 'd1')), 'voo-apos-mergulho');
    expect(a?.nivel).toBe('erro');
    expect(a?.mensagem).toMatch(/18 h antes de voar/);
    expect(a?.mensagem).toMatch(/DAN/);
  });

  it('acusa voo na manha seguinte quando o mergulho foi no fim da tarde', () => {
    // Mergulho das 16:00 as 19:00; voo as 08:00 do dia seguinte = 13 h depois.
    const a = pegar(alertas(diasComMergulhoEVoo('08:00', 'd2', '16:00')), 'voo-apos-mergulho');
    expect(a?.titulo).toMatch(/13\.0 h depois/);
  });

  it('nao acusa voo na manha seguinte quando o mergulho foi de manha', () => {
    // Mergulho das 09:00 as 12:00; voo as 08:00 do dia seguinte = 20 h depois.
    expect(codigos(alertas(diasComMergulhoEVoo('08:00', 'd2')))).not.toContain('voo-apos-mergulho');
  });

  it('nao acusa voo no dia seguinte a noite', () => {
    expect(codigos(alertas(diasComMergulhoEVoo('20:00', 'd2')))).not.toContain('voo-apos-mergulho');
  });
});

describe('atencao: altitude-no-primeiro-dia', () => {
  it('avisa quando o primeiro dia e numa cidade alta', () => {
    const d = comHospedagem(dia('d1', QUARTA, 'altiplano', []));
    const a = pegar(alertas([d]), 'altitude-no-primeiro-dia');
    expect(a?.titulo).toMatch(/3\.400 m/);
    expect(a?.mensagem).toMatch(/evite alcool/);
  });

  it('avisa tambem quando se sobe de uma vez de uma cidade baixa', () => {
    const d1 = comHospedagem(dia('d1', QUARTA, 'rio', []));
    const d2 = comHospedagem(dia('d2', '2026-11-19', 'altiplano', []));
    const a = pegar(alertas([d1, d2]), 'altitude-no-primeiro-dia');
    expect(a?.mensagem).toMatch(/subiu 3\.398 m de uma vez/);
  });
});

describe('atencao: item-fora-da-cidade-base', () => {
  it('acusa atividade noutra cidade sem trecho agendado', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-rio-copacabana', paraMinutos('10:00'), 120),
      ]),
    );
    const a = pegar(alertas([d]), 'item-fora-da-cidade-base');
    expect(a?.mensagem).toMatch(/dorme em Sao Paulo/);
    expect(a?.correcoes.map((c) => c.tipo)).toContain('inserir-trecho');
  });

  it('cala quando o dia tem a troca de cidade agendada', () => {
    const voo: Bloco = {
      id: 'b-voo',
      tipo: 'trecho',
      modal: 'voo',
      deCidadeId: 'sao-paulo',
      paraCidadeId: 'rio',
      startMin: paraMinutos('06:00'),
      durationMin: 300,
      statusDeReserva: 'reservado',
    };
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        voo,
        atividade('b1', 'br-rio-copacabana', paraMinutos('14:00'), 120),
      ]),
    );
    expect(codigos(alertas([d]))).not.toContain('item-fora-da-cidade-base');
  });
});

describe('atencao: noite-sem-hospedagem', () => {
  it('acusa dia sem hospedagem, menos o ultimo', () => {
    const d1 = dia('d1', QUARTA, 'sao-paulo', []);
    const d2 = dia('d2', '2026-11-19', 'sao-paulo', []);
    const lista = alertas([d1, d2]).filter((a) => a.codigo === 'noite-sem-hospedagem');
    expect(lista).toHaveLength(1);
    expect(lista[0]?.diaId).toBe('d1');
  });
});

describe('dica: cidade-abaixo-do-minimo-de-noites', () => {
  it('avisa quando fica menos noites que o recomendado', () => {
    const d = comHospedagem(dia('d1', QUARTA, 'rio', []));
    const a = pegar(alertas([d]), 'cidade-abaixo-do-minimo-de-noites');
    expect(a?.nivel).toBe('dica');
    expect(a?.titulo).toMatch(/1 noite\(s\) em Rio de Janeiro/);
  });
});

describe('atencao: dia-sobrecarregado', () => {
  it('usa o teto do ritmo do viajante', () => {
    const blocos = [
      atividade('b1', 'br-sp-pinacoteca', paraMinutos('06:00'), 360),
      atividade('b2', 'br-sp-almoco', paraMinutos('12:30'), 420),
    ];
    const d = comHospedagem(dia('d1', QUARTA, 'sao-paulo', blocos));
    // ritmo "intenso" = teto de 12 h
    const a = pegar(alertas([d]), 'dia-sobrecarregado');
    expect(a?.mensagem).toMatch(/ate 12 h por dia/);
  });
});

describe('dica: dia-sem-refeicao', () => {
  it('avisa quando o viajante esta ocupado na hora do almoco', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-pinacoteca', paraMinutos('11:00'), 240),
      ]),
    );
    const a = alertas([d]).find((x) => x.codigo === 'dia-sem-refeicao' && x.titulo.includes('almoco'));
    expect(a?.nivel).toBe('dica');
  });

  it('nao avisa quando ha restaurante agendado na janela', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-almoco', paraMinutos('12:00'), 60),
      ]),
    );
    const almoco = alertas([d]).find(
      (x) => x.codigo === 'dia-sem-refeicao' && x.titulo.includes('almoco'),
    );
    expect(almoco).toBeUndefined();
  });
});

describe('atencao: sono-insuficiente', () => {
  it('acusa menos de 6 h entre o fim de um dia e o inicio do outro', () => {
    const d1 = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [atividade('b1', 'br-sp-almoco', paraMinutos('22:00'), 120)]),
    );
    const d2 = comHospedagem(
      dia('d2', '2026-11-19', 'sao-paulo', [
        atividade('b2', 'br-sp-pinacoteca', paraMinutos('05:00'), 90),
      ]),
    );
    const a = pegar(alertas([d1, d2]), 'sono-insuficiente');
    expect(a?.titulo).toMatch(/5\.0 h/);
  });
});

describe('alertas vindos do banco de destino', () => {
  it('dica: clima-do-mes aparece quando o mes pesa na decisao', () => {
    const d = comHospedagem(dia('d1', QUARTA, 'rio', []));
    const a = pegar(alertas([d]), 'clima-do-mes');
    expect(a?.titulo).toMatch(/290 mm em 18 dias/);
    expect(a?.mensagem).toMatch(/Plano B/);
  });

  it('situacao-atual-da-cidade aparece com a data de verificacao', () => {
    const d = comHospedagem(dia('d1', QUARTA, 'rio', []));
    const a = pegar(alertas([d]), 'situacao-atual-da-cidade');
    expect(a?.nivel).toBe('atencao');
    expect(a?.mensagem).toMatch(/verificado em 2026-10-08/);
  });

  it('evento-desaconselhado-no-dia aparece para evento marcado como evite', () => {
    const d = comHospedagem(dia('d1', QUARTA, 'sao-paulo', []));
    const a = pegar(alertas([d]), 'evento-desaconselhado-no-dia');
    expect(a?.nivel).toBe('atencao');
    expect(a?.titulo).toBe('Feriado de teste');
  });

  it('precisa-reservar vira atencao quando o item esgota rapido', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-show-com-reserva', paraMinutos('20:00'), 120),
      ]),
    );
    const a = pegar(alertas([d]), 'precisa-reservar');
    expect(a?.nivel).toBe('atencao');
    expect(a?.mensagem).toMatch(/30 dia\(s\) de antecedencia/);
  });

  it('precisa-reservar some quando o bloco ja esta reservado', () => {
    const bloco: Bloco = {
      id: 'b1',
      tipo: 'atividade',
      itemId: 'br-sp-show-com-reserva',
      startMin: paraMinutos('20:00'),
      durationMin: 120,
      statusDeReserva: 'reservado',
    };
    const d = comHospedagem(dia('d1', QUARTA, 'sao-paulo', [bloco]));
    expect(codigos(alertas([d]))).not.toContain('precisa-reservar');
  });
});

describe('atencao: orcamento-estourado', () => {
  it('acusa quando ate o melhor caso passa do teto', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [atividade('b1', 'br-sp-caro', paraMinutos('10:00'), 90)]),
    );
    const a = pegar(
      alertas([d], (v) => ({
        ...v,
        orcamento: { moeda: 'BRL', porPessoa: 1000, incluiVoosInternacionais: true },
      })),
      'orcamento-estourado',
    );
    expect(a?.nivel).toBe('atencao');
    // 2 pessoas x R$ 5.000 = R$ 10.000 contra teto de R$ 2.000
    expect(a?.mensagem).toMatch(/R\$\s?10\.000/);
  });

  it('cala quando nao ha orcamento definido', () => {
    const d = comHospedagem(
      dia('d1', QUARTA, 'sao-paulo', [atividade('b1', 'br-sp-caro', paraMinutos('10:00'), 90)]),
    );
    expect(codigos(alertas([d]))).not.toContain('orcamento-estourado');
  });
});

describe('ordem dos alertas', () => {
  it('erro vem antes de atencao, que vem antes de dica', () => {
    const d = comHospedagem(
      dia('d1', SEGUNDA, 'sao-paulo', [
        atividade('b1', 'br-sp-museu-fecha-segunda', paraMinutos('12:00'), 20),
        atividade('b2', 'br-rio-copacabana', paraMinutos('13:00'), 120),
      ]),
    );
    const niveis = alertas([d]).map((a) => a.nivel);
    const ordem = { erro: 0, atencao: 1, dica: 2 };
    for (let i = 1; i < niveis.length; i += 1) {
      expect(ordem[niveis[i]!]).toBeGreaterThanOrEqual(ordem[niveis[i - 1]!]);
    }
  });
});
