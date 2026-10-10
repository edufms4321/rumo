/**
 * Quais documentos de entrada valem PARA ESTA viagem, e quando resolver cada
 * um.
 *
 * Dois filtros, e os dois importam:
 *
 * - nacionalidade: o e-visto mexicano e exigencia de brasileiro; o Visitax
 *   cobra de qualquer estrangeiro. O segundo entra com `nacionalidades: []`,
 *   que vale para todos, em vez de ser repetido por nacionalidade.
 * - escopo: o Visitax e taxa de Quintana Roo. Mostrar a cobranca para quem
 *   so vai a Oaxaca seria errado nos dois sentidos — manda pagar o que nao
 *   deve, e ensina a ignorar a tela.
 *
 * O prazo sai da data de inicio da viagem menos `diasAntesDaViagem`. Quando
 * o dado nao diz quantos dias, nao ha prazo: a fila mostra o documento sem
 * contagem regressiva em vez de inventar uma.
 */
import type { DocumentoDeEntrada } from '../schema/documento.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';
import { somarDias } from './tempo.ts';

export interface DocumentoNaViagem {
  documento: DocumentoDeEntrada;
  /** Data limite, AAAA-MM-DD. Ausente = o dado nao diz a antecedencia. */
  prazo?: string;
  /** Por que ele aparece: 'nacional' ou o nome do lugar que o cobra. */
  motivoDoEscopo?: string;
}

/** O escopo do documento e tocado pelo roteiro? */
function escopoSeAplica(
  doc: DocumentoDeEntrada,
  viagem: Viagem,
  pacote: PacoteDestino,
): { aplica: boolean; motivo?: string } {
  if (doc.escopo === 'nacional') return { aplica: true };

  const basesDoRoteiro = new Set(
    viagem.dias.flatMap((d) => (d.cidadeBaseId ? [d.cidadeBaseId] : [])),
  );
  /*
    Nao basta olhar onde ele dorme: uma atividade agendada em Quintana Roo
    num bate-volta tambem entra no estado, e a taxa e por entrar.
  */
  for (const dia of viagem.dias) {
    for (const bloco of dia.blocos) {
      if (bloco.tipo === 'trecho') {
        basesDoRoteiro.add(bloco.deCidadeId);
        basesDoRoteiro.add(bloco.paraCidadeId);
      }
    }
  }
  const itensAgendados = new Set(
    viagem.dias.flatMap((d) => d.blocos.flatMap((b) => (b.tipo === 'atividade' ? [b.itemId] : []))),
  );
  for (const item of pacote.itens) {
    if (itensAgendados.has(item.id)) basesDoRoteiro.add(item.cidadeId);
  }

  const cidade = pacote.cidades.find((c) => c.id === doc.escopo);
  if (cidade) {
    return basesDoRoteiro.has(cidade.id)
      ? { aplica: true, motivo: cidade.nome }
      : { aplica: false };
  }

  const estado = pacote.estados.find((e) => e.id === doc.escopo);
  if (estado) {
    const cidadesDoEstado = pacote.cidades
      .filter((c) => c.estadoId === estado.id)
      .map((c) => c.id);
    const toca = cidadesDoEstado.some((id) => basesDoRoteiro.has(id));
    return toca ? { aplica: true, motivo: estado.nome } : { aplica: false };
  }

  /*
    Escopo que nao casa com nada do pacote: mostra. Esconder um documento
    porque o id esta errado e a falha silenciosa mais cara possivel aqui.
  */
  return { aplica: true, motivo: doc.escopo };
}

export function documentosDaViagem(viagem: Viagem, pacote: PacoteDestino): DocumentoNaViagem[] {
  const nacionalidade = viagem.viajantes.nacionalidade;
  const inicio = viagem.dias[0]?.data;

  return pacote.destino.documentos
    .filter(
      (d) => d.nacionalidades.length === 0 || d.nacionalidades.includes(nacionalidade),
    )
    .map((documento) => {
      const escopo = escopoSeAplica(documento, viagem, pacote);
      if (!escopo.aplica) return undefined;
      const prazo =
        inicio && documento.diasAntesDaViagem !== undefined
          ? somarDias(inicio, -documento.diasAntesDaViagem)
          : undefined;
      return {
        documento,
        ...(prazo ? { prazo } : {}),
        ...(escopo.motivo ? { motivoDoEscopo: escopo.motivo } : {}),
      };
    })
    .filter((d): d is DocumentoNaViagem => d !== undefined)
    .sort((a, b) => {
      /* Prazo mais apertado primeiro; sem prazo, por nome. */
      if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
      if (a.prazo) return -1;
      if (b.prazo) return 1;
      return a.documento.nome.localeCompare(b.documento.nome);
    });
}

/** Trechos que saem do pais no meio do roteiro. */
export function escalasForaDoPais(
  viagem: Viagem,
): Array<{ diaId: string; blocoId: string; pais: string }> {
  const saidas: Array<{ diaId: string; blocoId: string; pais: string }> = [];
  for (const dia of viagem.dias) {
    for (const bloco of dia.blocos) {
      if (bloco.tipo === 'trecho' && bloco.escalaEmOutroPais) {
        saidas.push({ diaId: dia.id, blocoId: bloco.id, pais: bloco.escalaEmOutroPais });
      }
    }
  }
  return saidas;
}
