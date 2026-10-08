/**
 * Monta cada colecao do banco a partir da pesquisa crua.
 *
 * Decisao que atravessa este arquivo: TODA base mencionada pela pesquisa entra
 * em `cidades`, mesmo as que ainda nao foram pesquisadas a fundo. O usuario
 * precisa poder montar qualquer roteiro do pais; campo ausente faz o motor
 * usar padrao rotulado como estimativa, nunca impede o planejamento.
 */
import {
  COLETADO_EM,
  type Json,
  RE_URL,
  avisos,
  confianca,
  derivado,
  fontes,
  mesclar,
  slug,
} from './pesquisa-utils.ts';

/** Mapa id-da-base -> arquivo de pesquisa daquela base (onda-*.json). */
export type Bases = Record<string, Json>;

// ------------------------------------------------------------------- tabelas

/** Regiao de cada base. */
const REGIAO_DA_CIDADE: Record<string, string> = {
  cartagena: 'caribe-continental',
  'santa-marta': 'caribe-continental',
  palomino: 'caribe-continental',
  'san-andres': 'caribe-insular',
  bogota: 'andes',
  'villa-de-leyva': 'andes',
  medellin: 'andes',
  salento: 'eje-cafetero',
};

const NOME_DA_CIDADE: Record<string, string> = {
  cartagena: 'Cartagena',
  'santa-marta': 'Santa Marta',
  palomino: 'Palomino',
  'san-andres': 'San Andres',
  bogota: 'Bogota',
  'villa-de-leyva': 'Villa de Leyva',
  medellin: 'Medellin',
  salento: 'Salento',
};

/** Texto da pesquisa -> id de regiao, e qual cidade herda aquele clima. */
const CLIMA_PARA_CIDADES: Array<{ contem: RegExp; cidades: string[]; regiao: string }> = [
  { contem: /Caribe - Cartagena/i, cidades: ['cartagena'], regiao: 'caribe-continental' },
  { contem: /Caribe seco/i, cidades: ['santa-marta', 'palomino'], regiao: 'caribe-continental' },
  { contem: /Caribe insular/i, cidades: ['san-andres'], regiao: 'caribe-insular' },
  { contem: /Andes - Bogot/i, cidades: ['bogota'], regiao: 'andes' },
  { contem: /Andes - Villa de Leyva/i, cidades: ['villa-de-leyva'], regiao: 'andes' },
  { contem: /Andes - Medell/i, cidades: ['medellin'], regiao: 'andes' },
  { contem: /Eje Cafetero/i, cidades: ['salento'], regiao: 'eje-cafetero' },
  { contem: /Pac[ií]fico/i, cidades: [], regiao: 'pacifico' },
  { contem: /Amaz[oô]nia/i, cidades: [], regiao: 'amazonia' },
];

const DESCRICAO_DA_REGIAO: Record<string, string> = {
  'caribe-continental': 'Costa caribenha continental: Cartagena, Santa Marta, Tayrona, Palomino.',
  'caribe-insular': 'Arquipelago de San Andres, Providencia e Santa Catalina.',
  andes: 'Cordilheira: Bogota, Medellin, Villa de Leyva e o altiplano.',
  'eje-cafetero': 'Regiao do cafe: Salento, Filandia, Vale de Cocora, fazendas.',
  pacifico: 'Costa do Pacifico: Choco, Nuqui, avistamento de baleias.',
  amazonia: 'Amazonia colombiana, com base em Leticia.',
};

/** Nome que a pesquisa usa em trechos e eventos -> id de cidade. */
const APELIDOS_DE_CIDADE: Array<[RegExp, string]> = [
  [/villa de leyva/i, 'villa-de-leyva'],
  [/san andr[eé]s/i, 'san-andres'],
  [/santa marta/i, 'santa-marta'],
  [/cartagena/i, 'cartagena'],
  [/medell[ií]n/i, 'medellin'],
  [/bogot[aá]/i, 'bogota'],
  [/palomino/i, 'palomino'],
  [/salento|pereira|armenia|eje cafetero/i, 'salento'],
];

function cidadePorTexto(texto: string): string | undefined {
  for (const [padrao, id] of APELIDOS_DE_CIDADE) if (padrao.test(texto)) return id;
  return undefined;
}

/** Todas as cidades citadas num texto (para evento que vale em mais de uma). */
function cidadesPorTexto(texto: string): string[] {
  const achadas = new Set<string>();
  for (const [padrao, id] of APELIDOS_DE_CIDADE) if (padrao.test(texto)) achadas.add(id);
  return [...achadas];
}

const IATA_PARA_CIDADE: Record<string, string> = {
  CTG: 'cartagena',
  ADZ: 'san-andres',
  SMR: 'santa-marta',
  MDE: 'medellin',
  EOH: 'medellin',
  BOG: 'bogota',
  PEI: 'salento',
  AXM: 'salento',
};

// ------------------------------------------------------------------ destino

export function construirDestino(logistica: Json): Json {
  const d = logistica.destino;
  const r = d.requisitosEntradaBrasileiro ?? {};

  const todasAsFontes = fontes([
    ...(r.fontes ?? []),
    ...(d.saude?.fontes ?? []),
    ...(d.seguranca?.fontes ?? []),
    ...(d.dinheiro?.fontes ?? []),
    ...(d.chipEsim?.fontes ?? []),
  ]);

  return {
    id: 'colombia',
    fontes: todasAsFontes,
    coletadoEm: logistica.coletadoEm || COLETADO_EM,
    confianca: 'parcial',
    observacaoDeConfianca:
      'Dados de pais reunidos de varias fontes com niveis diferentes. Ver pendencias para o que nao saiu de fonte oficial.',
    nome: 'Colombia',
    codigoPais: 'CO',
    moeda: 'COP',
    fuso: 'America/Bogota',
    fusoOffsetMinutos: -300,
    idiomas: ['es'],
    ...(d.tomadas ? { tomadas: String(d.tomadas) } : {}),
    ...(d.voltagem ? { voltagem: String(d.voltagem) } : {}),
    // Caixa que cobre a Colombia continental e o arquipelago de San Andres,
    // que fica bem a oeste. Usada pelo validador para pegar coordenada errada.
    caixaDelimitadora: { latMin: -4.3, latMax: 13.5, lngMin: -82.1, lngMax: -66.8 },
    entrada: [
      {
        nacionalidade: 'BR',
        documento: String(r.passaporte ?? 'nao informado'),
        vistoNecessario: false,
        ...(r.vacinaFebreAmarela ? { vacinaFebreAmarela: String(r.vacinaFebreAmarela) } : {}),
        ...(r.comprovantes ? { formularioMigratorio: String(r.comprovantes) } : {}),
        comprovantesExigidos: [],
        observacoes: String(r.visto ?? ''),
        fontes: fontes(r.fontes).length > 0 ? fontes(r.fontes) : todasAsFontes,
      },
    ],
    saude: {
      vacinasRecomendadas: (d.saude?.vacinasRecomendadas ?? []).map(String),
      ...(d.saude?.aguaPotavel ? { aguaPotavel: String(d.saude.aguaPotavel) } : {}),
      ...(d.saude?.altitudeBogota ? { altitudeAtencao: String(d.saude.altitudeBogota) } : {}),
      ...(d.saude?.seguroObrigatorio ? { observacoes: String(d.saude.seguroObrigatorio) } : {}),
      fontes: fontes(d.saude?.fontes),
    },
    seguranca: {
      orientacaoGeral: String(d.seguranca?.orientacaoGeral ?? 'sem dado').slice(0, 4000),
      golpesComuns: (d.seguranca?.golpesComuns ?? []).map(String),
      appsDeTransporte: (d.seguranca?.appsDeTransporte ?? []).map(String),
      fontes: fontes(d.seguranca?.fontes),
    },
    dinheiro: {
      ...(d.dinheiro?.cambio ? { cambioObservacao: String(d.dinheiro.cambio) } : {}),
      ...(d.dinheiro?.cartaoAceito ? { cartaoAceito: String(d.dinheiro.cartaoAceito) } : {}),
      ...(d.dinheiro?.saqueEmCaixa ? { saque: String(d.dinheiro.saqueEmCaixa) } : {}),
      ...(d.dinheiro?.gorjeta ? { gorjeta: String(d.dinheiro.gorjeta) } : {}),
      ...(d.dinheiro?.iva19ParaTuristas
        ? { isencaoDeImpostoParaTurista: String(d.dinheiro.iva19ParaTuristas) }
        : {}),
      fontes: fontes(d.dinheiro?.fontes),
    },
    conectividade: {
      operadoras: (d.chipEsim?.operadoras ?? []).map(String),
      ...(d.chipEsim?.comoComprar ? { comoComprarChip: String(d.chipEsim.comoComprar) } : {}),
      ...(d.chipEsim?.faixaPreco ? { esim: String(d.chipEsim.faixaPreco) } : {}),
      fontes: fontes(d.chipEsim?.fontes),
    },
    linksUteis: [],
  };
}

// ------------------------------------------------------------------- regioes

export function construirRegioes(logistica: Json): Json[] {
  const porRegiao = new Map<string, Json[]>();
  for (const c of logistica.climaNovembro ?? []) {
    const casamento = CLIMA_PARA_CIDADES.find((x) => x.contem.test(String(c.regiao)));
    if (!casamento) continue;
    const lista = porRegiao.get(casamento.regiao) ?? [];
    lista.push(c);
    porRegiao.set(casamento.regiao, lista);
  }

  const usadas = new Set(Object.values(REGIAO_DA_CIDADE));
  const regioes: Json[] = [];

  for (const id of usadas) {
    const climas = porRegiao.get(id) ?? [];
    const fontesDaRegiao = fontes(climas.flatMap((c) => c.fontes ?? []));
    regioes.push({
      id,
      fontes:
        fontesDaRegiao.length > 0
          ? fontesDaRegiao
          : [{ url: 'https://www.openstreetmap.org/relation/120027' }],
      coletadoEm: COLETADO_EM,
      confianca: fontesDaRegiao.length > 0 ? 'parcial' : 'estimado',
      nome: id
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
      descricaoCurta: DESCRICAO_DA_REGIAO[id] ?? 'Regiao da Colombia.',
    });
  }
  return regioes;
}

// ---------------------------------------------------------------- aeroportos

export function construirAeroportos(logistica: Json): Json[] {
  const saida: Json[] = [];
  for (const a of logistica.aeroportos ?? []) {
    const iata = String(a.iata ?? '').toUpperCase();
    if (iata.length !== 3) {
      avisos.push(`aeroporto sem IATA valido descartado: ${a.nome ?? '(sem nome)'}`);
      continue;
    }
    const c = a.coords ?? {};
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) {
      avisos.push(`aeroporto ${iata} sem coordenada: descartado`);
      continue;
    }
    // 0 na pesquisa significa "nao achei em fonte", nao "zero minutos".
    const positivo = (v: unknown) => (Number.isFinite(v) && Number(v) > 0 ? Number(v) : undefined);
    const campos = {
      tempoAoCentroMin: positivo(a.tempoAoCentroMin),
      antecedenciaDomesticaMin: positivo(a.antecedenciaDomesticaMin),
      antecedenciaInternacionalMin: positivo(a.antecedenciaInternacionalMin),
      desembarqueDomesticoMin: positivo(a.desembarqueDomesticoMin),
      desembarqueInternacionalMin: positivo(a.desembarqueInternacionalMin),
    };
    for (const [nome, valor] of Object.entries(campos)) {
      if (valor === undefined) derivado(`aeroporto sem ${nome}: motor usara padrao estimado`);
    }

    saida.push({
      id: slug(iata),
      fontes: fontes(a.fontes),
      coletadoEm: COLETADO_EM,
      confianca: 'parcial',
      iata,
      nome: String(a.nome ?? iata),
      cidadeNome: String(a.cidade ?? ''),
      coords: { lat: c.lat, lng: c.lng },
      ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)),
      ...(a.observacao ? { observacoes: String(a.observacao).slice(0, 2000) } : {}),
    });
  }
  return saida;
}

// ------------------------------------------------------------------- cidades

function climaDaCidade(logistica: Json, cidadeId: string): Json[] {
  for (const c of logistica.climaNovembro ?? []) {
    const casamento = CLIMA_PARA_CIDADES.find((x) => x.contem.test(String(c.regiao)));
    if (!casamento?.cidades.includes(cidadeId)) continue;
    if (!Number.isFinite(c.chuvaMm) || Number(c.chuvaMm) === 0) continue;
    const { confianca: nivel } = confianca(c.confianca);
    return [
      {
        mes: 11,
        tempMinC: Number(c.tempMinC ?? 0),
        tempMaxC: Number(c.tempMaxC ?? 0),
        chuvaMm: Number(c.chuvaMm),
        diasDeChuva: Number(c.diasDeChuva ?? 0),
        resumo: String(c.resumo ?? '').slice(0, 2000),
        ...(c.marEVento ? { marEVento: String(c.marEVento).slice(0, 1200) } : {}),
        ...(c.planoBChuva ? { planoBChuva: String(c.planoBChuva).slice(0, 1200) } : {}),
        pesoNaDecisao: ['alto', 'medio', 'baixo'].includes(String(c.pesoNaDecisao))
          ? String(c.pesoNaDecisao)
          : 'medio',
        fontes: fontes(c.fontes),
        ...(nivel ? {} : {}),
      },
    ];
  }
  return [];
}

function bairrosDaBase(notas: Json | undefined): Json[] {
  return (notas?.melhoresBairrosParaFicar ?? []).map((b: Json) => ({
    nome: String(b.nome ?? 'sem nome'),
    perfil: String(b.perfil ?? 'sem descricao'),
    ...(Number.isFinite(b.diariaFaixa?.min) && Number(b.diariaFaixa?.max) > 0
      ? {
          diariaFaixa: {
            moeda: b.diariaFaixa.moeda || 'COP',
            min: Number(b.diariaFaixa.min),
            max: Number(b.diariaFaixa.max),
          },
        }
      : {}),
    ...(b.observacao ? { observacao: String(b.observacao).slice(0, 1200) } : {}),
    ...(b.seguranca ? { seguranca: String(b.seguranca).slice(0, 1200) } : {}),
    fontes: fontes(b.fontes),
  }));
}

/**
 * Fatores de deslocamento autorados por cidade. Sao ENTRADA DO MOTOR, nao
 * afirmacao sobre o mundo: velocidade media do modal e quanto a rota real
 * excede a linha reta. Toda saida da camada 3 do estimador aparece na
 * interface marcada como estimativa. Cidade fora desta tabela usa o padrao
 * do motor.
 */
const FATORES: Record<string, Json> = {
  // Centro historico compacto e plano; transito pesado fora dele.
  cartagena: {
    'a-pe': { kmh: 4.5, fatorRota: 1.25 },
    'carro-app': { kmh: 20, fatorRota: 1.35 },
    'transporte-publico': { kmh: 14, fatorRota: 1.5 },
    'veiculo-alugado': { kmh: 20, fatorRota: 1.35 },
  },
  // Ilha de ~26 km de perimetro, estrada circular costeira, pouco transito.
  // Mulita e buggy sao lentos, por isso 22 km/h e nao mais.
  'san-andres': {
    'a-pe': { kmh: 4.5, fatorRota: 1.2 },
    'carro-app': { kmh: 24, fatorRota: 1.15 },
    'transporte-publico': { kmh: 18, fatorRota: 1.25 },
    'veiculo-alugado': { kmh: 22, fatorRota: 1.15 },
    bicicleta: { kmh: 12, fatorRota: 1.15 },
  },
};

export function construirCidades(
  logistica: Json,
  coords: Json,
  bases: Bases,
  ajustes: Json,
): Json[] {
  const patchesDeCidade: Json = ajustes.cidades ?? {};
  const notasPorCidade: Record<string, Json> = {};
  for (const [baseId, pacote] of Object.entries(bases)) {
    if (pacote?.notasDaBase) notasPorCidade[baseId] = pacote.notasDaBase;
  }

  const aeroportosPorCidade = new Map<string, string[]>();
  for (const [iata, cidadeId] of Object.entries(IATA_PARA_CIDADE)) {
    const existe = (logistica.aeroportos ?? []).some(
      (a: Json) => String(a.iata).toUpperCase() === iata,
    );
    if (!existe) continue;
    const lista = aeroportosPorCidade.get(cidadeId) ?? [];
    lista.push(iata);
    aeroportosPorCidade.set(cidadeId, lista);
  }

  const cidades: Json[] = [];

  for (const [id, regiaoId] of Object.entries(REGIAO_DA_CIDADE)) {
    const geo = coords[id];
    if (!geo) {
      avisos.push(`cidade ${id} sem coordenada em coords-cidades.json: descartada`);
      continue;
    }
    const notas = notasPorCidade[id];
    const pesquisadaAFundo = Boolean(notas);

    const taxas: Json[] = [];
    const taxa = notas?.taxaDeEntradaNaIlha;
    if (taxa && Number(taxa.valor) > 0) {
      taxas.push({
        nome: 'Tarjeta de Turismo (taxa de entrada na ilha)',
        preco: {
          moeda: taxa.moeda || 'COP',
          min: Number(taxa.valor),
          max: Number(taxa.valor),
          por: 'pessoa',
          inclui: 'entrada na ilha',
          coletadoEm: COLETADO_EM,
          fontes: fontes(taxa.fontes),
        },
        comoSePaga: String(taxa.comoSePaga ?? ''),
        quemPaga: 'todo visitante nao residente',
      });
    }

    const noites = notas?.noitesRecomendadas;
    const noitesValidas =
      noites &&
      Number(noites.min) > 0 &&
      Number(noites.ideal) >= Number(noites.min) &&
      Number(noites.max) >= Number(noites.ideal);
    if (!pesquisadaAFundo) {
      derivado('cidade ainda nao pesquisada a fundo: entra sem noites nem fatores');
    }

    const cidade: Json = {
      id,
      fontes: notas
        ? fontes([...(notas.fontes ?? []), geo.osm])
        : [{ url: String(geo.osm) }],
      coletadoEm: COLETADO_EM,
      confianca: pesquisadaAFundo ? 'parcial' : 'estimado',
      ...(pesquisadaAFundo
        ? {}
        : {
            observacaoDeConfianca:
              'Base criada so com coordenada, altitude e clima de fonte. Bairros, como circular e noites recomendadas chegam na onda B da pesquisa.',
          }),
      nome: NOME_DA_CIDADE[id] ?? id,
      regiaoId,
      coords: { lat: geo.lat, lng: geo.lng },
      altitudeM: Number(geo.altitudeM ?? 0),
      aeroportos: aeroportosPorCidade.get(id) ?? [],
      ...(noitesValidas
        ? {
            noitesRecomendadas: {
              min: Number(noites.min),
              ideal: Number(noites.ideal),
              max: Number(noites.max),
            },
          }
        : {}),
      bairros: bairrosDaBase(notas),
      ...(notas?.comoCircular ? { comoCircular: String(notas.comoCircular).slice(0, 3000) } : {}),
      ...(FATORES[id] ? { fatoresDeslocamento: FATORES[id] } : {}),
      matrizInterna: [],
      climaPorMes: climaDaCidade(logistica, id),
      ...(notas?.segurancaPorBairro
        ? { seguranca: String(notas.segurancaPorBairro).slice(0, 3000) }
        : {}),
      pegaTuristaAEvitar: (notas?.pegaTuristaAEvitar ?? []).map(String),
      taxasObrigatorias: taxas,
      situacaoAtual: [],
    };

    const patch = patchesDeCidade[id];
    cidades.push(patch ? mesclar(cidade, patch) : cidade);
  }

  for (const id of Object.keys(patchesDeCidade)) {
    if (!cidades.some((c) => c.id === id)) {
      avisos.push(`ajuste manual para cidade inexistente "${id}"`);
    }
  }

  return cidades;
}

// ------------------------------------------------------------------- trechos

const MODAL_VALIDO = new Set([
  'voo',
  'onibus',
  'barco',
  'carro-fretado',
  'veiculo-alugado',
  'carro-app',
  'transporte-publico',
  'a-pe',
  'bicicleta',
]);

export function construirTrechos(logistica: Json): Json[] {
  const trechos: Json[] = [];
  const ids = new Set<string>();
  const paresDeVoo = new Set<string>();

  for (const t of logistica.trechosEntreCidades ?? []) {
    const de = cidadePorTexto(String(t.de ?? ''));
    const para = cidadePorTexto(String(t.para ?? ''));
    if (!de || !para) {
      avisos.push(`trecho "${t.de} -> ${t.para}" nao mapeou para bases conhecidas: descartado`);
      continue;
    }
    if (de === para) {
      avisos.push(`trecho "${t.de} -> ${t.para}" virou a mesma base (${de}): descartado`);
      continue;
    }
    const modal = MODAL_VALIDO.has(String(t.modal)) ? String(t.modal) : 'carro-fretado';
    if (!MODAL_VALIDO.has(String(t.modal))) derivado('modal desconhecido mapeado para carro-fretado');

    const base = `${de}-${para}-${modal}`;
    let id = base;
    let n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    if (modal === 'voo') paresDeVoo.add(`${de}>${para}`);

    const { confianca: nivel, observacaoDeConfianca } = confianca(t.confianca);
    const preco =
      Number(t.faixaPreco?.min) > 0 || Number(t.faixaPreco?.max) > 0
        ? {
            moeda: t.faixaPreco.moeda || 'COP',
            min: Number(t.faixaPreco.min ?? 0),
            max: Math.max(Number(t.faixaPreco.max ?? 0), Number(t.faixaPreco.min ?? 0)),
            por: 'pessoa',
            inclui: '',
            coletadoEm: COLETADO_EM,
            fontes: fontes(t.fontes),
          }
        : undefined;

    trechos.push({
      id,
      fontes: fontes(t.fontes),
      coletadoEm: COLETADO_EM,
      confianca: nivel,
      ...(observacaoDeConfianca ? { observacaoDeConfianca } : {}),
      deCidadeId: de,
      paraCidadeId: para,
      modal,
      operadoras: (t.operadoras ?? []).map(String),
      ...(Number(t.duracaoPortaAPortaMin) > 0
        ? { duracaoPortaAPortaMin: Number(t.duracaoPortaAPortaMin) }
        : {}),
      ...(Number(t.duracaoVeiculoMin) > 0
        ? { duracaoVeiculoMin: Number(t.duracaoVeiculoMin) }
        : {}),
      ...(t.frequencia ? { frequencia: String(t.frequencia).slice(0, 1200) } : {}),
      ...(preco ? { preco } : {}),
      ...(t.terminais?.saida ? { terminalSaida: String(t.terminais.saida) } : {}),
      ...(t.terminais?.chegada ? { terminalChegada: String(t.terminais.chegada) } : {}),
      ...(Number(t.antecedenciaDias) > 0
        ? { antecedenciaDiasParaComprar: Number(t.antecedenciaDias) }
        : {}),
      ...(t.observacoes ? { observacoes: String(t.observacoes).slice(0, 4000) } : {}),
      alertas: [],
    });
  }

  // Voos internos que a lista de trechos nao cobre: entram como trecho de voo
  // com a duracao do VOO (dado de fonte). O porta a porta fica para o motor.
  for (const v of logistica.voosInternos ?? []) {
    const rota = rotaIata(v.rota);
    if (!rota) {
      avisos.push(`voo interno com rota ilegivel: ${v.rota}`);
      continue;
    }
    const [origem, destino] = rota;
    const de = IATA_PARA_CIDADE[origem];
    const para = IATA_PARA_CIDADE[destino];
    if (!de || !para || de === para) continue;
    if (paresDeVoo.has(`${de}>${para}`)) continue;

    const base = `${de}-${para}-voo`;
    let id = base;
    let n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    paresDeVoo.add(`${de}>${para}`);

    const preco =
      Number(v.faixaPreco?.min) > 0
        ? {
            moeda: v.faixaPreco.moeda || 'COP',
            min: Number(v.faixaPreco.min),
            max: Math.max(Number(v.faixaPreco.max ?? 0), Number(v.faixaPreco.min)),
            por: 'pessoa',
            inclui: '',
            coletadoEm: v.faixaPreco.coletadoEm || COLETADO_EM,
            fontes: fontes(v.fontes),
            observacao: `faixa de agregador, nao cotacao de data especifica${
              v.faixaPreco.tipo ? ` (${v.faixaPreco.tipo})` : ''
            }`,
          }
        : undefined;

    trechos.push({
      id,
      fontes: fontes(v.fontes),
      coletadoEm: COLETADO_EM,
      confianca: confianca(v.confianca).confianca,
      deCidadeId: de,
      paraCidadeId: para,
      modal: 'voo',
      operadoras: (v.cias ?? []).map(String),
      ...(Number(v.duracaoMin) > 0 ? { duracaoVeiculoMin: Number(v.duracaoMin) } : {}),
      ...(v.frequencia ? { frequencia: String(v.frequencia).slice(0, 1200) } : {}),
      ...(preco ? { preco } : {}),
      terminalSaida: origem,
      terminalChegada: destino,
      ...(v.observacoes ? { observacoes: String(v.observacoes).slice(0, 4000) } : {}),
      alertas: ['duracao porta a porta nao veio da fonte: o motor estima'],
    });
    derivado('voo interno convertido em trecho sem porta a porta de fonte');
  }

  return trechos;
}

// ---------------------------------------------------------------------- voos

/**
 * A pesquisa escreve a rota como "GRU-BOG" ou "GRU-ADZ (San Andres)".
 * Le so os dois codigos IATA e ignora o resto do texto.
 */
const RE_ROTA = /\b([A-Z]{3})\b\s*-\s*\b([A-Z]{3})\b/;

function rotaIata(bruto: unknown): [string, string] | undefined {
  const m = RE_ROTA.exec(String(bruto ?? '').toUpperCase());
  return m?.[1] && m[2] ? [m[1], m[2]] : undefined;
}

export function construirVoos(logistica: Json): Json[] {
  const voos: Json[] = [];
  const ids = new Set<string>();

  for (const v of logistica.voosInternacionais ?? []) {
    const rota = rotaIata(v.rota);
    if (!rota) {
      avisos.push(`voo internacional com rota ilegivel: ${v.rota}`);
      continue;
    }
    const [origemIata, destinoIata] = rota;
    let id = slug(`${origemIata}-${destinoIata}`);
    let n = 2;
    while (ids.has(id)) id = `${id}-${n++}`;
    ids.add(id);

    const fp = v.faixaPreco ?? {};
    const preco =
      Number(fp.min) > 0
        ? {
            moeda: fp.moeda || 'BRL',
            min: Number(fp.min),
            max: Math.max(Number(fp.max ?? 0), Number(fp.min)),
            por: 'pessoa',
            inclui: String(fp.tipo ?? ''),
            coletadoEm: fp.coletadoEm || COLETADO_EM,
            fontes: fontes(v.fontes),
            observacao: String(fp.observacao ?? '').slice(0, 600),
          }
        : undefined;

    voos.push({
      id,
      fontes: fontes(v.fontes),
      coletadoEm: COLETADO_EM,
      confianca: confianca(v.confianca).confianca,
      origemIata,
      destinoIata,
      cias: (v.cias ?? []).map(String),
      ...(v.escala ? { escalas: String(v.escala) } : {}),
      duracaoTotalMin: Number(v.duracaoTotalMin) > 0 ? Number(v.duracaoTotalMin) : 600,
      ...(v.frequencia ? { frequencia: String(v.frequencia).slice(0, 1500) } : {}),
      ...(preco ? { preco } : {}),
      ...(v.linkDeBusca && RE_URL.test(String(v.linkDeBusca))
        ? { linkDeBusca: String(v.linkDeBusca) }
        : {}),
      observacoes:
        'Preco de voo e fotografia do dia da coleta. A viagem e no mes seguinte, entao a faixa e util, mas confira no link de busca antes de comprar.',
    });
    if (!(Number(v.duracaoTotalMin) > 0)) {
      derivado('voo internacional sem duracao na fonte: 600 min como marcador');
    }
  }
  return voos;
}

// ---------------------------------------------------------------- calendario

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function mapearPreco(texto: string): string | undefined {
  const t = texto.toLowerCase();
  if (/sem dado|sem efeito|efeito pequeno|fora da janela|n\/a/.test(t)) return undefined;
  if (/m[aá]xim|pico de pre|sobem muito/.test(t)) return 'sobe-muito';
  if (/pico|sobe|elevad|alto|sup/.test(t)) return 'sobe';
  return undefined;
}

function mapearLotacao(texto: string): string | undefined {
  const t = texto.toLowerCase();
  if (/sem dado|n\/a/.test(t)) return undefined;
  if (/m[aá]xima|muito alta|alta/.test(t)) return 'alta';
  if (/m[eé]dia/.test(t)) return 'media';
  if (/baixa|vazio/.test(t)) return 'baixa';
  return undefined;
}

export function construirCalendario(logistica: Json): Json[] {
  const eventos: Json[] = [];
  const ids = new Set<string>();

  for (const e of logistica.calendarioNovembro2026 ?? []) {
    const data = String(e.data ?? '');
    if (!RE_DATA.test(data)) {
      avisos.push(`evento sem data exata ficou fora do banco: "${e.nome}" (${data})`);
      continue;
    }
    const tipo = ['feriado-nacional', 'feriado-local', 'festa', 'evento', 'temporada'].includes(
      String(e.tipo),
    )
      ? String(e.tipo)
      : 'evento';

    const local = String(e.local ?? '');
    const nacional = /col[oô]mbia inteira|nacional/i.test(local);
    const escopos = nacional ? ['nacional'] : cidadesPorTexto(local);

    if (escopos.length === 0) {
      avisos.push(`evento "${e.nome}" tem escopo "${local}" fora das bases do banco: descartado`);
      continue;
    }
    if (escopos.length > 1) {
      derivado('evento de varias cidades desdobrado em um registro por cidade');
    }

    const impactoBruto = e.impacto ?? {};
    const prosa = [impactoBruto.preco, impactoBruto.lotacao].filter(Boolean).join(' | ');
    const preco = mapearPreco(String(impactoBruto.preco ?? ''));
    const lotacao = mapearLotacao(String(impactoBruto.lotacao ?? ''));
    if (!preco && impactoBruto.preco) derivado('impacto de preco em prosa sem categoria clara');

    const { confianca: nivel, observacaoDeConfianca } = confianca(e.confianca);

    for (const escopo of escopos) {
      const base = slug(`${data}-${String(e.nome).slice(0, 40)}-${escopo}`);
      let id = base;
      let n = 2;
      while (ids.has(id)) id = `${base}-${n++}`;
      ids.add(id);

      eventos.push({
        id,
        fontes: fontes(e.fontes),
        coletadoEm: COLETADO_EM,
        confianca: nivel,
        ...(observacaoDeConfianca ? { observacaoDeConfianca } : {}),
        nome: String(e.nome).slice(0, 400),
        tipo,
        dataInicio: data,
        escopo,
        ...(tipo === 'feriado-nacional' && /transferid/i.test(String(e.nome))
          ? { transferidoParaSegunda: true }
          : {}),
        impacto: {
          ...(preco ? { preco } : {}),
          ...(lotacao ? { lotacao } : {}),
          fechamentos: String(impactoBruto.fechamentos ?? ''),
          ...(impactoBruto.seguranca ? { seguranca: String(impactoBruto.seguranca) } : {}),
          ...(prosa ? { observacao: prosa.slice(0, 1500) } : {}),
        },
        descricao: String(e.nome).slice(0, 2000),
      });
    }
  }
  return eventos;
}

// --------------------------------------------------------------- hospedagem

function perfilDoBairro(texto: string): string {
  const t = texto.toLowerCase();
  if (/mochil|hostel|econ[oô]mic|barat|pouco dinheiro/.test(t)) return 'economico';
  if (/premium|luxo|boutique|cinco estrelas|alto padr/.test(t)) return 'premium';
  derivado('perfil de bairro em prosa mapeado para conforto');
  return 'conforto';
}

export function construirHospedagem(bases: Bases): Json[] {
  const saida: Json[] = [];
  const ids = new Set<string>();

  for (const [cidadeId, pacote] of Object.entries(bases)) {
    for (const b of pacote?.notasDaBase?.melhoresBairrosParaFicar ?? []) {
      const nome = String(b.nome ?? '').trim();
      if (!nome) continue;
      const faixa = b.diariaFaixa ?? {};
      if (!(Number(faixa.min) > 0)) {
        avisos.push(`bairro "${nome}" (${cidadeId}) sem faixa de diaria: fora de hospedagem.json`);
        continue;
      }
      const base = slug(`${cidadeId}-${nome}`);
      let id = base;
      let n = 2;
      while (ids.has(id)) id = `${base}-${n++}`;
      ids.add(id);

      saida.push({
        id,
        fontes: fontes(b.fontes),
        coletadoEm: COLETADO_EM,
        confianca: 'estimado',
        observacaoDeConfianca:
          'Faixa de diaria convertida de agregadores, nao cotacao para novembro de 2026.',
        cidadeId,
        bairro: nome,
        perfil: perfilDoBairro(String(b.perfil ?? '')),
        diaria: {
          moeda: faixa.moeda || 'COP',
          min: Number(faixa.min),
          max: Math.max(Number(faixa.max ?? 0), Number(faixa.min)),
        },
        porQue: [b.perfil, b.observacao].filter(Boolean).join(' — ').slice(0, 1500),
      });
    }
  }
  return saida;
}
