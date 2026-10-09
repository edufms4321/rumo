/**
 * Configuracao de conversao de um destino: o que o conversor precisa saber
 * para transformar a pesquisa crua daquele pais no pacote do banco.
 *
 * Por que isto existe e por que NAO contraria o criterio de aceite 7
 * ("adicionar destino = criar pasta de dados"):
 *
 * O APP le `/data/<destino>/` por `import.meta.glob` e nao precisa de nada
 * disto. Largar uma pasta pronta em /data coloca o destino no app, sem
 * codigo. Esta configuracao e da FERRAMENTA DE PESQUISA, que traduz texto de
 * agente para o schema - e isso exige conhecimento especifico do pais:
 * quais lugares sao base e quais sao bate-volta, como o agente escreveu o
 * nome de cada cidade, que aeroporto serve que base.
 */

export interface CaixaDelimitadora {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface FatorDeModal {
  kmh: number;
  fatorRota: number;
}

export interface ConfigDeDestino {
  /** id do destino: vira a pasta em /data/<id>/. */
  id: string;
  nome: string;
  /** Nome do pais, quando o pacote cobre so uma parte dele. */
  paisNome?: string;
  /** Uma frase sobre o que o pacote NAO cobre. Aparece na tela inicial. */
  cobertura?: string;
  codigoPais: string;
  moeda: string;
  fuso: string;
  fusoOffsetMinutos: number;
  idiomas: string[];
  caixaDelimitadora: CaixaDelimitadora;

  /** Pasta de pesquisa, relativa a raiz do projeto. */
  pastaDePesquisa: string;

  /** Base -> regiao. As chaves deste mapa SAO as cidades-base do pacote. */
  regiaoDaCidade: Record<string, string>;
  /** Base -> nome de exibicao. */
  nomeDaCidade: Record<string, string>;
  /** Zona turistica -> frase curta. A chave e o valor de regiaoDaCidade. */
  descricaoDaRegiao: Record<string, string>;
  /**
   * Zona turistica -> nome de exibicao, quando o id nao da um nome bonito.
   * Sem entrada aqui o conversor capitaliza o id ("bahia-dende" vira
   * "Bahia Dende", que e feio e errado).
   */
  nomeDaZona?: Record<string, string>;

  /**
   * Como o agente nomeou a cidade de um item -> base a que o item pertence.
   * Bate-volta aponta para a base de onde se vai e volta no mesmo dia.
   */
  cidadeDoItem: Record<string, string>;
  /** Base -> prefixo curto usado no id dos itens. */
  prefixoId: Record<string, string>;

  /** Texto da regiao climatica na pesquisa -> bases que herdam aquele clima. */
  climaParaCidades: Array<{ contem: RegExp; cidades: string[]; regiao: string }>;
  /** Como reconhecer uma base num texto livre (trechos, eventos). */
  apelidosDeCidade: Array<[RegExp, string]>;
  /** IATA -> base que aquele aeroporto serve. */
  iataParaCidade: Record<string, string>;

  /**
   * Fatores de deslocamento autorados, por base. Entrada do motor, nao
   * afirmacao sobre o mundo: a camada 3 do estimador sempre aparece na
   * interface rotulada como estimativa. Base fora desta tabela usa o padrao
   * do motor.
   */
  fatores: Record<string, Record<string, FatorDeModal>>;

  /**
   * Offset proprio de bases que nao seguem o fuso principal do pais.
   * O Mexico precisa: Quintana Roo e UTC-5, o centro UTC-6, a Baja Sur UTC-7.
   */
  fusoPorCidade?: Record<string, number>;
}
