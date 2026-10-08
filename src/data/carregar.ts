import { type PacoteDestino, type ProblemaDePacote, validarPacote } from '../schema/pacote.ts';
import { agruparPorDestino, montarPacote } from './montar-pacote.ts';

/**
 * Carrega todos os pacotes de destino de /data/ no navegador.
 *
 * Os dois padroes de glob cobrem /data/<destino>/*.json e
 * /data/<destino>/itens/*.json. Vite resolve isso no build, por isso
 * adicionar uma pasta nova em /data/ coloca o destino no app sem
 * nenhuma mudanca de codigo - o criterio de aceite 7 da v1.
 */
const arquivos = {
  ...import.meta.glob('../../data/*/*.json', { eager: true, import: 'default' }),
  ...import.meta.glob('../../data/*/*/*.json', { eager: true, import: 'default' }),
} as Record<string, unknown>;

export interface DestinoCarregado {
  id: string;
  pacote?: PacoteDestino;
  problemas: ProblemaDePacote[];
  ignorados: string[];
}

function carregarTudo(): DestinoCarregado[] {
  const porDestino = agruparPorDestino(arquivos, '/data/');

  return Object.entries(porDestino).map(([id, arquivosDoDestino]) => {
    const { bruto, ignorados, faltando } = montarPacote(arquivosDoDestino);

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
  });
}

/** Avaliado uma vez por sessao. */
export const destinos: DestinoCarregado[] = carregarTudo();

export function destinoPorId(id: string): DestinoCarregado | undefined {
  return destinos.find((d) => d.id === id);
}

/** Destinos que passaram na validacao e podem ser usados para planejar. */
export const destinosValidos = destinos.filter(
  (d): d is DestinoCarregado & { pacote: PacoteDestino } => d.pacote !== undefined,
);
