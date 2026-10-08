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
scripts/         validate-data.ts
data/<destino>/  (vazio — enche na Fase 2)
pesquisa/        saída crua dos subagentes de pesquisa (não versionada como banco)
```

## Decisões de arquitetura em vigor

1. **`src/engine/` é puro.** Sem React, sem IndexedDB, sem fetch.
2. **Deslocamento intra-cidade é derivado, não salvo.** Guarda-se só a escolha do usuário por lacuna.
3. **Troca de cidade é bloco salvo** (`BlocoTrecho`): tem voo, horário, preço.
4. **Tempo em minutos inteiros desde a meia-noite local.** Sem fuso na agenda.
5. **Deslocamento em 3 camadas**: matriz entre cidades (autorada) → matriz interna da cidade (autorada) → haversine × fator do modal por cidade. A camada 3 é sempre rotulada "estimativa".
6. **`BaseRecord` força procedência**: `fontes` tem `.min(1)`, logo registro sem fonte reprova o build.
7. **Novo destino = nova pasta em `/data/`.** `src/data/carregar.ts` usa `import.meta.glob`, então nenhuma mudança de código é necessária.
8. **Preço é objeto** (faixa + moeda + data + fontes), nunca número.

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

## Estado atual

Fase 1 em andamento. Typecheck e lint passam. `/data` ainda vazio, então `npm run validate:data` reprova de propósito até a onda A da pesquisa chegar.
