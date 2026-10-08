import type { ConfigDeDestino } from './tipos.ts';

export const colombia: ConfigDeDestino = {
  id: 'colombia',
  nome: 'Colombia',
  codigoPais: 'CO',
  moeda: 'COP',
  fuso: 'America/Bogota',
  fusoOffsetMinutos: -300,
  idiomas: ['es'],
  // Cobre o continente e o arquipelago de San Andres, bem a oeste.
  caixaDelimitadora: { latMin: -4.3, latMax: 13.5, lngMin: -82.1, lngMax: -66.8 },
  pastaDePesquisa: 'pesquisa',

  regiaoDaCidade: {
    cartagena: 'caribe-continental',
    'santa-marta': 'caribe-continental',
    palomino: 'caribe-continental',
    'san-andres': 'caribe-insular',
    bogota: 'andes',
    'villa-de-leyva': 'andes',
    medellin: 'andes',
    salento: 'eje-cafetero',
  },

  nomeDaCidade: {
    cartagena: 'Cartagena',
    'santa-marta': 'Santa Marta',
    palomino: 'Palomino',
    'san-andres': 'San Andres',
    bogota: 'Bogota',
    'villa-de-leyva': 'Villa de Leyva',
    medellin: 'Medellin',
    salento: 'Salento',
  },

  descricaoDaRegiao: {
    'caribe-continental': 'Costa caribenha continental: Cartagena, Santa Marta, Tayrona, Palomino.',
    'caribe-insular': 'Arquipelago de San Andres, Providencia e Santa Catalina.',
    andes: 'Cordilheira: Bogota, Medellin, Villa de Leyva e o altiplano.',
    'eje-cafetero': 'Regiao do cafe: Salento, Filandia, Vale de Cocora, fazendas.',
  },

  cidadeDoItem: {
    cartagena: 'cartagena',
    'islas-rosario': 'cartagena',
    baru: 'cartagena',
    'san-andres': 'san-andres',
    medellin: 'medellin',
    guatape: 'medellin',
    jardin: 'medellin',
    salento: 'salento',
    cocora: 'salento',
    filandia: 'salento',
    pereira: 'salento',
    armenia: 'salento',
    'santa-marta': 'santa-marta',
    tayrona: 'santa-marta',
    minca: 'santa-marta',
    taganga: 'santa-marta',
    palomino: 'palomino',
    bogota: 'bogota',
    zipaquira: 'bogota',
    guatavita: 'bogota',
    'villa-de-leyva': 'villa-de-leyva',
  },

  prefixoId: {
    cartagena: 'ctg',
    'san-andres': 'adz',
    'santa-marta': 'smr',
    medellin: 'mde',
    bogota: 'bog',
    salento: 'slt',
    'villa-de-leyva': 'vdl',
    palomino: 'plm',
  },

  climaParaCidades: [
    { contem: /Caribe - Cartagena/i, cidades: ['cartagena'], regiao: 'caribe-continental' },
    { contem: /Caribe seco/i, cidades: ['santa-marta', 'palomino'], regiao: 'caribe-continental' },
    { contem: /Caribe insular/i, cidades: ['san-andres'], regiao: 'caribe-insular' },
    { contem: /Andes - Bogot/i, cidades: ['bogota'], regiao: 'andes' },
    { contem: /Andes - Villa de Leyva/i, cidades: ['villa-de-leyva'], regiao: 'andes' },
    { contem: /Andes - Medell/i, cidades: ['medellin'], regiao: 'andes' },
    { contem: /Eje Cafetero/i, cidades: ['salento'], regiao: 'eje-cafetero' },
  ],

  apelidosDeCidade: [
    [/villa de leyva/i, 'villa-de-leyva'],
    [/san andr[eé]s/i, 'san-andres'],
    [/santa marta/i, 'santa-marta'],
    [/cartagena/i, 'cartagena'],
    [/medell[ií]n/i, 'medellin'],
    [/bogot[aá]/i, 'bogota'],
    [/palomino/i, 'palomino'],
    [/salento|pereira|armenia|eje cafetero/i, 'salento'],
  ],

  iataParaCidade: {
    CTG: 'cartagena',
    ADZ: 'san-andres',
    SMR: 'santa-marta',
    MDE: 'medellin',
    EOH: 'medellin',
    BOG: 'bogota',
    PEI: 'salento',
    AXM: 'salento',
  },

  fatores: {
    // Centro historico compacto e plano; transito pesado fora dele.
    cartagena: {
      'a-pe': { kmh: 4.5, fatorRota: 1.25 },
      'carro-app': { kmh: 20, fatorRota: 1.35 },
      'transporte-publico': { kmh: 14, fatorRota: 1.5 },
      'veiculo-alugado': { kmh: 20, fatorRota: 1.35 },
    },
    // Ilha de ~26 km de perimetro, estrada circular costeira, pouco transito.
    // Mulita e buggy sao lentos, por isso 22 km/h e nao mais.
    'san-andres': {
      'a-pe': { kmh: 4.5, fatorRota: 1.2 },
      'carro-app': { kmh: 24, fatorRota: 1.15 },
      'transporte-publico': { kmh: 18, fatorRota: 1.25 },
      'veiculo-alugado': { kmh: 22, fatorRota: 1.15 },
      bicicleta: { kmh: 12, fatorRota: 1.15 },
    },
  },
};
