/**
 * Estado da aplicacao.
 *
 * Tres camadas, de proposito separadas:
 *  - `biblioteca`: todas as viagens do usuario (melhoria 18). E o que se
 *    grava no IndexedDB e o que sai no backup.
 *  - `viagemAtiva`: um ponteiro, nao uma copia.
 *  - o pacote de destino vem de /data e NUNCA e gravado: e somente leitura.
 *
 * Desfazer e refazer cobrem so o que muda a viagem. Trocar de tela, abrir
 * filtro ou mudar o tema nao entram no historico - desfazer precisa ser
 * previsivel.
 */
import { get as lerDoBanco, set as gravarNoBanco } from 'idb-keyval';
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { AnotacaoDeDocumento } from '../schema/documento.ts';
import type { PacoteDestino } from '../schema/pacote.ts';
import {
  type Bloco,
  type Dia,
  type Gasto,
  type Reserva,
  VERSAO_SCHEMA_VIAGEM,
  type Viagem,
} from '../schema/viagem.ts';
import { carregarDestino } from '../data/carregar.ts';

const CHAVE_DO_BANCO = 'rumo:biblioteca:v1';
/**
 * Espelho sincrono em localStorage.
 *
 * O IndexedDB e assincrono: quando a aba fecha, a gravacao pendente pode
 * nao terminar — nem `pagehide` garante, porque o navegador nao espera uma
 * promessa. O localStorage grava na hora, de forma sincrona, e o estado de
 * uma viagem tem poucos kB. Entao: espelho sincrono para nao perder a
 * ultima acao, IndexedDB como deposito principal.
 *
 * Na abertura vence o mais recente dos dois.
 */
const CHAVE_DO_ESPELHO = 'rumo:biblioteca:espelho:v1';

function agora(): string {
  return new Date().toISOString();
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function novoId(prefixo: string): string {
  return `${prefixo}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Datas de um intervalo, inclusivo, em AAAA-MM-DD. */
export function diasEntre(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  const limite = Date.parse(`${fim}T00:00:00Z`);
  let atual = Date.parse(`${inicio}T00:00:00Z`);
  while (atual <= limite && datas.length < 400) {
    datas.push(new Date(atual).toISOString().slice(0, 10));
    atual += 86_400_000;
  }
  return datas;
}

export function viagemNova(destinoId: string, nome: string): Viagem {
  return {
    versaoSchema: VERSAO_SCHEMA_VIAGEM,
    id: novoId('viagem'),
    nome,
    destinoId,
    origem: {
      cidade: 'Sao Paulo',
      aeroportos: ['GRU'],
      /*
        O fuso de casa vem do aparelho, nao de um chute: getTimezoneOffset
        devolve o sinal invertido (180 para UTC-3), por isso o menos.
      */
      fusoOffsetMinutos: -new Date().getTimezoneOffset(),
    },
    viajantes: { adultos: 2, criancas: 0, nacionalidade: 'BR' },
    estilo: 'economico',
    ritmo: 'equilibrado',
    interesses: [],
    cambio: { taxas: { COP: 0.00155, MXN: 0.3, USD: 5.4 }, atualizadoEm: hojeIso(), manual: true },
    dias: [],
    favoritos: [],
    reservas: [],
    deslocamentos: {},
    gastos: [],
    confirmacoes: {},
    descartados: {},
    documentos: {},
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
}

interface Estado {
  viagens: Viagem[];
  viagemAtivaId?: string;
  carregado: boolean;
  /** "Hoje", para as regras de prazo. Fixado no carregamento. */
  hoje: string;
  /** Pacotes ja baixados, por id de destino. */
  pacotes: Record<string, PacoteDestino>;
  /** Destinos cujo download esta em curso ou falhou. */
  statusDoPacote: Record<string, 'carregando' | 'erro'>;
}

interface Acoes {
  carregar: () => Promise<void>;
  criarViagem: (destinoId: string, nome: string) => string;
  abrirViagem: (id: string) => void;
  apagarViagem: (id: string) => void;
  alterar: (muda: (v: Viagem) => void) => void;
  importarJson: (texto: string) => { ok: boolean; mensagem: string; viagemId?: string };
  garantirPacote: (destinoId: string) => Promise<void>;
}

export type LojaDaViagem = Estado & Acoes;

export const usarLoja = create<LojaDaViagem>()(
  temporal(
    (set, pegar) => ({
      viagens: [],
      carregado: false,
      hoje: hojeIso(),
      pacotes: {},
      statusDoPacote: {},

      garantirPacote: async (destinoId) => {
        const estado = pegar();
        if (estado.pacotes[destinoId] || estado.statusDoPacote[destinoId] === 'carregando') return;
        set((e) => ({ statusDoPacote: { ...e.statusDoPacote, [destinoId]: 'carregando' } }));
        const carregado = await carregarDestino(destinoId);
        set((e) => {
          const status = { ...e.statusDoPacote };
          if (carregado.pacote) {
            delete status[destinoId];
            return { pacotes: { ...e.pacotes, [destinoId]: carregado.pacote }, statusDoPacote: status };
          }
          status[destinoId] = 'erro';
          return { statusDoPacote: status };
        });
      },

      carregar: async () => {
        type Guardado = { viagens: Viagem[]; viagemAtivaId?: string; gravadoEm?: string };
        let doBanco: Guardado | undefined;
        let doEspelho: Guardado | undefined;

        try {
          doBanco = await lerDoBanco<Guardado>(CHAVE_DO_BANCO);
        } catch {
          /* sem IndexedDB: segue so com o espelho */
        }
        try {
          const cru = localStorage.getItem(CHAVE_DO_ESPELHO);
          if (cru) doEspelho = JSON.parse(cru) as Guardado;
        } catch {
          /* armazenamento bloqueado */
        }

        // Vence o mais recente: o espelho pode ter a ultima acao que o
        // IndexedDB nao chegou a gravar antes de a aba fechar.
        const escolhido =
          doEspelho && (!doBanco || (doEspelho.gravadoEm ?? '') > (doBanco.gravadoEm ?? ''))
            ? doEspelho
            : doBanco;

        set({
          viagens: escolhido?.viagens ?? [],
          ...(escolhido?.viagemAtivaId ? { viagemAtivaId: escolhido.viagemAtivaId } : {}),
          carregado: true,
        });
      },

      criarViagem: (destinoId, nome) => {
        const viagem = viagemNova(destinoId, nome);
        set((e) => ({ viagens: [...e.viagens, viagem], viagemAtivaId: viagem.id }));
        return viagem.id;
      },

      abrirViagem: (id) => set({ viagemAtivaId: id }),

      apagarViagem: (id) =>
        set((e) => ({
          viagens: e.viagens.filter((v) => v.id !== id),
          ...(e.viagemAtivaId === id ? { viagemAtivaId: undefined } : {}),
        })),

      alterar: (muda) => {
        const { viagens, viagemAtivaId } = pegar();
        const indice = viagens.findIndex((v) => v.id === viagemAtivaId);
        if (indice < 0) return;
        const copia = structuredClone(viagens[indice]!);
        muda(copia);
        copia.atualizadoEm = agora();
        const novas = [...viagens];
        novas[indice] = copia;
        set({ viagens: novas });
      },

      importarJson: (texto) => {
        try {
          const cru = JSON.parse(texto) as { viagens?: Viagem[] } | Viagem;
          const lista = Array.isArray((cru as { viagens?: Viagem[] }).viagens)
            ? (cru as { viagens: Viagem[] }).viagens
            : [cru as Viagem];

          const validas = lista.filter((v) => v?.id && v?.destinoId && Array.isArray(v.dias));
          if (validas.length === 0) {
            return { ok: false, mensagem: 'O arquivo nao tem nenhuma viagem reconhecivel.' };
          }

          set((e) => {
            const porId = new Map(e.viagens.map((v) => [v.id, v]));
            for (const v of validas) porId.set(v.id, v);
            return { viagens: [...porId.values()], viagemAtivaId: validas[0]?.id };
          });
          return {
            ok: true,
            mensagem: `${validas.length} viagem(ns) importada(s).`,
            ...(validas[0]?.id ? { viagemId: validas[0].id } : {}),
          };
        } catch {
          return { ok: false, mensagem: 'Nao consegui ler o arquivo: nao e um JSON valido.' };
        }
      },
    }),
    {
      // Desfazer so acompanha as viagens. Trocar de tela ou baixar um pacote
      // nao entra no historico, senao Ctrl+Z vira roleta.
      partialize: (estado) => ({ viagens: estado.viagens }),
      limit: 100,
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    },
  ),
);

// --------------------------------------------------------- gravacao auto

let gravando: ReturnType<typeof setTimeout> | undefined;
let pendente: { viagens: Viagem[]; viagemAtivaId?: string; gravadoEm: string } | undefined;

function gravarAgora(): void {
  if (!pendente) return;
  const carga = pendente;
  pendente = undefined;
  clearTimeout(gravando);
  void gravarNoBanco(CHAVE_DO_BANCO, carga).catch(() => {
    /* sem IndexedDB: segue em memoria */
  });
}

usarLoja.subscribe((estado) => {
  if (!estado.carregado) return;
  const carga = {
    viagens: estado.viagens,
    viagemAtivaId: estado.viagemAtivaId,
    gravadoEm: new Date().toISOString(),
  };
  pendente = carga;

  // Espelho sincrono: acontece agora, antes de qualquer unload.
  try {
    localStorage.setItem(CHAVE_DO_ESPELHO, JSON.stringify(carga));
  } catch {
    /* cota estourada ou armazenamento bloqueado: o IndexedDB ainda cobre */
  }

  clearTimeout(gravando);
  // Agrupa rajadas de edicao: arrastar um bloco dispara varias mudancas.
  gravando = setTimeout(gravarAgora, 400);
});

/*
  Sem isto, fechar a aba ou trocar de app nos 400 ms seguintes a uma
  edicao perderia a mudanca. `pagehide` e `visibilitychange` sao os unicos
  eventos confiaveis no celular — `beforeunload` nao dispara no iOS.
*/
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', gravarAgora);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') gravarAgora();
  });
}

// ------------------------------------------------------------- seletores

export function usarViagem(): Viagem | undefined {
  return usarLoja((e) => e.viagens.find((v) => v.id === e.viagemAtivaId));
}

export function usarPacote(): PacoteDestino | undefined {
  const destinoId = usarLoja((e) => e.viagens.find((v) => v.id === e.viagemAtivaId)?.destinoId);
  return usarLoja((e) => (destinoId ? e.pacotes[destinoId] : undefined));
}

/** 'pronto' quando o pacote da viagem ativa ja esta em memoria. */
export function usarStatusDoPacote(): 'sem-viagem' | 'carregando' | 'erro' | 'pronto' {
  const destinoId = usarLoja((e) => e.viagens.find((v) => v.id === e.viagemAtivaId)?.destinoId);
  const pacote = usarLoja((e) => (destinoId ? e.pacotes[destinoId] : undefined));
  const status = usarLoja((e) => (destinoId ? e.statusDoPacote[destinoId] : undefined));
  if (!destinoId) return 'sem-viagem';
  if (pacote) return 'pronto';
  if (status === 'erro') return 'erro';
  return 'carregando';
}

export function usarHoje(): string {
  return usarLoja((e) => e.hoje);
}

// ----------------------------------------------------- acoes de alto nivel

export const acoes = {
  definirDatas(inicio: string, fim: string): void {
    usarLoja.getState().alterar((v) => {
      const datas = diasEntre(inicio, fim);
      const porData = new Map(v.dias.map((d) => [d.data, d]));
      v.dias = datas.map(
        (data): Dia => porData.get(data) ?? { id: novoId('dia'), data, blocos: [] },
      );
    });
  },

  definirCidadeDoDia(diaId: string, cidadeId: string | undefined): void {
    usarLoja.getState().alterar((v) => {
      const dia = v.dias.find((d) => d.id === diaId);
      if (!dia) return;
      if (cidadeId) dia.cidadeBaseId = cidadeId;
      else delete dia.cidadeBaseId;
    });
  },

  /**
   * Anota o aereo ate o destino. Preco por pessoa, porque e assim que o
   * teto do usuario e expresso e assim que a passagem e vendida.
   */
  definirVoo(voo: Viagem['voo']): void {
    usarLoja.getState().alterar((v) => {
      v.voo = voo;
    });
  },

  definirHospedagem(diaId: string, hospedagem: Dia['hospedagem']): void {
    usarLoja.getState().alterar((v) => {
      const dia = v.dias.find((d) => d.id === diaId);
      if (dia) dia.hospedagem = hospedagem;
    });
  },

  alternarFavorito(itemId: string): void {
    usarLoja.getState().alterar((v) => {
      v.favoritos = v.favoritos.includes(itemId)
        ? v.favoritos.filter((x) => x !== itemId)
        : [...v.favoritos, itemId];
    });
  },

  descartar(itemId: string, motivo: 'ja-fui' | 'nao-quero' | 'fechado-agora'): void {
    usarLoja.getState().alterar((v) => {
      v.descartados[itemId] = motivo;
      v.favoritos = v.favoritos.filter((x) => x !== itemId);
    });
  },

  recuperarDescartado(itemId: string): void {
    usarLoja.getState().alterar((v) => {
      delete v.descartados[itemId];
    });
  },

  /**
   * Adiciona um item ao dia no proximo horario livre.
   *
   * O calculo do horario tem de acontecer AQUI, com o estado do momento do
   * clique: se a tela calcular, quatro cliques seguidos empilham tudo no
   * mesmo minuto, porque o render nao acompanha a rajada.
   */
  /**
   * Agenda um item no primeiro horario livre do dia.
   *
   * `cidadeDoItem` serve para adivinhar a cidade-base quando o dia ainda nao
   * tem uma: quem agenda a Catedral de Sal provavelmente dorme em Bogota. E
   * um palpite sobre o plano do usuario, nao sobre o mundo — fica visivel no
   * seletor do calendario e ele troca com um clique. Sem isso o motor nao
   * tem de onde sair e nao calcula o trajeto da hospedagem.
   */
  adicionarItemAoDia(
    diaId: string,
    itemId: string,
    duracaoMin: number,
    precisaReservar: boolean,
    cidadeDoItem?: string,
  ): void {
    usarLoja.getState().alterar((v) => {
      const dia = v.dias.find((d) => d.id === diaId);
      if (!dia) return;
      if (!dia.cidadeBaseId && cidadeDoItem) dia.cidadeBaseId = cidadeDoItem;
      const fim = dia.blocos.reduce(
        (max, b) => Math.max(max, b.startMin + b.durationMin),
        9 * 60 - 15,
      );
      const inicio = Math.min(1380, Math.round((fim + 15) / 15) * 15);
      dia.blocos.push({
        id: novoId('bloco'),
        tipo: 'atividade',
        itemId,
        startMin: inicio,
        durationMin: duracaoMin,
        statusDeReserva: precisaReservar ? 'precisa-reservar' : 'nao-precisa',
      });
    });
  },

  adicionarBloco(diaId: string, bloco: Bloco, cidadeDoItem?: string): void {
    usarLoja.getState().alterar((v) => {
      const dia = v.dias.find((d) => d.id === diaId);
      if (!dia) return;
      if (!dia.cidadeBaseId && cidadeDoItem) dia.cidadeBaseId = cidadeDoItem;
      dia.blocos.push(bloco);
    });
  },

  moverBloco(blocoId: string, paraDiaId: string, startMin: number): void {
    usarLoja.getState().alterar((v) => {
      let bloco: Bloco | undefined;
      for (const dia of v.dias) {
        const i = dia.blocos.findIndex((b) => b.id === blocoId);
        if (i >= 0) {
          bloco = dia.blocos.splice(i, 1)[0];
          break;
        }
      }
      if (!bloco) return;
      const destino = v.dias.find((d) => d.id === paraDiaId);
      if (!destino) return;
      bloco.startMin = Math.max(0, Math.min(1439, startMin));
      destino.blocos.push(bloco);
    });
  },

  redimensionarBloco(blocoId: string, durationMin: number): void {
    usarLoja.getState().alterar((v) => {
      for (const dia of v.dias) {
        const bloco = dia.blocos.find((b) => b.id === blocoId);
        if (bloco) {
          bloco.durationMin = Math.max(5, Math.min(2880, durationMin));
          return;
        }
      }
    });
  },

  removerBloco(blocoId: string): void {
    usarLoja.getState().alterar((v) => {
      for (const dia of v.dias) dia.blocos = dia.blocos.filter((b) => b.id !== blocoId);
    });
  },

  definirModalDaLacuna(lacunaId: string, modal: string, minutosManuais?: number): void {
    usarLoja.getState().alterar((v) => {
      v.deslocamentos[lacunaId] = {
        modal: modal as never,
        ...(minutosManuais !== undefined ? { minutosManuais } : {}),
      };
    });
  },

  limparModalDaLacuna(lacunaId: string): void {
    usarLoja.getState().alterar((v) => {
      delete v.deslocamentos[lacunaId];
    });
  },

  /** Situacao de um documento de entrada nesta viagem. */
  anotarDocumento(documentoId: string, anotacao: Partial<AnotacaoDeDocumento>): void {
    usarLoja.getState().alterar((v) => {
      const atual = v.documentos[documentoId] ?? { status: 'pendente' as const };
      v.documentos[documentoId] = { ...atual, ...anotacao, anotadoEm: agora() };
    });
  },

  definirStatusDeReserva(blocoId: string, status: Bloco extends never ? never : string): void {
    usarLoja.getState().alterar((v) => {
      for (const dia of v.dias) {
        const bloco = dia.blocos.find((b) => b.id === blocoId);
        if (bloco && (bloco.tipo === 'atividade' || bloco.tipo === 'trecho')) {
          bloco.statusDeReserva = status as never;
          return;
        }
      }
    });
  },

  salvarReserva(reserva: Reserva): void {
    usarLoja.getState().alterar((v) => {
      const i = v.reservas.findIndex((r) => r.id === reserva.id);
      if (i >= 0) v.reservas[i] = reserva;
      else v.reservas.push(reserva);
    });
  },

  registrarGasto(gasto: Gasto): void {
    usarLoja.getState().alterar((v) => {
      v.gastos.push(gasto);
    });
  },

  removerGasto(gastoId: string): void {
    usarLoja.getState().alterar((v) => {
      v.gastos = v.gastos.filter((g) => g.id !== gastoId);
    });
  },

  confirmarDado(
    itemId: string,
    campo: string,
    valorApurado?: string,
    comoConfirmou?: string,
  ): void {
    usarLoja.getState().alterar((v) => {
      v.confirmacoes[itemId] ??= [];
      v.confirmacoes[itemId].push({
        campo,
        confirmadoEm: hojeIso(),
        ...(valorApurado ? { valorApurado } : {}),
        ...(comoConfirmou ? { comoConfirmou } : {}),
      });
    });
  },

  definirCambio(moeda: string, taxa: number): void {
    usarLoja.getState().alterar((v) => {
      v.cambio.taxas[moeda] = taxa;
      v.cambio.manual = true;
      v.cambio.atualizadoEm = hojeIso();
    });
  },

  atualizarViagem(campos: Partial<Viagem>): void {
    usarLoja.getState().alterar((v) => Object.assign(v, campos));
  },
};
