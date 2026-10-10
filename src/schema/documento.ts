/**
 * Documentos e taxas de entrada no pais.
 *
 * Por que isto nao e so um texto em `RequisitoDeEntrada.observacoes`: a regra
 * do visto de entrada unica precisa ser LIDA pelo motor. O e-visto mexicano
 * vale para UMA entrada e so por via aerea; um roteiro que sai do pais e
 * volta queima o visto no meio da viagem e o viajante descobre no balcao.
 * Para o app avisar isso antes, `entradasPermitidas` e `vias` tem de ser
 * campos, nao prosa.
 *
 * O resto dos campos existe para a tela: prazo, custo, link oficial e como
 * pedir sao exatamente o que o viajante precisa ter na mao, e o status fica
 * na viagem (`viagem.documentos`), nao aqui — o pacote e somente leitura.
 *
 * A escala de confianca e a mesma do resto do projeto
 * (`verificado | parcial | estimado`), e ela se aplica SEPARADAMENTE ao
 * requisito e ao preco: o Visitax existe segundo o portal oficial do estado
 * (verificado), mas o portal nao publica o valor, que varia com a UMA — o
 * preco entra como faixa estimada, com as fontes de imprensa que achei.
 */
import { z } from 'zod';
import { BaseRecord, Preco, Url } from './base.ts';

export const TipoDeDocumento = z.enum([
  'passaporte',
  'visto',
  'taxa',
  'formulario',
  'vacina',
  'seguro',
]);
export type TipoDeDocumento = z.infer<typeof TipoDeDocumento>;

/** Por onde a entrada vale. O e-visto mexicano so vale por via aerea. */
export const ViaDeEntrada = z.enum(['aerea', 'terrestre', 'maritima']);
export type ViaDeEntrada = z.infer<typeof ViaDeEntrada>;

export const DocumentoDeEntrada = BaseRecord.extend({
  nome: z.string().min(1),
  tipo: TipoDeDocumento,
  /** false = recomendado, nao exigido. A tela separa os dois. */
  obrigatorio: z.boolean().default(true),
  /**
   * Nacionalidades a que se aplica, em ISO de 2 letras. Vazio = todo mundo:
   * o Visitax de Quintana Roo cobra de qualquer estrangeiro, e repetir o
   * registro por nacionalidade seria duplicar o mesmo dado.
   */
  nacionalidades: z.array(z.string().length(2)).default([]),
  resumo: z.string().min(1),
  custo: Preco.optional(),
  linkOficial: Url.optional(),
  comoPedir: z.string().optional(),
  /** Em palavras: "antes do embarque", "antes de sair do estado". */
  prazo: z.string().optional(),
  /**
   * Quantos dias antes da viagem resolver. Alimenta a fila de reservas, que
   * ordena por prazo. Ausente = o app nao opina sobre a urgencia.
   */
  diasAntesDaViagem: z.number().int().nonnegative().optional(),
  /** 1 = entrada unica. Ausente = a fonte nao diz, e o motor nao supoe. */
  entradasPermitidas: z.number().int().positive().optional(),
  vias: z.array(ViaDeEntrada).default([]),
  validadeDias: z.number().int().positive().optional(),
  /** Quem esta dispensado. Texto, porque a lista real e irregular. */
  isencoes: z.array(z.string()).default([]),
  /**
   * 'nacional' ou o id de um estado/cidade do pacote. O Visitax vale so em
   * Quintana Roo: cobrar de quem fica em Oaxaca seria errado.
   */
  escopo: z.string().default('nacional'),
  observacoes: z.string().optional(),
});
export type DocumentoDeEntrada = z.infer<typeof DocumentoDeEntrada>;

/** Estado de cada documento NA VIAGEM. Mora em `viagem.documentos`. */
export const StatusDoDocumento = z.enum([
  'pendente',
  'em-andamento',
  'pronto',
  'nao-se-aplica',
]);
export type StatusDoDocumento = z.infer<typeof StatusDoDocumento>;

export const AnotacaoDeDocumento = z.object({
  status: StatusDoDocumento.default('pendente'),
  observacao: z.string().optional(),
  /** Numero de protocolo, codigo do e-visto, o que ele quiser guardar. */
  codigo: z.string().optional(),
  anotadoEm: z.string().optional(),
});
export type AnotacaoDeDocumento = z.infer<typeof AnotacaoDeDocumento>;
