import { z } from 'zod';
import { BaseRecord, Coord, FaixaDeDiaria, Fonte, Slug, Url } from './base.ts';

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
  /** Deslocamento tipico aeroporto <-> centro, em minutos. */
  tempoAoCentroMin: z.number().int().positive(),
  antecedenciaDomesticaMin: z.number().int().positive(),
  antecedenciaInternacionalMin: z.number().int().positive(),
  desembarqueDomesticoMin: z.number().int().positive(),
  desembarqueInternacionalMin: z.number().int().positive(),
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
  noitesRecomendadas: z
    .object({
      min: z.number().int().positive(),
      ideal: z.number().int().positive(),
      max: z.number().int().positive(),
    })
    .refine((n) => n.min <= n.ideal && n.ideal <= n.max, {
      message: 'noites precisam satisfazer min <= ideal <= max',
    }),
  bairros: z.array(Bairro).default([]),
  comoCircular: z.string().min(1),
  fatoresDeslocamento: z.object({
    'a-pe': FatorDeslocamento,
    'carro-app': FatorDeslocamento,
    'transporte-publico': FatorDeslocamento,
    'veiculo-alugado': FatorDeslocamento,
    bicicleta: FatorDeslocamento.optional(),
  }),
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
  /** Nascer e por do sol tipicos, usados pela regra de luz do dia. */
  luzDoDia: z
    .object({ amanhecerHHMM: z.string(), anoitecerHHMM: z.string(), fontes: z.array(Fonte).default([]) })
    .optional(),
  mapaReferencia: Url.optional(),
});
export type CidadeBase = z.infer<typeof CidadeBase>;
