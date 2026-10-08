import { describe, expect, it } from 'vitest';
import { atividade, dia, viagemDeTeste } from './fixtures-de-teste.ts';
import { pacoteParaRegras } from './fixtures-regras.ts';
import { avaliarIdade, precoAindaUtil, procedenciaDoItem } from './procedencia.ts';
import { compararRoteiros, planoBDeChuva, resumirRoteiro } from './sugestoes.ts';
import { paraMinutos } from './tempo.ts';

const pacote = pacoteParaRegras();
const QUARTA = '2026-11-18';
const HOJE = '2026-10-08';

describe('melhoria 6: idade do dado', () => {
  it('conta em dias quando e recente e em meses quando nao e', () => {
    expect(avaliarIdade('2026-10-08', HOJE).rotulo).toBe('coletado hoje');
    expect(avaliarIdade('2026-10-07', HOJE).rotulo).toBe('coletado ontem');
    expect(avaliarIdade('2026-09-28', HOJE).rotulo).toBe('coletado ha 10 dias');
    expect(avaliarIdade('2026-06-08', HOJE).rotulo).toBe('coletado ha 4 meses');
  });

  it('classifica em tres niveis', () => {
    expect(avaliarIdade('2026-10-01', HOJE).nivel).toBe('recente');
    expect(avaliarIdade('2026-01-01', HOJE).nivel).toBe('envelhecendo');
    expect(avaliarIdade('2024-01-01', HOJE).nivel).toBe('velho');
  });

  it('nao devolve idade negativa para dado do futuro', () => {
    expect(avaliarIdade('2027-01-01', HOJE).dias).toBe(0);
  });

  it('a frase muda de tom conforme o dado envelhece', () => {
    const item = pacote.itens.find((i) => i.id === 'br-sp-pinacoteca')!;
    const recente = procedenciaDoItem({ ...item, coletadoEm: '2026-10-01' }, HOJE);
    const velho = procedenciaDoItem({ ...item, coletadoEm: '2024-01-01' }, HOJE);
    expect(recente.frase).toMatch(/^verificado, coletado ha 7 dias/);
    expect(velho.frase).toMatch(/confirme antes de contar com isto/);
  });

  it('a confirmacao do usuario vence o banco na exibicao', () => {
    const item = pacote.itens.find((i) => i.id === 'br-sp-pinacoteca')!;
    const viagem = {
      ...viagemDeTeste([]),
      confirmacoes: {
        'br-sp-pinacoteca': [
          { campo: 'preco', confirmadoEm: '2026-10-05', valorApurado: 'R$ 40', comoConfirmou: 'telefone' },
        ],
      },
    };
    const p = procedenciaDoItem({ ...item, coletadoEm: '2024-01-01' }, HOJE, viagem);
    expect(p.frase).toBe('Voce confirmou preco em 2026-10-05.');
    expect(p.confirmacoesDoUsuario).toHaveLength(1);
  });

  it('preco de mais de um ano deixa de ser util', () => {
    const caro = pacote.itens.find((i) => i.id === 'br-sp-caro')!;
    expect(precoAindaUtil(caro, HOJE)).toBe(true);
    expect(precoAindaUtil(caro, '2028-01-01')).toBe(false);
  });
});

describe('melhoria 4: plano B de chuva', () => {
  it('sugere coberto no lugar do que depende de clima, na mesma cidade', () => {
    const d = dia('d1', QUARTA, 'rio', [
      atividade('b1', 'br-rio-copacabana', paraMinutos('10:00'), 120),
    ]);
    const plano = planoBDeChuva(viagemDeTeste([d]), 'd1', pacote);
    expect(plano?.trocas).toHaveLength(1);
    expect(plano?.trocas[0]?.itemAtual).toBe('Praia de Copacabana');
    for (const alt of plano!.trocas[0]!.alternativas) {
      expect(alt.item.cidadeId).toBe('rio');
      expect(alt.item.restricoes.dependeDeClima).toBeFalsy();
    }
  });

  it('cita o numero de chuva do mes como motivo', () => {
    const d = dia('d1', QUARTA, 'rio', [
      atividade('b1', 'br-rio-copacabana', paraMinutos('10:00'), 120),
    ]);
    expect(planoBDeChuva(viagemDeTeste([d]), 'd1', pacote)?.motivo).toMatch(
      /290 mm em 18 dias de chuva/,
    );
  });

  it('nao sugere alternativa mais longa que o bloco vago', () => {
    const d = dia('d1', QUARTA, 'rio', [
      atividade('b1', 'br-rio-copacabana', paraMinutos('10:00'), 50),
    ]);
    const plano = planoBDeChuva(viagemDeTeste([d]), 'd1', pacote);
    for (const alt of plano?.trocas[0]?.alternativas ?? []) {
      expect(alt.item.duracao!.min).toBeLessThanOrEqual(50);
    }
  });

  it('nao sugere item que o usuario descartou', () => {
    const d = dia('d1', QUARTA, 'rio', [
      atividade('b1', 'br-rio-copacabana', paraMinutos('10:00'), 300),
    ]);
    const viagem = { ...viagemDeTeste([d]), descartados: { 'br-rio-mergulho': 'ja-fui' as const } };
    const plano = planoBDeChuva(viagem, 'd1', pacote);
    const ids = plano?.trocas.flatMap((t) => t.alternativas.map((a) => a.item.id)) ?? [];
    expect(ids).not.toContain('br-rio-mergulho');
  });

  it('avisa quando nao ha nada ao ar livre para trocar', () => {
    const d = dia('d1', QUARTA, 'sao-paulo', [
      atividade('b1', 'br-sp-museu-fecha-segunda', paraMinutos('10:00'), 90),
    ]);
    expect(planoBDeChuva(viagemDeTeste([d]), 'd1', pacote)?.nadaParaTrocar).toBe(true);
  });
});

describe('melhoria 19: comparar dois roteiros', () => {
  const comConflito = viagemDeTeste([
    {
      ...dia('d1', QUARTA, 'sao-paulo', [
        atividade('b1', 'br-sp-almoco', paraMinutos('12:00'), 60),
        atividade('b2', 'br-rio-copacabana', paraMinutos('14:00'), 120),
      ]),
      hospedagem: { nome: 'Hotel', moeda: 'BRL', confirmada: true },
    },
  ]);
  const semConflito = {
    ...viagemDeTeste([
      {
        ...dia('d1', QUARTA, 'sao-paulo', [
          atividade('b1', 'br-sp-almoco', paraMinutos('12:00'), 60),
          atividade('b2', 'br-sp-pinacoteca', paraMinutos('14:00'), 90),
        ]),
        hospedagem: { nome: 'Hotel', moeda: 'BRL', confirmada: true },
      },
    ]),
    nome: 'Versao calma',
  };

  it('resume cada roteiro em numeros comparaveis', () => {
    const r = resumirRoteiro(semConflito, pacote);
    expect(r.dias).toBe(1);
    expect(r.noitesPorCidade['sao-paulo']).toBe(1);
    expect(r.minutosEmAtividades).toBe(150);
  });

  it('diz em que cada versao ganha, em portugues', () => {
    const c = compararRoteiros(comConflito, semConflito, pacote);
    expect(c.a.erros).toBeGreaterThan(c.b.erros);
    expect(c.diferencas.join(' ')).toMatch(/Conflitos: .* melhor em Versao calma/);
  });

  it('avisa quando a comparacao de custo e fraca por falta de preco', () => {
    const c = compararRoteiros(comConflito, semConflito, pacote);
    const frase = c.diferencas.find((d) => d.includes('sem preco'));
    if (frase) expect(frase).toMatch(/menos confiavel e a comparacao de custo/);
  });
});
