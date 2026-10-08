/**
 * Fixtures dos testes do motor. Nao entram no app.
 *
 * Usam Sao Paulo e Rio de propósito: e o exemplo que o dono do produto deu
 * para o conflito de deslocamento ("almoco em Sao Paulo as 12h e praia no Rio
 * as 14h"), e a distancia grande torna o erro obvio.
 */
import type { PacoteDestino } from '../schema/pacote.ts';
import { VERSAO_SCHEMA_VIAGEM, type Bloco, type Dia, type Viagem } from '../schema/viagem.ts';

const FONTE = [{ url: 'https://exemplo.test/fonte' }];
const COMUM = { fontes: FONTE, coletadoEm: '2026-10-08', confianca: 'verificado' as const };

const FATORES_SP = {
  'a-pe': { kmh: 4.5, fatorRota: 1.3 },
  'carro-app': { kmh: 18, fatorRota: 1.45 },
  'transporte-publico': { kmh: 15, fatorRota: 1.5 },
  'veiculo-alugado': { kmh: 18, fatorRota: 1.45 },
};

export function pacoteDeTeste(opcoes: { comTrechoAereo?: boolean } = {}): PacoteDestino {
  return {
    destino: {
      ...COMUM,
      id: 'brasil',
      nome: 'Brasil',
      codigoPais: 'BR',
      moeda: 'BRL',
      fuso: 'America/Sao_Paulo',
      fusoOffsetMinutos: -180,
      idiomas: ['pt'],
      caixaDelimitadora: { latMin: -34, latMax: 5.3, lngMin: -74, lngMax: -34 },
      entrada: [
        { nacionalidade: 'BR', documento: 'RG', vistoNecessario: false, comprovantesExigidos: [], fontes: FONTE },
      ],
      saude: { vacinasRecomendadas: [], fontes: [] },
      seguranca: { orientacaoGeral: 'normal', golpesComuns: [], appsDeTransporte: [], fontes: [] },
      dinheiro: { fontes: [] },
      conectividade: { operadoras: [], fontes: [] },
      linksUteis: [],
    },
    regioes: [{ ...COMUM, id: 'sudeste', nome: 'Sudeste', descricaoCurta: 'Sudeste do Brasil' }],
    cidades: [
      {
        ...COMUM,
        id: 'sao-paulo',
        nome: 'Sao Paulo',
        regiaoId: 'sudeste',
        coords: { lat: -23.5505, lng: -46.6333 },
        altitudeM: 760,
        aeroportos: ['GRU'],
        bairros: [],
        comoCircular: 'metro e carro de app',
        fatoresDeslocamento: FATORES_SP,
        matrizInterna: [],
        climaPorMes: [],
        pegaTuristaAEvitar: [],
        taxasObrigatorias: [],
        situacaoAtual: [],
      },
      {
        ...COMUM,
        id: 'rio',
        nome: 'Rio de Janeiro',
        regiaoId: 'sudeste',
        coords: { lat: -22.9068, lng: -43.1729 },
        altitudeM: 2,
        aeroportos: ['GIG'],
        bairros: [],
        comoCircular: 'metro e carro de app',
        matrizInterna: [],
        climaPorMes: [],
        pegaTuristaAEvitar: [],
        taxasObrigatorias: [],
        situacaoAtual: [],
      },
    ],
    aeroportos: [
      {
        ...COMUM,
        id: 'gru',
        iata: 'GRU',
        nome: 'Guarulhos',
        cidadeNome: 'Sao Paulo',
        coords: { lat: -23.4313, lng: -46.4699 },
        tempoAoCentroMin: 60,
        antecedenciaDomesticaMin: 90,
        desembarqueDomesticoMin: 30,
      },
      {
        ...COMUM,
        id: 'gig',
        iata: 'GIG',
        nome: 'Galeao',
        cidadeNome: 'Rio de Janeiro',
        coords: { lat: -22.8099, lng: -43.2506 },
        tempoAoCentroMin: 40,
        antecedenciaDomesticaMin: 90,
        desembarqueDomesticoMin: 25,
      },
    ],
    itens: [
      {
        ...COMUM,
        id: 'br-sp-almoco',
        nome: 'Almoco no centro de Sao Paulo',
        cidadeId: 'sao-paulo',
        categoria: 'restaurante',
        tags: [],
        coords: { lat: -23.5475, lng: -46.6361 },
        descricaoCurta: 'Almoco no centro.',
        descricaoLonga: '',
        agendavel: true,
        duracao: { min: 45, tipica: 60, max: 120 },
        diasFechados: [],
        reserva: { necessaria: false },
        contato: {},
        imagens: [],
        restricoes: { outras: [] },
        selos: [],
        dicas: [],
        alertas: [],
      },
      {
        ...COMUM,
        id: 'br-rio-copacabana',
        nome: 'Praia de Copacabana',
        cidadeId: 'rio',
        categoria: 'praia',
        tags: [],
        coords: { lat: -22.9711, lng: -43.1822 },
        descricaoCurta: 'Praia no Rio.',
        descricaoLonga: '',
        agendavel: true,
        duracao: { min: 60, tipica: 120, max: 300 },
        diasFechados: [],
        reserva: { necessaria: false },
        contato: {},
        imagens: [],
        restricoes: { outras: [] },
        selos: [],
        dicas: [],
        alertas: [],
      },
      {
        ...COMUM,
        id: 'br-sp-pinacoteca',
        nome: 'Pinacoteca',
        cidadeId: 'sao-paulo',
        categoria: 'museu',
        tags: [],
        coords: { lat: -23.5343, lng: -46.6337 },
        descricaoCurta: 'Museu no centro de Sao Paulo.',
        descricaoLonga: '',
        agendavel: true,
        duracao: { min: 60, tipica: 90, max: 180 },
        diasFechados: [],
        reserva: { necessaria: false },
        contato: {},
        imagens: [],
        restricoes: { outras: [] },
        selos: [],
        dicas: [],
        alertas: [],
      },
      {
        ...COMUM,
        id: 'br-sp-sem-coordenada',
        nome: 'Bar sem endereco',
        cidadeId: 'sao-paulo',
        categoria: 'bar',
        tags: [],
        descricaoCurta: 'Bar cuja coordenada a pesquisa nao achou.',
        descricaoLonga: '',
        agendavel: true,
        duracao: { min: 60, tipica: 90, max: 180 },
        diasFechados: [],
        reserva: { necessaria: false },
        contato: {},
        imagens: [],
        restricoes: { outras: [] },
        selos: [],
        dicas: [],
        alertas: [],
      },
    ],
    trechos: opcoes.comTrechoAereo
      ? [
          {
            ...COMUM,
            id: 'sao-paulo-rio-voo',
            deCidadeId: 'sao-paulo',
            paraCidadeId: 'rio',
            modal: 'voo',
            operadoras: ['LATAM'],
            duracaoPortaAPortaMin: 300,
            duracaoVeiculoMin: 60,
            alertas: [],
          },
        ]
      : [],
    voosInternacionais: [],
    calendario: [],
    hospedagem: [],
  } as PacoteDestino;
}

export function viagemDeTeste(dias: Dia[], deslocamentos: Viagem['deslocamentos'] = {}): Viagem {
  return {
    versaoSchema: VERSAO_SCHEMA_VIAGEM,
    id: 'viagem-teste',
    nome: 'Viagem de teste',
    destinoId: 'brasil',
    origem: { cidade: 'Sao Paulo', aeroportos: ['GRU'] },
    viajantes: { adultos: 2, criancas: 0, nacionalidade: 'BR' },
    estilo: 'economico',
    ritmo: 'intenso',
    interesses: [],
    cambio: { taxas: { COP: 0.00155, USD: 5.4 }, atualizadoEm: '2026-10-08', manual: true },
    dias,
    favoritos: [],
    reservas: [],
    deslocamentos,
    gastos: [],
    confirmacoes: {},
    descartados: {},
    criadoEm: '2026-10-08T12:00:00Z',
    atualizadoEm: '2026-10-08T12:00:00Z',
  };
}

export function atividade(id: string, itemId: string, startMin: number, durationMin: number): Bloco {
  return { id, tipo: 'atividade', itemId, startMin, durationMin, statusDeReserva: 'nao-precisa' };
}

export function dia(id: string, data: string, cidadeBaseId: string, blocos: Bloco[]): Dia {
  return { id, data, cidadeBaseId, blocos };
}
