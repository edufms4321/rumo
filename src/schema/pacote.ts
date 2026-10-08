import { z } from 'zod';
import type { BoundingBox, Coord } from './base.ts';
import { EventoLocal } from './calendario.ts';
import { Destino } from './destino.ts';
import { Aeroporto, CidadeBase, Regiao } from './geo.ts';
import { SugestaoHospedagem } from './hospedagem.ts';
import { Item } from './item.ts';
import { TrechoEntreCidades, VooInternacional } from './transporte.ts';

/**
 * Um pacote de destino e uma pasta em /data/<pais>/ com estes arquivos.
 * Adicionar um destino novo e criar a pasta e rodar o validador - nunca
 * mexer em codigo. Ver docs/como-adicionar-destino.md.
 */
export const PacoteDestino = z.object({
  destino: Destino,
  regioes: z.array(Regiao),
  cidades: z.array(CidadeBase),
  aeroportos: z.array(Aeroporto),
  itens: z.array(Item),
  trechos: z.array(TrechoEntreCidades),
  voosInternacionais: z.array(VooInternacional),
  calendario: z.array(EventoLocal),
  hospedagem: z.array(SugestaoHospedagem),
});
export type PacoteDestino = z.infer<typeof PacoteDestino>;

/** Slugs que a matriz interna pode usar sem apontar para um item real. */
export const ANCORAS_RESERVADAS = [
  'centro',
  'aeroporto',
  'terminal-de-onibus',
  'porto',
  'hospedagem',
] as const;

export type NivelDeProblema = 'erro' | 'aviso';

export interface ProblemaDePacote {
  nivel: NivelDeProblema;
  caminho: string;
  mensagem: string;
}

function dentroDaCaixa(coord: Coord, caixa: BoundingBox): boolean {
  return (
    coord.lat >= caixa.latMin &&
    coord.lat <= caixa.latMax &&
    coord.lng >= caixa.lngMin &&
    coord.lng <= caixa.lngMax
  );
}

function acharDuplicados(ids: string[]): string[] {
  const vistos = new Set<string>();
  const duplicados = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) duplicados.add(id);
    vistos.add(id);
  }
  return [...duplicados];
}

/**
 * Valida um pacote em duas camadas:
 * 1. forma de cada registro (Zod) - erro
 * 2. coerencia entre registros: referencia quebrada, id duplicado,
 *    coordenada fora do pais - erro; dado fraco - aviso.
 *
 * Nunca lanca excecao: devolve a lista de problemas para o script imprimir.
 */
export function validarPacote(bruto: unknown): {
  ok: boolean;
  pacote?: PacoteDestino;
  problemas: ProblemaDePacote[];
} {
  const problemas: ProblemaDePacote[] = [];
  const analise = PacoteDestino.safeParse(bruto);

  if (!analise.success) {
    for (const erro of analise.error.issues) {
      problemas.push({
        nivel: 'erro',
        caminho: erro.path.join('.') || '(raiz)',
        mensagem: erro.message,
      });
    }
    return { ok: false, problemas };
  }

  const p = analise.data;
  const idsDeRegiao = new Set(p.regioes.map((r) => r.id));
  const idsDeCidade = new Set(p.cidades.map((c) => c.id));
  const idsDeItem = new Set(p.itens.map((i) => i.id));
  const iatas = new Set(p.aeroportos.map((a) => a.iata));

  // --- ids duplicados, por colecao ---
  const colecoes: Array<[string, string[]]> = [
    ['regioes', p.regioes.map((r) => r.id)],
    ['cidades', p.cidades.map((c) => c.id)],
    ['aeroportos', p.aeroportos.map((a) => a.id)],
    ['itens', p.itens.map((i) => i.id)],
    ['trechos', p.trechos.map((t) => t.id)],
    ['voosInternacionais', p.voosInternacionais.map((v) => v.id)],
    ['calendario', p.calendario.map((e) => e.id)],
    ['hospedagem', p.hospedagem.map((h) => h.id)],
  ];
  for (const [nome, ids] of colecoes) {
    for (const dup of acharDuplicados(ids)) {
      problemas.push({ nivel: 'erro', caminho: `${nome}`, mensagem: `id duplicado: ${dup}` });
    }
  }
  for (const dup of acharDuplicados(p.aeroportos.map((a) => a.iata))) {
    problemas.push({ nivel: 'erro', caminho: 'aeroportos', mensagem: `IATA duplicado: ${dup}` });
  }

  // --- cidades ---
  for (const cidade of p.cidades) {
    if (!idsDeRegiao.has(cidade.regiaoId)) {
      problemas.push({
        nivel: 'erro',
        caminho: `cidades.${cidade.id}.regiaoId`,
        mensagem: `regiao inexistente: ${cidade.regiaoId}`,
      });
    }
    if (!dentroDaCaixa(cidade.coords, p.destino.caixaDelimitadora)) {
      problemas.push({
        nivel: 'erro',
        caminho: `cidades.${cidade.id}.coords`,
        mensagem: 'coordenada fora da caixa delimitadora do destino',
      });
    }
    for (const iata of cidade.aeroportos) {
      if (!iatas.has(iata)) {
        problemas.push({
          nivel: 'erro',
          caminho: `cidades.${cidade.id}.aeroportos`,
          mensagem: `aeroporto inexistente: ${iata}`,
        });
      }
    }
    for (const par of cidade.matrizInterna) {
      for (const ponta of [par.de, par.para]) {
        const ancora = (ANCORAS_RESERVADAS as readonly string[]).includes(ponta);
        if (!ancora && !idsDeItem.has(ponta)) {
          problemas.push({
            nivel: 'erro',
            caminho: `cidades.${cidade.id}.matrizInterna`,
            mensagem: `ponta desconhecida: ${ponta} (nao e item nem ancora reservada)`,
          });
        }
      }
    }
    if (cidade.climaPorMes.length === 0) {
      problemas.push({
        nivel: 'aviso',
        caminho: `cidades.${cidade.id}.climaPorMes`,
        mensagem: 'sem clima por mes: a sugestao de janela de datas vai ignorar esta cidade',
      });
    }
  }

  // --- aeroportos ---
  for (const aeroporto of p.aeroportos) {
    if (!dentroDaCaixa(aeroporto.coords, p.destino.caixaDelimitadora)) {
      problemas.push({
        nivel: 'aviso',
        caminho: `aeroportos.${aeroporto.iata}.coords`,
        mensagem: 'coordenada fora do destino (esperado para aeroporto de origem, ex.: GRU)',
      });
    }
  }

  // --- itens ---
  for (const item of p.itens) {
    if (!idsDeCidade.has(item.cidadeId)) {
      problemas.push({
        nivel: 'erro',
        caminho: `itens.${item.id}.cidadeId`,
        mensagem: `cidade inexistente: ${item.cidadeId}`,
      });
    }
    if (item.coords && !dentroDaCaixa(item.coords, p.destino.caixaDelimitadora)) {
      problemas.push({
        nivel: 'erro',
        caminho: `itens.${item.id}.coords`,
        mensagem: 'coordenada fora da caixa delimitadora do destino',
      });
    }
    if (!item.coords) {
      problemas.push({
        nivel: 'aviso',
        caminho: `itens.${item.id}.coords`,
        mensagem: 'sem coordenada: nao entra no mapa e o deslocamento sai como estimativa grosseira',
      });
    }
    if (item.preco && item.preco.fontes.length === 0) {
      problemas.push({
        nivel: 'aviso',
        caminho: `itens.${item.id}.preco.fontes`,
        mensagem: 'preco sem fonte: a interface vai exibir como estimado',
      });
    }
    if (item.reserva.necessaria && item.reserva.antecedenciaDias === undefined) {
      problemas.push({
        nivel: 'aviso',
        caminho: `itens.${item.id}.reserva.antecedenciaDias`,
        mensagem: 'precisa reservar mas nao diz a antecedencia: o alerta de prazo fica sem data',
      });
    }
    if (item.imagens.length === 0) {
      problemas.push({
        nivel: 'aviso',
        caminho: `itens.${item.id}.imagens`,
        mensagem: 'sem imagem licenciada: o card usa placeholder',
      });
    }
  }

  // --- trechos entre cidades ---
  for (const trecho of p.trechos) {
    for (const [campo, valor] of [
      ['deCidadeId', trecho.deCidadeId],
      ['paraCidadeId', trecho.paraCidadeId],
    ] as const) {
      if (!idsDeCidade.has(valor)) {
        problemas.push({
          nivel: 'erro',
          caminho: `trechos.${trecho.id}.${campo}`,
          mensagem: `cidade inexistente: ${valor}`,
        });
      }
    }
  }

  // --- voos internacionais ---
  for (const voo of p.voosInternacionais) {
    if (!iatas.has(voo.destinoIata)) {
      problemas.push({
        nivel: 'erro',
        caminho: `voosInternacionais.${voo.id}.destinoIata`,
        mensagem: `aeroporto inexistente no pacote: ${voo.destinoIata}`,
      });
    }
    if (!iatas.has(voo.origemIata)) {
      problemas.push({
        nivel: 'aviso',
        caminho: `voosInternacionais.${voo.id}.origemIata`,
        mensagem: `aeroporto de origem ${voo.origemIata} nao esta no pacote: o motor nao sabe a antecedencia nem o tempo ao centro`,
      });
    }
  }

  // --- calendario ---
  for (const evento of p.calendario) {
    if (
      evento.escopo !== 'nacional' &&
      !idsDeCidade.has(evento.escopo) &&
      !idsDeRegiao.has(evento.escopo)
    ) {
      problemas.push({
        nivel: 'erro',
        caminho: `calendario.${evento.id}.escopo`,
        mensagem: `escopo desconhecido: ${evento.escopo}`,
      });
    }
  }

  // --- hospedagem ---
  for (const sugestao of p.hospedagem) {
    if (!idsDeCidade.has(sugestao.cidadeId)) {
      problemas.push({
        nivel: 'erro',
        caminho: `hospedagem.${sugestao.id}.cidadeId`,
        mensagem: `cidade inexistente: ${sugestao.cidadeId}`,
      });
    }
  }

  const temErro = problemas.some((x) => x.nivel === 'erro');
  return { ok: !temErro, pacote: p, problemas };
}
