import { z } from 'zod';
import { BaseRecord, FaixaDeDiaria, Slug, Url } from './base.ts';

/** Sugestao de hospedagem por bairro e faixa. Nao pretende ser exaustiva. */
export const SugestaoHospedagem = BaseRecord.extend({
  cidadeId: Slug,
  bairro: z.string().min(1),
  nome: z.string().optional(),
  perfil: z.enum(['economico', 'conforto', 'premium']),
  tipo: z.enum(['hostel', 'hotel', 'pousada', 'apartamento', 'resort']).optional(),
  diaria: FaixaDeDiaria,
  porQue: z.string().default(''),
  link: Url.optional(),
});
export type SugestaoHospedagem = z.infer<typeof SugestaoHospedagem>;
