import { z } from 'zod';
import { BaseRecord, IsoDate, Slug } from './base.ts';

/**
 * Feriado, festa ou evento com impacto real na viagem.
 * escopo e nacional ou o id de uma cidade ou regiao.
 * A Colombia transfere varios feriados para a segunda-feira seguinte
 * (Ley Emiliani), por isso transferidoParaSegunda e um campo proprio:
 * e o erro mais facil de cometer num calendario colombiano.
 */
export const EventoLocal = BaseRecord.extend({
  nome: z.string().min(1),
  tipo: z.enum(['feriado-nacional', 'feriado-local', 'festa', 'evento', 'temporada']),
  dataInicio: IsoDate,
  dataFim: IsoDate.optional(),
  escopo: z.union([z.literal('nacional'), Slug]),
  transferidoParaSegunda: z.boolean().optional(),
  impacto: z.object({
    preco: z.enum(['sobe-muito', 'sobe', 'neutro', 'cai']).default('neutro'),
    lotacao: z.enum(['alta', 'media', 'baixa']).default('media'),
    fechamentos: z.string().default(''),
    seguranca: z.string().optional(),
  }),
  valeEstarPresente: z.enum(['sim', 'depende', 'evite']).optional(),
  descricao: z.string().default(''),
}).refine((e) => !e.dataFim || e.dataFim >= e.dataInicio, {
  message: 'dataFim deve ser igual ou posterior a dataInicio',
});
export type EventoLocal = z.infer<typeof EventoLocal>;
