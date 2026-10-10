import { z } from 'zod';
import { IsoDate, Modal, Moeda, Slug, Url } from './base.ts';
import { AnotacaoDeDocumento } from './documento.ts';

/**
 * Estado do usuario. Vive no IndexedDB do navegador, separado do pacote de
 * destino (que e somente leitura). Sai e entra como JSON no backup.
 *
 * Modelo de tempo: minutos inteiros desde a meia-noite LOCAL do dia.
 * Nao ha aritmetica de fuso na agenda - a Colombia e UTC-5 sem horario de
 * verao e o Brasil nao tem mais horario de verao. A unica excecao e o bloco
 * de trecho, que guarda partida e chegada cada uma no horario local do seu
 * proprio aeroporto; o offset vem do dado do aeroporto.
 *
 * durationMin pode empurrar o fim do bloco para depois da meia-noite
 * (voo noturno). O motor trata o transbordo; o dado nao precisa saber.
 */

export const VERSAO_SCHEMA_VIAGEM = 1;

export const Ritmo = z.enum(['tranquilo', 'equilibrado', 'intenso']);
export type Ritmo = z.infer<typeof Ritmo>;

export const Estilo = z.enum(['economico', 'conforto', 'premium']);
export type Estilo = z.infer<typeof Estilo>;

export const StatusDeReserva = z.enum([
  'nao-precisa',
  'precisa-reservar',
  'reservado',
  'pago',
  'cancelado',
]);
export type StatusDeReserva = z.infer<typeof StatusDeReserva>;

const MinutoDoDia = z.number().int().min(0).max(1439);
const DuracaoEmMinutos = z.number().int().positive().max(2880);

const BlocoComum = {
  id: z.string().min(1),
  startMin: MinutoDoDia,
  durationMin: DuracaoEmMinutos,
  nota: z.string().optional(),
};

/** Atividade vinda de um item do pacote de destino. */
export const BlocoAtividade = z.object({
  ...BlocoComum,
  tipo: z.literal('atividade'),
  itemId: Slug,
  /** Sobrescreve o custo do pacote quando o usuario sabe o valor real. */
  custoOverride: z.number().nonnegative().optional(),
  statusDeReserva: StatusDeReserva.default('nao-precisa'),
});

export const BlocoRefeicao = z.object({
  ...BlocoComum,
  tipo: z.literal('refeicao'),
  nome: z.string().min(1),
  /** Preenchido quando a refeicao e num item do banco. */
  itemId: Slug.optional(),
  local: z.string().optional(),
  custoEstimado: z.number().nonnegative().optional(),
});

export const BlocoTempoLivre = z.object({
  ...BlocoComum,
  tipo: z.literal('tempo-livre'),
});

export const BlocoNota = z.object({
  ...BlocoComum,
  tipo: z.literal('nota'),
  texto: z.string().min(1),
});

/**
 * Troca de cidade. Este bloco E salvo (tem voo, horario, preco), ao contrario
 * do deslocamento dentro da cidade, que o motor deriva a cada calculo.
 */
export const BlocoTrecho = z.object({
  ...BlocoComum,
  tipo: z.literal('trecho'),
  trechoId: Slug.optional(),
  modal: Modal,
  deCidadeId: Slug,
  paraCidadeId: Slug,
  numeroVoo: z.string().optional(),
  terminalSaida: z.string().optional(),
  terminalChegada: z.string().optional(),
  custo: z.number().nonnegative().optional(),
  statusDeReserva: StatusDeReserva.default('precisa-reservar'),
  /** Para voo internacional: offset do aeroporto de chegada, em minutos. */
  offsetChegadaMinutos: z.number().int().optional(),
  /**
   * Pais onde este trecho faz escala FORA do destino, quando faz. Existe
   * para uma regra so, e ela paga o campo: com visto de entrada unica, sair
   * do pais no meio do roteiro queima o visto, e o viajante descobre isso no
   * balcao de imigracao, com a passagem ja comprada.
   */
  escalaEmOutroPais: z.string().optional(),
});

export const Bloco = z.discriminatedUnion('tipo', [
  BlocoAtividade,
  BlocoRefeicao,
  BlocoTempoLivre,
  BlocoNota,
  BlocoTrecho,
]);
export type Bloco = z.infer<typeof Bloco>;
export type TipoDeBloco = Bloco['tipo'];

export const Hospedagem = z.object({
  nome: z.string().default(''),
  bairro: z.string().optional(),
  custoPorNoite: z.number().nonnegative().optional(),
  moeda: Moeda.default('COP'),
  confirmada: z.boolean().default(false),
  link: Url.optional(),
  checkInHHMM: z.string().optional(),
  checkOutHHMM: z.string().optional(),
});

export const Dia = z.object({
  id: z.string().min(1),
  data: IsoDate,
  /** Cidade onde o viajante dorme nesta noite. Vazio = noite sem base. */
  cidadeBaseId: Slug.optional(),
  hospedagem: Hospedagem.optional(),
  blocos: z.array(Bloco).default([]),
});
export type Dia = z.infer<typeof Dia>;

export const Reserva = z.object({
  id: z.string().min(1),
  /** Bloco ou item a que a reserva se refere. */
  blocoId: z.string().optional(),
  itemId: Slug.optional(),
  titulo: z.string().min(1),
  status: StatusDeReserva,
  prazoAte: IsoDate.optional(),
  codigoDeConfirmacao: z.string().optional(),
  valorPago: z.number().nonnegative().optional(),
  moeda: Moeda.optional(),
  contato: z.string().optional(),
  link: Url.optional(),
  observacao: z.string().optional(),
  /**
   * MELHORIA 14 — o e-mail de confirmacao colado inteiro. Guardar o texto
   * cru importa mais que extrair campos: quando o extrator erra, o original
   * continua ali.
   */
  textoColado: z.string().optional(),
});
export type Reserva = z.infer<typeof Reserva>;

/**
 * Escolha do usuario para uma LACUNA entre dois blocos.
 * A chave e o id da lacuna (derivado dos blocos vizinhos), nao um bloco
 * salvo - e isso que impede deslocamento velho de sobrar na agenda.
 */
export const EscolhaDeDeslocamento = z.object({
  modal: Modal,
  /** Minutos informados a mao, quando o usuario sabe melhor que o estimador. */
  minutosManuais: z.number().int().positive().optional(),
});

/**
 * Quantos BRL vale 1 unidade de cada moeda, por codigo ISO.
 * Generico de proposito: o app e multi-destino e cada pacote tem a sua moeda
 * (COP na Colombia, MXN no Mexico). BRL e sempre 1 e nao precisa estar aqui.
 * Editavel pelo usuario, por isso `manual`.
 */
export const Cambio = z.object({
  taxas: z.record(z.string().length(3), z.number().positive()),
  atualizadoEm: IsoDate,
  manual: z.boolean().default(true),
});
export type Cambio = z.infer<typeof Cambio>;

/**
 * MELHORIA 9 — gasto real.
 * Durante a viagem o usuario anota o que gastou de fato. O orcamento passa a
 * comparar planejado com real, em vez de so projetar.
 */
export const Gasto = z.object({
  id: z.string().min(1),
  data: IsoDate,
  descricao: z.string().min(1),
  valor: z.number().nonnegative(),
  moeda: Moeda,
  categoria: z.enum([
    'atividades',
    'refeicoes',
    'hospedagem',
    'transporte-entre-cidades',
    'transporte-local',
    'compras',
    'taxas-obrigatorias',
    'outros',
  ]),
  diaId: z.string().optional(),
  blocoId: z.string().optional(),
  observacao: z.string().optional(),
});
export type Gasto = z.infer<typeof Gasto>;

/**
 * MELHORIA 7 — "eu confirmei isto".
 * O usuario liga para a locadora, confirma o preco e marca aqui. Vira uma
 * camada DELE por cima do banco, com a data dele. O banco continua intocado:
 * a interface mostra os dois e deixa claro qual e qual.
 */
export const ConfirmacaoDoUsuario = z.object({
  /** O que foi conferido: "preco", "horario", "telefone", "existe ainda". */
  campo: z.string().min(1),
  confirmadoEm: IsoDate,
  /** O valor que ele apurou, quando difere do banco. */
  valorApurado: z.string().optional(),
  comoConfirmou: z.string().optional(),
  observacao: z.string().optional(),
});
export type ConfirmacaoDoUsuario = z.infer<typeof ConfirmacaoDoUsuario>;

/** MELHORIA 20 — tirar da frente o que ele ja viu ou nao quer. */
export const MotivoDeDescarte = z.enum(['ja-fui', 'nao-quero', 'fechado-agora']);

export const Viagem = z.object({
  versaoSchema: z.literal(VERSAO_SCHEMA_VIAGEM),
  id: z.string().min(1),
  nome: z.string().min(1),
  destinoId: Slug,
  origem: z.object({
    cidade: z.string().min(1),
    aeroportos: z.array(z.string().length(3)).default([]),
    /**
     * Fuso de casa, em minutos. Serve para a tela do dia dizer quanto o
     * relogio do destino esta a frente ou atras do de casa. Opcional porque
     * uma viagem criada antes deste campo nao sabe: chutar -180 para todo
     * mundo seria inventar um dado do usuario. Quem cria a viagem le o
     * offset do proprio aparelho, que e factual.
     */
    fusoOffsetMinutos: z.number().int().optional(),
  }),
  viajantes: z.object({
    adultos: z.number().int().positive(),
    criancas: z.number().int().nonnegative().default(0),
    /**
     * Codigo ISO de 2 letras. Decide quais requisitos de entrada do destino
     * se aplicam: o mesmo pais pode exigir visto de um e nao de outro.
     */
    nacionalidade: z.string().length(2).default('BR'),
  }),
  estilo: Estilo,
  ritmo: Ritmo,
  interesses: z.array(z.string()).default([]),
  orcamento: z
    .object({
      moeda: Moeda.default('BRL'),
      porPessoa: z.number().positive().optional(),
      total: z.number().positive().optional(),
      incluiVoosInternacionais: z.boolean().default(true),
    })
    .optional(),
  /**
   * O voo internacional (ou o aereo de ida e volta ate o destino).
   *
   * Por que fica na VIAGEM e nao no pacote: o pacote tem a rota pesquisada,
   * com faixa de preco e link de busca; o que custa de verdade e a cotacao
   * que o viajante achou no dia em que comprou. O banco informa, a viagem
   * decide.
   *
   * Preco de voo a treze meses de distancia e ficcao — por isso o campo
   * aceita `precoPorPessoa` vazio: a rota entra no plano, o numero entra
   * quando existir.
   */
  voo: z
    .object({
      /** id da rota em voos-internacionais.json, quando veio do banco. */
      rotaId: z.string().optional(),
      rotulo: z.string().default(''),
      precoPorPessoa: z.number().nonnegative().optional(),
      moeda: Moeda.default('BRL'),
      comprado: z.boolean().default(false),
      observacao: z.string().optional(),
    })
    .optional(),
  cambio: Cambio,
  dias: z.array(Dia).default([]),
  favoritos: z.array(Slug).default([]),
  reservas: z.array(Reserva).default([]),
  deslocamentos: z.record(z.string(), EscolhaDeDeslocamento).default({}),
  /** MELHORIA 9: o que foi gasto de verdade. */
  gastos: z.array(Gasto).default([]),
  /** MELHORIA 7: confirmacoes do usuario, por id de item. */
  confirmacoes: z.record(Slug, z.array(ConfirmacaoDoUsuario)).default({}),
  /** MELHORIA 20: itens que nao devem mais aparecer em Descobrir. */
  descartados: z.record(Slug, MotivoDeDescarte).default({}),
  /**
   * Situacao de cada documento de entrada, por id do documento no pacote.
   * O pacote diz o que o pais exige; isto diz em que pe ele esta.
   */
  documentos: z.record(z.string(), AnotacaoDeDocumento).default({}),
  criadoEm: z.string().min(1),
  atualizadoEm: z.string().min(1),
});
export type Viagem = z.infer<typeof Viagem>;

/**
 * MELHORIA 18 — varias viagens guardadas.
 * Colombia e Mexico lado a lado, nao uma sobrescrevendo a outra. O
 * armazenamento guarda a biblioteca inteira, nao uma viagem solta.
 */
export const Biblioteca = z.object({
  versaoSchema: z.literal(VERSAO_SCHEMA_VIAGEM),
  viagens: z.array(Viagem).default([]),
  /** Qual viagem esta aberta. */
  viagemAtivaId: z.string().optional(),
  atualizadoEm: z.string().min(1),
});
export type Biblioteca = z.infer<typeof Biblioteca>;
