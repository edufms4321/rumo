import { z } from 'zod';
import { BaseRecord, Contato, FaixaDeDiaria, Slug, Url } from './base.ts';

/**
 * Onde dormir: tanto a sugestao de BAIRRO ("fique em Getsemani, e aqui o que
 * se ganha e o que se perde") quanto o LUGAR com nome ("Hostel X, cama em
 * dormitorio a partir de 45 mil COP").
 *
 * As duas formas no mesmo registro de proposito: quem procura cama barata
 * precisa das duas respostas juntas, e separa-las em duas colecoes obrigaria
 * a interface a costurar o que o viajante le como uma coisa so. Registro sem
 * `nome` e sugestao de bairro; com `nome` e um lugar.
 *
 * `diaria` e OPCIONAL, e essa foi a mudanca que destravou a pesquisa: o
 * preco de hostel so existe, na pratica, nos agregadores — Booking,
 * Hostelworld, Airbnb — cujos termos de uso e robots.txt proibem acesso
 * automatizado. Sem o campo opcional, a unica saida seria inventar preco ou
 * descartar o lugar. Lugar com nome, bairro e site oficial, mesmo sem preco,
 * vale muito mais que linha nenhuma: o viajante abre o site e confere.
 */
export const SugestaoHospedagem = BaseRecord.extend({
  cidadeId: Slug,
  bairro: z.string().min(1),
  nome: z.string().optional(),
  perfil: z.enum(['economico', 'conforto', 'premium']),
  tipo: z.enum(['hostel', 'hotel', 'pousada', 'apartamento', 'camping', 'resort']).optional(),
  /**
   * Preco de referencia. Quando `porCama` e verdadeiro, e o valor de UMA
   * CAMA em dormitorio compartilhado — nao do quarto. Confundir os dois
   * numa viagem de duas pessoas erra o orcamento pela metade.
   */
  diaria: FaixaDeDiaria.optional(),
  porCama: z.boolean().default(false),
  /** Quarto privativo no mesmo lugar, quando a fonte publica os dois. */
  diariaPrivativo: FaixaDeDiaria.optional(),
  porQue: z.string().default(''),
  link: Url.optional(),
  endereco: z.string().optional(),
  contato: Contato.optional(),
  cafeIncluso: z.boolean().optional(),
  cozinhaCompartilhada: z.boolean().optional(),
  /** Frase honesta sobre seguranca da zona, quando houver fonte. */
  seguranca: z.string().optional(),
  alertas: z.array(z.string()).default([]),
});
export type SugestaoHospedagem = z.infer<typeof SugestaoHospedagem>;
