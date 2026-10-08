/**
 * Carregamento dos pacotes de destino.
 *
 * Dois niveis, de proposito:
 *  - o INDICE de cada destino (nome, contagens, selo de confianca) e pequeno
 *    e vem junto com o app, porque a tela inicial precisa dele na hora;
 *  - o PACOTE inteiro (centenas de itens com descricao, fontes e horarios)
 *    so e baixado quando o usuario abre uma viagem daquele destino.
 *
 * Sem essa separacao, abrir o app baixaria os dois paises inteiros antes de
 * desenhar a primeira tela. Com ela, a primeira tela e leve e o pacote chega
 * quando faz falta.
 *
 * Adicionar um destino continua sendo criar uma pasta: os dois globs varrem
 * /data/* e nenhum nome de pais aparece neste arquivo.
 */
import { type PacoteDestino, type ProblemaDePacote, validarPacote } from '../schema/pacote.ts';
import { agruparPorDestino, montarPacote } from './montar-pacote.ts';

export interface IndiceDeDestino {
  id: string;
  nome: string;
  moeda: string;
  totais: { itens: number; cidades: number; trechos: number; eventos: number };
  confianca: { verificado: number; parcial: number; estimado: number };
}

const indicesCrus = import.meta.glob('../../data/*/indice.json', {
  eager: true,
  import: 'default',
}) as Record<string, IndiceDeDestino>;

/** Leve: vem no bundle principal. */
export const indices: IndiceDeDestino[] = Object.values(indicesCrus).sort((a, b) =>
  a.nome.localeCompare(b.nome),
);

/** Pesado: cada arquivo vira um pedaco separado, baixado sob demanda. */
const arquivosPreguicosos = {
  ...import.meta.glob('../../data/*/*.json', { import: 'default' }),
  ...import.meta.glob('../../data/*/*/*.json', { import: 'default' }),
} as Record<string, () => Promise<unknown>>;

export interface DestinoCarregado {
  id: string;
  pacote?: PacoteDestino;
  problemas: ProblemaDePacote[];
  ignorados: string[];
}

const cache = new Map<string, Promise<DestinoCarregado>>();

export function carregarDestino(id: string): Promise<DestinoCarregado> {
  const emCache = cache.get(id);
  if (emCache) return emCache;

  const promessa = (async (): Promise<DestinoCarregado> => {
    const prefixo = `/data/${id}/`;
    const caminhos = Object.keys(arquivosPreguicosos).filter(
      (c) => c.replace(/\\/g, '/').includes(prefixo) && !c.endsWith('indice.json'),
    );

    const arquivos: Record<string, unknown> = {};
    await Promise.all(
      caminhos.map(async (caminho) => {
        arquivos[caminho] = await arquivosPreguicosos[caminho]!();
      }),
    );

    const porDestino = agruparPorDestino(arquivos, '/data/');
    const doDestino = porDestino[id];
    if (!doDestino) {
      return {
        id,
        problemas: [{ nivel: 'erro', caminho: id, mensagem: 'pasta de destino vazia' }],
        ignorados: [],
      };
    }

    const { bruto, ignorados, faltando } = montarPacote(doDestino);
    if (faltando.length > 0) {
      return {
        id,
        problemas: faltando.map((arquivo) => ({
          nivel: 'erro' as const,
          caminho: id,
          mensagem: `arquivo obrigatorio ausente: ${arquivo}`,
        })),
        ignorados,
      };
    }

    const { pacote, problemas } = validarPacote(bruto);
    return { id, pacote, problemas, ignorados };
  })();

  cache.set(id, promessa);
  return promessa;
}
