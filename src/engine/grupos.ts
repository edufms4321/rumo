/**
 * Grupos de item: a camada que o usuario ve em cima da `categoria`.
 *
 * Por que existe: `categoria` tem 12 valores feitos para o MOTOR
 * ("restaurante" alimenta a regra de dia sem refeicao, "passeio" trava
 * horario de saida). Para QUEM PROCURA, 12 pilulas em ordem alfabetica nao
 * sao uma organizacao - "experiencia" com 130 itens quer dizer tudo e nada.
 *
 * O grupo e DERIVADO, nunca gravado no banco. Essa escolha e deliberada:
 * gravar criaria uma segunda verdade que envelhece sozinha (um item ganha a
 * etiqueta `forro` numa reimportacao e o grupo gravado continua "passeios").
 * Derivando, a regra mora num lugar so e vale para os 4 pacotes de uma vez.
 *
 * A ordem do array e a ordem na interface: do que o viajante procura mais
 * para o que ele consulta.
 */
import type { Item } from '../schema/item.ts';

export const GRUPOS = [
  'praia-e-mar',
  'natureza',
  'aventura',
  'cultura',
  'comer',
  'bares',
  'festas-e-musica',
  'compras',
  'passeios',
  'pratico',
  'referencia',
] as const;
export type Grupo = (typeof GRUPOS)[number];

export const NOME_DO_GRUPO: Record<Grupo, string> = {
  'praia-e-mar': 'Praia e mar',
  natureza: 'Natureza',
  aventura: 'Aventura e esporte',
  cultura: 'Cultura e historia',
  comer: 'Comer',
  bares: 'Bares',
  'festas-e-musica': 'Festas e musica',
  compras: 'Compras',
  passeios: 'Passeios e bate-volta',
  pratico: 'Transporte e aluguel',
  referencia: 'Para saber antes',
};

/** Uma linha por grupo, para a interface explicar o que cabe ali. */
export const DICA_DO_GRUPO: Record<Grupo, string> = {
  'praia-e-mar': 'Praias, piscinas naturais, snorkel e ilha.',
  natureza: 'Parque, cachoeira, lagoa, caverna, mirante e por do sol.',
  aventura: 'Mergulho, kitesurf, surfe, trilha longa, rafting, buggy e 4x4.',
  cultura: 'Centro historico, museu, igreja, sitio arqueologico e arquitetura.',
  comer: 'Restaurante, cafe, mercado de comida e aula de cozinha.',
  bares: 'Bar, boteco, cerveja, drink e por do sol com bebida.',
  'festas-e-musica': 'Forro, samba, balada, show e festa de rua.',
  compras: 'Artesanato, feira, mercado e loja.',
  passeios: 'Passeio guiado, barco e bate-volta de dia inteiro.',
  pratico: 'Aluguel de veiculo e transporte.',
  referencia: 'Cartao de consulta: nao se arrasta para um dia.',
};

/*
  As expressoes leem NOME + ETIQUETAS, nunca a descricao.

  Essa restricao nasceu de um teste: lendo a descricao, "Centro Historico de
  Joao Pessoa" caiu em Bares (a descricao cita os bares da redondeza) e
  "Orla da Atalaia" caiu em Festas (a descricao cita shows). A descricao fala
  do ENTORNO; o nome e as etiquetas falam da COISA.

  E `\bbar` sem fim de palavra classificou "Planctons luminescentes na foz do
  Rio Preguicas" como bar, porque o item fica em BARreirinhas. Toda expressao
  daqui fecha a palavra.
*/
const RE: Record<string, RegExp> = {
  aventura:
    /\b(mergulh\w*|scuba|cilindro|batismo|kitesurf|kite|windsurf|surfe?|rafting|rapel|tirolesa|canion\w*|canyon\w*|escalada|parapente|quadricicl\w*|buggy|4x4|offroad|off-road|cavalgada|travessia|espeleolog\w*|flutuacao|flutuar|boia-?cross|caiaque|stand-?up|sandboard|tubing)\b/i,
  // `noite` e `vida-noturna` NAO entram aqui: querem dizer "abre a noite",
  // nao "e uma festa". Com elas, "Urra Beer" virava festa e Bares caia para
  // 3 itens em 397 - e os plancton luminescentes do Rio Preguicas, que se ve
  // de noite, viravam balada.
  'festas-e-musica':
    /\b(forr[oó]\w*|samba|ax[eé]|carnaval\w*|balada\w*|boate\w*|discoteca\w*|festas?|baile\w*|shows?|reggae|salsa|merengue|bachata|mariachi|folia|blocos?|trio-?eletrico|arrocha|piseiro|sertanejo|festival\w*|micareta|lambada|pagode|maracatu|frevo|quadrilha|sao-joao|musica-ao-vivo)\b/i,
  comer:
    /\b(gastronomi\w*|comida\w*|culinari\w*|cozinha\w*|degustac\w*|restaurante\w*|petisco\w*|frutos-do-mar|carne-de-sol|tapioca\w*|acaraj[eé]|moqueca|taco\w*|mezcal|caf[eé]s?|doces?|sobremesa\w*|feijoada|churrasco|jantar|almoco|brunch|padaria|sorvete\w*|mercado-de-comida)\b/i,
  bares:
    /\b(bares?|boteco\w*|cervejari\w*|cerveja|chopp\w*|drinks?|coquetel\w*|caipirinha\w*|rum|mojito|happy-?hour|open-?bar|pubs?|lounge)\b/i,
  cultura:
    /\b(centro-?historico|historic\w*|histori\w*|museu\w*|igrejas?|catedral\w*|convento\w*|mosteiro\w*|fortes?|fortaleza\w*|palacio\w*|unesco|arqueolog\w*|rupestre|maya|ta[ií]no|colonial\w*|arquitetura|cultura\w*|candombl\w*|capoeira|patrimoni\w*|bibliotecas?|teatros?|galerias?|mural\w*|grafite|pelourinho|sitio-arqueologico|memorial|basilica|santuario)\b/i,
  natureza:
    /\b(parques?|natureza|cachoeiras?|catarata\w*|saltos?|lagoas?|lagos?|grutas?|cavernas?|cenotes?|dunas?|mangue\w*|delta|mata|selva|serra|chapada|mirante\w*|por-do-sol|nascer-do-sol|baleia\w*|tartaruga\w*|peixe-boi|passarinh\w*|jardim-botanico|reserva\w*|revoada|guaras|golfinho\w*|aquario|oceanario|termas?)\b/i,
  'praia-e-mar':
    /\b(praias?|piscinas?-naturais?|piscina-natural|snorkel\w*|recifes?|corais?|coral|ilhas?|mar-calmo|pe-na-areia|barracas?|fal[eé]sias?|arrecifes?|cayos?|banho-de-mar|catamara\w*|lancha\w*|escuna\w*|prainha)\b/i,
  compras:
    /\b(artesanat\w*|feiras?|mercados?|lojas?|compras|souvenir\w*|[aâ]mbar|larimar|rendas?|ceramica\w*|redes?|chapeus?|outlet\w*|shopping\w*|croche|bordado\w*)\b/i,
};

/** So o nome e as etiquetas. A descricao fala do entorno e engana. */
function sinal(item: Item): string {
  return `${item.nome} ${item.tags.join(' ')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const bate = (grupo: string, t: string): boolean => RE[grupo]?.test(t) ?? false;

/**
 * Grupo PRINCIPAL do item: o que vai no cartao e na contagem. Deterministico
 * e total - todo item cai em exatamente um, e `referencia` recebe tudo que
 * nao se arrasta para um dia.
 */
export function grupoDoItem(item: Item): Grupo {
  // Cartao de consulta nao e um lugar, e um aviso. Misturar os dois foi o
  // que fez "experiencia" virar um saco com 130 itens dentro.
  if (item.agendavel === false) return 'referencia';

  const t = sinal(item);

  switch (item.categoria) {
    // Uma praia continua sendo uma praia mesmo quando da para soltar pipa
    // nela: "Praia de Atins" caiu em Aventura so porque tem a etiqueta
    // kitesurf. A aventura entra como grupo SECUNDARIO.
    case 'praia':
      return 'praia-e-mar';
    case 'museu':
      return 'cultura';
    case 'restaurante':
    case 'cafe':
      return 'comer';
    // Um bar com musica ao vivo continua sendo um bar. Só vira Festas
    // quando a casa e de festa: balada, boate, forro pe de serra, bloco.
    case 'bar':
      return /(balada\w*|boate\w*|discoteca\w*|forr[oó]\w*|samba|carnaval\w*|micareta|festival\w*|pagode|baile\w*)/i.test(t)
        ? 'festas-e-musica'
        : 'bares';
    case 'compras':
      return 'compras';
    case 'aluguel-veiculo':
      return 'pratico';
    case 'mirante':
      return 'natureza';
    case 'natureza':
      return bate('aventura', t) ? 'aventura' : 'natureza';
    case 'passeio':
      if (bate('aventura', t)) return 'aventura';
      if (bate('festas-e-musica', t)) return 'festas-e-musica';
      return 'passeios';
    case 'experiencia':
    case 'atracao': {
      // Ordem = o que decide o dia. Mergulho manda em praia porque exige
      // reserva, horario e nao voar depois; cultura manda em bar porque o
      // Pelourinho nao e um bar, mesmo tendo bares.
      for (const g of ['aventura', 'festas-e-musica', 'cultura', 'comer', 'bares', 'praia-e-mar', 'natureza', 'compras'] as Grupo[]) {
        if (bate(g, t)) return g;
      }
      return item.categoria === 'atracao' ? 'cultura' : 'passeios';
    }
  }
}

/**
 * Todos os grupos em que o item deve APARECER quando se filtra.
 *
 * Um item pertence a mais de um grupo com frequencia, e esconder isso perde
 * coisa boa: "Sao Cristovao e a Praca Sao Francisco" e um bate-volta E um
 * patrimonio da UNESCO. Quem filtra Cultura quer ve-lo; quem filtra Passeios
 * tambem. O cartao mostra so o principal.
 */
export function gruposDoItem(item: Item): Grupo[] {
  const principal = grupoDoItem(item);
  if (principal === 'referencia') return ['referencia'];

  const t = sinal(item);
  const saida = new Set<Grupo>([principal]);
  for (const g of GRUPOS) {
    if (g === 'referencia' || g === 'pratico') continue;
    if (bate(g, t)) saida.add(g);
  }
  // A categoria tambem conta como pertencimento, mesmo sem palavra-chave:
  // um passeio e um passeio ainda que o nome nao diga.
  if (item.categoria === 'passeio') saida.add('passeios');
  if (item.categoria === 'praia') saida.add('praia-e-mar');
  if (item.categoria === 'restaurante' || item.categoria === 'cafe') saida.add('comer');
  if (item.categoria === 'bar') saida.add('bares');
  if (item.categoria === 'museu') saida.add('cultura');
  if (item.categoria === 'compras') saida.add('compras');
  if (item.categoria === 'mirante') saida.add('natureza');
  if (item.categoria === 'aluguel-veiculo') saida.add('pratico');
  return GRUPOS.filter((g) => saida.has(g));
}

/** Conta pelo grupo PRINCIPAL, na ordem da interface. Zero nao aparece. */
export function contarPorGrupo(itens: Item[]): Array<{ grupo: Grupo; n: number }> {
  const conta = new Map<Grupo, number>();
  for (const i of itens) {
    const g = grupoDoItem(i);
    conta.set(g, (conta.get(g) ?? 0) + 1);
  }
  return GRUPOS.map((grupo) => ({ grupo, n: conta.get(grupo) ?? 0 })).filter((g) => g.n > 0);
}
