import { describe, expect, it } from 'vitest';
import { estimarDeslocamento } from './deslocamento.ts';
import { atividade, dia, pacoteDeTeste, viagemDeTeste } from './fixtures-de-teste.ts';
import { resolverDia } from './resolver-dia.ts';
import { paraMinutos } from './tempo.ts';

const ALMOCO = 'br-sp-almoco';
const PRAIA = 'br-rio-copacabana';
const PINACOTECA = 'br-sp-pinacoteca';
const SEM_COORDENADA = 'br-sp-sem-coordenada';

describe('o caso que o dono do produto pediu: almoco em Sao Paulo, praia no Rio', () => {
  const pacote = pacoteDeTeste();
  const diaDoConflito = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-praia', PRAIA, paraMinutos('14:00'), 120),
  ]);
  const viagem = viagemDeTeste([diaDoConflito]);
  const resolvido = resolverDia(viagem, diaDoConflito, pacote, { incluirHospedagem: false });

  const lacuna = resolvido.lacunas.find((l) => l.id === 'b-almoco>b-praia');

  it('cria a lacuna entre os dois blocos', () => {
    expect(lacuna).toBeDefined();
    expect(lacuna?.minutosDisponiveis).toBe(60);
  });

  it('detecta que o deslocamento NAO cabe', () => {
    expect(lacuna?.cabe).toBe(false);
    expect(lacuna?.faltamMin).toBeGreaterThan(300);
  });

  it('sabe que e um deslocamento entre cidades', () => {
    expect(lacuna?.deslocamento?.entreCidades).toBe(true);
  });

  it('avisa que nao existe trecho cadastrado, em vez de fingir precisao', () => {
    expect(lacuna?.deslocamento?.camada).toBe('estimativa');
    expect(lacuna?.deslocamento?.confianca).toBe('estimado');
    expect(lacuna?.deslocamento?.avisos.join(' ')).toMatch(/nenhum trecho cadastrado/i);
  });

  it('explica a conta em vez de so dar o numero', () => {
    const passos = lacuna?.deslocamento?.passos ?? [];
    expect(passos.map((p) => p.rotulo)).toEqual([
      'distancia em linha reta',
      'fator de rota padrao do app',
      'distancia estimada',
      'velocidade media considerada',
    ]);
    // Sao Paulo ao Rio sao uns 360 km em linha reta.
    expect(passos[0]?.valor).toMatch(/^3[0-9]{2} km$/);
  });

  it('o resumo e uma frase em portugues, pronta para a tela', () => {
    expect(lacuna?.deslocamento?.resumo).toMatch(/Sao Paulo a Rio de Janeiro/);
    expect(lacuna?.deslocamento?.resumo).toMatch(/estimativa grosseira/);
  });

  it('soma os minutos que faltam no total do dia', () => {
    expect(resolvido.minutosEmFalta).toBe(lacuna?.faltamMin);
  });
});

describe('mesmo par de cidades, agora com voo cadastrado', () => {
  const pacote = pacoteDeTeste({ comTrechoAereo: true });
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-praia', PRAIA, paraMinutos('14:00'), 120),
  ]);
  const resolvido = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });
  const lacuna = resolvido.lacunas[0];

  it('usa a duracao porta a porta do banco, nao a linha reta', () => {
    expect(lacuna?.deslocamento?.camada).toBe('trecho-entre-cidades');
    expect(lacuna?.deslocamento?.minutos).toBe(300);
  });

  it('continua nao cabendo em 60 minutos, e diz quanto falta', () => {
    expect(lacuna?.cabe).toBe(false);
    expect(lacuna?.faltamMin).toBe(240);
  });

  it('cita a fonte do trecho', () => {
    expect(lacuna?.deslocamento?.fontes.length).toBeGreaterThan(0);
  });
});

describe('deslocamento dentro da mesma cidade', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-pina', PINACOTECA, paraMinutos('14:00'), 90),
  ]);
  const resolvido = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });
  const lacuna = resolvido.lacunas[0];

  it('cabe folgado e sobra tempo livre', () => {
    expect(lacuna?.cabe).toBe(true);
    expect(lacuna?.minutosLivres).toBeGreaterThan(40);
  });

  it('escolhe carro de app porque 1,49 km passa do limite de caminhada', () => {
    expect(lacuna?.deslocamento?.modal).toBe('carro-app');
    expect(lacuna?.deslocamento?.passos[0]?.valor).toBe('1,5 km');
  });

  it('usa o fator de rota da propria cidade e diz isso', () => {
    const resumo = lacuna?.deslocamento?.resumo ?? '';
    expect(resumo).toMatch(/tracado real de Sao Paulo/);
    const passos = lacuna?.deslocamento?.passos ?? [];
    expect(passos.find((p) => p.rotulo.includes('fator de rota'))?.estimado).toBe(false);
  });
});

describe('quando falta coordenada, o motor se cala em vez de chutar', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-bar', SEM_COORDENADA, paraMinutos('14:00'), 90),
  ]);
  const resolvido = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });
  const lacuna = resolvido.lacunas[0];

  it('nao inventa um numero', () => {
    expect(lacuna?.deslocamento?.camada).toBe('sem-dados');
    expect(lacuna?.deslocamento?.minutos).toBeNull();
  });

  it('nao acusa conflito falso', () => {
    expect(lacuna?.cabe).toBe(true);
    expect(resolvido.minutosEmFalta).toBe(0);
  });

  it('diz qual lugar esta sem coordenada', () => {
    expect(lacuna?.deslocamento?.resumo).toMatch(/Bar sem endereco/);
  });
});

describe('escolha do usuario vence o estimador', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-pina', PINACOTECA, paraMinutos('14:00'), 90),
  ]);

  it('respeita o modal escolhido para aquela lacuna', () => {
    const viagem = viagemDeTeste([d], { 'b-almoco>b-pina': { modal: 'carro-app' } });
    const lacuna = resolverDia(viagem, d, pacote, { incluirHospedagem: false }).lacunas[0];
    expect(lacuna?.deslocamento?.modal).toBe('carro-app');
  });

  it('respeita os minutos informados a mao', () => {
    const viagem = viagemDeTeste([d], {
      'b-almoco>b-pina': { modal: 'carro-app', minutosManuais: 35 },
    });
    const lacuna = resolverDia(viagem, d, pacote, { incluirHospedagem: false }).lacunas[0];
    expect(lacuna?.deslocamento?.minutos).toBe(35);
    expect(lacuna?.deslocamento?.camada).toBe('informado-pelo-usuario');
    expect(lacuna?.deslocamento?.resumo).toMatch(/que voce informou/);
  });
});

describe('o id da lacuna e estavel, porque e a chave da escolha do usuario', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-pina', PINACOTECA, paraMinutos('14:00'), 90),
  ]);

  it('nao muda quando o bloco e movido no horario', () => {
    const antes = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });
    const movido = {
      ...d,
      blocos: d.blocos.map((b) =>
        b.id === 'b-pina' ? { ...b, startMin: paraMinutos('16:00') } : b,
      ),
    };
    const depois = resolverDia(viagemDeTeste([movido]), movido, pacote, {
      incluirHospedagem: false,
    });
    expect(depois.lacunas[0]?.id).toBe(antes.lacunas[0]?.id);
    expect(depois.lacunas[0]?.minutosDisponiveis).toBeGreaterThan(
      antes.lacunas[0]?.minutosDisponiveis ?? 0,
    );
  });
});

describe('sobreposicao de blocos', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 120),
    atividade('b-pina', PINACOTECA, paraMinutos('13:00'), 90),
  ]);
  const resolvido = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });

  it('mede quantos minutos os blocos se cruzam', () => {
    expect(resolvido.sobreposicoes).toEqual([{ a: 'b-almoco', b: 'b-pina', minutos: 60 }]);
  });
});

describe('trajeto de ida e volta da hospedagem', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-pina', PINACOTECA, paraMinutos('10:00'), 90),
  ]);
  const resolvido = resolverDia(viagemDeTeste([d]), d, pacote);

  it('cria a saida da hospedagem e a volta para ela', () => {
    expect(resolvido.lacunas.map((l) => l.id)).toEqual([
      'hospedagem-inicio>b-pina',
      'b-pina>hospedagem-fim',
    ]);
    expect(resolvido.lacunas.map((l) => l.tipo)).toEqual([
      'saida-da-hospedagem',
      'volta-para-hospedagem',
    ]);
  });

  it('conta esses trajetos no total de deslocamento do dia', () => {
    expect(resolvido.minutosEmDeslocamento).toBeGreaterThan(0);
  });

  it('NAO marca conflito nesses trajetos: eles nao disputam espaco com nada', () => {
    // Antes esta regra existir, todo dia com hospedagem nascia com um
    // conflito falso, porque o intervalo disponivel era zero por construcao.
    expect(resolvido.lacunas.every((l) => l.cabe)).toBe(true);
    expect(resolvido.minutosEmFalta).toBe(0);
  });

  it('responde "a que horas sair" em vez de "cabe?"', () => {
    const saida = resolvido.lacunas[0];
    const minutosDeTrajeto = saida?.deslocamento?.minutos ?? 0;
    expect(saida?.horarioDeSaidaMin).toBe(paraMinutos('10:00') - minutosDeTrajeto);
  });

  it('responde "a que horas chego de volta"', () => {
    const volta = resolvido.lacunas[1];
    const minutosDeTrajeto = volta?.deslocamento?.minutos ?? 0;
    expect(volta?.horarioDeChegadaMin).toBe(paraMinutos('11:30') + minutosDeTrajeto);
  });

  it('nao infla o tempo livre do dia com esses trajetos', () => {
    expect(resolvido.minutosLivres).toBe(0);
  });
});

describe('totais do dia', () => {
  const pacote = pacoteDeTeste();
  const d = dia('d1', '2026-11-18', 'sao-paulo', [
    atividade('b-almoco', ALMOCO, paraMinutos('12:00'), 60),
    atividade('b-pina', PINACOTECA, paraMinutos('14:00'), 90),
  ]);
  const resolvido = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });

  it('soma as atividades', () => {
    expect(resolvido.minutosEmAtividades).toBe(150);
  });

  it('o tempo livre e a lacuna menos o deslocamento', () => {
    const lacuna = resolvido.lacunas[0];
    expect(resolvido.minutosLivres).toBe(
      lacuna!.minutosDisponiveis - (lacuna!.deslocamento?.minutos ?? 0),
    );
  });
});

describe('estimarDeslocamento direto', () => {
  const pacote = pacoteDeTeste();

  it('anda a pe abaixo de 1,2 km e pega carro acima disso', () => {
    const perto = estimarDeslocamento(
      { nome: 'A', cidadeId: 'sao-paulo', coords: { lat: -23.5505, lng: -46.6333 } },
      { nome: 'B', cidadeId: 'sao-paulo', coords: { lat: -23.5545, lng: -46.6363 } },
      { pacote },
    );
    const longe = estimarDeslocamento(
      { nome: 'A', cidadeId: 'sao-paulo', coords: { lat: -23.5505, lng: -46.6333 } },
      { nome: 'B', cidadeId: 'sao-paulo', coords: { lat: -23.6505, lng: -46.7333 } },
      { pacote },
    );
    expect(perto.modal).toBe('a-pe');
    expect(longe.modal).toBe('carro-app');
  });

  it('nunca devolve zero minuto para dois pontos diferentes', () => {
    const d = estimarDeslocamento(
      { nome: 'A', cidadeId: 'sao-paulo', coords: { lat: -23.5505, lng: -46.6333 } },
      { nome: 'B', cidadeId: 'sao-paulo', coords: { lat: -23.5506, lng: -46.6334 } },
      { pacote },
    );
    expect(d.minutos).toBeGreaterThanOrEqual(1);
  });
});

describe('melhoria 1: matriz de rotas reais nao atropela a caminhada', () => {
  function pacoteComMatriz() {
    const p = pacoteDeTeste();
    const sp = p.cidades.find((c) => c.id === 'sao-paulo')!;
    // A matriz calculada so tem rota de CARRO: e o que o servidor publico
    // de roteamento oferece.
    sp.matrizInterna = [
      {
        de: 'br-sp-almoco',
        para: 'br-sp-pinacoteca',
        modal: 'carro-app',
        minutos: 7,
        fontes: [{ url: 'https://project-osrm.org/' }],
      },
      {
        de: 'br-sp-almoco',
        para: 'br-sp-perto',
        modal: 'carro-app',
        minutos: 2,
        fontes: [{ url: 'https://project-osrm.org/' }],
      },
    ];
    // Um item a 200 m do almoco: distancia de caminhada.
    p.itens.push({
      ...p.itens.find((i) => i.id === 'br-sp-pinacoteca')!,
      id: 'br-sp-perto',
      nome: 'Banca da esquina',
      coords: { lat: -23.5493, lng: -46.6361 },
    });
    return p;
  }

  it('usa a rota real quando a distancia pede carro', () => {
    const pacote = pacoteComMatriz();
    const d = dia('d1', '2026-11-18', 'sao-paulo', [
      atividade('b1', ALMOCO, paraMinutos('12:00'), 60),
      atividade('b2', PINACOTECA, paraMinutos('14:00'), 90),
    ]);
    const lacuna = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false })
      .lacunas[0];
    expect(lacuna?.deslocamento?.camada).toBe('matriz-da-cidade');
    expect(lacuna?.deslocamento?.minutos).toBe(7);
  });

  it('ignora a rota de carro quando a pe e o natural, mesmo havendo par na matriz', () => {
    const pacote = pacoteComMatriz();
    const d = dia('d1', '2026-11-18', 'sao-paulo', [
      atividade('b1', ALMOCO, paraMinutos('12:00'), 60),
      atividade('b2', 'br-sp-perto', paraMinutos('14:00'), 30),
    ]);
    const lacuna = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false })
      .lacunas[0];
    expect(lacuna?.deslocamento?.modal).toBe('a-pe');
    expect(lacuna?.deslocamento?.camada).toBe('estimativa');
  });

  it('respeita o carro quando o usuario escolhe carro no trecho curto', () => {
    const pacote = pacoteComMatriz();
    const d = dia('d1', '2026-11-18', 'sao-paulo', [
      atividade('b1', ALMOCO, paraMinutos('12:00'), 60),
      atividade('b2', 'br-sp-perto', paraMinutos('14:00'), 30),
    ]);
    const viagem = viagemDeTeste([d], { 'b1>b2': { modal: 'carro-app' } });
    const lacuna = resolverDia(viagem, d, pacote, { incluirHospedagem: false }).lacunas[0];
    expect(lacuna?.deslocamento?.camada).toBe('matriz-da-cidade');
    expect(lacuna?.deslocamento?.minutos).toBe(2);
  });
});

describe('deslocamento que o motor nao consegue calcular', () => {
  it('conta os trechos sem dados em vez de somar zero', () => {
    const pacote = pacoteDeTeste();
    // Dois itens sem coordenada: o motor nao tem de onde tirar a distancia.
    for (const item of pacote.itens) delete (item as { coords?: unknown }).coords;

    const d = dia('d1', '2026-11-18', 'sao-paulo', [
      atividade('b1', ALMOCO, paraMinutos('12:00'), 60),
      atividade('b2', PINACOTECA, paraMinutos('15:00'), 90),
    ]);
    const r = resolverDia(viagemDeTeste([d]), d, pacote, { incluirHospedagem: false });

    expect(r.minutosEmDeslocamento).toBe(0);
    // O que importa: o dia NAO afirma que nao ha deslocamento, afirma que
    // nao sabe. Zero somado em silencio deixa o dia otimista de graca.
    expect(r.trajetosSemDados).toBeGreaterThan(0);
  });
});
