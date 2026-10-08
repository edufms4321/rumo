/**
 * MELHORIA 6 — idade do dado visivel.
 *
 * O banco ja guarda `coletadoEm` e `confianca` em todo registro, mas isso
 * nao servia de nada enquanto a interface nao dissesse "coletado ha 4
 * meses". Preco e horario sao os campos que envelhecem rapido; nome e
 * coordenada quase nao envelhecem.
 *
 * Aqui tambem entra a camada do usuario (melhoria 7): quando ele liga e
 * confirma, a confirmacao DELE vence o banco na exibicao, sem apagar o que
 * o banco diz.
 */
import type { Confianca } from '../schema/base.ts';
import type { Item } from '../schema/item.ts';
import type { ConfirmacaoDoUsuario, Viagem } from '../schema/viagem.ts';
import { diferencaEmDias } from './tempo.ts';

export type NivelDeIdade = 'recente' | 'envelhecendo' | 'velho';

/** Dados que mudam de preco mudam rapido; o resto aguenta mais. */
const DIAS_ENVELHECENDO = 180;
const DIAS_VELHO = 365;

export interface IdadeDoDado {
  dias: number;
  nivel: NivelDeIdade;
  /** "coletado ha 4 meses", pronto para a tela. */
  rotulo: string;
}

export function avaliarIdade(coletadoEm: string, hoje: string): IdadeDoDado {
  const dias = Math.max(0, diferencaEmDias(coletadoEm, hoje));
  const nivel: NivelDeIdade =
    dias >= DIAS_VELHO ? 'velho' : dias >= DIAS_ENVELHECENDO ? 'envelhecendo' : 'recente';

  let rotulo: string;
  if (dias === 0) rotulo = 'coletado hoje';
  else if (dias === 1) rotulo = 'coletado ontem';
  else if (dias < 30) rotulo = `coletado ha ${dias} dias`;
  else {
    const meses = Math.round(dias / 30);
    rotulo = meses === 1 ? 'coletado ha 1 mes' : `coletado ha ${meses} meses`;
  }

  return { dias, nivel, rotulo };
}

const TEXTO_DA_CONFIANCA: Record<Confianca, string> = {
  verificado: 'verificado',
  parcial: 'parcialmente verificado',
  estimado: 'estimado',
};

export interface ResumoDeProcedencia {
  confianca: Confianca;
  confiancaTexto: string;
  idade: IdadeDoDado;
  quantasFontes: number;
  temCoordenada: boolean;
  temImagem: boolean;
  /** Confirmacoes que o proprio usuario registrou para este item. */
  confirmacoesDoUsuario: ConfirmacaoDoUsuario[];
  /**
   * Uma frase que resume a confianca para quem nao quer ler o resto.
   * E o texto que a interface mostra embaixo do card.
   */
  frase: string;
}

export function procedenciaDoItem(
  item: Item,
  hoje: string,
  viagem?: Viagem,
): ResumoDeProcedencia {
  const idade = avaliarIdade(item.coletadoEm, hoje);
  const confirmacoes = viagem?.confirmacoes[item.id] ?? [];

  const maisRecente = [...confirmacoes].sort((a, b) =>
    a.confirmadoEm < b.confirmadoEm ? 1 : -1,
  )[0];

  let frase: string;
  if (maisRecente) {
    // A confirmacao do usuario vence na exibicao: foi ele que ligou.
    frase = `Voce confirmou ${maisRecente.campo} em ${maisRecente.confirmadoEm}.`;
  } else if (idade.nivel === 'velho') {
    frase = `${TEXTO_DA_CONFIANCA[item.confianca]}, mas ${idade.rotulo}: confirme antes de contar com isto.`;
  } else if (item.confianca === 'estimado') {
    frase = `Estimado pelo pesquisador, ${idade.rotulo}. Trate como ordem de grandeza.`;
  } else {
    frase = `${TEXTO_DA_CONFIANCA[item.confianca]}, ${idade.rotulo}.`;
  }

  return {
    confianca: item.confianca,
    confiancaTexto: TEXTO_DA_CONFIANCA[item.confianca],
    idade,
    quantasFontes: item.fontes.length,
    temCoordenada: Boolean(item.coords),
    temImagem: item.imagens.length > 0,
    confirmacoesDoUsuario: confirmacoes,
    frase,
  };
}

/**
 * Preco e o campo que mais envelhece: um preco de um ano atras nao e
 * informacao, e historia. Esta funcao diz se o preco ainda vale alguma coisa.
 */
export function precoAindaUtil(item: Item, hoje: string): boolean {
  if (!item.preco) return false;
  return avaliarIdade(item.preco.coletadoEm, hoje).nivel !== 'velho';
}
