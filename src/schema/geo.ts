import { z } from 'zod';
import { BaseRecord, Coord, FaixaDeDiaria, Fonte, Preco, Slug, Url } from './base.ts';

export const Regiao = BaseRecord.extend({
  nome: z.string().min(1),
  descricaoCurta: z.string().min(1),
});
export type Regiao = z.infer<typeof Regiao>;

export const Aeroporto = BaseRecord.extend({
  iata: z.string().length(3),
  nome: z.string().min(1),
  cidadeNome: z.string().min(1),
  coords: Coord,
  /**
   * Minutos. Todos OPCIONAIS de proposito: a pesquisa raramente acha esses
   * numeros em fonte citavel. Ausente = desconhecido, e o motor usa o padrao
   * documentado em src/engine/ rotulado como estimativa. Preferimos a
   * estimativa visivelmente vinda do motor a um numero sem fonte no banco.
   */
  tempoAoCentroMin: z.number().int().positive().optional(),
  antecedenciaDomesticaMin: z.number().int().positive().optional(),
  antecedenciaInternacionalMin: z.number().int().positive().optional(),
  desembarqueDomesticoMin: z.number().int().positive().optional(),
  desembarqueInternacionalMin: z.number().int().positive().optional(),
  observacoes: z.string().optional(),
});
export type Aeroporto = z.infer<typeof Aeroporto>;

export const ClimaDoMes = z.object({
  /** 1 = janeiro. */
  mes: z.number().int().min(1).max(12),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  chuvaMm: z.number().nonnegative(),
  diasDeChuva: z.number().nonnegative(),
  resumo: z.string().min(1),
  marEVento: z.string().optional(),
  planoBChuva: z.string().optional(),
  pesoNaDecisao: z.enum(['alto', 'medio', 'baixo']),
  fontes: z.array(Fonte).min(1),
});
export type ClimaDoMes = z.infer<typeof ClimaDoMes>;

export const Bairro = z.object({
  nome: z.string().min(1),
  perfil: z.string().min(1),
  diariaFaixa: FaixaDeDiaria.optional(),
  observacao: z.string().optional(),
  seguranca: z.string().optional(),
  fontes: z.array(Fonte).default([]),
});

/**
 * Fatores do estimador de deslocamento (camada 3). `kmh` e a velocidade media
 * real do modal naquela cidade; `fatorRota` corrige a distancia em linha reta
 * para a distancia percorrida (ruas, contornos, agua).
 * Tudo que sai daqui e rotulado "estimativa" na interface.
 */
export const FatorDeslocamento = z.object({
  kmh: z.number().positive(),
  fatorRota: z.number().min(1).max(3),
});

export const CidadeBase = BaseRecord.extend({
  nome: z.string().min(1),
  regiaoId: Slug,
  coords: Coord,
  altitudeM: z.number().int(),
  aeroportos: z.array(z.string().length(3)).default([]),
  /**
   * Ausente = ainda nao pesquisado. A sugestao de noites por cidade
   * simplesmente nao opina sobre essa base, em vez de inventar um numero.
   */
  noitesRecomendadas: z
    .object({
      min: z.number().int().positive(),
      ideal: z.number().int().positive(),
      max: z.number().int().positive(),
    })
    .refine((n) => n.min <= n.ideal && n.ideal <= n.max, {
      message: 'noites precisam satisfazer min <= ideal <= max',
    })
    .optional(),
  bairros: z.array(Bairro).default([]),
  comoCircular: z.string().optional(),
  /**
   * Ausente = o motor usa o padrao documentado em src/engine/, rotulado como
   * estimativa. Assim uma base com pesquisa parcial continua planejavel: o
   * usuario nunca e impedido de montar o roteiro que quiser, so avisado.
   */
  fatoresDeslocamento: z
    .object({
      'a-pe': FatorDeslocamento,
      'carro-app': FatorDeslocamento,
      'transporte-publico': FatorDeslocamento,
      'veiculo-alugado': FatorDeslocamento,
      bicicleta: FatorDeslocamento.optional(),
    })
    .optional(),
  /** Pares intra-cidade autorados (camada 2). Minutos porta a porta. */
  matrizInterna: z
    .array(
      z.object({
        de: Slug,
        para: Slug,
        modal: z.string().min(1),
        minutos: z.number().int().positive(),
        fontes: z.array(Fonte).default([]),
      }),
    )
    .default([]),
  climaPorMes: z.array(ClimaDoMes).default([]),
  seguranca: z.string().optional(),
  pegaTuristaAEvitar: z.array(z.string()).default([]),
  /**
   * Taxas que o viajante paga so por estar na cidade ou na ilha, independente
   * do que faca (ex.: Tarjeta de Turismo de San Andres). O motor soma isso ao
   * orcamento na primeira noite da cidade.
   */
  taxasObrigatorias: z
    .array(
      z.object({
        nome: z.string().min(1),
        preco: Preco,
        comoSePaga: z.string().default(''),
        quemPaga: z.string().default('todo visitante nao residente'),
      }),
    )
    .default([]),
  /**
   * Nascer e por do sol NAO ficam aqui: dependem da data e o motor os calcula
   * a partir de `coords` e do dia. Guardar valor fixo seria chute com cara
   * de dado.
   */
  mapaReferencia: Url.optional(),
});
export type CidadeBase = z.infer<typeof CidadeBase>;
