import { z } from 'zod';
import {
  BaseRecord,
  Contato,
  Coord,
  Duracao,
  HoraHHMM,
  Horarios,
  Imagem,
  Preco,
  Slug,
  Url,
} from './base.ts';

export const Categoria = z.enum([
  'atracao',
  'passeio',
  'praia',
  'museu',
  'restaurante',
  'cafe',
  'bar',
  'compras',
  'aluguel-veiculo',
  'experiencia',
  'mirante',
  'natureza',
]);
export type Categoria = z.infer<typeof Categoria>;

/** Selos exibidos no card. Derivam do dado, mas podem ser escritos a mao. */
export const Selo = z.enum([
  'precisa-reservar',
  'imperdivel',
  'so-de-manha',
  'so-de-tarde',
  'depende-do-clima',
  'depende-da-mare',
  'esgota-rapido',
  'pega-turista',
  'vale-cada-peso',
  'corte-se-apertar',
  'gratuito',
]);
export type Selo = z.infer<typeof Selo>;

export const Restricoes = z
  .object({
    idadeMinima: z.number().int().nonnegative().optional(),
    condicionamento: z.enum(['baixo', 'medio', 'alto']).optional(),
    dependeDeClima: z.boolean().optional(),
    dependeDeMare: z.boolean().optional(),
    /** Ativa a regra de luz do dia: atividade nao pode terminar depois do anoitecer. */
    dependeDeLuzDoDia: z.boolean().optional(),
    acessibilidade: z.string().optional(),
    /** Ativa a regra de nao voar depois de mergulhar. Horas de espera. */
    naoVoarDepoisHoras: z.number().int().positive().optional(),
    outras: z.array(z.string()).default([]),
  })
  .default({ outras: [] });

/** Extra da categoria aluguel-veiculo: buggy, mulita, carrinho, scooter, carro. */
export const Aluguel = z.object({
  tipos: z
    .array(
      z.object({
        veiculo: z.string().min(1),
        periodo: z.string().min(1),
        preco: Preco.optional(),
        capacidade: z.number().int().positive().optional(),
      }),
    )
    .min(1),
  documentosExigidos: z.array(z.string()).default([]),
  idadeMinima: z.number().int().positive().optional(),
  deposito: z.string().optional(),
  combustivel: z.string().optional(),
  seguro: z.string().optional(),
  regras: z.array(z.string()).default([]),
});

/** Extra da categoria passeio: barco, tour com saida marcada. */
export const Passeio = z.object({
  pontoPartida: z.string().min(1),
  coordsPartida: Coord.optional(),
  /** Vazio significa saida flexivel. Com valores, o motor trava o inicio do bloco. */
  horariosDeSaida: z.array(HoraHHMM).default([]),
  horarioFixo: z.boolean().default(false),
  retornoAproximadoHHMM: HoraHHMM.optional(),
  incluiTransporte: z.boolean().optional(),
  pontoRetorno: z.string().optional(),
});

/** Extra das categorias de comida e bebida. */
export const Gastronomia = z.object({
  tipoCozinha: z.array(z.string()).default([]),
  faixa: z.enum(['barato', 'medio', 'caro', 'muito-caro']).optional(),
  reservaRecomendada: z.boolean().optional(),
});

export const Item = BaseRecord.extend({
  nome: z.string().min(1),
  cidadeId: Slug,
  categoria: Categoria,
  tags: z.array(z.string()).default([]),
  coords: Coord.optional(),
  descricaoCurta: z.string().min(1).max(220),
  descricaoLonga: z.string().default(''),
  duracao: Duracao,
  horarios: Horarios.optional(),
  horariosObservacao: z.string().optional(),
  diasFechados: z.array(z.string()).default([]),
  fechaEmFeriado: z.boolean().optional(),
  melhorHorario: z.string().optional(),
  preco: Preco.optional(),
  gratuito: z.boolean().optional(),
  reserva: z
    .object({
      necessaria: z.boolean(),
      antecedenciaDias: z.number().int().nonnegative().optional(),
      esgotaRapido: z.boolean().optional(),
      link: Url.optional(),
      comoReservar: z.string().optional(),
    })
    .default({ necessaria: false }),
  contato: Contato,
  imagens: z.array(Imagem).default([]),
  restricoes: Restricoes,
  selos: z.array(Selo).default([]),
  /** Voz do agente de viagens: por que vale, como nao cair em armadilha. */
  dicas: z.array(z.string()).default([]),
  alertas: z.array(z.string()).default([]),
  aluguel: Aluguel.optional(),
  passeio: Passeio.optional(),
  gastronomia: Gastronomia.optional(),
}).superRefine((item, ctx) => {
  if (item.categoria === 'aluguel-veiculo' && !item.aluguel) {
    ctx.addIssue({
      code: 'custom',
      path: ['aluguel'],
      message: 'categoria aluguel-veiculo exige o bloco aluguel',
    });
  }
  if (item.categoria === 'passeio' && !item.passeio) {
    ctx.addIssue({
      code: 'custom',
      path: ['passeio'],
      message: 'categoria passeio exige o bloco passeio com pontoPartida',
    });
  }
  if (item.gratuito === true && item.preco) {
    ctx.addIssue({
      code: 'custom',
      path: ['preco'],
      message: 'item marcado como gratuito nao pode ter preco',
    });
  }
  if (item.preco && item.preco.max === 0 && item.gratuito !== true) {
    ctx.addIssue({
      code: 'custom',
      path: ['preco', 'max'],
      message: 'preco zerado: marque gratuito ou omita o preco quando nao foi encontrado',
    });
  }
});
export type Item = z.infer<typeof Item>;
