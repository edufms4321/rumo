import { z } from 'zod';
import { BaseRecord, BoundingBox, Fonte, Url } from './base.ts';
import { DocumentoDeEntrada } from './documento.ts';

/** Requisitos de entrada, por nacionalidade do viajante. */
export const RequisitoDeEntrada = z.object({
  nacionalidade: z.string().length(2, 'use o codigo ISO de 2 letras, ex.: BR'),
  documento: z.string().min(1),
  vistoNecessario: z.boolean(),
  validadeMinimaDoPassaporteMeses: z.number().int().nonnegative().optional(),
  vacinaFebreAmarela: z.string().optional(),
  formularioMigratorio: z.string().optional(),
  comprovantesExigidos: z.array(z.string()).default([]),
  seguroObrigatorio: z.boolean().optional(),
  observacoes: z.string().optional(),
  fontes: z.array(Fonte).min(1),
});

export const Destino = BaseRecord.extend({
  nome: z.string().min(1),
  /**
   * Nome do pais, separado de `nome`. Existe porque um pacote cobre uma
   * PARTE do pais: "Nordeste brasileiro" e o recorte, "Brasil" e o pais. A
   * tela inicial agrupa por pais e precisa dos dois para nao mentir que o
   * pacote cobre o pais inteiro.
   */
  paisNome: z.string().min(1).optional(),
  /**
   * O que este pacote NAO cobre, em uma frase. Aparece junto da arvore de
   * lugares. Sem isto, "Brasil" na tela inicial da a entender que da para
   * planejar Rio e Sao Paulo aqui, e nao da.
   */
  cobertura: z.string().optional(),
  codigoPais: z.string().length(2),
  moeda: z.string().length(3),
  fuso: z.string().min(1),
  /** Offset fixo em minutos. A Colombia e UTC-5 sem horario de verao. */
  fusoOffsetMinutos: z.number().int(),
  idiomas: z.array(z.string()).min(1),
  tomadas: z.string().optional(),
  voltagem: z.string().optional(),
  /** Usada pelo validador para reprovar coordenada fora do pais. */
  caixaDelimitadora: BoundingBox,
  entrada: z.array(RequisitoDeEntrada).min(1),
  /**
   * Documentos e taxas de entrada, em campos que o motor le. Separado de
   * `entrada` porque aquilo e a prosa do requisito e isto e o que a tela de
   * Documentos lista e a regra de visto de entrada unica valida. Default []
   * para um pacote antigo continuar carregando sem a pesquisa feita.
   */
  documentos: z.array(DocumentoDeEntrada).default([]),
  saude: z.object({
    vacinasRecomendadas: z.array(z.string()).default([]),
    aguaPotavel: z.string().optional(),
    altitudeAtencao: z.string().optional(),
    observacoes: z.string().optional(),
    fontes: z.array(Fonte).default([]),
  }),
  seguranca: z.object({
    orientacaoGeral: z.string().min(1),
    golpesComuns: z.array(z.string()).default([]),
    appsDeTransporte: z.array(z.string()).default([]),
    fontes: z.array(Fonte).default([]),
  }),
  dinheiro: z.object({
    cambioObservacao: z.string().optional(),
    cartaoAceito: z.string().optional(),
    saque: z.string().optional(),
    gorjeta: z.string().optional(),
    isencaoDeImpostoParaTurista: z.string().optional(),
    fontes: z.array(Fonte).default([]),
  }),
  conectividade: z.object({
    operadoras: z.array(z.string()).default([]),
    comoComprarChip: z.string().optional(),
    esim: z.string().optional(),
    fontes: z.array(Fonte).default([]),
  }),
  /**
   * MELHORIA 16 — contatos de emergencia num lugar so.
   * Opcional porque nem todo pacote vai ter isto pesquisado, e um campo
   * vazio e melhor que um numero errado numa emergencia.
   */
  emergencia: z
    .object({
      numeroUnico: z.string().optional(),
      policia: z.string().optional(),
      bombeiros: z.string().optional(),
      ambulancia: z.string().optional(),
      policiaTuristica: z.string().optional(),
      representacaoBrasileira: z
        .array(
          z.object({
            nome: z.string().min(1),
            tipo: z.enum(['embaixada', 'consulado-geral', 'consulado-honorario', 'vice-consulado']),
            cidade: z.string().min(1),
            endereco: z.string().optional(),
            telefone: z.string().optional(),
            /** Numero de plantao, so para emergencia de brasileiro. */
            plantao: z.string().optional(),
            email: z.string().optional(),
            horario: z.string().optional(),
            fontes: z.array(Fonte).min(1),
          }),
        )
        .default([]),
      observacoes: z.string().optional(),
      fontes: z.array(Fonte).default([]),
    })
    .optional(),
  linksUteis: z.array(z.object({ titulo: z.string().min(1), url: Url })).default([]),
});
export type Destino = z.infer<typeof Destino>;
