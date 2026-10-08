import { describe, expect, it } from 'vitest';
import { validarPacote } from './pacote.ts';

/**
 * Estes testes sao a prova negativa do validador: nao basta aceitar dado bom,
 * ele precisa REPROVAR dado sem procedencia, com referencia quebrada ou com
 * coordenada impossivel. E a garantia mecanica da regra "nao invente dado".
 */

const FONTE = [{ url: 'https://exemplo.gov.co/pagina' }];

function pacoteMinimo() {
  return {
    destino: {
      id: 'colombia',
      fontes: FONTE,
      coletadoEm: '2026-10-08',
      confianca: 'verificado',
      nome: 'Colombia',
      codigoPais: 'CO',
      moeda: 'COP',
      fuso: 'America/Bogota',
      fusoOffsetMinutos: -300,
      idiomas: ['es'],
      caixaDelimitadora: { latMin: -4.3, latMax: 13.5, lngMin: -82, lngMax: -66.8 },
      entrada: [
        {
          nacionalidade: 'BR',
          documento: 'passaporte',
          vistoNecessario: false,
          fontes: FONTE,
        },
      ],
      saude: {},
      seguranca: { orientacaoGeral: 'atencao normal de cidade grande' },
      dinheiro: {},
      conectividade: {},
    },
    regioes: [
      {
        id: 'caribe',
        fontes: FONTE,
        coletadoEm: '2026-10-08',
        confianca: 'verificado',
        nome: 'Caribe',
        descricaoCurta: 'Costa caribenha',
      },
    ],
    cidades: [
      {
        id: 'cartagena',
        fontes: FONTE,
        coletadoEm: '2026-10-08',
        confianca: 'verificado',
        nome: 'Cartagena',
        regiaoId: 'caribe',
        coords: { lat: 10.4, lng: -75.5 },
        altitudeM: 2,
        aeroportos: ['CTG'],
        comoCircular: 'a pe no centro, carro-app fora dele',
        fatoresDeslocamento: {
          'a-pe': { kmh: 4.5, fatorRota: 1.25 },
          'carro-app': { kmh: 20, fatorRota: 1.35 },
          'transporte-publico': { kmh: 14, fatorRota: 1.5 },
          'veiculo-alugado': { kmh: 22, fatorRota: 1.3 },
        },
        noitesRecomendadas: { min: 2, ideal: 3, max: 5 },
        climaPorMes: [
          {
            mes: 11,
            tempMinC: 25,
            tempMaxC: 31,
            chuvaMm: 120,
            diasDeChuva: 12,
            resumo: 'fim da temporada de chuvas',
            pesoNaDecisao: 'medio',
            fontes: FONTE,
          },
        ],
      },
    ],
    aeroportos: [
      {
        id: 'ctg',
        fontes: FONTE,
        coletadoEm: '2026-10-08',
        confianca: 'verificado',
        iata: 'CTG',
        nome: 'Rafael Nunez',
        cidadeNome: 'Cartagena',
        coords: { lat: 10.44, lng: -75.51 },
        tempoAoCentroMin: 20,
        antecedenciaDomesticaMin: 90,
        antecedenciaInternacionalMin: 180,
        desembarqueDomesticoMin: 25,
        desembarqueInternacionalMin: 60,
      },
    ],
    itens: [
      {
        id: 'co-ctg-exemplo',
        fontes: FONTE,
        coletadoEm: '2026-10-08',
        confianca: 'verificado',
        nome: 'Item de exemplo',
        cidadeId: 'cartagena',
        categoria: 'atracao',
        descricaoCurta: 'Usado apenas nos testes.',
        duracao: { min: 30, tipica: 60, max: 120 },
        coords: { lat: 10.42, lng: -75.55 },
      },
    ],
    trechos: [],
    voosInternacionais: [],
    calendario: [],
    hospedagem: [],
  };
}

function erros(bruto: unknown) {
  return validarPacote(bruto).problemas.filter((p) => p.nivel === 'erro');
}

function avisos(bruto: unknown) {
  return validarPacote(bruto).problemas.filter((p) => p.nivel === 'aviso');
}

describe('validarPacote', () => {
  it('aprova um pacote minimo coerente', () => {
    const resultado = validarPacote(pacoteMinimo());
    expect(erros(pacoteMinimo())).toEqual([]);
    expect(resultado.ok).toBe(true);
    expect(resultado.pacote?.itens).toHaveLength(1);
  });

  it('reprova item sem fontes', () => {
    const p = pacoteMinimo();
    p.itens[0]!.fontes = [];
    expect(validarPacote(p).ok).toBe(false);
  });

  it('reprova item sem fontes mesmo quando o resto esta perfeito', () => {
    const p = pacoteMinimo();
    delete (p.itens[0] as Record<string, unknown>).fontes;
    const resultado = validarPacote(p);
    expect(resultado.ok).toBe(false);
    expect(resultado.pacote).toBeUndefined();
  });

  it('reprova registro sem coletadoEm', () => {
    const p = pacoteMinimo();
    delete (p.itens[0] as Record<string, unknown>).coletadoEm;
    expect(validarPacote(p).ok).toBe(false);
  });

  it('reprova confianca fora do vocabulario', () => {
    const p = pacoteMinimo();
    p.itens[0]!.confianca = 'muito-verificado';
    expect(validarPacote(p).ok).toBe(false);
  });

  it('reprova item apontando para cidade inexistente', () => {
    const p = pacoteMinimo();
    p.itens[0]!.cidadeId = 'medellin';
    const lista = erros(p);
    expect(lista.some((e) => e.mensagem.includes('cidade inexistente: medellin'))).toBe(true);
  });

  it('reprova cidade apontando para regiao inexistente', () => {
    const p = pacoteMinimo();
    p.cidades[0]!.regiaoId = 'andes';
    expect(erros(p).some((e) => e.mensagem.includes('regiao inexistente: andes'))).toBe(true);
  });

  it('reprova id duplicado', () => {
    const p = pacoteMinimo();
    p.itens.push(structuredClone(p.itens[0]!));
    expect(erros(p).some((e) => e.mensagem.includes('id duplicado'))).toBe(true);
  });

  it('reprova coordenada fora da caixa delimitadora do destino', () => {
    const p = pacoteMinimo();
    // Rio de Janeiro, bem longe da Colombia.
    p.itens[0]!.coords = { lat: -22.9, lng: -43.2 };
    expect(erros(p).some((e) => e.mensagem.includes('fora da caixa delimitadora'))).toBe(true);
  });

  it('reprova aeroporto que a cidade cita mas nao existe no pacote', () => {
    const p = pacoteMinimo();
    p.cidades[0]!.aeroportos = ['ADZ'];
    expect(erros(p).some((e) => e.mensagem.includes('aeroporto inexistente: ADZ'))).toBe(true);
  });

  it('reprova faixa de preco invertida', () => {
    const p = pacoteMinimo();
    (p.itens[0] as Record<string, unknown>).preco = {
      moeda: 'COP',
      min: 50_000,
      max: 10_000,
      por: 'pessoa',
      coletadoEm: '2026-10-08',
      fontes: FONTE,
    };
    expect(validarPacote(p).ok).toBe(false);
  });

  it('reprova duracao incoerente', () => {
    const p = pacoteMinimo();
    p.itens[0]!.duracao = { min: 120, tipica: 60, max: 30 };
    expect(validarPacote(p).ok).toBe(false);
  });

  it('reprova imagem sem credito ou sem licenca', () => {
    const p = pacoteMinimo();
    (p.itens[0] as Record<string, unknown>).imagens = [
      {
        url: 'https://upload.wikimedia.org/foto.jpg',
        credito: '',
        licenca: 'CC BY-SA 4.0',
        fonte: 'https://commons.wikimedia.org/wiki/File:foto.jpg',
      },
    ];
    expect(validarPacote(p).ok).toBe(false);
  });

  it('reprova aluguel-veiculo sem o bloco aluguel', () => {
    const p = pacoteMinimo();
    p.itens[0]!.categoria = 'aluguel-veiculo';
    expect(erros(p).some((e) => e.mensagem.includes('exige o bloco aluguel'))).toBe(true);
  });

  it('reprova passeio sem o bloco passeio', () => {
    const p = pacoteMinimo();
    p.itens[0]!.categoria = 'passeio';
    expect(erros(p).some((e) => e.mensagem.includes('exige o bloco passeio'))).toBe(true);
  });

  it('reprova item gratuito que tambem tem preco', () => {
    const p = pacoteMinimo();
    const item = p.itens[0] as Record<string, unknown>;
    item.gratuito = true;
    item.preco = {
      moeda: 'COP',
      min: 10_000,
      max: 10_000,
      por: 'pessoa',
      coletadoEm: '2026-10-08',
      fontes: FONTE,
    };
    expect(erros(p).some((e) => e.mensagem.includes('gratuito nao pode ter preco'))).toBe(true);
  });

  it('reprova trecho ligando cidade que nao existe', () => {
    const p = pacoteMinimo();
    (p.trechos as unknown[]).push({
      id: 'ctg-adz',
      fontes: FONTE,
      coletadoEm: '2026-10-08',
      confianca: 'parcial',
      deCidadeId: 'cartagena',
      paraCidadeId: 'san-andres',
      modal: 'voo',
      duracaoPortaAPortaMin: 300,
    });
    expect(erros(p).some((e) => e.mensagem.includes('cidade inexistente: san-andres'))).toBe(true);
  });

  it('reprova evento com escopo desconhecido', () => {
    const p = pacoteMinimo();
    (p.calendario as unknown[]).push({
      id: 'festa-x',
      fontes: FONTE,
      coletadoEm: '2026-10-08',
      confianca: 'parcial',
      nome: 'Festa inventada',
      tipo: 'festa',
      dataInicio: '2026-11-11',
      escopo: 'cidade-que-nao-existe',
      impacto: {},
    });
    expect(erros(p).some((e) => e.mensagem.includes('escopo desconhecido'))).toBe(true);
  });

  it('apenas AVISA quando o item nao tem coordenada', () => {
    const p = pacoteMinimo();
    delete (p.itens[0] as Record<string, unknown>).coords;
    const resultado = validarPacote(p);
    expect(resultado.ok).toBe(true);
    expect(avisos(p).some((a) => a.mensagem.includes('sem coordenada'))).toBe(true);
  });

  it('apenas AVISA quando o preco nao tem fonte', () => {
    const p = pacoteMinimo();
    (p.itens[0] as Record<string, unknown>).preco = {
      moeda: 'COP',
      min: 35_000,
      max: 35_000,
      por: 'pessoa',
      coletadoEm: '2026-10-08',
      fontes: [],
    };
    const resultado = validarPacote(p);
    expect(resultado.ok).toBe(true);
    expect(avisos(p).some((a) => a.mensagem.includes('preco sem fonte'))).toBe(true);
  });

  it('apenas AVISA quando precisa reservar mas nao diz a antecedencia', () => {
    const p = pacoteMinimo();
    (p.itens[0] as Record<string, unknown>).reserva = { necessaria: true };
    const resultado = validarPacote(p);
    expect(resultado.ok).toBe(true);
    expect(avisos(p).some((a) => a.mensagem.includes('nao diz a antecedencia'))).toBe(true);
  });
});
