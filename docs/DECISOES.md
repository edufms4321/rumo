# DECISÕES

> Uma linha por decisão: o que foi decidido, por quê, e qual alternativa foi descartada. Ordem cronológica.

---

## D1 — React + TypeScript + Vite, com npm

**Decisão:** React 19 + TypeScript + Vite, instalado com `npm`.
**Por quê:** é a mesma base do projeto `03. ENEM-MAT` do Eduardo, então há uma convenção só na máquina. `pnpm` não está instalado.
**Descartado:** Next.js (traria servidor e roteamento de arquivos que um app local-first não usa); Svelte (ótimo, mas ele já tem React em casa).

## D2 — Zod como fonte da verdade do banco

**Decisão:** o schema Zod em `src/schema/` define o banco, e `BaseRecord` exige `fontes` com pelo menos um item.
**Por quê:** transforma "não invente dado" de promessa em falha de build. É a única forma honesta de garantir isso.
**Descartado:** JSON Schema + ajv (sem inferência de tipo para o TypeScript); confiar na disciplina do agente de pesquisa (frágil por construção).

## D3 — Deslocamento dentro da cidade é derivado, não salvo

**Decisão:** o motor calcula o bloco de deslocamento a cada render, a partir dos blocos vizinhos. O que se persiste é só a escolha de modal do usuário por lacuna (`viagem.deslocamentos[idDaLacuna]`).
**Por quê:** elimina de origem a classe de bug "mudei a atividade e o trajeto antigo ficou lá". Em um app cujo valor é recalcular ao arrastar, dado derivado persistido é dívida garantida.
**Descartado:** persistir o bloco de deslocamento e invalidar na edição — exigiria lembrar de invalidar em todo caminho de mutação.

## D4 — Troca de cidade é bloco salvo

**Decisão:** `BlocoTrecho` é persistido, ao contrário do deslocamento intra-cidade.
**Por quê:** tem número de voo, horário comprado, preço pago e status de reserva. Não é derivável.
**Descartado:** tratar tudo como derivado (perderia o dado da compra).

## D5 — Tempo em minutos inteiros desde a meia-noite local

**Decisão:** `startMin` (0–1439) e `durationMin`. Sem aritmética de fuso na agenda. Exceção: voo internacional guarda partida e chegada cada uma no horário local do seu aeroporto, com o offset vindo do dado do aeroporto.
**Por quê:** Colômbia é UTC−5 sem horário de verão e o Brasil não tem mais horário de verão desde 2019. Carregar fuso em toda a agenda seria custo sem benefício.
**Descartado:** armazenar tudo em UTC e converter na exibição — transformaria cada render em conversão e cada bug de agenda em pesadelo de depuração.

## D6 — Estimativa de deslocamento em três camadas

**Decisão:**
1. matriz porta a porta entre cidades, escrita à mão no pacote (`confianca: verificado`);
2. matriz interna da cidade para os pares que importam;
3. haversine × fator de velocidade do modal, calibrado por cidade — **sempre rotulado "estimativa"** na interface.
Um provedor real de rotas (OSRM/ORS) entra depois atrás de uma interface, opcional e com cache.
**Por quê:** nenhuma chave de API paga pode ser obrigatória. E mentir sobre precisão é pior do que admitir estimativa.
**Descartado:** depender do servidor público de demonstração do OSRM (política de uso proibe app de verdade); exigir chave do Google Directions (paga).

## D7 — Novo destino é uma pasta, não código

**Decisão:** `src/data/carregar.ts` usa `import.meta.glob` sobre `/data/*/`. Criar `data/peru/` com os arquivos da convenção coloca o Peru no app.
**Por quê:** é o critério de aceite 7 da v1. Resolvido na Fase 1 em vez de ser adiado para a Fase 6.
**Descartado:** registro manual de destinos num arquivo `destinos.ts` (seria "mexer em código").

## D8 — Preço é objeto, nunca número

**Decisão:** `{ moeda, min, max, por, inclui, coletadoEm, fontes, observacao }`.
**Por quê:** a viagem é em novembro de 2026, a 13 meses da coleta. Um número solto seria uma afirmação falsa. Com faixa + data + fonte, a interface pode dizer a verdade: "preço de outubro de 2026, confirme".
**Descartado:** `precoBRL: number` (simples e errado).

## D9 — Mapa com MapLibre + OpenFreeMap

**Decisão:** MapLibre GL com tiles vetoriais do OpenFreeMap.
**Por quê:** grátis, sem chave, sem cartão, sem limite declarado de uso. A política de uso dos tiles raster do OpenStreetMap proíbe aplicação de verdade.
**Descartado:** Mapbox e Maptiler (exigem chave e têm teto no plano gratuito); tiles raster do OSM (contra a política de uso).
**Status:** decidido, não implementado (entra na Fase 4b).

## D10 — PDF por folha de impressão

**Decisão:** exportar PDF com uma folha de estilo `@media print` e `window.print()`.
**Por quê:** sai melhor, respeita fonte e quebra de página do navegador, e economiza ~200 KB de biblioteca.
**Descartado:** jsPDF / react-pdf (peso e resultado pior para documento de texto).
**Status:** decidido, não implementado (Fase 5).

## D11 — Pesquisa em paralelo, em três ondas

**Decisão:** a pesquisa da Colômbia roda em subagentes durante as fases 1, 3 e 4, em vez de ser uma fase bloqueante.
**Por quê:** ela é lenta e não bloqueia o código. Escolha do Eduardo entre três opções apresentadas.
**Descartado:** pesquisa primeiro (dias sem nada visível); app primeiro e pesquisa depois (schema ajustado tarde, quando o dado real chegasse).

## D12 — Esforço de pesquisa concentrado nas bases viáveis

**Decisão:** 15–25 itens bem verificados em Cartagena, San Andrés, Medellín+Guatapé, Eje Cafetero e Santa Marta/Tayrona; Bogotá em cobertura média; Cali, Tatacoa, Leticia, Guajira, Caño Cristales e Providencia como avaliação honesta de "vale ou não para novembro".
**Por quê:** com 10–12 dias, o viajante usa 3 bases. Pesquisar 150 itens uniformemente gastaria esforço em região que ele não vai visitar — mas zerar as outras deixaria a tela Descobrir pobre e tiraria a graça de comparar alternativas.
**Descartado:** 150 itens espalhados uniformemente (verificação rasa); só as 3 bases do roteiro (~60 itens, app pobre).
