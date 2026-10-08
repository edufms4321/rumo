# PLANO — Rumo

## Estado

**Fase atual:** 1 — concluída. **Portão 1 aberto, aguardando o Eduardo.**
**Pesquisa:** onda A entregue e importada (58 itens). Ondas B e C não iniciadas.
**Próximo:** com o aval do portão 1, começa a Fase 3 (motor de regras) e dispara a onda B.

Última atualização: 2026-10-08 (America/Sao_Paulo).

---

## Como o trabalho anda

Cada fase termina com um portão: resumo curto do que foi feito, o comando exato para testar, e o que o Eduardo precisa decidir. Nada avança sem aprovação dele.

A pesquisa roda **em paralelo** com a construção, em três ondas, porque ela é lenta e não bloqueia o código.

---

## Fase 1 — Esqueleto, schema, validador → portão 1

- [x] Pasta, git, npm, Vite, TypeScript, Tailwind
- [x] `src/schema/` completo em Zod (base, destino, geo, item, transporte, calendário, hospedagem, pacote, viagem)
- [x] `scripts/validate-data.ts` com as duas camadas (forma + coerência)
- [x] `src/data/montar-pacote.ts` puro, compartilhado entre navegador e Node
- [x] `src/data/carregar.ts` com `import.meta.glob` (novo destino = nova pasta)
- [x] Tela de prova da Fase 1 com selo de confiança e fontes clicáveis
- [x] `CLAUDE.md`, `CEREBRO.md`, `DIARIO.md`, `PLANO.md`, `docs/DECISOES.md`, `docs/como-adicionar-destino.md`
- [x] `/data/colombia/` com **58 itens reais** (a meta era 5; a onda A entregou muito mais)
- [x] Conversor repetível `npm run importar:pesquisa` + `pesquisa/ajustes-manuais.json`
- [x] `docs/pendencias-de-verificacao.md`
- [x] `npm run validate:data` passando (0 erro, 50 avisos)
- [x] 33 testes, typecheck e lint limpos; app conferido no navegador
- [x] Commits

**Como o Eduardo testa o portão 1:**
```bash
npm run dev            # abre e vê os 5 itens com selo e fonte
npm run validate:data  # tem que passar
npm run typecheck && npm run lint
```
E a prova negativa: apagar à mão a lista `fontes` de um item em `data/colombia/itens/*.json` e rodar `npm run validate:data` — tem que **reprovar**.

---

## Fase 2 — Pesquisa (3 ondas, em paralelo)

### Onda A — entregue em 2026-10-08
- San Andrés: aluguel de buggy/mulita/carrinho (locadoras, preço por período, documentos de brasileiro, regras, roteiro da volta à ilha), passeios de barco, taxa de entrada na ilha, como ir a Providencia, praias, vida noturna, compras, comida econômica
- Cartagena + Islas del Rosario + Barú: centro histórico, praias e ilhas, vida noturna em Getsemaní, compras, golpes comuns, veredito sobre as Festas da Independência (11 de novembro)
- Logística: voos do Brasil e internos, matriz porta a porta entre bases, aeroportos, requisitos de entrada, saúde, dinheiro, chip; clima de novembro por região; feriados e eventos de novembro/2026

### Onda B — durante a Fase 3
Medellín + Guatapé + Jardín · Eje Cafetero (Salento, Cocora, Filandia, fazendas de café) · Santa Marta + Tayrona + Minca + Palomino · Bogotá e arredores (Zipaquirá, Guatavita, Villa de Leyva)

### Onda C — durante a Fase 4
Avaliação honesta de "vale ou não para novembro/2026": Cali, Tatacoa, Leticia, La Guajira, Caño Cristales, Providencia. Curta, com veredito e fonte.

### Entregáveis da Fase 2
- Banco JSON preenchido (meta ~150 itens, 15–25 por base principal)
- `docs/guia-colombia.md`: resumo executivo, 3 roteiros-modelo (10, 12, 14 dias) com noites por cidade, **recomendação de janela de datas com o porquê em número**
- `docs/pendencias-de-verificacao.md`: o que o Eduardo precisa confirmar por telefone/WhatsApp

---

## Fase 3 — Motor de regras com testes → portão 2

Módulo puro em `src/engine/`. Um código de alerta por regra, um teste nomeado por código.

Casos obrigatórios:
- almoço em São Paulo 12h + praia no Rio 14h → `erro:deslocamento-impossivel`, com "faltam X min" e 3 correções
- troca de cidade por voo doméstico → ida ao aeroporto + antecedência + desembarque + traslado somados
- item agendado em cidade diferente da cidade-base do dia
- atividade que depende de luz do dia terminando depois do anoitecer
- passeio com horário fixo de saída travando o início
- dia sem refeição · dia sobrecarregado para ritmo intenso · menos de X horas de sono
- noite sem hospedagem · cidade abaixo do mínimo de noites · ida e volta desnecessária
- altitude de Bogotá no primeiro dia · voo logo após mergulho
- estouro de orçamento com o teto de R$ 8.000/pessoa
- dia de chegada e de partida respeitando horário do voo, check-in e check-out

---

## Fase 4 — Interface → portões 3, 4, 5

- **4a** Configuração da viagem → Descobrir → Detalhe do item → Minha seleção
- **4b** Calendário da viagem → Dia (timeline, arrastar, deslocamento derivado, mini-mapa)
- **4c** Orçamento → Reservas e pendências

Barra fixa com tempo livre, horas ocupadas, gasto × orçamento, nº de conflitos. Arrastar funciona com teclado e toque.

---

## Fase 5 — Sugestões, exportação, offline, polimento → portão 6

Sugestão de janela de datas e roteiro automático; exportar PDF (folha de impressão), `.ics`, JSON; "abrir no Google Maps" por dia; PWA; tema claro/escuro; estados vazios e de carregamento; Playwright nos fluxos principais.

---

## Fase 6 — Publicação → portão 7

Hospedagem gratuita + manual de uso de uma página. Prova final: um segundo destino entra só criando pasta em `/data/`.

---

## Cortes aceitos para a v1

| Corte | Volta quando |
|---|---|
| Mapa na tela Descobrir (lista ↔ mapa) | v1.1 |
| "Otimizar ordem do dia" (solver de rota) | v1.1 |
| Maquinário de i18n | quando houver 2º idioma |
| Tiles de mapa offline | provavelmente nunca |
| Hospedagem como entidade com reserva | v1.1 |
| Biblioteca de PDF | nunca (folha de impressão é melhor) |

Nada do motor de regras foi cortado.
