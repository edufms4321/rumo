import { describe, expect, it } from 'vitest';
import type { Item } from '../schema/item.ts';
import { atividade, dia, viagemDeTeste } from './fixtures-de-teste.ts';
import { pacoteParaRegras } from './fixtures-regras.ts';
import {
  assuntosPendentes,
  linkDeWhatsApp,
  listaDeBagagem,
  mensagemDeConfirmacao,
} from './geradores.ts';

const pacote = pacoteParaRegras();
const QUARTA = '2026-11-18';

function item(id: string): Item {
  const i = pacote.itens.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} nao existe na fixture`);
  return i;
}

describe('melhoria 13: mensagem pronta em espanhol', () => {
  it('descobre sozinho o que perguntar a partir dos buracos do item', () => {
    // A Pinacoteca da fixture nao tem preco nem horarios.
    const assuntos = assuntosPendentes(item('br-sp-pinacoteca'));
    expect(assuntos).toContain('preco');
    expect(assuntos).toContain('horario');
  });

  it('nao gera mensagem para item completo', () => {
    const completo: Item = {
      ...item('br-sp-caro'),
      horarios: { seg: [{ abre: '09:00', fecha: '17:00' }] },
      confianca: 'verificado',
      alertas: [],
    };
    expect(mensagemDeConfirmacao(completo)).toBeUndefined();
  });

  it('escreve em espanhol e traz a traducao para conferencia', () => {
    const m = mensagemDeConfirmacao(item('br-sp-pinacoteca'));
    expect(m?.texto).toMatch(/^Buenas! Soy de Brasil/);
    expect(m?.texto).toMatch(/Pinacoteca/);
    expect(m?.traducao).toMatch(/^Ola! Sou do Brasil/);
  });

  it('lista as perguntas em marcadores, nao numa frase corrida', () => {
    const m = mensagemDeConfirmacao(item('br-sp-pinacoteca'), ['preco', 'horario', 'reserva']);
    const linhas = m!.texto.split('\n');
    expect(linhas[0]).toMatch(/Queria confirmar sobre Pinacoteca:$/);
    expect(linhas.filter((l) => l.startsWith('- '))).toHaveLength(3);
    expect(linhas.at(-1)).toBe('Muchas gracias!');
    expect(m?.traducao).toMatch(/- se precisa reservar e com quanta antecedencia\?/);
  });

  it('pergunta sobre a CNH quando o item e aluguel de veiculo', () => {
    const locadora: Item = { ...item('br-sp-caro'), categoria: 'aluguel-veiculo' };
    const m = mensagemDeConfirmacao(locadora);
    expect(m?.texto).toMatch(/licencia de conducir brasilena/);
  });

  it('monta o link do WhatsApp com o texto ja escrito', () => {
    const comZap: Item = {
      ...item('br-sp-pinacoteca'),
      contato: { whatsapp: '+57 310 510 5555' },
    };
    const m = mensagemDeConfirmacao(comZap);
    const link = linkDeWhatsApp(m!);
    expect(link).toMatch(/^https:\/\/wa\.me\/573105105555\?text=Buenas/);
  });

  it('nao inventa link quando nao ha numero', () => {
    expect(linkDeWhatsApp(mensagemDeConfirmacao(item('br-sp-pinacoteca'))!)).toBeUndefined();
  });
});

describe('melhoria 17: lista de bagagem', () => {
  it('sai do clima real dos meses da viagem, nao de lista generica', () => {
    // O Rio da fixture tem 18 dias de chuva em novembro.
    const d = { ...dia('d1', QUARTA, 'rio', []), hospedagem: undefined };
    const lista = listaDeBagagem(viagemDeTeste([d]), pacote);
    const capa = lista.categorias.Roupa?.find((x) => x.nome.includes('Capa de chuva'));
    expect(capa?.porque).toMatch(/18 dias de chuva/);
    expect(capa?.essencial).toBe(true);
  });

  it('pede casaco quando alguma base tem minima baixa', () => {
    const d = dia('d1', QUARTA, 'rio', []);
    const lista = listaDeBagagem(viagemDeTeste([d]), pacote);
    // O Rio da fixture tem minima de 21 graus: nao pede casaco.
    expect(lista.categorias.Roupa?.some((x) => x.nome.includes('Casaco'))).toBeFalsy();
  });

  it('deriva da atividade agendada, com o motivo junto', () => {
    const d = dia('d1', QUARTA, 'rio', [
      atividade('b1', 'br-rio-mergulho', 540, 180),
      atividade('b2', 'br-rio-copacabana', 900, 120),
    ]);
    const lista = listaDeBagagem(viagemDeTeste([d]), pacote);
    const protetor = lista.categorias.Praia?.find((x) => x.nome.includes('Protetor solar'));
    expect(protetor?.porque).toMatch(/cenotes e areas protegidas/);
    expect(lista.categorias.Praia?.some((x) => x.nome.includes('snorkel'))).toBe(true);
  });

  it('nao pede equipamento de praia numa viagem sem praia', () => {
    const d = dia('d1', QUARTA, 'sao-paulo', [atividade('b1', 'br-sp-pinacoteca', 600, 90)]);
    const lista = listaDeBagagem(viagemDeTeste([d]), pacote);
    expect(lista.categorias.Praia).toBeUndefined();
  });

  it('sempre traz os documentos basicos', () => {
    const lista = listaDeBagagem(viagemDeTeste([dia('d1', QUARTA, 'rio', [])]), pacote);
    expect(lista.categorias.Documentos?.map((x) => x.nome)).toContain(
      'Passaporte e copia digital',
    );
  });

  it('acrescenta o visto quando o destino exige', () => {
    const comVisto = pacoteParaRegras();
    comVisto.destino.entrada = [
      {
        nacionalidade: 'BR',
        documento: 'Passaporte',
        vistoNecessario: true,
        comprovantesExigidos: [],
        fontes: [{ url: 'https://exemplo.test/v' }],
      },
    ];
    const lista = listaDeBagagem(viagemDeTeste([dia('d1', QUARTA, 'rio', [])]), comVisto);
    expect(lista.categorias.Documentos?.some((x) => x.nome.includes('Visto'))).toBe(true);
  });

  it('todo item da lista diz por que esta ali', () => {
    const d = dia('d1', QUARTA, 'rio', [atividade('b1', 'br-rio-mergulho', 540, 180)]);
    const lista = listaDeBagagem(viagemDeTeste([d]), pacote);
    for (const itens of Object.values(lista.categorias)) {
      for (const i of itens) expect(i.porque.length).toBeGreaterThan(5);
    }
  });
});
