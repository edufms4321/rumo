import { z } from 'zod';
import { BaseRecord, Modal, Preco, Slug, Url } from './base.ts';

/**
 * Trecho entre duas cidades-base.
 * duracaoPortaAPortaMin e o numero que o motor usa: ja inclui ida ao terminal,
 * antecedencia, embarque, desembarque e traslado na chegada.
 * duracaoVeiculoMin fica apenas para exibicao.
 */
export const TrechoEntreCidades = BaseRecord.extend({
  deCidadeId: Slug,
  paraCidadeId: Slug,
  modal: Modal,
  operadoras: z.array(z.string()).default([]),
  /**
   * Opcional: quando a pesquisa so acha o tempo do veiculo (duracao do voo,
   * do onibus), este campo fica ausente e o motor soma acesso ao terminal,
   * antecedencia e traslado a partir do dado do aeroporto, rotulando o
   * resultado como estimativa. Melhor isso do que um numero sem fonte aqui.
   */
  duracaoPortaAPortaMin: z.number().int().positive().optional(),
  duracaoVeiculoMin: z.number().int().positive().optional(),
  frequencia: z.string().optional(),
  preco: Preco.optional(),
  terminalSaida: z.string().optional(),
  terminalChegada: z.string().optional(),
  antecedenciaDiasParaComprar: z.number().int().nonnegative().optional(),
  observacoes: z.string().optional(),
  alertas: z.array(z.string()).default([]),
}).refine((t) => t.deCidadeId !== t.paraCidadeId, {
  message: 'trecho precisa ligar cidades diferentes',
});
export type TrechoEntreCidades = z.infer<typeof TrechoEntreCidades>;

/**
 * Voo internacional origem para destino.
 * Preco e fotografia do dia: a interface sempre mostra coletadoEm e o
 * linkDeBusca ao lado da faixa, para o usuario conferir na hora.
 */
export const VooInternacional = BaseRecord.extend({
  origemIata: z.string().length(3),
  destinoIata: z.string().length(3),
  cias: z.array(z.string()).min(1),
  escalas: z.string().optional(),
  duracaoTotalMin: z.number().int().positive(),
  frequencia: z.string().optional(),
  preco: Preco.optional(),
  linkDeBusca: Url.optional(),
  observacoes: z.string().optional(),
});
export type VooInternacional = z.infer<typeof VooInternacional>;
