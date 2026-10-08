/**
 * Geradores de texto a partir do banco e da viagem. Modulo puro.
 *
 * MELHORIA 13 — mensagem pronta em espanhol para confirmar o que a pesquisa
 * nao conseguiu confirmar. O documento de pendencias lista o que falta; o
 * trabalho chato e escrever a mensagem. Aqui ela sai pronta para colar no
 * WhatsApp.
 *
 * MELHORIA 17 — lista de bagagem derivada do clima dos meses que a viagem
 * cobre e das atividades escolhidas, nao de uma lista generica de internet.
 */
import type { Item } from '../schema/item.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import type { Viagem } from '../schema/viagem.ts';

// --------------------------------------------------------- mensagem pronta

export type AssuntoDaPergunta =
  | 'preco'
  | 'horario'
  | 'reserva'
  | 'documentos'
  | 'existe-ainda'
  | 'acessibilidade';

export interface MensagemDeConfirmacao {
  item: string;
  /** Para onde mandar, quando o banco tem contato. */
  whatsapp?: string;
  telefone?: string;
  site?: string;
  assuntos: AssuntoDaPergunta[];
  /** Texto pronto para colar, em espanhol. */
  texto: string;
  /** O mesmo em portugues, para ele conferir o que esta mandando. */
  traducao: string;
}

const PERGUNTAS: Record<AssuntoDaPergunta, { es: string; pt: string }> = {
  preco: {
    es: 'cual es el precio actual y que incluye',
    pt: 'qual e o preco atual e o que inclui',
  },
  horario: {
    es: 'cual es el horario de atencion y si cierran algun dia de la semana',
    pt: 'qual e o horario e se fecham em algum dia da semana',
  },
  reserva: {
    es: 'si hace falta reservar y con cuanta anticipacion',
    pt: 'se precisa reservar e com quanta antecedencia',
  },
  documentos: {
    es: 'que documentos piden (sirve la licencia de conducir brasilena?) y si hay deposito',
    pt: 'que documentos pedem (a CNH brasileira serve?) e se ha caucao',
  },
  'existe-ainda': {
    es: 'si siguen operando y en la misma direccion',
    pt: 'se ainda estao operando e no mesmo endereco',
  },
  acessibilidade: {
    es: 'si el lugar es accesible y que condicion fisica exige',
    pt: 'se o lugar e acessivel e que condicionamento exige',
  },
};

/**
 * Descobre sozinho o que perguntar, a partir dos buracos do proprio item.
 * E o mesmo criterio que gera os avisos do validador, entao a mensagem
 * cobre exatamente o que o banco admite nao saber.
 */
export function assuntosPendentes(item: Item): AssuntoDaPergunta[] {
  const assuntos: AssuntoDaPergunta[] = [];
  const texto = [...item.alertas, item.descricaoLonga].join(' ').toLowerCase();

  if (!item.preco && !item.gratuito) assuntos.push('preco');
  else if (item.preco && /confirmar|sem data|20\d\d/.test(item.preco.observacao ?? '')) {
    assuntos.push('preco');
  }
  if (!item.horarios || Object.keys(item.horarios).length === 0) assuntos.push('horario');
  if (item.reserva.necessaria && item.reserva.antecedenciaDias === undefined) {
    assuntos.push('reserva');
  }
  if (item.categoria === 'aluguel-veiculo') assuntos.push('documentos');
  if (item.confianca === 'estimado' || /nao confirmad|a confirmar/.test(texto)) {
    assuntos.push('existe-ainda');
  }
  return [...new Set(assuntos)];
}

export function mensagemDeConfirmacao(
  item: Item,
  assuntosForcados?: AssuntoDaPergunta[],
): MensagemDeConfirmacao | undefined {
  const assuntos = assuntosForcados ?? assuntosPendentes(item);
  if (assuntos.length === 0) return undefined;

  const listaEs = assuntos.map((a) => PERGUNTAS[a].es);
  const listaPt = assuntos.map((a) => PERGUNTAS[a].pt);

  // Lista com marcadores em vez de frase corrida: as perguntas ja contem
  // "y" por dentro ("el precio y que incluye"), e emendar tudo numa frase so
  // vira um amontoado que ninguem responde direito.
  const montar = (abertura: string, perguntas: string[], fecho: string): string =>
    [abertura, ...perguntas.map((q) => `- ${q}?`), fecho].join('\n');

  const texto = montar(
    `Buenas! Soy de Brasil y estoy organizando un viaje. Queria confirmar sobre ${item.nome}:`,
    listaEs,
    'Muchas gracias!',
  );

  const traducao = montar(
    `Ola! Sou do Brasil e estou organizando uma viagem. Queria confirmar sobre ${item.nome}:`,
    listaPt,
    'Muito obrigado!',
  );

  return {
    item: item.nome,
    ...(item.contato.whatsapp ? { whatsapp: item.contato.whatsapp } : {}),
    ...(item.contato.telefone ? { telefone: item.contato.telefone } : {}),
    ...(item.contato.site ? { site: item.contato.site } : {}),
    assuntos,
    texto,
    traducao,
  };
}

/** Link que abre a conversa ja com o texto escrito. */
export function linkDeWhatsApp(mensagem: MensagemDeConfirmacao): string | undefined {
  if (!mensagem.whatsapp) return undefined;
  const numero = mensagem.whatsapp.replace(/\D/g, '');
  if (numero.length < 8) return undefined;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem.texto)}`;
}

// ------------------------------------------------------- lista de bagagem

export interface ItemDeBagagem {
  nome: string;
  /** Por que esta na lista: sempre a partir de um dado concreto da viagem. */
  porque: string;
  essencial: boolean;
}

export interface ListaDeBagagem {
  categorias: Record<string, ItemDeBagagem[]>;
  total: number;
}

/**
 * O basico muda quando a viagem e dentro do proprio pais.
 *
 * Pedir passaporte e seguro "para atendimento fora do pais" num roteiro
 * pelo Nordeste e o tipo de erro que faz o usuario parar de confiar no
 * resto da lista. A diferenca sai do dado, nao de pais escrito no codigo:
 * o destino tem `codigoPais` e o viajante tem `nacionalidade`.
 */
function basico(domestica: boolean): ItemDeBagagem[] {
  return [
    domestica
      ? {
          nome: 'Documento de identidade com foto',
          porque: 'embarque em voo domestico e check-in de hospedagem',
          essencial: true,
        }
      : { nome: 'Passaporte e copia digital', porque: 'documento de viagem', essencial: true },
    {
      nome: 'Cartao de credito e algum dinheiro em especie',
      porque: 'nem todo lugar tem maquininha',
      essencial: true,
    },
    domestica
      ? {
          nome: 'Cartao do plano de saude',
          porque: 'atendimento fora da sua cidade',
          essencial: false,
        }
      : {
          nome: 'Seguro-viagem com apolice no celular',
          porque: 'atendimento medico fora do pais',
          essencial: true,
        },
  ];
}

export function listaDeBagagem(viagem: Viagem, pacote: PacoteDestino): ListaDeBagagem {
  const domestica = pacote.destino.codigoPais === viagem.viajantes.nacionalidade;
  const categorias: Record<string, ItemDeBagagem[]> = { Documentos: basico(domestica) };
  const por = (categoria: string, item: ItemDeBagagem): void => {
    categorias[categoria] ??= [];
    if (!categorias[categoria].some((x) => x.nome === item.nome)) categorias[categoria].push(item);
  };

  // ---------------------------------------------------------- documentos
  const requisito =
    pacote.destino.entrada.find((e) => e.nacionalidade === viagem.viajantes.nacionalidade) ??
    pacote.destino.entrada[0];
  if (requisito?.vistoNecessario) {
    por('Documentos', {
      nome: 'Visto aprovado, impresso',
      porque: `${pacote.destino.nome} exige visto`,
      essencial: true,
    });
  }
  if (requisito?.vacinaFebreAmarela) {
    por('Documentos', {
      nome: 'Certificado de vacinacao',
      porque: 'o destino pede comprovante de vacina',
      essencial: true,
    });
  }
  // Tomada so vira item quando o padrao e outro; dentro do pais, nao e.
  if (pacote.destino.tomadas && !domestica) {
    por('Eletronicos', {
      nome: `Adaptador de tomada (${pacote.destino.tomadas})`,
      porque: 'padrao de tomada diferente do brasileiro',
      essencial: true,
    });
  }

  // ------------------------------------------------- clima dos meses reais
  const cidadesVisitadas = new Set(
    viagem.dias.map((d) => d.cidadeBaseId).filter((x): x is string => Boolean(x)),
  );
  const mesesDaViagem = new Set(viagem.dias.map((d) => Number(d.data.slice(5, 7))));

  let chuvaMaxima = 0;
  let friaMinima = Number.POSITIVE_INFINITY;
  let altitudeMaxima = 0;

  for (const cidadeId of cidadesVisitadas) {
    const cidade = pacote.cidades.find((c) => c.id === cidadeId);
    if (!cidade) continue;
    altitudeMaxima = Math.max(altitudeMaxima, cidade.altitudeM);
    for (const clima of cidade.climaPorMes) {
      if (!mesesDaViagem.has(clima.mes)) continue;
      chuvaMaxima = Math.max(chuvaMaxima, clima.diasDeChuva);
      friaMinima = Math.min(friaMinima, clima.tempMinC);
    }
  }

  if (chuvaMaxima >= 8) {
    por('Roupa', {
      nome: 'Capa de chuva leve',
      porque: `ate ${Math.round(chuvaMaxima)} dias de chuva no mes da viagem`,
      essencial: chuvaMaxima >= 15,
    });
    por('Mochila', {
      nome: 'Saco estanque para o celular',
      porque: 'chuva frequente no periodo',
      essencial: false,
    });
  }
  if (Number.isFinite(friaMinima) && friaMinima <= 12) {
    por('Roupa', {
      nome: 'Casaco de verdade',
      porque: `minima de ${Math.round(friaMinima)} graus em alguma base da viagem`,
      essencial: true,
    });
  }
  if (altitudeMaxima >= 2400) {
    por('Saude', {
      nome: 'Protetor labial e hidratante',
      porque: `ate ${altitudeMaxima.toLocaleString('pt-BR')} m de altitude: ar seco`,
      essencial: false,
    });
  }

  // -------------------------------------------- o que as atividades pedem
  const itensPorId = new Map(pacote.itens.map((i) => [i.id, i]));
  const agendados = viagem.dias
    .flatMap((d) => d.blocos)
    .filter((b) => b.tipo === 'atividade')
    .map((b) => itensPorId.get(b.itemId))
    .filter((i): i is Item => Boolean(i));

  const textoDasAtividades = agendados
    .map((i) => `${i.nome} ${i.tags.join(' ')} ${i.categoria}`)
    .join(' ')
    .toLowerCase();

  const regras: Array<[RegExp, string, ItemDeBagagem]> = [
    [/praia|snorkel|mergulho|cenote|barco|ilha/, 'Praia', { nome: 'Protetor solar biodegradavel', porque: 'cenotes e areas protegidas proibem protetor comum', essencial: true }],
    [/praia|snorkel|barco|ilha|cay/, 'Praia', { nome: 'Roupa de banho e toalha de secagem rapida', porque: 'ha praia ou passeio de barco na agenda', essencial: true }],
    [/snorkel|mergulho/, 'Praia', { nome: 'Mascara de snorkel propria', porque: 'a alugada costuma vazar e sai cara no acumulado', essencial: false }],
    [/trilha|caminhada|vale|cocora|cerro|mirante|pirâmide|piramide|ruinas|arqueolog/, 'Trilha', { nome: 'Tenis de caminhada ja amaciado', porque: 'ha trilha ou sitio arqueologico na agenda', essencial: true }],
    [/trilha|selva|manguezal|cenote|amazon|tayrona|minca/, 'Trilha', { nome: 'Repelente com DEET', porque: 'ha area de mata ou mangue na agenda', essencial: true }],
    [/buggy|mulita|scooter|moto|carrinho de golfe/, 'Veiculo', { nome: 'CNH fisica, passaporte e Permissao Internacional', porque: 'ha aluguel de veiculo na agenda e as locadoras divergem sobre a CNH brasileira', essencial: true }],
    [/buggy|mulita|scooter|moto/, 'Veiculo', { nome: 'Oculos de sol e bone', porque: 'veiculo aberto', essencial: false }],
    [/bar|balada|noturn|salsa|rumba|mezcal/, 'Noite', { nome: 'Uma roupa de sair', porque: 'ha vida noturna na agenda', essencial: false }],
    [/museu|igreja|catedral|convento|templo/, 'Roupa', { nome: 'Camiseta que cubra os ombros', porque: 'igrejas e alguns museus exigem', essencial: false }],
  ];

  for (const [padrao, categoria, item] of regras) {
    if (padrao.test(textoDasAtividades)) por(categoria, item);
  }

  const total = Object.values(categorias).reduce((n, lista) => n + lista.length, 0);
  return { categorias, total };
}
