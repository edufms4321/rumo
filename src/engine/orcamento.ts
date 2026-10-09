/**
 * Custo planejado da viagem, em BRL, com a conta aberta por categoria, por
 * cidade e por dia.
 *
 * Tudo converte para BRL usando `viagem.cambio.taxas`, que o usuario edita.
 * Quando falta taxa para uma moeda, o valor NAO entra no total e vira um
 * item em `semConversao` - somar com taxa inventada seria pior do que
 * admitir o buraco.
 *
 * Preco e sempre faixa (min, max). O total tambem: o app mostra "entre X e
 * Y", nunca um numero unico que finge precisao que o dado nao tem.
 */
import type { Preco } from '../schema/base.ts';
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';

export type CategoriaDeCusto =
  | 'atividades'
  | 'refeicoes'
  | 'hospedagem'
  | 'transporte-entre-cidades'
  | 'taxas-obrigatorias';

export interface Faixa {
  min: number;
  max: number;
}

export interface LinhaDeCusto {
  rotulo: string;
  categoria: CategoriaDeCusto;
  diaId?: string;
  cidadeId?: string;
  /** Ja convertido para BRL e multiplicado pelo numero de viajantes. */
  faixaBRL: Faixa;
  moedaOriginal: string;
  faixaOriginal: Faixa;
  porPessoa: boolean;
}

export interface Orcamento {
  linhas: LinhaDeCusto[];
  total: Faixa;
  porCategoria: Record<CategoriaDeCusto, Faixa>;
  porDia: Record<string, Faixa>;
  porCidade: Record<string, Faixa>;
  totalPorPessoa: Faixa;
  /** Valores que ficaram de fora por falta de taxa de cambio. */
  semConversao: Array<{ rotulo: string; moeda: string; faixa: Faixa }>;
  /** Itens agendados cujo preco a pesquisa nao encontrou. */
  semPreco: string[];
  orcado?: Faixa;
  estourou: boolean;
}

const FAIXA_ZERO: Faixa = { min: 0, max: 0 };

function somar(a: Faixa, b: Faixa): Faixa {
  return { min: a.min + b.min, max: a.max + b.max };
}

function taxaPara(viagem: Viagem, moeda: string): number | undefined {
  if (moeda === 'BRL') return 1;
  return viagem.cambio.taxas[moeda];
}

export function calcularOrcamento(viagem: Viagem, pacote: PacoteDestino): Orcamento {
  const itensPorId = new Map(pacote.itens.map((i) => [i.id, i]));
  const pessoas = viagem.viajantes.adultos + viagem.viajantes.criancas;

  const linhas: LinhaDeCusto[] = [];
  const semConversao: Orcamento['semConversao'] = [];
  const semPreco: string[] = [];

  function registrar(
    rotulo: string,
    categoria: CategoriaDeCusto,
    preco: Preco,
    diaId?: string,
    cidadeId?: string,
  ): void {
    const taxa = taxaPara(viagem, preco.moeda);
    const faixaOriginal = { min: preco.min, max: preco.max };
    if (taxa === undefined) {
      semConversao.push({ rotulo, moeda: preco.moeda, faixa: faixaOriginal });
      return;
    }
    const multiplicador = preco.por === 'pessoa' ? pessoas : 1;
    linhas.push({
      rotulo,
      categoria,
      ...(diaId ? { diaId } : {}),
      ...(cidadeId ? { cidadeId } : {}),
      faixaBRL: {
        min: preco.min * taxa * multiplicador,
        max: preco.max * taxa * multiplicador,
      },
      moedaOriginal: preco.moeda,
      faixaOriginal,
      porPessoa: preco.por === 'pessoa',
    });
  }

  // Quantas noites em cada cidade, nao so quais cidades: a taxa progressiva
  // precisa do numero.
  const noitesPorCidade = new Map<string, number>();
  const cidadesComNoite = new Set<string>();

  for (const dia of viagem.dias) {
    if (dia.cidadeBaseId) {
      cidadesComNoite.add(dia.cidadeBaseId);
      noitesPorCidade.set(dia.cidadeBaseId, (noitesPorCidade.get(dia.cidadeBaseId) ?? 0) + 1);
    }

    for (const bloco of dia.blocos) {
      if (bloco.tipo === 'atividade') {
        const item: Item | undefined = itensPorId.get(bloco.itemId);
        if (bloco.custoOverride !== undefined) {
          registrar(
            item?.nome ?? bloco.itemId,
            'atividades',
            {
              moeda: 'BRL',
              min: bloco.custoOverride,
              max: bloco.custoOverride,
              por: 'grupo',
              inclui: 'valor informado por voce',
              coletadoEm: viagem.atualizadoEm.slice(0, 10),
              fontes: [],
            },
            dia.id,
            item?.cidadeId,
          );
          continue;
        }
        if (item?.preco) {
          registrar(item.nome, 'atividades', item.preco, dia.id, item.cidadeId);
        } else if (item && !item.gratuito) {
          semPreco.push(item.nome);
        }
      }

      if (bloco.tipo === 'refeicao' && bloco.custoEstimado !== undefined) {
        registrar(
          bloco.nome,
          'refeicoes',
          {
            moeda: 'BRL',
            min: bloco.custoEstimado,
            max: bloco.custoEstimado,
            por: 'pessoa',
            inclui: '',
            coletadoEm: viagem.atualizadoEm.slice(0, 10),
            fontes: [],
          },
          dia.id,
          dia.cidadeBaseId,
        );
      }

      if (bloco.tipo === 'trecho' && bloco.custo !== undefined) {
        registrar(
          `${bloco.deCidadeId} para ${bloco.paraCidadeId}`,
          'transporte-entre-cidades',
          {
            moeda: 'BRL',
            min: bloco.custo,
            max: bloco.custo,
            por: 'pessoa',
            inclui: '',
            coletadoEm: viagem.atualizadoEm.slice(0, 10),
            fontes: [],
          },
          dia.id,
          bloco.paraCidadeId,
        );
      }
    }

    if (dia.hospedagem?.custoPorNoite !== undefined) {
      registrar(
        dia.hospedagem.nome || 'hospedagem',
        'hospedagem',
        {
          moeda: dia.hospedagem.moeda,
          min: dia.hospedagem.custoPorNoite,
          max: dia.hospedagem.custoPorNoite,
          por: 'grupo',
          inclui: 'diaria',
          coletadoEm: viagem.atualizadoEm.slice(0, 10),
          fontes: [],
        },
        dia.id,
        dia.cidadeBaseId,
      );
    }
  }

  // Taxas que se paga por estar na cidade, uma vez por cidade visitada.
  for (const cidadeId of cidadesComNoite) {
    const cidade = pacote.cidades.find((c) => c.id === cidadeId);
    const noites = noitesPorCidade.get(cidadeId) ?? 0;

    for (const taxa of cidade?.taxasObrigatorias ?? []) {
      /*
        Taxa com tabela oficial por dia vira valor EXATO, nao faixa.

        E a diferenca entre o orcamento dizer "entre R$ 105,79 e R$ 672,85
        por pessoa" e dizer "R$ 520,50 por pessoa, para as suas 5 noites".
        Fora do alcance da tabela (viagem mais longa do que ela cobre) a
        faixa volta, porque extrapolar uma curva progressiva de que so se
        conhece o fim seria inventar.
      */
      const linha = taxa.tabelaPorDias.find((l) => l.dias === noites);
      const preco = linha
        ? {
            ...taxa.preco,
            min: linha.valor,
            max: linha.valor,
            observacao: `Valor da tabela oficial para ${noites} dia${noites > 1 ? 's' : ''}.`,
          }
        : taxa.preco;
      registrar(`${taxa.nome} (${cidade?.nome})`, 'taxas-obrigatorias', preco, undefined, cidadeId);
    }
  }

  // ------------------------------------------------------------------ totais
  const vazio = (): Record<string, Faixa> => ({});
  const porCategoria = {
    atividades: { ...FAIXA_ZERO },
    refeicoes: { ...FAIXA_ZERO },
    hospedagem: { ...FAIXA_ZERO },
    'transporte-entre-cidades': { ...FAIXA_ZERO },
    'taxas-obrigatorias': { ...FAIXA_ZERO },
  } satisfies Record<CategoriaDeCusto, Faixa>;

  const porDia = vazio();
  const porCidade = vazio();
  let total: Faixa = { ...FAIXA_ZERO };

  for (const linha of linhas) {
    total = somar(total, linha.faixaBRL);
    porCategoria[linha.categoria] = somar(porCategoria[linha.categoria], linha.faixaBRL);
    if (linha.diaId) porDia[linha.diaId] = somar(porDia[linha.diaId] ?? FAIXA_ZERO, linha.faixaBRL);
    if (linha.cidadeId) {
      porCidade[linha.cidadeId] = somar(porCidade[linha.cidadeId] ?? FAIXA_ZERO, linha.faixaBRL);
    }
  }

  const totalPorPessoa = {
    min: pessoas > 0 ? total.min / pessoas : total.min,
    max: pessoas > 0 ? total.max / pessoas : total.max,
  };

  let orcado: Faixa | undefined;
  if (viagem.orcamento) {
    const taxa = taxaPara(viagem, viagem.orcamento.moeda) ?? 1;
    const teto = viagem.orcamento.total
      ? viagem.orcamento.total
      : (viagem.orcamento.porPessoa ?? 0) * pessoas;
    if (teto > 0) orcado = { min: teto * taxa, max: teto * taxa };
  }

  return {
    linhas,
    total,
    porCategoria,
    porDia,
    porCidade,
    totalPorPessoa,
    semConversao,
    semPreco,
    ...(orcado ? { orcado } : {}),
    // Estourou quando ate o melhor caso ja passa do teto.
    estourou: orcado ? total.min > orcado.max : false,
  };
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function formatarFaixaBRL(faixa: Faixa): string {
  if (Math.round(faixa.min) === Math.round(faixa.max)) return formatarBRL(faixa.min);
  return `${formatarBRL(faixa.min)} a ${formatarBRL(faixa.max)}`;
}
