/**
 * "O que reservar agora": uma fila so, com tudo que tem prazo.
 *
 * Antes, a tela de Reservas listava apenas atividades agendadas que pedem
 * reserva. O voo internacional e os documentos de entrada — as duas coisas
 * mais caras e mais irreversiveis da viagem — ficavam cada um na sua tela,
 * sem prazo e sem ordem. Quem olhava a fila via o tour de Oaxaca no topo e o
 * visto em nenhum lugar.
 *
 * Ordem: o que for mais urgente primeiro. Tres regimes, e eles sao
 * diferentes de proposito:
 *
 * - `comprar-antes`: nao tem data limite, tem uma curva de preco. Passagem
 *   internacional nao esgota; encarece toda semana, e comprar antes e o
 *   unico controle que o viajante tem. Vai no topo SEM data, porque inventar
 *   "compre ate dia X" seria chutar um numero que nenhuma fonte sustenta.
 * - prazo conhecido: ordenado pela data, mais apertado primeiro.
 * - sem prazo: vai para o fim, dizendo que o banco nao sabe a antecedencia
 *   em vez de fingir folga.
 *
 * Resolver um item o tira da fila; ele continua visivel na lista completa.
 */
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { documentosDaViagem } from './documentos.ts';
import { diferencaEmDias, somarDias } from './tempo.ts';

export type OrigemDaPendencia =
  | { tipo: 'atividade'; blocoId: string; itemId: string; diaId: string; data: string }
  | { tipo: 'documento'; documentoId: string }
  | { tipo: 'voo' };

export type Urgencia = 'vencido' | 'comprar-antes' | 'apertado' | 'tranquilo' | 'sem-prazo';

export interface PendenciaDeReserva {
  /** Chave estavel para key de lista e para marcar como resolvida. */
  chave: string;
  titulo: string;
  origem: OrigemDaPendencia;
  prazo?: string;
  diasAteOPrazo?: number;
  resolvida: boolean;
  urgencia: Urgencia;
  /** Link de compra ou site oficial, quando existe. */
  link?: string;
  /** Uma linha de contexto: "costuma esgotar", "entrada unica". */
  nota?: string;
}

/** Quantos dias antes do prazo ainda contam como apertado. */
const JANELA_APERTADA_DIAS = 15;

function urgenciaDe(diasAteOPrazo: number | undefined, resolvida: boolean): Urgencia {
  if (diasAteOPrazo === undefined) return 'sem-prazo';
  if (diasAteOPrazo < 0 && !resolvida) return 'vencido';
  return diasAteOPrazo <= JANELA_APERTADA_DIAS ? 'apertado' : 'tranquilo';
}

const PESO: Record<Urgencia, number> = {
  vencido: 0,
  'comprar-antes': 1,
  apertado: 2,
  tranquilo: 3,
  'sem-prazo': 4,
};

export function filaDeReservas(
  viagem: Viagem,
  pacote: PacoteDestino,
  hoje: string,
): PendenciaDeReserva[] {
  const lista: PendenciaDeReserva[] = [];
  const porId = new Map(pacote.itens.map((i) => [i.id, i]));
  const inicio = viagem.dias[0]?.data;

  /*
    O voo internacional. `comprado` e a unica coisa que o app sabe de verdade
    aqui: nao ha fonte que diga "compre com N dias". Por isso entra sem data
    e com o motivo escrito.
  */
  if (viagem.voo && !viagem.voo.comprado) {
    const rota = pacote.voosInternacionais.find((v) => v.id === viagem.voo?.rotaId);
    lista.push({
      chave: 'voo',
      titulo: viagem.voo.rotulo || 'Voo internacional',
      origem: { tipo: 'voo' },
      resolvida: false,
      urgencia: 'comprar-antes',
      ...(rota?.linkDeBusca ? { link: rota.linkDeBusca } : {}),
      nota: 'Passagem internacional nao esgota, encarece. Comprar antes e o unico controle que voce tem sobre esse valor.',
    });
  }

  for (const { documento, prazo } of documentosDaViagem(viagem, pacote)) {
    const status = viagem.documentos[documento.id]?.status ?? 'pendente';
    const resolvida = status === 'pronto' || status === 'nao-se-aplica';
    const diasAteOPrazo = prazo ? diferencaEmDias(hoje, prazo) : undefined;
    const notas: string[] = [];
    if (documento.entradasPermitidas === 1) notas.push('entrada unica');
    if (documento.vias.length > 0) notas.push(`so via ${documento.vias.join(' e ')}`);
    if (documento.prazo) notas.push(documento.prazo);

    lista.push({
      chave: `documento:${documento.id}`,
      titulo: documento.nome,
      origem: { tipo: 'documento', documentoId: documento.id },
      ...(prazo ? { prazo, diasAteOPrazo } : {}),
      resolvida,
      urgencia: urgenciaDe(diasAteOPrazo, resolvida),
      ...(documento.linkOficial ? { link: documento.linkOficial } : {}),
      ...(notas.length > 0 ? { nota: notas.join(' · ') } : {}),
    });
  }

  for (const dia of viagem.dias) {
    for (const bloco of dia.blocos) {
      if (bloco.tipo !== 'atividade') continue;
      const item = porId.get(bloco.itemId);
      if (!item?.reserva.necessaria) continue;
      const resolvida =
        bloco.statusDeReserva === 'reservado' ||
        bloco.statusDeReserva === 'pago' ||
        bloco.statusDeReserva === 'cancelado';
      const antecedencia = item.reserva.antecedenciaDias;
      const prazo = antecedencia === undefined ? undefined : somarDias(dia.data, -antecedencia);
      const diasAteOPrazo = prazo ? diferencaEmDias(hoje, prazo) : undefined;

      lista.push({
        chave: `bloco:${bloco.id}`,
        titulo: item.nome,
        origem: {
          tipo: 'atividade',
          blocoId: bloco.id,
          itemId: item.id,
          diaId: dia.id,
          data: dia.data,
        },
        ...(prazo ? { prazo, diasAteOPrazo } : {}),
        resolvida,
        urgencia: urgenciaDe(diasAteOPrazo, resolvida),
        ...(item.reserva.link ? { link: item.reserva.link } : {}),
        ...(item.reserva.esgotaRapido ? { nota: 'costuma esgotar' } : {}),
      });
    }
  }

  /* Inicio da viagem sem data nenhuma: nada a ordenar por prazo. */
  void inicio;

  return lista.sort((a, b) => {
    const pa = PESO[a.urgencia];
    const pb = PESO[b.urgencia];
    if (pa !== pb) return pa - pb;
    if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
    return a.titulo.localeCompare(b.titulo);
  });
}
