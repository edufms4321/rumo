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
**Por quê:** a viagem é em novembro de 2026 e a coleta é de 8 de outubro de 2026 — cerca de quatro semanas antes, não treze meses como eu afirmei por engano no início. Um número solto seria uma afirmação falsa. Com faixa + data + fonte, a interface pode dizer a verdade: "preço de outubro de 2026, confirme".
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

## D13 — Campo ausente significa desconhecido, e o motor assume o padrão

**Decisão:** tempo do aeroporto ao centro, antecedência de embarque, duração porta a porta, noites recomendadas, como circular e fatores de deslocamento são **opcionais** no schema. Quando a pesquisa não acha o número em fonte citável, o campo fica vazio e o motor usa um padrão documentado em `src/engine/`, **rotulado como estimativa na tela**.
**Por quê:** a alternativa era gravar o número heurístico dentro de `/data`, onde ele ficaria indistinguível de dado com fonte. Preferimos a estimativa visivelmente vinda do motor.
**Descartado:** manter os campos obrigatórios e preencher com heurística (polui o banco); manter obrigatórios e descartar os registros incompletos (impediria o usuário de planejar meia Colômbia).

## D14 — Toda base do país entra no banco, mesmo sem pesquisa funda

**Decisão:** Santa Marta, Palomino, Medellín, Bogotá, Villa de Leyva e Salento entram já na onda A, com coordenada, altitude e clima de fonte. O resto chega na onda B.
**Por quê:** correção pedida pelo Eduardo — ele quer poder montar **qualquer** roteiro, e o app avisa em vez de podar. Era o que o briefing dele já dizia ("o app nunca bloqueia, ele avisa"); eu é que estava agindo como agente de viagens que corta opções.
**Descartado:** só as bases pesquisadas a fundo (deixaria metade do país fora do planejamento).
**Consequência:** exigiu a D13.

## D15 — Islas del Rosario e Barú são itens de Cartagena, não bases

**Decisão:** itens de Rosario e Barú recebem `cidadeId: cartagena` e uma etiqueta com o lugar real.
**Por quê:** ninguém monta a viagem dormindo lá; vai-se de Cartagena e volta no mesmo dia. Assim a regra "item agendado em cidade diferente da cidade-base do dia" funciona do jeito certo.
**Descartado:** criar cidades-base para elas (exigiria noites recomendadas e como circular que não fazem sentido para bate-volta).
**Limitação aceita:** quem quiser dormir em Isla Grande usa o campo livre de hospedagem do dia.

## D16 — Conversor repetível em vez de edição manual do banco

**Decisão:** `npm run importar:pesquisa` converte `pesquisa/onda-*.json` em `data/colombia/`. Julgamento humano vive em `pesquisa/ajustes-manuais.json` e é mesclado por cima.
**Por quê:** as ondas B e C vêm no mesmo formato, e o mapeamento precisa ser auditável. O script imprime a contagem de tudo que **deduziu**, separado do que veio de fonte. Reexecutar não perde trabalho manual.
**Descartado:** escrever o JSON do banco à mão (não escala para 150 itens e esconde o critério de conversão).
**Exceção:** os 5 itens de aluguel de buggy são escritos à mão, porque montar a tabela de veículos por expressão regular seria frágil justamente no dado mais importante da viagem.

## D17 — Registro sem fonte não entra no banco; vai para as pendências

**Decisão:** o conversor filtra registros com zero fontes antes de gravar, com aviso.
**Por quê:** o validador também reprovaria, mas o lugar certo de barrar é na entrada. Caso real da onda A: o agente registrou "não existe voo direto Brasil → San Andrés" como se fosse uma rota, com zero fonte, zero preço e zero duração. É um achado negativo honesto, não um registro de voo.
**Descartado:** gravar com uma fonte emprestada de outro registro (misturaria procedências).

## D18 — Janelas de horário sobrepostas são fontes discordando, não manhã e tarde

**Decisão:** quando duas janelas lidas do mesmo dia se sobrepõem ("08:00–17:15 ou 08:30–17:30"), o conversor mantém a primeira e põe um alerta no item.
**Por quê:** tratadas como dois períodos, o motor concluiria que o lugar abre das 08:00 às 17:30 — horário que nenhuma fonte afirma. Aconteceu em 9 dos 58 itens.
**Descartado:** usar a interseção das janelas (produz um horário que também não vem de fonte nenhuma); manter as duas (amplia o horário sem base).

## D19 — Configuração de pesquisa por destino, separada do app

**Decisão:** o conhecimento específico de cada país (quais lugares são base e quais são bate-volta, como o agente escreveu cada nome, que aeroporto serve que base, fatores de deslocamento) vive em `scripts/destinos/<pais>.ts`. O conversor recebe isso como parâmetro.
**Por quê:** traduzir texto de agente para o schema exige saber, por exemplo, que Chichén Itzá não é base e que quem a visita dorme em Valladolid. Isso não é derivável.
**Isto NÃO contraria o critério de aceite 7.** O **app** lê `/data/<destino>/` por `import.meta.glob` e não conhece nenhum desses arquivos: largar uma pasta pronta em `/data` coloca o destino no app sem código. A configuração é da **ferramenta de pesquisa**. Provado: `data/mexico/` entrou e o app mostrou 143 itens sem uma linha alterada em `src/`.
**Descartado:** adivinhar as bases pelo texto (frágil justamente nos casos que importam).

## D20 — Moeda é código ISO aberto, não lista fechada

**Decisão:** `Moeda` passou de `enum(['COP','BRL','USD','EUR'])` para qualquer código ISO de 3 letras.
**Por quê:** o México quebrou o enum logo no primeiro import. Num app multi-destino, fechar a lista de moedas é garantir retrabalho a cada país.
**Descartado:** adicionar MXN ao enum (adiaria o problema por um destino).

## D21 — Fuso por cidade, não só por país

**Decisão:** `CidadeBase.fusoOffsetMinutos` é opcional e sobrescreve o do destino.
**Por quê:** o México tem três fusos — Quintana Roo em UTC−5, o centro em UTC−6, a Baja California Sur em UTC−7. Sem isso, o cálculo de pôr do sol e o horário de chegada de voo sairiam errados em um terço do país. A Colômbia não expôs esse problema porque tem fuso único.
**Descartado:** um offset por destino (errado para qualquer país largo).

## D22 — Item pode não ser agendável

**Decisão:** `Item.agendavel`. Quando falso, a duração é opcional e as exigências de bloco por categoria não se aplicam.
**Por quê:** "TransMilenio: como funciona" e "vale alugar carro no Eje Cafetero?" são cartões de referência. Eles ajudam a decidir e pertencem ao banco, mas não se arrastam para um dia.
**Regra que resolve o caso difícil:** locadora sem tabela de veículos não é locadora, é conselho sobre aluguel — o conversor rebaixa a cartão de referência e avisa.
