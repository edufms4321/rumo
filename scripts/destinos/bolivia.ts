/**
 * Bolivia.
 *
 * Quinto destino, e o que mais exercita o motor: e o unico pacote em que a
 * ALTITUDE decide o roteiro. La Paz fica a 3.640 m, El Alto a 4.050 m e
 * Potosi a 4.090 m — a regra de altitude no primeiro dia, que ate aqui
 * quase nao disparava, passa a valer para metade das bases.
 *
 * O recorte e o circuito que um viajante de orcamento faz de verdade:
 * altiplano (La Paz, Titicaca), descida para os Yungas e a Amazonia
 * (Coroico, Rurrenabaque), o sul do Salar (Uyuni, Tupiza), as cidades
 * coloniais (Potosi, Sucre), os vales (Cochabamba, Torotoro) e o oriente
 * (Santa Cruz, Samaipata).
 */
import type { ConfigDeDestino } from './tipos.ts';

export const bolivia: ConfigDeDestino = {
  id: 'bolivia',
  nome: 'Bolivia',
  paisNome: 'Bolivia',
  cobertura:
    'Cobre 12 bases: altiplano e Titicaca, Yungas e Amazonia, o Salar e o sul, as cidades coloniais, os vales e o oriente. Fora do pacote: o Pantanal boliviano (Puerto Suarez), as missoes jesuiticas de Chiquitos e o norte do Beni alem de Rurrenabaque.',
  codigoPais: 'BO',
  moeda: 'BOB',
  // Bolivia e UTC-4 o ano inteiro: nao usa horario de verao.
  fuso: 'America/La_Paz',
  fusoOffsetMinutos: -240,
  idiomas: ['es', 'qu', 'ay'],
  caixaDelimitadora: { latMin: -23.1, latMax: -9.6, lngMin: -69.8, lngMax: -57.3 },

  pastaDePesquisa: 'pesquisa/bolivia',

  regiaoDaCidade: {
    'la-paz': 'altiplano',
    copacabana: 'titicaca',
    coroico: 'yungas',
    rurrenabaque: 'amazonia',
    uyuni: 'salar-e-sul',
    tupiza: 'salar-e-sul',
    potosi: 'cidades-coloniais',
    sucre: 'cidades-coloniais',
    cochabamba: 'vales',
    torotoro: 'vales',
    'santa-cruz': 'oriente',
    samaipata: 'oriente',
  },

  nomeDaCidade: {
    'la-paz': 'La Paz',
    copacabana: 'Copacabana',
    coroico: 'Coroico',
    rurrenabaque: 'Rurrenabaque',
    uyuni: 'Uyuni',
    tupiza: 'Tupiza',
    potosi: 'Potosi',
    sucre: 'Sucre',
    cochabamba: 'Cochabamba',
    torotoro: 'Torotoro',
    'santa-cruz': 'Santa Cruz de la Sierra',
    samaipata: 'Samaipata',
  },

  nomeDaZona: {
    altiplano: 'Altiplano',
    titicaca: 'Lago Titicaca',
    yungas: 'Yungas',
    amazonia: 'Amazonia boliviana',
    'salar-e-sul': 'Salar de Uyuni e o sul',
    'cidades-coloniais': 'Cidades da prata',
    vales: 'Vales de Cochabamba',
    oriente: 'Oriente e Chiquitania',
  },

  descricaoDaRegiao: {
    altiplano:
      'La Paz e El Alto: a sede de governo mais alta do mundo, teleferico como transporte urbano e o ar a 3.600 m.',
    titicaca:
      'Copacabana e a Isla del Sol: o lago navegavel mais alto do mundo e o berco do mito inca.',
    yungas:
      'Coroico e a estrada da morte: 3.500 m de descida do altiplano para a mata, em poucas horas.',
    amazonia:
      'Rurrenabaque, Madidi e as pampas do Yacuma: a Amazonia boliviana, barata e de acesso complicado.',
    'salar-e-sul':
      'Uyuni e Tupiza: o maior deserto de sal do planeta, as lagoas coloridas e o sul de Butch Cassidy.',
    'cidades-coloniais':
      'Potosi e Sucre: a montanha de prata que financiou a Espanha e a cidade branca onde a Bolivia nasceu.',
    vales:
      'Cochabamba e Torotoro: clima ameno, a melhor comida do pais e pegadas de dinossauro num canion.',
    oriente:
      'Santa Cruz e Samaipata: terra baixa, calor, economia nova e um sitio pre-inca no alto da serra.',
  },

  /**
   * Como o pesquisador pode ter nomeado a cidade de um item -> base.
   * Bate-volta aponta para a base de onde se sai e volta no mesmo dia.
   */
  cidadeDoItem: {
    'la-paz': 'la-paz',
    'el-alto': 'la-paz',
    'valle-de-la-luna': 'la-paz',
    tiwanaku: 'la-paz',
    chacaltaya: 'la-paz',
    'estrada-da-morte': 'la-paz',
    'camino-de-la-muerte': 'la-paz',
    'valle-de-las-animas': 'la-paz',
    copacabana: 'copacabana',
    'isla-del-sol': 'copacabana',
    'isla-de-la-luna': 'copacabana',
    titicaca: 'copacabana',
    coroico: 'coroico',
    yungas: 'coroico',
    rurrenabaque: 'rurrenabaque',
    madidi: 'rurrenabaque',
    pampas: 'rurrenabaque',
    'santa-rosa-del-yacuma': 'rurrenabaque',
    uyuni: 'uyuni',
    'salar-de-uyuni': 'uyuni',
    'colchani': 'uyuni',
    'isla-incahuasi': 'uyuni',
    'laguna-colorada': 'uyuni',
    'laguna-verde': 'uyuni',
    'sol-de-manana': 'uyuni',
    'eduardo-avaroa': 'uyuni',
    tupiza: 'tupiza',
    'san-vicente': 'tupiza',
    potosi: 'potosi',
    'cerro-rico': 'potosi',
    'ojo-del-inca': 'potosi',
    sucre: 'sucre',
    tarabuco: 'sucre',
    'cal-orcko': 'sucre',
    cochabamba: 'cochabamba',
    'parque-tunari': 'cochabamba',
    tiquipaya: 'cochabamba',
    torotoro: 'torotoro',
    'santa-cruz': 'santa-cruz',
    'santa-cruz-de-la-sierra': 'santa-cruz',
    'lomas-de-arena': 'santa-cruz',
    samaipata: 'samaipata',
    'el-fuerte': 'samaipata',
    amboro: 'samaipata',
    'la-higuera': 'samaipata',
  },

  prefixoId: {
    'la-paz': 'lpz',
    copacabana: 'cpc',
    coroico: 'crc',
    rurrenabaque: 'rbq',
    uyuni: 'uyu',
    tupiza: 'tpz',
    potosi: 'pts',
    sucre: 'scr',
    cochabamba: 'cbb',
    torotoro: 'trt',
    'santa-cruz': 'scz',
    samaipata: 'smp',
  },

  climaParaCidades: [
    { contem: /la paz|el alto|altiplano/i, cidades: ['la-paz'], regiao: 'altiplano' },
    { contem: /copacabana|titicaca|isla del sol/i, cidades: ['copacabana'], regiao: 'titicaca' },
    { contem: /coroico|yungas/i, cidades: ['coroico'], regiao: 'yungas' },
    {
      contem: /rurrenabaque|madidi|amazon|pampas|beni/i,
      cidades: ['rurrenabaque'],
      regiao: 'amazonia',
    },
    { contem: /uyuni|salar|sud l[ií]pez|lagunas/i, cidades: ['uyuni'], regiao: 'salar-e-sul' },
    { contem: /tupiza/i, cidades: ['tupiza'], regiao: 'salar-e-sul' },
    { contem: /potos[ií]/i, cidades: ['potosi'], regiao: 'cidades-coloniais' },
    { contem: /sucre|chuquisaca/i, cidades: ['sucre'], regiao: 'cidades-coloniais' },
    { contem: /cochabamba|valle/i, cidades: ['cochabamba'], regiao: 'vales' },
    { contem: /torotoro|toro toro/i, cidades: ['torotoro'], regiao: 'vales' },
    {
      contem: /santa cruz|oriente|tierras bajas/i,
      cidades: ['santa-cruz'],
      regiao: 'oriente',
    },
    { contem: /samaipata|ambor[oó]/i, cidades: ['samaipata'], regiao: 'oriente' },
  ],

  apelidosDeCidade: [
    [/la paz|el alto/i, 'la-paz'],
    [/copacabana|isla del sol|titicaca/i, 'copacabana'],
    [/coroico|yungas/i, 'coroico'],
    [/rurrenabaque|madidi|rurre/i, 'rurrenabaque'],
    [/uyuni|salar/i, 'uyuni'],
    [/tupiza/i, 'tupiza'],
    [/potos[ií]/i, 'potosi'],
    [/sucre/i, 'sucre'],
    [/cochabamba/i, 'cochabamba'],
    [/torotoro|toro toro/i, 'torotoro'],
    [/santa cruz/i, 'santa-cruz'],
    [/samaipata/i, 'samaipata'],
  ],

  iataParaCidade: {
    LPB: 'la-paz',
    UYU: 'uyuni',
    SRE: 'sucre',
    POI: 'potosi',
    CBB: 'cochabamba',
    VVI: 'santa-cruz',
    RBQ: 'rurrenabaque',
  },

  /**
   * Fatores de deslocamento. Entrada do estimador, nao afirmacao sobre o
   * mundo: a camada 3 sempre aparece rotulada como estimativa.
   *
   * O que muda aqui: La Paz e construida dentro de um canion, entao a
   * distancia em linha reta mente mais do que em qualquer outra cidade do
   * banco — subir e descer ladeira a pe e lento, e o teleferico (que e
   * transporte publico de verdade) e mais rapido que o carro na hora do
   * rush. Nas bases pequenas do altiplano e do sul a estrada e de terra.
   */
  fatores: {
    'la-paz': {
      'a-pe': { kmh: 3.6, fatorRota: 1.7 },
      'carro-app': { kmh: 16, fatorRota: 1.6 },
      'transporte-publico': { kmh: 15, fatorRota: 1.4 },
      'veiculo-alugado': { kmh: 16, fatorRota: 1.6 },
    },
    copacabana: {
      'a-pe': { kmh: 4.2, fatorRota: 1.4 },
      'carro-app': { kmh: 24, fatorRota: 1.4 },
      'transporte-publico': { kmh: 16, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 26, fatorRota: 1.4 },
    },
    coroico: {
      'a-pe': { kmh: 3.8, fatorRota: 1.6 },
      'carro-app': { kmh: 20, fatorRota: 1.8 },
      'transporte-publico': { kmh: 16, fatorRota: 1.9 },
      'veiculo-alugado': { kmh: 20, fatorRota: 1.8 },
    },
    rurrenabaque: {
      'a-pe': { kmh: 4.4, fatorRota: 1.3 },
      'carro-app': { kmh: 20, fatorRota: 1.5 },
      'transporte-publico': { kmh: 15, fatorRota: 1.7 },
      'veiculo-alugado': { kmh: 22, fatorRota: 1.6 },
    },
    uyuni: {
      'a-pe': { kmh: 4.3, fatorRota: 1.3 },
      'carro-app': { kmh: 26, fatorRota: 1.4 },
      'transporte-publico': { kmh: 18, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 30, fatorRota: 1.5 },
    },
    tupiza: {
      'a-pe': { kmh: 4.2, fatorRota: 1.4 },
      'carro-app': { kmh: 24, fatorRota: 1.5 },
      'transporte-publico': { kmh: 17, fatorRota: 1.7 },
      'veiculo-alugado': { kmh: 26, fatorRota: 1.6 },
    },
    potosi: {
      // A 4.090 m e em ladeira: andar cansa muito mais do que a distancia diz.
      'a-pe': { kmh: 3.5, fatorRota: 1.5 },
      'carro-app': { kmh: 20, fatorRota: 1.5 },
      'transporte-publico': { kmh: 15, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 20, fatorRota: 1.5 },
    },
    sucre: {
      'a-pe': { kmh: 4.1, fatorRota: 1.35 },
      'carro-app': { kmh: 22, fatorRota: 1.45 },
      'transporte-publico': { kmh: 16, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 22, fatorRota: 1.45 },
    },
    cochabamba: {
      'a-pe': { kmh: 4.4, fatorRota: 1.3 },
      'carro-app': { kmh: 20, fatorRota: 1.45 },
      'transporte-publico': { kmh: 15, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 20, fatorRota: 1.45 },
    },
    torotoro: {
      'a-pe': { kmh: 3.8, fatorRota: 1.6 },
      'carro-app': { kmh: 18, fatorRota: 1.9 },
      'transporte-publico': { kmh: 14, fatorRota: 2 },
      'veiculo-alugado': { kmh: 18, fatorRota: 1.9 },
    },
    'santa-cruz': {
      'a-pe': { kmh: 4.5, fatorRota: 1.25 },
      'carro-app': { kmh: 22, fatorRota: 1.4 },
      'transporte-publico': { kmh: 16, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 24, fatorRota: 1.4 },
    },
    samaipata: {
      'a-pe': { kmh: 4.2, fatorRota: 1.4 },
      'carro-app': { kmh: 22, fatorRota: 1.6 },
      'transporte-publico': { kmh: 16, fatorRota: 1.8 },
      'veiculo-alugado': { kmh: 24, fatorRota: 1.7 },
    },
  },
};
