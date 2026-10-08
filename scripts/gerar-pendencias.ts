/**
 * Gera `docs/pendencias-de-verificacao.md` a partir do banco.
 *
 * Por que gerar em vez de escrever: a versao escrita a mao dizia "58
 * itens" quando o banco ja tinha 435. Um documento sobre o que falta
 * conferir que esta ele proprio desatualizado nao serve para nada — e
 * pior, da uma falsa sensacao de cobertura.
 *
 * Uso: npm run pendencias
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

type Preco = { min?: number; max?: number; moeda?: string; coletadoEm?: string };
type Item = {
  id: string;
  nome: string;
  cidadeId: string;
  categoria: string;
  confianca: 'verificado' | 'parcial' | 'estimado';
  agendavel?: boolean;
  coletadoEm: string;
  fontes: Array<{ url: string }>;
  coords?: { lat: number; lng: number };
  imagens?: unknown[];
  preco?: Preco;
  horarios?: Record<string, unknown>;
  contato?: { telefone?: string; site?: string; whatsapp?: string };
  reserva?: { necessaria?: boolean; antecedenciaDias?: number };
  observacaoDeConfianca?: string;
  selos?: string[];
};

const HOJE = new Date().toISOString().slice(0, 10);

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function lerDestino(id: string) {
  const raiz = join('data', id);
  const destino = JSON.parse(readFileSync(join(raiz, 'destino.json'), 'utf8')) as {
    nome: string;
  };
  const cidades = JSON.parse(readFileSync(join(raiz, 'cidades.json'), 'utf8')) as Array<{
    id: string;
    nome: string;
  }>;
  const itens: Item[] = [];
  for (const f of readdirSync(join(raiz, 'itens'))) {
    itens.push(...(JSON.parse(readFileSync(join(raiz, 'itens', f), 'utf8')) as Item[]));
  }
  return { id, nome: destino.nome, cidades: new Map(cidades.map((c) => [c.id, c.nome])), itens };
}

function linha(item: Item, cidades: Map<string, string>, oque: string): string {
  return `| ${item.nome} | ${cidades.get(item.cidadeId) ?? item.cidadeId} | ${oque} |`;
}

const LIMITE = 40;

/**
 * O cabecalho diz o TOTAL, nao quantas linhas couberam. Um "(40)" que na
 * verdade sao 111 e exatamente o tipo de numero errado que este documento
 * existe para nao ter.
 */
function tabela(titulo: string, porque: string, todos: string[]): string {
  if (todos.length === 0) return '';
  const linhas = todos.slice(0, LIMITE);
  const resto = todos.length - linhas.length;
  return [
    `### ${titulo} — ${todos.length}`,
    '',
    porque,
    '',
    '| Item | Base | O que falta |',
    '|---|---|---|',
    ...linhas,
    ...(resto > 0
      ? ['', `_...e mais ${resto}. \`npm run validate:data\` imprime a lista inteira._`]
      : []),
    '',
  ].join('\n');
}

function secaoDoDestino(d: ReturnType<typeof lerDestino>): string {
  const agendaveis = d.itens.filter((i) => i.agendavel !== false);
  const conta = {
    verificado: d.itens.filter((i) => i.confianca === 'verificado').length,
    parcial: d.itens.filter((i) => i.confianca === 'parcial').length,
    estimado: d.itens.filter((i) => i.confianca === 'estimado').length,
  };

  // Gratuito nao e "preco desconhecido": o item diz que nao se paga, e
  // isso e uma resposta. Sem este filtro a lista acusava o Museo Botero,
  // que e de graca, de estar com preco faltando.
  const semPreco = agendaveis.filter(
    (i) => !i.selos?.includes('gratuito') && (!i.preco || (!i.preco.min && !i.preco.max)),
  );
  const semHorario = agendaveis.filter(
    (i) => !i.horarios || Object.keys(i.horarios).length === 0,
  );
  const semCoord = agendaveis.filter((i) => !i.coords);
  const semImagem = agendaveis.filter((i) => !i.imagens || i.imagens.length === 0);
  const semContato = agendaveis.filter(
    (i) => !i.contato?.telefone && !i.contato?.whatsapp && !i.contato?.site,
  );
  const reservaSemPrazo = agendaveis.filter(
    (i) => i.reserva?.necessaria && !i.reserva.antecedenciaDias,
  );
  const umaFonte = agendaveis.filter((i) => i.fontes.length === 1 && i.preco?.min);
  const velhos = d.itens.filter((i) => diasEntre(i.coletadoEm, HOJE) > 365);
  const conflitos = agendaveis.filter((i) =>
    /divergen|discordam|conflito entre fontes/i.test(i.observacaoDeConfianca ?? ''),
  );

  return [
    `## ${d.nome}`,
    '',
    '| Medida | Número |',
    '|---|---|',
    `| Itens | ${d.itens.length} (${agendaveis.length} agendáveis) |`,
    `| Bases | ${d.cidades.size} |`,
    `| Confiança: verificado | ${conta.verificado} |`,
    `| Confiança: parcialmente verificado | ${conta.parcial} |`,
    `| Confiança: estimado | ${conta.estimado} |`,
    `| Com coordenada | ${agendaveis.length - semCoord.length} de ${agendaveis.length} |`,
    `| Com imagem de licença livre | ${agendaveis.length - semImagem.length} de ${agendaveis.length} |`,
    `| Com algum contato | ${agendaveis.length - semContato.length} de ${agendaveis.length} |`,
    `| Coletado há mais de um ano | ${velhos.length} |`,
    '',
    tabela(
      'Preço não encontrado',
      'O app mostra estes itens sem preço, e o orçamento não os conta. Ligue ou confirme no site antes de fechar a conta da viagem.',
      semPreco.map((i) => linha(i, d.cidades, 'preço')),
    ),
    tabela(
      'Preço com uma fonte só',
      'A regra do projeto é duas fontes que concordam, ou site oficial. Estes têm uma só: trate como ordem de grandeza.',
      umaFonte.map((i) => linha(i, d.cidades, 'segunda fonte de preço')),
    ),
    tabela(
      'Horário não encontrado',
      'Sem horário o motor não consegue avisar "está fechado neste dia". Dia da semana ausente significa **desconhecido**, nunca "fechado".',
      semHorario.map((i) => linha(i, d.cidades, 'horário de funcionamento')),
    ),
    tabela(
      'Fontes discordam',
      'Duas fontes deram informações diferentes. O banco ficou com a primeira e marcou o item.',
      conflitos.map((i) => linha(i, d.cidades, 'qual das duas está certa')),
    ),
    tabela(
      'Precisa reservar, mas não diz com quanta antecedência',
      'Sem o prazo, o alerta de reserva não consegue virar uma data no calendário.',
      reservaSemPrazo.map((i) => linha(i, d.cidades, 'antecedência da reserva')),
    ),
    tabela(
      'Sem coordenada',
      'Não entra no mapa do dia, e o deslocamento sai como estimativa grosseira. Muitos destes não são um ponto (um bairro, um circuito), e aí ficar sem coordenada é o certo.',
      semCoord.map((i) => linha(i, d.cidades, 'coordenada')),
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

function main() {
  const destinos = readdirSync('data', { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join('data', e.name, 'destino.json')))
    .map((e) => lerDestino(e.name));

  const texto = [
    '# Pendências de verificação',
    '',
    `> Gerado por \`npm run pendencias\` em ${HOJE}. Não edite à mão: rode de novo.`,
    '',
    'Isto é o que **não** foi possível confirmar em fonte confiável.',
    '',
    'Nada daqui foi inventado para tapar buraco. Quando a fonte não existia, o campo ficou vazio e o item entrou no banco com o selo de confiança rebaixado — é por isso que esta lista é longa. Uma lista curta aqui significaria que alguém preencheu com número plausível.',
    '',
    'Confirme por WhatsApp ou telefone antes de contar com qualquer coisa desta lista. Na tela **Reservas**, cada pendência tem uma mensagem pronta em espanhol para copiar. Depois de confirmar, use **"Eu confirmei isto"** no detalhe do item: a sua confirmação passa a valer por cima do banco, com a sua data.',
    '',
    '---',
    '',
    ...destinos.map(secaoDoDestino),
    '---',
    '',
    '## O que mais envelhece',
    '',
    '- **Preço de voo** é fotografia do dia. O banco guarda faixa, data e link de busca — use o link, não o número.',
    '- **Horário** muda com a estação e com feriado local.',
    '- **Preço de entrada** costuma subir uma vez por ano.',
    '- **Situação de estrada, balsa e parque** muda de um dia para o outro. O campo `situacaoAtual` da cidade tem a data da última verificação; acima de alguns meses, confira.',
    '',
  ].join('\n');

  writeFileSync('docs/pendencias-de-verificacao.md', `${texto}\n`);
  console.log(
    `docs/pendencias-de-verificacao.md gerado: ${destinos.length} destino(s), ${destinos.reduce((n, d) => n + d.itens.length, 0)} itens.`,
  );
}

main();
