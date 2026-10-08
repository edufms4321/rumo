import { z } from 'zod';

/**
 * Primitives shared by every record in a destination pack.
 * Version-agnostic on purpose: no `z.url()` / `z.string().url()`, so the schema
 * behaves the same on Zod 3 and Zod 4.
 */

export const Url = z
  .string()
  .regex(/^https?:\/\/[^\s]+$/, 'deve ser uma URL http(s) completa');

export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use letras minusculas, numeros e hifens');

export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'data inexistente');

/** Wall-clock time, 00:00 to 23:59. The app never stores timezones in the agenda. */
export const HoraHHMM = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'use o formato HH:MM');

export const Moeda = z.enum(['COP', 'BRL', 'USD', 'EUR']);
export type Moeda = z.infer<typeof Moeda>;

/**
 * How much we trust a record.
 * verificado = site oficial, ou duas fontes independentes que concordam
 * parcial    = uma fonte razoavel
 * estimado   = deduzido pelo agente; a interface mostra isso ao usuario
 */
export const Confianca = z.enum(['verificado', 'parcial', 'estimado']);
export type Confianca = z.infer<typeof Confianca>;

export const Fonte = z.object({
  url: Url,
  titulo: z.string().min(1).optional(),
  /** Quando a propria fonte foi publicada, se ela informa. */
  publicadoEm: IsoDate.optional(),
});
export type Fonte = z.infer<typeof Fonte>;

/**
 * Every record in /data carries provenance. `fontes` has `.min(1)` so the
 * validator refuses a pack with an unsourced record - that is the mechanical
 * guarantee against invented data, not a promise.
 */
export const BaseRecord = z.object({
  id: Slug,
  fontes: z.array(Fonte).min(1, 'todo registro precisa de pelo menos uma fonte'),
  coletadoEm: IsoDate,
  confianca: Confianca,
  /** Texto livre para o usuario entender a limitacao do dado. */
  observacaoDeConfianca: z.string().optional(),
});

export const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coord = z.infer<typeof Coord>;

export const BoundingBox = z.object({
  latMin: z.number().min(-90).max(90),
  latMax: z.number().min(-90).max(90),
  lngMin: z.number().min(-180).max(180),
  lngMax: z.number().min(-180).max(180),
});
export type BoundingBox = z.infer<typeof BoundingBox>;

/** Preco e sempre faixa + moeda + data, nunca um numero solto. */
export const Preco = z
  .object({
    moeda: Moeda,
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    por: z.enum(['pessoa', 'grupo']),
    /** O que o preco inclui. Vazio quando a fonte nao diz. */
    inclui: z.string().default(''),
    coletadoEm: IsoDate,
    fontes: z.array(Fonte).default([]),
    /** Ex.: "preco de 2025, confirmar" */
    observacao: z.string().optional(),
  })
  .refine((p) => p.max >= p.min, { message: 'preco.max deve ser >= preco.min', path: ['max'] });
export type Preco = z.infer<typeof Preco>;

export const FaixaDeDiaria = z.object({
  moeda: Moeda,
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

/** Duracao em MINUTOS. `tipica` e o que o app usa como padrao ao arrastar. */
export const Duracao = z
  .object({
    min: z.number().int().positive(),
    tipica: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .refine((d) => d.min <= d.tipica && d.tipica <= d.max, {
    message: 'duracao precisa satisfazer min <= tipica <= max',
  });
export type Duracao = z.infer<typeof Duracao>;

export const DiaDaSemana = z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
export type DiaDaSemana = z.infer<typeof DiaDaSemana>;

export const JanelaDeFuncionamento = z
  .object({ abre: HoraHHMM, fecha: HoraHHMM })
  .refine((j) => j.abre < j.fecha, { message: 'abre deve ser antes de fecha no mesmo dia' });

/**
 * Horario de um dia. A ausencia da chave significa DESCONHECIDO, nao fechado -
 * distincao que o motor de regras usa para escolher entre alertar e calar.
 */
export const HorarioDoDia = z.union([
  z.literal('fechado'),
  z.literal('24h'),
  z.array(JanelaDeFuncionamento).min(1),
]);
export type HorarioDoDia = z.infer<typeof HorarioDoDia>;

export const Horarios = z
  .object({
    seg: HorarioDoDia,
    ter: HorarioDoDia,
    qua: HorarioDoDia,
    qui: HorarioDoDia,
    sex: HorarioDoDia,
    sab: HorarioDoDia,
    dom: HorarioDoDia,
  })
  .partial();
export type Horarios = z.infer<typeof Horarios>;

export const Contato = z
  .object({
    telefone: z.string().min(1).optional(),
    whatsapp: z.string().min(1).optional(),
    site: Url.optional(),
    instagram: z.string().min(1).optional(),
    email: z.string().min(3).optional(),
    endereco: z.string().min(1).optional(),
  })
  .default({});
export type Contato = z.infer<typeof Contato>;

/**
 * Imagem com licenca explicita. Sem credito e licenca, o registro nao passa -
 * e a interface mostra um placeholder em vez de foto de origem duvidosa.
 */
export const Imagem = z.object({
  url: Url,
  credito: z.string().min(1, 'imagem precisa de credito do autor'),
  licenca: z.string().min(1, 'imagem precisa de licenca explicita'),
  fonte: Url,
  descricao: z.string().optional(),
});
export type Imagem = z.infer<typeof Imagem>;

export const Modal = z.enum([
  'a-pe',
  'carro-app',
  'transporte-publico',
  'veiculo-alugado',
  'bicicleta',
  'voo',
  'onibus',
  'barco',
  'carro-fretado',
]);
export type Modal = z.infer<typeof Modal>;
