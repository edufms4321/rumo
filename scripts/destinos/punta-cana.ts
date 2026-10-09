/**
 * Punta Cana e a Republica Dominicana.
 *
 * Quarto destino. O recorte parte de Punta Cana — que e por onde quase
 * todo brasileiro entra — e se abre para as bases que valem a pena de
 * verdade: Bayahibe e Santo Domingo a oeste, Samana e a costa norte para
 * quem fica mais tempo.
 *
 * O que este destino tem de diferente dos outros tres: o modelo de
 * **resort com tudo incluido** domina Punta Cana, e isso muda o orcamento
 * (a diaria ja cobre comida e bebida) e o roteiro (o passeio sai do hotel
 * e volta para ele). O banco trata isso como dado, nao como regra nova.
 */
import type { ConfigDeDestino } from './tipos.ts';

export const puntaCana: ConfigDeDestino = {
  id: 'punta-cana',
  nome: 'Punta Cana e Republica Dominicana',
  paisNome: 'Republica Dominicana',
  cobertura:
    'Cobre 6 bases: o leste dos resorts, Santo Domingo, Samana, a costa norte e a cordilheira. Fora do pacote: Santiago e todo o sudoeste (Barahona, Pedernales, Bahia de las Aguilas).',
  codigoPais: 'DO',
  moeda: 'DOP',
  // Atlantic Standard o ano inteiro: o pais nao usa horario de verao.
  fuso: 'America/Santo_Domingo',
  fusoOffsetMinutos: -240,
  idiomas: ['es'],
  // A ilha inteira mais as ilhas-satelite (Saona, Catalina) e a Samana.
  caixaDelimitadora: { latMin: 17.4, latMax: 20.1, lngMin: -72.1, lngMax: -68.2 },

  pastaDePesquisa: 'pesquisa/punta-cana',

  regiaoDaCidade: {
    'punta-cana': 'leste',
    bayahibe: 'leste',
    'santo-domingo': 'sul',
    'las-terrenas': 'samana',
    'puerto-plata': 'costa-norte',
    jarabacoa: 'cordilheira',
  },

  nomeDaCidade: {
    'punta-cana': 'Punta Cana',
    bayahibe: 'Bayahibe',
    'santo-domingo': 'Santo Domingo',
    'las-terrenas': 'Las Terrenas',
    'puerto-plata': 'Puerto Plata',
    jarabacoa: 'Jarabacoa',
  },

  /**
   * Nome de exibicao da zona turistica. Sem isto o conversor capitaliza o
   * id, e "bahia-dende" virava "Bahia Dende" - que nao e o nome de nada.
   */
  nomeDaZona: {
    leste: 'Costa do Coco e Bayahibe',
    sul: 'Zona Colonial e o sul',
    samana: 'Peninsula de Samana',
    'costa-norte': 'Costa do Ambar',
    cordilheira: 'Cordilheira Central',
  },

  descricaoDaRegiao: {
    leste: 'Punta Cana e Bavaro: praia de postal, resort com tudo incluido e as ilhas Saona e Catalina.',
    sul: 'Santo Domingo: a primeira cidade europeia das Americas, e a unica parte do pais que nao e praia.',
    samana: 'Peninsula de Samana: baleias jubarte entre janeiro e marco, cachoeira do Limon e Los Haitises.',
    'costa-norte': 'Puerto Plata, Sosua e Cabarete: kitesurf, teleferico e o lado que o vento domina.',
    cordilheira: 'Jarabacoa e Constanza: montanha, rafting e o unico lugar frio do pais.',
  },

  /**
   * Como o pesquisador pode ter nomeado a cidade de um item -> base.
   * Bate-volta aponta para a base de onde se sai e volta no mesmo dia.
   */
  cidadeDoItem: {
    'punta-cana': 'punta-cana',
    bavaro: 'punta-cana',
    'bavaro-punta-cana': 'punta-cana',
    cap_cana: 'punta-cana',
    'cap-cana': 'punta-cana',
    uvero_alto: 'punta-cana',
    'uvero-alto': 'punta-cana',
    macao: 'punta-cana',
    'playa-macao': 'punta-cana',
    'montana-redonda': 'punta-cana',
    higuey: 'punta-cana',
    'isla-saona': 'bayahibe',
    saona: 'bayahibe',
    'isla-catalina': 'bayahibe',
    catalina: 'bayahibe',
    bayahibe: 'bayahibe',
    'la-romana': 'bayahibe',
    'altos-de-chavon': 'bayahibe',
    'santo-domingo': 'santo-domingo',
    'zona-colonial': 'santo-domingo',
    'boca-chica': 'santo-domingo',
    'juan-dolio': 'santo-domingo',
    'las-terrenas': 'las-terrenas',
    samana: 'las-terrenas',
    'el-limon': 'las-terrenas',
    'los-haitises': 'las-terrenas',
    'cayo-levantado': 'las-terrenas',
    'las-galeras': 'las-terrenas',
    'puerto-plata': 'puerto-plata',
    sosua: 'puerto-plata',
    cabarete: 'puerto-plata',
    damajagua: 'puerto-plata',
    '27-charcos': 'puerto-plata',
    jarabacoa: 'jarabacoa',
    constanza: 'jarabacoa',
    'salto-de-jimenoa': 'jarabacoa',
  },

  prefixoId: {
    'punta-cana': 'puj',
    bayahibe: 'byh',
    'santo-domingo': 'sdq',
    'las-terrenas': 'ltr',
    'puerto-plata': 'pop',
    jarabacoa: 'jrb',
  },

  climaParaCidades: [
    {
      contem: /punta cana|bavaro|leste|higuey/i,
      cidades: ['punta-cana'],
      regiao: 'leste',
    },
    { contem: /bayahibe|la romana|saona/i, cidades: ['bayahibe'], regiao: 'leste' },
    { contem: /santo domingo|sul|capital/i, cidades: ['santo-domingo'], regiao: 'sul' },
    { contem: /samana|las terrenas|peninsula/i, cidades: ['las-terrenas'], regiao: 'samana' },
    {
      contem: /puerto plata|costa norte|sosua|cabarete/i,
      cidades: ['puerto-plata'],
      regiao: 'costa-norte',
    },
    {
      contem: /jarabacoa|constanza|cordilheira|montanha/i,
      cidades: ['jarabacoa'],
      regiao: 'cordilheira',
    },
  ],

  apelidosDeCidade: [
    [/punta cana|b[áa]varo/i, 'punta-cana'],
    [/bayahibe|la romana|saona|catalina/i, 'bayahibe'],
    [/santo domingo|zona colonial/i, 'santo-domingo'],
    [/las terrenas|saman[áa]|las galeras/i, 'las-terrenas'],
    [/puerto plata|sos[úu]a|cabarete/i, 'puerto-plata'],
    [/jarabacoa|constanza/i, 'jarabacoa'],
  ],

  iataParaCidade: {
    PUJ: 'punta-cana',
    LRM: 'bayahibe',
    SDQ: 'santo-domingo',
    AZS: 'las-terrenas',
    POP: 'puerto-plata',
    STI: 'jarabacoa',
  },

  /**
   * Fatores de deslocamento. Entrada do estimador, nao afirmacao sobre o
   * mundo: a camada 3 sempre aparece rotulada como estimativa.
   *
   * O que muda aqui: Punta Cana nao e cidade, e um corredor de resorts
   * de 40 km ao longo de uma estrada so — a pe nao se vai a lugar nenhum
   * e o taxi e caro e tabelado. Santo Domingo, ao contrario, e capital
   * grande com transito pesado e centro historico que se faz a pe.
   */
  fatores: {
    'punta-cana': {
      'a-pe': { kmh: 4.4, fatorRota: 1.5 },
      'carro-app': { kmh: 38, fatorRota: 1.3 },
      'transporte-publico': { kmh: 20, fatorRota: 1.7 },
      'veiculo-alugado': { kmh: 40, fatorRota: 1.3 },
    },
    bayahibe: {
      'a-pe': { kmh: 4.5, fatorRota: 1.3 },
      'carro-app': { kmh: 32, fatorRota: 1.35 },
      'transporte-publico': { kmh: 18, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 34, fatorRota: 1.35 },
    },
    'santo-domingo': {
      'a-pe': { kmh: 4.4, fatorRota: 1.3 },
      'carro-app': { kmh: 18, fatorRota: 1.5 },
      'transporte-publico': { kmh: 13, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 17, fatorRota: 1.5 },
    },
    'las-terrenas': {
      'a-pe': { kmh: 4.4, fatorRota: 1.3 },
      'carro-app': { kmh: 28, fatorRota: 1.4 },
      'transporte-publico': { kmh: 18, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 30, fatorRota: 1.4 },
    },
    'puerto-plata': {
      'a-pe': { kmh: 4.5, fatorRota: 1.3 },
      'carro-app': { kmh: 26, fatorRota: 1.4 },
      'transporte-publico': { kmh: 16, fatorRota: 1.6 },
      'veiculo-alugado': { kmh: 28, fatorRota: 1.4 },
    },
    // Serra: curva fechada e subida.
    jarabacoa: {
      'a-pe': { kmh: 4.2, fatorRota: 1.4 },
      'carro-app': { kmh: 24, fatorRota: 1.7 },
      'transporte-publico': { kmh: 18, fatorRota: 1.8 },
      'veiculo-alugado': { kmh: 24, fatorRota: 1.7 },
    },
  },
};
