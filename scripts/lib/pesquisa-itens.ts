/**
 * Conversao de um item de pesquisa para um item do banco.
 *
 * As funcoes `derivar*` deduzem sinalizadores a partir do TEXTO do item. Elas
 * nao afirmam fato novo sobre o mundo: dizem a qual regra do motor o item
 * responde (depende de clima, depende de luz do dia, nao voar apos mergulho).
 * Toda deducao e contada em `derivado()` e sai no relatorio.
 */
import type { ConfigDeDestino } from '../destinos/tipos.ts';
import {
  COLETADO_EM,
  type Json,
  RE_URL,
  avisos,
  confianca,
  converterHorarios,
  converterPreco,
  derivado,
  fontes,
  mesclar,
  slug,
} from './pesquisa-utils.ts';

const RE_CLIMA = /barco|lancha|catamar|\bmar\b|snorkel|mergulho|praia|vela|caiaque|ilha|\bcay\b/i;
const RE_LUZ = /p[oô]r[- ]do[- ]sol|mirante|trilha|praia|amanhecer|sunset|nascer do sol/i;
const RE_MERGULHO = /mergulho|scuba|diving|buceo|bautizo de mar/i;
const RE_PEGA_TURISTA = /pega-?turista|turist[aã]o|armadilha|cilada/i;

function textoDoItem(i: Json): string {
  return [i.nome, i.descricaoCurta, i.descricaoLonga, ...(i.tags ?? []), ...(i.alertas ?? [])]
    .filter(Boolean)
    .join(' ');
}

/**
 * Dominios cuja palavra vale sozinha: o proprio orgao, o proprio parque,
 * a propria prefeitura. Fora desta lista, uma fonte so e uma fonte so.
 */
const OFICIAL = /(^|\.)gov\.br(\/|$)|icmbio|\.gov(\.|\/|$)|prefeitura|ibama|inmet|fumdham|tamar/i;

/**
 * Nivel de confianca deduzido das fontes, para quando a onda de pesquisa
 * nao declarou um.
 *
 * A regra e a mesma do projeto inteiro: duas fontes independentes que
 * concordam, ou uma oficial, vale "verificado"; uma fonte so vale
 * "parcial"; nenhuma, "estimado" — e o validador nem deixa entrar.
 *
 * Isto existe porque eu esqueci de pedir o campo no briefing de uma onda e
 * os 296 itens entraram como "estimado", o que era falso para baixo: havia
 * fonte oficial em boa parte deles. Mentir a favor tambem e mentir.
 */
function grauPelasFontes(i: Json): string {
  const fontes = (i.fontes ?? []) as unknown[];
  const urls = fontes.map((f) => (typeof f === 'string' ? f : String((f as Json)?.url ?? '')));
  const dominios = new Set(
    urls
      .map((u) => {
        try {
          return new URL(u).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  );
  if (dominios.size === 0) return 'estimado';
  if (dominios.size >= 2 || [...dominios].some((d) => OFICIAL.test(d))) return 'verificado';
  return 'parcial';
}

function derivarRestricoes(i: Json): Json {
  const texto = textoDoItem(i);
  const categoria = String(i.categoria);

  /*
    `restricoes` chega de duas formas.

    As ondas antigas mandavam uma lista de frases soltas. As novas mandam
    um objeto com os campos que o motor entende de verdade
    (`dependeDeMare`, `naoVoarDepoisHoras`...), que e melhor: o que o
    pesquisador afirma com fonte vale mais do que o que eu deduzo de
    regex. As duas formas sao aceitas, e o que vem declarado ganha das
    deducoes abaixo.
  */
  const cru = i.restricoes;
  const declarado: Json = cru && !Array.isArray(cru) && typeof cru === 'object' ? { ...cru } : {};
  const lista: unknown[] = Array.isArray(cru) ? cru : (declarado.outras as unknown[]) ?? [];
  delete declarado.outras;

  const r: Json = {
    outras: lista.filter((x: unknown) => typeof x === 'string' && x.trim()),
  };

  if (RE_CLIMA.test(texto) || categoria === 'praia') {
    r.dependeDeClima = true;
    derivado('dependeDeClima deduzido do texto ou da categoria');
  }
  if (RE_LUZ.test(texto) || ['praia', 'mirante', 'natureza'].includes(categoria)) {
    r.dependeDeLuzDoDia = true;
    derivado('dependeDeLuzDoDia deduzido do texto ou da categoria');
  }
  if (RE_MERGULHO.test(texto)) {
    // Minimo da DAN: 12 h apos um mergulho, 18 h apos mergulhos repetidos.
    r.naoVoarDepoisHoras = 18;
    derivado('naoVoarDepoisHoras = 18 (minimo DAN para mergulhos repetidos)');
  }

  // O declarado pela pesquisa entra por ultimo e manda.
  return { ...r, ...declarado };
}

function derivarSelos(i: Json, temPreco: boolean, gratuito: boolean): string[] {
  const selos = new Set<string>();
  const tags: string[] = (i.tags ?? []).map((t: unknown) => String(t).toLowerCase());
  const dicas: string = (i.dicasAgente ?? []).join(' ').toLowerCase();
  const texto = textoDoItem(i);

  if (i.reserva?.necessaria) selos.add('precisa-reservar');
  if (i.reserva?.esgotaRapido) selos.add('esgota-rapido');
  if (gratuito) selos.add('gratuito');
  if (RE_CLIMA.test(texto) || i.categoria === 'praia') selos.add('depende-do-clima');
  if (tags.includes('imperdivel') || tags.includes('imperdível')) selos.add('imperdivel');
  if (RE_PEGA_TURISTA.test(texto)) selos.add('pega-turista');

  // Julgamento do AGENTE DE VIAGENS, nao do script: estas frases foram
  // pedidas explicitamente no briefing da pesquisa.
  if (/vale cada peso|vale o gasto|vale cada centavo|vale muito/.test(dicas)) {
    selos.add('vale-cada-peso');
  }
  if (/corte se|corta se|primeiro a cortar|dispens[aá]vel|pode cortar/.test(dicas)) {
    selos.add('corte-se-apertar');
  }
  if (!temPreco && !gratuito) derivado('item sem preco: nenhum selo de custo aplicado');

  return [...selos];
}

/**
 * Converte os itens das duas bases pesquisadas, em ordem estavel, e aplica os
 * ajustes manuais por id. Devolve um arquivo por cidade do banco.
 */
export function construirItens(
  pacotesDePesquisa: Json[],
  ajustes: Json,
  config: ConfigDeDestino,
): Record<string, Json[]> {
  const idsUsados = new Set<string>();
  const porCidade: Record<string, Json[]> = {};
  const patchesDeItens: Json = ajustes.itens ?? {};
  const idsAjustados = new Set(Object.keys(patchesDeItens));

  for (const pacote of pacotesDePesquisa) {
    for (const bruto of pacote.itens ?? []) {
      const item = converterItem(bruto, idsUsados, config);
      if (!item) continue;
      const patch = patchesDeItens[item.id];
      const final = patch ? mesclar(item, patch) : item;
      if (patch) idsAjustados.delete(item.id);

      // Locadora sem tabela de veiculos nao e locadora: e conselho sobre
      // aluguel. Vira cartao de referencia em vez de reprovar a importacao.
      if (final.categoria === 'aluguel-veiculo' && !final.aluguel && final.agendavel) {
        final.agendavel = false;
        delete final.duracao;
        avisos.push(
          `"${final.nome}" esta como aluguel-veiculo sem tabela de veiculos: virou cartao de referencia (nao se arrasta para um dia)`,
        );
      }
      const lista = (porCidade[final.cidadeId] ??= []);
      lista.push(final);
    }
  }

  for (const id of idsAjustados) {
    avisos.push(`ajuste manual para id inexistente "${id}": o id do item mudou?`);
  }

  return porCidade;
}

export function converterItem(
  i: Json,
  idsUsados: Set<string>,
  config: ConfigDeDestino,
): Json | undefined {
  const cidadeOriginal = String(i.cidade ?? '');
  const cidadeId = config.cidadeDoItem[cidadeOriginal];
  if (!cidadeId) {
    avisos.push(`item "${i.nome}" tem cidade desconhecida "${cidadeOriginal}": descartado`);
    return undefined;
  }

  const prefixo = config.prefixoId[cidadeId] ?? slug(cidadeId, 6);
  const base = `${config.codigoPais.toLowerCase()}-${prefixo}-${slug(String(i.nome))}`;
  let id = base;
  let n = 2;
  while (idsUsados.has(id)) id = `${base}-${n++}`;
  idsUsados.add(id);

  const tags = new Set<string>(
    (i.tags ?? []).map((t: unknown) => slug(String(t), 30)).filter(Boolean),
  );
  if (cidadeOriginal !== cidadeId) tags.add(slug(cidadeOriginal, 30));

  const gratuito = [...tags].some((t) => ['gratis', 'gratuito', 'free'].includes(t));
  const { preco, alerta: alertaDePreco } = converterPreco(i.preco);
  const { horarios, horariosObservacao, conflitoDeHorario } = converterHorarios(i.horarios);
  const { confianca: nivel, observacaoDeConfianca } = confianca(
    i.confianca ?? grauPelasFontes(i),
  );

  const c = i.coords as Json | undefined;
  const temCoords =
    !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && !(c.lat === 0 && c.lng === 0);
  if (!temCoords && c) derivado('coordenada 0,0 tratada como ausente');

  const contato: Json = {};
  for (const [chave, valor] of Object.entries(i.contato ?? {})) {
    const texto = String(valor ?? '').trim();
    if (!texto) continue;
    if (chave === 'site' && !RE_URL.test(texto)) continue;
    contato[chave] = texto;
  }

  const imagens: Json[] = [];
  const img = i.imagem as Json | undefined;
  if (img?.url && img.credito && img.licenca && img.fonte && RE_URL.test(String(img.url))) {
    imagens.push({
      url: String(img.url),
      credito: String(img.credito),
      licenca: String(img.licenca),
      fonte: String(img.fonte),
      ...(img.descricao ? { descricao: String(img.descricao) } : {}),
    });
  }

  // Duracao zerada na pesquisa significa "isto nao e uma atividade": e um
  // cartao de referencia (como funciona o TransMilenio, vale alugar carro).
  const d = i.duracao as Json | undefined;
  const temDuracao =
    !!d && Number(d.min) > 0 && Number(d.tipica) > 0 && Number(d.max) > 0;
  if (!temDuracao) derivado('item sem duracao tratado como cartao de referencia');

  const alertas = (i.alertas ?? []).map(String);
  if (alertaDePreco) alertas.push(alertaDePreco);
  if (!temCoords) alertas.push('coordenada nao encontrada: este item nao aparece no mapa');
  if (conflitoDeHorario) {
    alertas.push(
      'as fontes divergem no horario de funcionamento: o banco usa a primeira citada; confira antes de ir',
    );
  }

  const item: Json = {
    id,
    fontes: fontes(i.fontes),
    coletadoEm: i.coletadoEm || COLETADO_EM,
    confianca: nivel,
    ...(observacaoDeConfianca ? { observacaoDeConfianca } : {}),
    nome: String(i.nome),
    cidadeId,
    categoria: i.categoria,
    tags: [...tags],
    ...(temCoords ? { coords: { lat: c!.lat, lng: c!.lng } } : {}),
    descricaoCurta: (String(i.descricaoCurta ?? '').trim() || String(i.nome)).slice(0, 220),
    descricaoLonga: String(i.descricaoLonga ?? ''),
    ...(temDuracao ? { duracao: i.duracao } : {}),
    ...(horarios ? { horarios } : {}),
    ...(horariosObservacao ? { horariosObservacao } : {}),
    diasFechados: (i.diasFechados ?? []).map(String),
    ...(i.melhorHorario ? { melhorHorario: String(i.melhorHorario) } : {}),
    ...(preco ? { preco } : {}),
    ...(gratuito && !preco ? { gratuito: true } : {}),
    reserva: {
      necessaria: Boolean(i.reserva?.necessaria),
      ...(Number.isFinite(i.reserva?.antecedenciaDias) && Number(i.reserva.antecedenciaDias) > 0
        ? { antecedenciaDias: Number(i.reserva.antecedenciaDias) }
        : {}),
      ...(i.reserva?.link && RE_URL.test(String(i.reserva.link))
        ? { link: String(i.reserva.link) }
        : {}),
    },
    contato,
    imagens,
    agendavel: temDuracao,
    restricoes: derivarRestricoes(i),
    selos: derivarSelos(i, !!preco, gratuito && !preco),
    dicas: (i.dicasAgente ?? []).map(String),
    alertas,
  };

  if (i.categoria === 'passeio') {
    item.passeio = {
      ...(i.pontoPartida ? { pontoPartida: String(i.pontoPartida) } : {}),
      horariosDeSaida: [],
      horarioFixo: false,
    };
  }
  if (['restaurante', 'bar', 'cafe'].includes(String(i.categoria))) {
    item.gastronomia = { tipoCozinha: [], reservaRecomendada: Boolean(i.reserva?.necessaria) };
  }
  if (i.categoria === 'aluguel-veiculo') {
    // A tabela de veiculos vive em prosa na pesquisa. Montar por regex seria
    // fragil justamente no dado mais importante da viagem, entao estes poucos
    // itens sao escritos a mao em pesquisa/ajustes-manuais.json.
    avisos.push(`aluguel sem bloco estruturado: ${id} -> escrever em ajustes-manuais.json`);
  }

  return item;
}
