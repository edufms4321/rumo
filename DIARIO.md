# DIÁRIO — Rumo

> Só acrescenta. Nunca reescreve. Data e hora reais, fuso America/Sao_Paulo. Sempre com o porquê.

---

## 2026-10-08 12:36 — Fase 0 e início da Fase 1

**Fase 0 (plano) aprovada.** Antes de escrever código, perguntei os campos em branco do briefing e o Eduardo respondeu: 10–12 dias, 2 adultos, até R$ 8.000/pessoa incluindo voo internacional, econômico + intenso, interesses em praia/natureza e vida noturna/compras, sem restrições, pesquisa em paralelo com a construção, pesquisa funda nas bases viáveis.

Disse a ele duas coisas que ele não pediu para ouvir, porque mudam o plano:
- com esse orçamento, o voo do Brasil come metade, e San Andrés é a parte mais cara do país — vai apertar em outro lugar;
- 10–12 dias dão para 3 bases; provavelmente vou recomendar cortar Bogotá ou Santa Marta, mas só com os dados da Fase 2 na mão.

**Por que a pesquisa roda em paralelo:** ela é lenta e não bloqueia o código. Deixar o Eduardo esperando dias sem ver tela seria pior.

**Esqueleto criado.** React 19.3 + TypeScript 7.0 + Vite 8.3 + Tailwind 4.3 + Zod 4.6 + Vitest + oxlint + tsx. Escolhi as mesmas bases do `03. ENEM-MAT` dele para não ter duas convenções diferentes na mesma máquina. `pnpm` não está instalado, então `npm`.

**Schema escrito** em `src/schema/`. As decisões que valem registrar:

1. **`BaseRecord` com `fontes.min(1)`.** Qualquer registro sem fonte reprova o build. A regra "não invente dado" deixa de ser promessa e passa a ser mecânica. *Alternativa descartada:* confiar na disciplina do agente de pesquisa — frágil por construção.
2. **Deslocamento intra-cidade é derivado, não salvo.** Guarda-se só a escolha de modal por lacuna. *Por quê:* elimina a classe de bug "mudei a atividade e o trajeto antigo ficou lá". *Alternativa descartada:* bloco de deslocamento persistido, que exigiria invalidação manual em toda edição.
3. **Tempo em minutos inteiros desde a meia-noite local.** Sem fuso na agenda: Colômbia é UTC−5 sem horário de verão e o Brasil não tem mais. Só o voo internacional guarda partida e chegada cada uma no horário local do seu aeroporto. *Alternativa descartada:* tudo em UTC, que transforma cada render em conversão e cada bug em pesadelo.
4. **Estimativa de deslocamento em 3 camadas**, com a camada 3 (haversine × fator do modal, por cidade) sempre rotulada "estimativa" na interface. *Por quê:* nenhuma chave de API paga pode ser obrigatória, e mentir sobre precisão é pior que admitir estimativa.
5. **Novo destino = nova pasta.** `src/data/carregar.ts` usa `import.meta.glob`, então o critério de aceite 7 da v1 já está satisfeito na Fase 1, não na Fase 6.
6. **Preço é objeto** com faixa, moeda, data e fontes. Número solto seria mentira a 13 meses da viagem.

**Validador escrito** (`scripts/validate-data.ts`), duas camadas: forma (Zod) e coerência entre registros (id duplicado, referência quebrada, coordenada fora do país). Erro reprova; aviso alimenta o documento de pendências.

**Tropeços reais:**
- TypeScript 7 removeu `baseUrl` do tsconfig. Removi e mantive `paths` relativo ao arquivo.
- Zod 4 tipa `.default()` pela saída, não pela entrada: `Restricoes.default({})` não compila porque `outras` é obrigatório na saída. Virou `.default({ outras: [] })`.
- Heredoc do bash engasgou num arquivo grande com muitas aspas; passei a escrever os arquivos longos com a ferramenta de escrita direta.

**Estado:** typecheck e lint passam. `/data` vazio, então `validate:data` reprova de propósito. Onda A da pesquisa rodando em 3 subagentes.

**Próximo:** receber a onda A, montar `/data/colombia/` com os 5 itens reais, rodar o validador, commitar e abrir o portão 1.
