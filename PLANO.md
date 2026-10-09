# PLANO — Rumo

## Estado

**Fases 1 a 6: concluídas.** O app está pronto para publicar.
**Publicado:** https://edufms4321.github.io/rumo/
**Pesquisa:** três destinos no banco — Colômbia (169 itens, 8 bases), México (266, 26) e Nordeste brasileiro (296, 23 bases, sendo 17 com conteúdo). 0 erro de validação.
**Pendente:** a onda de Pernambuco, Fernando de Noronha e Alagoas.
**Portões 1 a 7:** todos verificados por mim rodando os comandos e abrindo a tela. Faltam os do Eduardo.
**Próximo:** ele publicar (`docs/publicar.md`) e usar.

Verificação em números, hoje:

| Portão | Como se prova | Hoje |
|---|---|---|
| tipos, lint | `npm run validate` | passa |
| motor de regras | 146 testes Vitest | passam |
| banco de dados | `npm run validate:data` | 0 erro, 289 avisos (todos de dado faltando, nenhum de dado inventado) |
| fluxos no navegador | 15 testes Playwright | passam |
| acessibilidade | axe-core, 9 telas × 2 temas + diálogo | 0 violação |
| 2º destino sem mexer em código | teste e2e `um segundo destino funciona igual` | passa |

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

## Fase 6 — Publicação → portão 7 — **concluída**

- `.github/workflows/publicar.yml`: GitHub Pages a cada push na `main`, **atrás do portão de validação** — tipos, lint, 146 testes, validador de dados e 15 testes e2e. Um registro sem fonte impede o site de subir.
- `netlify.toml` como alternativa.
- `docs/publicar.md`: o passo a passo, como atualizar um preço, como instalar no celular, e o aviso de backup.
- `docs/manual.md`: o manual de uma página.
- Prova final (portão 7): o teste e2e `um segundo destino funciona igual, sem nada especifico de pais` abre o México e confere que o aviso de visto vem do banco, não do código.

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

---

# As 20 melhorias aprovadas (2026-10-08)

Aprovadas em bloco pelo Eduardo. Encaixadas nas fases em vez de virarem uma fase à parte — a maioria é motor ou dado, e a interface da Fase 4 renderiza tudo.

## Lote A — modelo de estado (antes da interface, porque ela depende disto)
- **7** Botão "eu confirmei isto": camada de verificação do usuário por cima do banco
- **9** Gasto real × planejado: livro de gastos na viagem
- **14** Guardar confirmações de reserva
- **18** Várias viagens guardadas
- **20** Marcar "já fui" / "não quero"

## Lote B — regras novas do motor
- **11** Alerta de documentos por destino (visto, vacina) com prazo
- **12** Contagem regressiva de reserva ("reserve até 14/11")
- **3** Bloco-tampão automático antes de voo e de passeio com hora marcada

## Lote C — geradores puros
- **13** Mensagem pronta em espanhol para cada pendência
- **17** Checklist de bagagem a partir do clima do mês e das atividades
- **16** Contatos de emergência por destino

## Lote D — inteligência de viagem
- **4** Plano B de chuva por dia
- **19** Comparar dois roteiros lado a lado
- **6** Idade do dado visível
- **10** Câmbio automático com trava manual

## Lote E — deslocamento
- **1** Matriz de rotas reais pré-calculada no build

## Lote F — interface (dentro da Fase 4)
- **2** Etiqueta "saia às 08:49" em cada bloco (o motor já calcula)
- **5** Zoom na linha do tempo
- **15** Modo "agora" no celular

## Lote G — ferramenta, depois da v1
- **8** Re-verificação automática dos favoritos antes da viagem

---

## Fase 7 — Organização do acervo (2026-10-09, fechada)

Pedido do Eduardo: "Nordeste tudo junto numa opção só? nem faz sentido" — e o mesmo para as atividades.

| Entregue | Onde |
|---|---|
| Árvore país > macrorregião > estado > cidade-base | `src/componentes/ArvoreDeLugares.tsx`, `pesquisa/_divisoes/divisoes.json` (D31) |
| Região turística como etiqueta, não nível | `zonas.json`, `cidade.zonaId` |
| 11 grupos de item, derivados do nome e das etiquetas | `src/engine/grupos.ts` (D32) |
| Filtro por grupo sempre visível + filtro por estado | `src/telas/Descobrir.tsx` |
| Cobertura declarada ("o que este pacote NÃO cobre") | `destino.cobertura` |
| 4 ondas de pesquisa de noite, comer, festa e cultura | +240 itens; banco em 1.187 |

### Próximo, em ordem de valor

1. **Imagens da República Dominicana e dos itens novos.** O Commons cobre mal o Caribe hispânico e a regra exige a cidade no nome do arquivo (D29). Provável resultado: poucos achados e muitos cartões com placeholder — que é o resultado honesto.
2. **Coordenadas dos itens de noite.** Quatro ondas vieram quase sem coordenada (os agentes não acharam em fonte e não inventaram, corretamente). `npm run coords` resolve parte; o resto é bairro e rua, não ponto.
3. **Preço.** Casa noturna não publica cover: 9 de 47 na Colômbia, 27 de 67 no México, 10 de 62 no Nordeste, 17 de 64 na Dominicana. O campo fica vazio e a pendência registra.
4. **Tabela completa da TPA de Noronha**, dia a dia (hoje só 1 e 7 dias, interpolando nada — D34).
5. **Melhoria 8** (re-verificação automática dos favoritos), adiada desde a v1.

### Buracos de conteúdo que a pesquisa nomeou e não fechou

- **Casa de forró pé de serra fixa no Recife**: fora de junho, nenhuma com programação publicada. O Recife resolve forró em arraial de rua.
- **Datas de 2028** em festa nenhuma dos quatro países. Carnaval dominicano e Festival del Merengue não publicam nem 2027.
- **Loreto (México)** é a base mais pobre do banco: a fonte lista comida em prosa, sem endereço nem preço.
- **Casas que podem ter fechado**, registradas com confiança rebaixada em vez de omitidas: Órbita Bar (Fortaleza, fechou — o endereço hoje é o Kosmica), Taverna Pub (Natal), Sala de Reboco (Recife), Jet Set e Ferro Café (Santo Domingo), Drink Point e Don Queco (Punta Cana), Dominican Republic Jazz Festival.

**Nota sobre o passo de imagens (2026-10-09):** parei a execução no meio. O ensaio na República Dominicana achou **4 imagens em ~150 tentativas** — as quatro de Las Terrenas, todas corretas — e a execução de gravação seguinte travou no limite de requisições do Wikimedia Commons (o recuo progressivo chega a 32 s por tentativa). Nada foi gravado. Vale retomar em outra hora, sem rodar duas passadas seguidas, e com a expectativa certa: o Commons cobre mal o Caribe hispânico, e a regra de exigir a cidade no nome do arquivo (D29) é estrita de propósito. Placeholder honesto continua melhor que foto do lugar errado.

---

## Fase 8 — Onde dormir (2026-10-09, fechada)

Pergunta dele: "já temos as acomodações? gostamos mais de hostel, ou o que for mais barato".
Resposta era não — e as 33 sugestões de bairro que existiam **não apareciam em tela nenhuma**.

| Entregue | Onde |
|---|---|
| Aba **Dormir**: por base, mais barato primeiro, filtro de hostel, grava na noite | `src/telas/Dormir.tsx` |
| Diária opcional; cama de dormitório separada do quarto | `src/schema/hospedagem.ts` (D36) |
| 400 registros nas 63 bases, 231 com nome | 4 ondas de pesquisa |
| Tabela oficial da TPA de Noronha, dia a dia, no orçamento | `src/engine/orcamento.ts` (D34) |
| Primeiros testes de unidade do orçamento | `src/engine/orcamento.test.ts` |
| +80 coordenadas, 3 rejeitadas à mão | `pesquisa/*/ajustes-manuais.json` |

### Próximo, em ordem de valor

1. **Preço por WhatsApp.** 198 dos 400 registros não têm preço, e a maioria tem telefone no app. É o passo que o agente não pode dar sozinho — e o que mais muda a utilidade da lista.
2. **Imagens**, retomar sem rodar duas passadas seguidas no Commons.
3. **Coordenadas que faltam**: 213 no Nordeste, 59 na Colômbia, 57 na Dominicana, 30 no México. Boa parte é bairro ou circuito, que legitimamente não é um ponto.
4. **Melhoria 8** (re-verificação automática dos favoritos), adiada desde a v1.
