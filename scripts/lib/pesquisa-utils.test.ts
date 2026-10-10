/**
 * Regressao do pior tipo de defeito que este projeto pode ter: perda
 * silenciosa de dado pesquisado.
 *
 * `converterHorarios` fazia `String(valor)` em cima do horario de cada dia.
 * Quando a onda de pesquisa gravava a forma estruturada
 * (`"seg": [{ abre: "07:00", fecha: "22:00" }]`), isso virava
 * "[object Object]", nenhum HH:MM casava, o dia saia AUSENTE do pacote — que
 * no schema significa "desconhecido" — e a string "[object Object]" era
 * gravada em `horariosObservacao`, dentro de /data, pronta para aparecer na
 * tela. Nove itens da onda da Bahia perderam horario assim; o pacote do
 * Nordeste tinha 4 itens com horario em 459.
 *
 * tsc e oxlint passam com esse bug: `String(objeto)` e codigo valido. So um
 * teste pega.
 */
import { describe, expect, it } from 'vitest';
import { converterHorarios, janelasEstruturadas } from './pesquisa-utils.ts';

describe('janelasEstruturadas', () => {
  it('le a forma que a pesquisa da Bahia usa', () => {
    expect(janelasEstruturadas([{ abre: '07:00', fecha: '22:00' }])).toEqual([
      { abre: '07:00', fecha: '22:00' },
    ]);
  });

  it('aceita um objeto solto, nao so array', () => {
    expect(janelasEstruturadas({ abre: '09:00', fecha: '18:00' })).toHaveLength(1);
  });

  it('descarta hora invalida em vez de gravar lixo', () => {
    expect(janelasEstruturadas([{ abre: '25:00', fecha: '99:99' }])).toEqual([]);
    expect(janelasEstruturadas([{ abre: 'manha', fecha: 'tarde' }])).toEqual([]);
  });

  it('descarta janela que atravessa a meia-noite, como o parser de prosa', () => {
    expect(janelasEstruturadas([{ abre: '22:00', fecha: '03:00' }])).toEqual([]);
  });

  it('nao se engana com prosa: devolve vazio e deixa o outro caminho agir', () => {
    expect(janelasEstruturadas('09:00-18:00')).toEqual([]);
  });
});

describe('converterHorarios', () => {
  it('a forma estruturada chega ao pacote', () => {
    const r = converterHorarios({
      seg: [{ abre: '07:00', fecha: '22:00' }],
      ter: [{ abre: '07:00', fecha: '22:00' }],
    });
    expect(r.horarios).toEqual({
      seg: [{ abre: '07:00', fecha: '22:00' }],
      ter: [{ abre: '07:00', fecha: '22:00' }],
    });
  });

  it('a observacao nunca sai como "[object Object]"', () => {
    const r = converterHorarios({ seg: [{ abre: '07:00', fecha: '22:00' }] });
    expect(r.horariosObservacao).not.toContain('[object Object]');
    expect(r.horariosObservacao).toBe('07:00-22:00');
  });

  it('a prosa continua funcionando igual', () => {
    const r = converterHorarios({ qua: '09:00-12:30 e 14:30-19:00' });
    expect(r.horarios).toEqual({
      qua: [
        { abre: '09:00', fecha: '12:30' },
        { abre: '14:30', fecha: '19:00' },
      ],
    });
  });

  it('"fechado" em prosa continua virando fechado', () => {
    expect(converterHorarios({ seg: 'fechado' }).horarios).toEqual({ seg: 'fechado' });
  });

  it('objeto sem abre/fecha nao inventa dia nem polui a observacao', () => {
    const r = converterHorarios({ seg: [{ qualquer: 'coisa' }] });
    expect(r.horarios).toBeUndefined();
    expect(r.horariosObservacao ?? '').not.toContain('[object Object]');
  });

  it('dia ausente continua ausente, que significa desconhecido', () => {
    const r = converterHorarios({ seg: [{ abre: '07:00', fecha: '22:00' }] });
    expect(Object.keys(r.horarios as object)).toEqual(['seg']);
  });
});
