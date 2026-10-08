# CEREBRO — verdade viva do Rumo

> Atualizado em 2026-10-08. Este arquivo descreve o que EXISTE, não o que está planejado. O que está planejado vive em `PLANO.md`.

## O que é

Web app para planejar uma viagem de ponta a ponta: descobrir opções → favoritar → montar o roteiro arrastando atividades para os dias → o app calcula deslocamento, conflito, tempo livre e orçamento em tempo real.

Genérico e multi-destino. Local-first: tudo no navegador, sem backend, sem login.

## Viagem piloto (parâmetros do usuário)

| Campo | Valor |
|---|---|
| Origem | São Paulo (GRU/CGH/VCP) |
| Destino | Colômbia |
| Janela | Novembro/2026, datas flexíveis dentro do mês |
| Duração | 10 a 12 dias porta a porta |
| Viajantes | 2 adultos |
| Orçamento | até R$ 8.000/pessoa, **incluindo** voos internacionais |
| Estilo / ritmo | econômico / intenso |
| Interesses | praia e natureza; vida noturna e compras |
| Obrigatório | San Andrés com aluguel de buggy/mulita/carrinho |
| Restrições | nenhuma |

Tensões conhecidas: San Andrés é a região mais cara do país e o voo do Brasil consome metade do orçamento; 10–12 dias dão para 3 bases no máximo.

## Stack instalada

Versões reais em `package.json` (confira antes de afirmar):

- React 19.3 + TypeScript 7.0 + Vite 8.3
- Zod 4.6 (schemas de dados)
- Tailwind CSS 4.3 (via `@tailwindcss/vite`)
- Vitest 5.0 (testes), oxlint 1.87 (lint), tsx (roda scripts .ts no Node)
- Node 24.19, npm 11.17. **pnpm não está instalado.**

Ainda **não** instalado (entra quando a fase chegar): `@dnd-kit`, `zustand`, `zundo`, `idb-keyval`, `react-router`, `maplibre-gl`, `vite-plugin-pwa`, `@playwright/test`, shadcn/ui.

## Estrutura que existe hoje

```
src/schema/      base, destino, geo, item, transporte, calendario, hospedagem, pacote, viagem, index
src/data/        montar-pacote (puro, compartilhado), carregar (navegador, import.meta.glob)
src/engine/      (vazio — Fase 3)
src/App.tsx      tela de prova da Fase 1: lista o banco com selo de confiança e fontes
scripts/         validate-data.ts, importar-pesquisa.ts
scripts/lib/     pesquisa-utils, pesquisa-itens, pesquisa-colecoes (conversor)
data/colombia/   o banco (ver números abaixo)
pesquisa/        saída crua dos subagentes + coords-cidades.json + ajustes-manuais.json
```

## O banco hoje (onda A da pesquisa, coletada em 2026-10-08)

58 itens · 8 cidades · 11 aeroportos · 20 trechos entre cidades · 4 voos internacionais · 13 eventos · 5 sugestões de hospedagem. `npm run validate:data` passa com 0 erro e 50 avisos.

Confiança dos itens: 4 verificado, 46 parcial, 8 estimado. 28 de 58 têm imagem licenciada; 41 de 58 têm coordenada.

**Pesquisadas a fundo:** Cartagena (30 itens, inclui Islas del Rosario e Barú) e San Andrés (28 itens, inclui as 5 locadoras de buggy/mulita).
**Presentes só como base planejável** (coordenada, altitude e clima de fonte; o resto chega na onda B): Santa Marta, Palomino, Medellín, Bogotá, Villa de Leyva, Salento.

### Conversor pesquisa → banco

`npm run importar:pesquisa` transforma `pesquisa/onda-*.json` em `data/colombia/`. É repetível: as ondas B e C usam o mesmo caminho. Ele separa o que veio de fonte do que ele mesmo deduziu, e imprime a contagem de cada dedução no fim. Julgamento humano vive em `pesquisa/ajustes-manuais.json` e é mesclado por cima, então reexecutar não perde trabalho manual.

O conversor **não preenche buraco**: preço zerado vira ausência de preço mais um alerta no item; coordenada 0,0 vira ausência de coordenada; registro sem nenhuma fonte não entra no banco e vai para as pendências.

## Decisões de arquitetura em vigor

1. **`src/engine/` é puro.** Sem React, sem IndexedDB, sem fetch.
2. **Deslocamento intra-cidade é derivado, não salvo.** Guarda-se só a escolha do usuário por lacuna.
3. **Troca de cidade é bloco salvo** (`BlocoTrecho`): tem voo, horário, preço.
4. **Tempo em minutos inteiros desde a meia-noite local.** Sem fuso na agenda.
5. **Deslocamento em 3 camadas**: matriz entre cidades (autorada) → matriz interna da cidade (autorada) → haversine × fator do modal por cidade. A camada 3 é sempre rotulada "estimativa".
6. **`BaseRecord` força procedência**: `fontes` tem `.min(1)`, logo registro sem fonte reprova o build.
7. **Novo destino = nova pasta em `/data/`.** `src/data/carregar.ts` usa `import.meta.glob`, então nenhuma mudança de código é necessária.
8. **Preço é objeto** (faixa + moeda + data + fontes), nunca número.
9. **Campo ausente significa desconhecido, e o motor assume o padrão.** Tempo de aeroporto ao centro, antecedência de embarque, duração porta a porta, noites recomendadas, como circular e fatores de deslocamento são todos opcionais no schema. Quando a pesquisa não acha o número em fonte, o campo fica vazio e o motor usa um padrão documentado, **rotulado como estimativa na tela**. Preferimos a estimativa visivelmente vinda do motor a um número sem fonte dentro do banco.
10. **Toda base do país entra no banco, mesmo sem pesquisa funda.** O Eduardo precisa poder montar qualquer roteiro; o app avisa, nunca poda a opção. Base com dado parcial continua planejável.
11. **Islas del Rosario e Barú não são bases**: ninguém dorme lá, vai-se de Cartagena e volta. Viram itens de Cartagena com etiqueta do lugar real.
12. **Dia da semana ausente em `horarios` significa desconhecido, não fechado.** O motor cala em vez de alertar errado.
13. **Duas janelas sobrepostas no mesmo dia são duas fontes discordando**, não manhã e tarde. O conversor mantém a primeira e põe um alerta no item.

## Convenção de arquivos de um pacote de destino

```
data/<destino>/destino.json               objeto
data/<destino>/regioes.json               lista
data/<destino>/cidades.json               lista
data/<destino>/aeroportos.json            lista
data/<destino>/trechos.json               lista
data/<destino>/voos-internacionais.json   lista
data/<destino>/calendario.json            lista
data/<destino>/hospedagem.json            lista
data/<destino>/itens/<cidade>.json        lista (vários arquivos, concatenados)
```

Arquivo fora dessa convenção é ignorado com aviso pelo validador.

## O validador

`npm run validate:data` roda duas camadas:

1. **Forma** (Zod): campo obrigatório faltando, tipo errado, faixa de preço invertida, duração incoerente, imagem sem licença.
2. **Coerência entre registros**: id duplicado, IATA duplicado, `item.cidadeId` inexistente, `cidade.regiaoId` inexistente, trecho ligando cidade que não existe, coordenada fora da caixa delimitadora do país, ponta de matriz interna desconhecida, escopo de evento desconhecido.

Erro reprova (exit 1). Aviso não reprova e alimenta `docs/pendencias-de-verificacao.md`: item sem coordenada, sem imagem licenciada, preço sem fonte, "precisa reservar" sem antecedência, cidade sem clima por mês.

## Comandos

```bash
npm run dev               # http://localhost:5173
npm test                  # 33 testes
npm run validate:data     # valida /data/**
npm run importar:pesquisa # pesquisa/onda-*.json -> data/colombia/
npm run validate          # typecheck + lint + test + validate:data
```

## Estado atual

**Fases 1 a 6 fechadas e o app publicado:** https://edufms4321.github.io/rumo/ (repo `edufms4321/rumo`, deploy a cada push atrás do validador).

| | |
|---|---|
| destinos | 3 — Colômbia, México, Nordeste brasileiro |
| itens | 731 em 57 bases |
| testes do motor | 147, verdes |
| testes de navegador | 20 Playwright + 3 de acessibilidade, verdes |
| validação de dados | 0 erro |
| acessibilidade | 0 violação axe em 9 telas × 2 temas |
| pacote inicial | ~171 kB gz; o banco de cada destino vem sob demanda |

O Nordeste está **incompleto de propósito**: faltam Pernambuco, Fernando de Noronha e Alagoas (a onda de pesquisa foi interrompida). As 17 bases que existem funcionam.

## Armadilhas já pagas (não repetir)

- **O atributo de tema é `data-tema`, com valores `claro` e `escuro`** — não `data-theme`/`light`/`dark`. Já varri acessibilidade no tema errado e concluí que estava tudo certo.
- **IndexedDB não termina antes de a aba fechar.** `pagehide` não resolve. Por isso existe o espelho síncrono em `localStorage` (`rumo:biblioteca:espelho:v1`).
- **Revogar a URL de um blob na mesma linha do clique aborta o download.**
- **O `h1` da página mora no `Layout`**, derivado da rota; os títulos das telas são `h2`.
- **Contraste se calcula, não se olha.** As razões estão nos comentários do CSS.
- **Os scripts de enriquecimento escrevem em `ajustes-manuais.json`, nunca em `/data`.** `/data` é regenerado pelo importador; escrever lá perde o trabalho na próxima importação (já perdi duas coordenadas assim).
- **Casar nome de lugar por texto erra feio.** Buscar coordenada por `display_name` me deu um café no lugar da cidade de Filandia e uma pousada no lugar da Playa San Luis; buscar imagem sem exigir a cidade me deu uma praia "Coco Loco" para uma discoteca. Rode sempre sem `--gravar` primeiro.
- **Campo numérico 0 nos arquivos de pesquisa significa "sem fonte"**, não zero de verdade.

## Comandos de verificação (rodar antes de dizer que algo está pronto)

```bash
npm run validate   # tipos + lint + 147 testes + banco
npm run e2e        # 23 testes de navegador, contra o build de produção
```

## Ferramentas de dados

```bash
npm run importar:pesquisa -- <destino>   # pesquisa crua -> banco
npm run coords:cidades -- <destino>      # centro e altitude das bases (OSM + Open-Meteo)
npm run coords -- <destino> [--gravar]   # coordenada de itens (OSM)
npm run imagens -- <destino> [--gravar]  # imagem de licença livre (Wikimedia)
npm run pendencias                       # regera docs/pendencias-de-verificacao.md
```
