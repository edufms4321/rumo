/**
 * Monta cada colecao do banco a partir da pesquisa crua.
 *
 * Decisao que atravessa este arquivo: TODA base mencionada pela pesquisa entra
 * em `cidades`, mesmo as que ainda nao foram pesquisadas a fundo. O usuario
 * precisa poder montar qualquer roteiro do pais; campo ausente faz o motor
 * usar padrao rotulado como estimativa, nunca impede o planejamento.
 */
import type { ConfigDeDestino } from '../destinos/tipos.ts';
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

// ------------------------------------------------------------------ ajuda

function cidadePorTexto(texto: string, config: ConfigDeDestino): string | undefined {
  for (const [padrao, id] of config.apelidosDeCidade) if (padrao.test(texto)) return id;
  return undefined;
}

/** Todas as bases citadas num texto (para evento que vale em mais de uma). */
function cidadesPorTexto(texto: string, config: ConfigDeDestino): string[] {
  const achadas = new Set<string>();
  for (const [padrao, id] of config.apelidosDeCidade) if (padrao.test(texto)) achadas.add(id);
  return [...achadas];
}

// ------------------------------------------------------------------ destino

/**
 * Decide se o destino exige visto, lendo o texto da pesquisa.
 *
 * Antes isto era `false` fixo — e o Mexico, que EXIGE visto de brasileiro
 * desde 2022, entrava no banco como se nao exigisse. O fato mais importante
 * do pais ficava de fora porque ninguem preencheu um booleano.
 *
 * A afirmacao positiva vence: o texto costuma dizer "precisam de visto" e
 * depois listar quem e isento, e o isento nao anula a regra geral.
 */
function exigeVisto(texto: string): { exige: boolean; incerto: boolean } {
  const t = texto.toLowerCase();
  const positivo =
    /precisa\w* de visto|exige\w* visto|visto obrigat|necessit\w* de visto|visa (electronica|obligatoria)/.test(
      t,
    );
  const negativo = /dispensad|isen[çc]|nao (e|e) necessario|sem visto|visa[- ]free/.test(t);
  if (positivo) return { exige: true, incerto: false };
  if (negativo) return { exige: false, incerto: false };
  return { exige: false, incerto: t.trim().length > 0 };
}

export function construirDestino(logistica: Json, config: ConfigDeDestino): Json {
  const d = logistica.destino;
  const r = d.requisitosEntradaBrasileiro ?? {};

  const visto = exigeVisto(String(r.visto ?? ''));
  if (visto.incerto) {
    avisos.push(
      'nao deu para decidir pelo texto se o destino exige visto: gravado como NAO exige, confira',
    );
  } else if (visto.exige) {
    derivado('visto obrigatorio deduzido do texto da pesquisa');
  }

  const todasAsFontes = fontes([
    ...(r.fontes ?? []),
    ...(d.saude?.fontes ?? []),
    ...(d.seguranca?.fontes ?? []),
    ...(d.dinheiro?.fontes ?? []),
    ...(d.chipEsim?.fontes ?? []),
  ]);

  return {
    id: config.id,
    fontes: todasAsFontes,
    coletadoEm: logistica.coletadoEm || COLETADO_EM,
    confianca: 'parcial',
    observacaoDeConfianca:
      'Dados de pais reunidos de varias fontes com niveis diferentes. Ver pendencias para o que nao saiu de fonte oficial.',
    nome: config.nome,
    ...(config.paisNome ? { paisNome: config.paisNome } : {}),
    ...(config.cobertura ? { cobertura: config.cobertura } : {}),
    codigoPais: config.codigoPais,
    moeda: config.moeda,
    fuso: config.fuso,
    fusoOffsetMinutos: config.fusoOffsetMinutos,
    idiomas: config.idiomas,
    ...(d.tomadas ? { tomadas: String(d.tomadas) } : {}),
    ...(d.voltagem ? { voltagem: String(d.voltagem) } : {}),
    // Usada pelo validador para pegar coordenada fora do pais.
    caixaDelimitadora: config.caixaDelimitadora,
    entrada: [
      {
        nacionalidade: 'BR',
        documento: String(r.passaporte ?? 'nao informado'),
        vistoNecessario: visto.exige,
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

// --------------------------------------------------------------------- zonas

/**
 * Zonas turisticas: o recorte com nome proprio que a configuracao do destino
 * declara ("Chapada Diamantina", "Eje Cafetero", "Zona Colonial").
 *
 * Nao leva `fontes`, e isso e deliberado. A versao anterior desta funcao
 * produzia `regioes.json` herdando BaseRecord, e para satisfazer a exigencia
 * de fonte carimbava `openstreetmap.org/relation/120027` em toda regiao sem
 * clima pesquisado — relacao que e o estado do Maranhao. As 16 regioes do
 * Nordeste ficaram com o Maranhao como fonte, Chapada Diamantina incluida.
 * A frase da zona e nossa; fonte falsa e pior do que fonte nenhuma.
 */
export function construirZonas(config: ConfigDeDestino): Json[] {
  const usadas = new Set(Object.values(config.regiaoDaCidade));
  const zonas: Json[] = [];
  for (const id of usadas) {
    const descricao = config.descricaoDaRegiao[id];
    if (!descricao) {
      avisos.push(`zona ${id} sem descricao em descricaoDaRegiao: descartada`);
      continue;
    }
    zonas.push({
      id,
      nome: (config.nomeDaZona?.[id] ?? id
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')),
      descricaoCurta: descricao,
    });
  }
  return zonas;
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

function climaDaCidade(logistica: Json, cidadeId: string, config: ConfigDeDestino): Json[] {
  // Onda dedicada de clima: 12 meses por cidade, com fonte por linha.
  // Vence a tabela regional da onda de logistica, que so tinha um mes.
  const porCidade = ((logistica.climaPorCidadeEMes ?? []) as Json[]).filter(
    (c) => c.cidade === cidadeId && Number(c.mes) >= 1 && Number(c.mes) <= 12,
  );
  if (porCidade.length > 0) {
    return porCidade
      .map((c) => ({
        mes: Number(c.mes),
        tempMinC: Number(c.tempMinC ?? 0),
        tempMaxC: Number(c.tempMaxC ?? 0),
        chuvaMm: Number(c.chuvaMm ?? 0),
        diasDeChuva: Number(c.diasDeChuva ?? 0),
        resumo: String(c.resumo ?? '').slice(0, 2000),
        ...(c.marEVento ? { marEVento: String(c.marEVento).slice(0, 1500) } : {}),
        ...(c.planoBChuva ? { planoBChuva: String(c.planoBChuva).slice(0, 1500) } : {}),
        pesoNaDecisao: ['alto', 'medio', 'baixo'].includes(String(c.pesoNaDecisao))
          ? String(c.pesoNaDecisao)
          : 'medio',
        fontes: fontes(c.fontes),
      }))
      .filter((c) => c.fontes.length > 0)
      .sort((a, b) => a.mes - b.mes);
  }

  for (const c of logistica.climaNovembro ?? []) {
    const casamento = config.climaParaCidades.find((x) => x.contem.test(String(c.regiao)));
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

export function construirCidades(
  logistica: Json,
  coords: Json,
  bases: Bases,
  ajustes: Json,
  config: ConfigDeDestino,
  matrizCalculada: Json = {},
  divisoes?: { estadoDaCidade: Record<string, string>; regiaoDaCidade: Record<string, string> },
): Json[] {
  const patchesDeCidade: Json = ajustes.cidades ?? {};
  const notasPorCidade: Record<string, Json> = {};
  for (const [baseId, pacote] of Object.entries(bases)) {
    if (pacote?.notasDaBase) notasPorCidade[baseId] = pacote.notasDaBase;
  }

  const aeroportosPorCidade = new Map<string, string[]>();
  for (const [iata, cidadeId] of Object.entries(config.iataParaCidade)) {
    const existe = (logistica.aeroportos ?? []).some(
      (a: Json) => String(a.iata).toUpperCase() === iata,
    );
    if (!existe) continue;
    const lista = aeroportosPorCidade.get(cidadeId) ?? [];
    lista.push(iata);
    aeroportosPorCidade.set(cidadeId, lista);
  }

  const cidades: Json[] = [];

  for (const [id, zonaId] of Object.entries(config.regiaoDaCidade)) {
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

    /*
      Forma generica: a onda declara `taxasObrigatorias` como lista.

      A forma antiga acima so sabia ler uma taxa, com nome escrito em
      espanhol no codigo ("Tarjeta de Turismo") e moeda COP por padrao —
      serviu para San Andres e nao serve para mais nada. O Nordeste tem
      TPA de Noronha, TUPA de Morro de Sao Paulo, ingresso do PARNAMAR e
      taxa veicular de Porto Seguro, e sao justamente os maiores custos
      fixos do pacote: ficar de fora do orcamento e o pior lugar para um
      dado sumir.
    */
    for (const t of (notas?.taxasObrigatorias ?? []) as Json[]) {
      const v = (t.valor ?? t.preco) as Json | undefined;
      const min = Number(v?.min ?? v?.valor ?? 0);
      if (!t.nome || !Number.isFinite(min) || min <= 0) continue;
      /*
        Percentual nao e taxa fixa.

        A pesquisa de Punta Cana trouxe "propina legal de 10%" com valor
        10, e o conversor somou DEZ PESOS por pessoa no orcamento. Nao e
        dinheiro: e uma porcentagem da conta. O mesmo vale para cobranca
        condicional ("passageiro extra acima de 4"), que depende de quem
        viaja. As duas continuam no texto da base; fora do somatorio.
      */
      const texto = `${t.nome} ${t.quemPaga ?? ''}`;
      if (/\d+\s*%|por\s*cento|percentual/i.test(texto)) continue;
      if (/extra|acima de \d|adicional por|por passageiro extra/i.test(texto)) continue;

      const fontesDaTaxa = fontes(t.fontes ?? v?.fontes);
      // Sem fonte a taxa nao entra: o validador reprovaria, e com razao.
      if (fontesDaTaxa.length === 0) continue;
      taxas.push({
        nome: String(t.nome).slice(0, 200),
        preco: {
          moeda: String(v?.moeda ?? config.moeda),
          min,
          max: Number(v?.max ?? min),
          por: String(v?.tipo ?? '').includes('grupo') ? 'grupo' : 'pessoa',
          inclui: String(t.inclui ?? t.nome).slice(0, 300),
          coletadoEm: String(v?.coletadoEm ?? COLETADO_EM),
          fontes: fontesDaTaxa,
          ...(t.quemPaga ? { observacao: String(t.quemPaga).slice(0, 2000) } : {}),
        },
        comoSePaga: String(t.comoSePaga ?? t.ondeSePaga ?? ''),
        quemPaga: String(t.quemPaga ?? 'todo visitante nao residente').slice(0, 400),
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
      nome: config.nomeDaCidade[id] ?? id,
      /*
        Dois niveis diferentes com nomes parecidos, entao: `regiaoId` e a
        MACRORREGIAO do pais (Nordeste, Caribe) e vem da divisao oficial
        pesquisada; `zonaId` e o recorte turistico (Chapada Diamantina) e vem
        da configuracao. Sem o arquivo de divisoes o conversor usa a zona como
        regiao, que e o comportamento antigo — pacote antigo continua valendo.
      */
      ...(divisoes?.regiaoDaCidade[id] ? { regiaoId: divisoes.regiaoDaCidade[id] } : {}),
      ...(divisoes?.estadoDaCidade[id] ? { estadoId: divisoes.estadoDaCidade[id] } : {}),
      zonaId,
      coords: { lat: geo.lat, lng: geo.lng },
      altitudeM: Number(geo.altitudeM ?? 0),
      ...(config.fusoPorCidade?.[id] !== undefined
        ? { fusoOffsetMinutos: config.fusoPorCidade[id] }
        : {}),
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
      ...(config.fatores[id] ? { fatoresDeslocamento: config.fatores[id] } : {}),
      matrizInterna: (matrizCalculada[id] ?? []) as Json[],
      climaPorMes: climaDaCidade(logistica, id, config),
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
  'trem',
  'barco',
  'carro-fretado',
  'veiculo-alugado',
  'carro-app',
  'transporte-publico',
  'a-pe',
  'bicicleta',
]);

export function construirTrechos(logistica: Json, config: ConfigDeDestino): Json[] {
  const trechos: Json[] = [];
  const ids = new Set<string>();
  const paresDeVoo = new Set<string>();

  for (const t of logistica.trechosEntreCidades ?? []) {
    const de = cidadePorTexto(String(t.de ?? ''), config);
    const para = cidadePorTexto(String(t.para ?? ''), config);
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
    const de = config.iataParaCidade[origem];
    const para = config.iataParaCidade[destino];
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

export function construirCalendario(logistica: Json, config: ConfigDeDestino): Json[] {
  const eventos: Json[] = [];
  const ids = new Set<string>();

  // Duas formas de pesquisa convivem: a da onda A da Colombia, com um campo
  // `data`, e a anual do Mexico, com `dataInicio`/`dataFim` e `recorrencia`.
  const brutos = [
    ...((logistica.calendarioNovembro2026 ?? []) as Json[]),
    ...((logistica.calendarioAnual ?? []) as Json[]),
  ];

  // Entrada com datas por ano vira um evento por ano publicado.
  const expandidos: Json[] = [];
  for (const e of brutos) {
    const anos = Object.keys(e)
      .map((k) => /^dataInicio(\d{4})$/.exec(k)?.[1])
      .filter((a): a is string => Boolean(a));
    if (anos.length === 0) {
      expandidos.push(e);
      continue;
    }
    for (const ano of anos) {
      expandidos.push({
        ...e,
        dataInicio: e[`dataInicio${ano}`],
        dataFim: e[`dataFim${ano}`],
        nome: `${e.nome} (${ano})`,
      });
    }
    derivado('evento anual desdobrado em um registro por ano publicado');
  }

  for (const e of expandidos) {
    const data = String(e.data ?? e.dataInicio ?? '');
    if (!RE_DATA.test(data)) {
      avisos.push(`evento sem data exata ficou fora do banco: "${e.nome}" (${data || 'vazio'})`);
      continue;
    }
    const dataFim = RE_DATA.test(String(e.dataFim ?? '')) ? String(e.dataFim) : undefined;
    const tipo = ['feriado-nacional', 'feriado-local', 'festa', 'evento', 'temporada'].includes(
      String(e.tipo),
    )
      ? String(e.tipo)
      : 'evento';

    const local = String(e.local ?? '');
    const nacional = /col[oô]mbia inteira|m[eé]xico inteiro|^nacional$|nacional/i.test(local);
    const escopos = nacional ? ['nacional'] : cidadesPorTexto(local, config);

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
        ...(dataFim && dataFim > data ? { dataFim } : {}),
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
        descricao: [e.quando, e.recorrencia, e.nome].filter(Boolean).join(' | ').slice(0, 2000),
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
