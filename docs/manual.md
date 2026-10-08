# Rumo — manual de uma página

## O que ele faz

Você descobre o que tem no destino, favorita o que interessa, arrasta para os dias — e o app calcula sozinho o deslocamento entre um lugar e outro, avisa quando não dá tempo, soma o custo e conta o tempo livre.

**O que o diferencia de uma planilha:** cada informação mostra de onde veio, quando foi coletada e o quanto se pode confiar nela. Nada é inventado para preencher espaço.

---

## Como começar

1. **Nova viagem** → escolha o destino.
2. **Ajustes** → coloque as datas, quantas pessoas e, se quiser, um teto de gasto.
   Se você ainda não sabe quando ir, pule as datas, favorite algumas coisas e volte: o app sugere as melhores janelas do ano com o porquê em milímetros de chuva.
3. **Descobrir** → busque, filtre por base e categoria, toque no ❤ do que interessa.
4. **Calendário** → diga em que cidade você dorme em cada dia.
5. **Abrir o dia** → arraste do painel lateral para a linha do tempo, ou toque no **+**.

---

## Os três selos que você vai ver o tempo todo

| Selo | Significa |
|---|---|
| **verificado** | site oficial, ou duas fontes independentes que concordam |
| **parcialmente verificado** | uma fonte razoável apenas |
| **estimado** | o pesquisador deduziu; trate como ordem de grandeza |

Junto deles aparece **"coletado há X"**. Preço e horário envelhecem rápido: acima de um ano, o app avisa para você confirmar.

Quando você ligar e confirmar alguma coisa, use **"Eu confirmei isto"** no detalhe do item. A sua confirmação passa a valer por cima do banco, com a sua data.

---

## Como ler o deslocamento

Entre dois blocos o app insere o trajeto sozinho. Toque nele para ver a conta aberta:

- **[do banco]** — tempo medido, com fonte.
- **[estimativa]** — calculado por distância em linha reta × fator de rota da cidade ÷ velocidade do modal. Cada parcela aparece marcada.
- **[sem dados]** — falta coordenada. O app prefere calar a chutar.

**Vermelho com "faltam X min"** quer dizer que o trajeto não cabe no intervalo. Toque para ver as três correções de um clique.

---

## Os níveis de alerta

- **erro** — quebra a viagem de verdade: não dá tempo, o lugar está fechado, voo cedo demais depois de mergulho.
- **atenção** — provavelmente dá errado ou custa caro.
- **dica** — melhora a viagem; ignorar não quebra nada.

**O app nunca te impede de fazer nada.** Ele avisa e, quando dá, oferece o conserto.

---

## Telas

| Tela | Para quê |
|---|---|
| **Agora** | na viagem, no celular: o que é agora, o que vem depois, como chegar, para quem ligar |
| **Descobrir** | o catálogo do destino, com filtro e busca |
| **Seleção** | seus favoritos agrupados por base, com soma de tempo e custo |
| **Calendário** | visão de todos os dias, cidade-base, clima e eventos |
| **Dia** | a linha do tempo, onde se monta o roteiro |
| **Orçamento** | planejado × teto × gasto real, por categoria e por base |
| **Reservas** | o que precisa reservar, com prazo em data, e a mensagem pronta em espanhol |
| **Exportar** | PDF, agenda (.ics), backup, rota no Google Maps e lista de bagagem |

---

## Coisas que valem saber

- **Tudo fica no seu navegador.** Não há conta, não há servidor, ninguém vê seus dados. Em troca: **faça o backup** em Exportar → Backup (.json). Se você limpar os dados do navegador, a viagem vai junto.
- **Ctrl+Z e Ctrl+Shift+Z** desfazem e refazem.
- **Funciona offline** depois da primeira visita. O mapa precisa de internet na primeira vez que você abrir cada região.
- **O PDF sai pela impressão do navegador** (Exportar → Roteiro em PDF → "Salvar como PDF"). Marque "Gráficos de fundo" para manter as cores dos alertas.
- **Preço de voo é fotografia do dia.** O app guarda a faixa, a data e o link de busca — use o link.

---

## Quando o app diz que não sabe

Isso é de propósito. Um item sem preço, sem coordenada ou sem horário aparece marcado assim em vez de receber um número plausível. Em **Reservas**, no fim da página, está a lista do que falta confirmar — cada linha com uma **mensagem pronta em espanhol** para você mandar no WhatsApp.

---

## Para quem for mexer no código

```bash
npm run dev               # desenvolvimento
npm run validate          # tipos + lint + 146 testes + validação dos dados
npm run e2e               # testes de ponta a ponta
npm run build             # produção
npm run importar:pesquisa -- <destino>   # pesquisa crua → banco
npm run matriz -- <destino>              # tempos reais de rota, uma vez
```

Adicionar um destino é criar uma pasta em `data/`. Veja [`como-adicionar-destino.md`](como-adicionar-destino.md).
