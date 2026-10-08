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
  /**
   * Os dois primeiros campos sao OPCIONAIS: a pesquisa quase sempre descreve
   * o impacto em prosa ("sem dado numerico; hotelaria tende a subir") e nao
   * em categoria. Ausente = desconhecido, e a prosa original fica em
   * `observacao`. Preencher um padrao aqui seria inventar intensidade.
   */
  impacto: z.object({
    preco: z.enum(['sobe-muito', 'sobe', 'neutro', 'cai']).optional(),
    lotacao: z.enum(['alta', 'media', 'baixa']).optional(),
    fechamentos: z.string().default(''),
    seguranca: z.string().optional(),
    observacao: z.string().optional(),
  }),
  valeEstarPresente: z.enum(['sim', 'depende', 'evite']).optional(),
  descricao: z.string().default(''),
}).refine((e) => !e.dataFim || e.dataFim >= e.dataInicio, {
  message: 'dataFim deve ser igual ou posterior a dataInicio',
});
export type EventoLocal = z.infer<typeof EventoLocal>;
