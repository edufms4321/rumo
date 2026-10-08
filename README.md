# Rumo

**No ar: https://edufms4321.github.io/rumo/**

Web app para planejar uma viagem de ponta a ponta: descobrir opções, favoritar, montar o roteiro arrastando atividades para os dias — e o app calcula deslocamento, detecta conflitos e controla tempo livre e orçamento em tempo real.

Genérico e multi-destino. Local-first: tudo fica no navegador, sem backend, sem login, sem chave de API paga.

Pacotes de dados hoje: **Colômbia** e **México**. Adicionar um destino é criar uma pasta em `data/` — nenhuma linha de código do app muda. Veja [`docs/como-adicionar-destino.md`](docs/como-adicionar-destino.md).

## O que o diferencia de uma planilha

Cada informação mostra **de onde veio, quando foi coletada e o quanto se pode confiar nela**. Isso não é promessa escrita: `scripts/validate-data.ts` reprova o build quando um registro não tem fonte, e o deploy só acontece se o validador passar. Um preço sem fonte impede o site de subir.

O que o app nunca faz: inventar telefone, preço, horário, endereço ou coordenada para preencher espaço. Sem fonte confiável, o campo fica vazio e aparece marcado assim.

## Rodar

```bash
npm install
npm run dev            # http://localhost:5173
```

## Comandos

```bash
npm test               # Vitest: motor de regras
npm run validate:data  # valida /data/** contra os schemas Zod
npm run typecheck      # tsc
npm run lint           # oxlint
npm run validate       # tudo acima
npm run build          # build de producao
```

## Como funciona

- `src/schema/` — schemas Zod. Todo registro do banco exige `fontes`, `coletadoEm` e `confianca`, então **dado sem procedência reprova o build**.
- `src/engine/` — motor de regras, módulo puro, sem React. Detecta conflito, calcula deslocamento, soma orçamento.
- `src/data/` — carrega `/data/<destino>/` com `import.meta.glob`.
- `data/<destino>/` — o banco, em JSON versionado. Adicionar um destino é criar uma pasta: ver [`docs/como-adicionar-destino.md`](docs/como-adicionar-destino.md).

## Honestidade dos dados

A interface sempre mostra a data da coleta e o selo de confiança (verificado / parcialmente verificado / estimado), e cada item traz suas fontes clicáveis. Preço é sempre faixa + moeda + data, nunca número solto — a viagem é em novembro de 2026 e preço coletado hoje é fotografia do dia.

O que não foi possível confirmar em fonte confiável fica em [`docs/pendencias-de-verificacao.md`](docs/pendencias-de-verificacao.md) para confirmação por telefone ou WhatsApp.

## Documentos

- [`CLAUDE.md`](CLAUDE.md) — contexto e convenções do projeto
- [`CEREBRO.md`](CEREBRO.md) — o que existe hoje
- [`PLANO.md`](PLANO.md) — fases e estado
- [`DIARIO.md`](DIARIO.md) — histórico com o porquê de cada decisão
- [`docs/DECISOES.md`](docs/DECISOES.md) — decisão, motivo, alternativa descartada
