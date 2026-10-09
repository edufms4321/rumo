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

## D23 — Espelho síncrono em localStorage ao lado do IndexedDB

**Decisão:** toda mudança de estado grava, na hora e de forma síncrona, uma cópia em `localStorage` (`rumo:biblioteca:espelho:v1`), além da gravação debounced no IndexedDB. Na abertura, vence a cópia com `gravadoEm` mais recente.

**Por quê:** o IndexedDB é assíncrono. Quando a aba fecha, a gravação pendente pode não terminar — e `pagehide` não salva, porque o navegador não espera uma promessa. Eu tinha adicionado `pagehide` achando que resolvia; não resolve. O `localStorage` grava na hora e o estado de uma viagem tem poucos kB.

**O que se perde:** duplicação de dado e o teto de ~5 MB do localStorage. Aceitável: se o espelho falhar (cota, aba anônima), o IndexedDB continua sendo o depósito principal e o app segue funcionando.

---

## D24 — O `h1` da página mora no Layout, não em cada tela

**Decisão:** o `Layout` renderiza um `h1` invisível (`sr-only`) derivado da rota; as telas usam `h2` para o título visível.

**Por quê:** várias telas trocam o conteúdo inteiro por um estado vazio ("a viagem ainda não tem datas"). Quando faziam isso, a página ficava sem nenhum cabeçalho e quem usa leitor de tela perdia a referência de onde está. Pôr o `h1` em cada tela significava repetir o cuidado em cada caminho de renderização — e esquecer em um deles.

**O que se perde:** um nível de cabeçalho "desperdiçado" que ninguém vê. Em troca, a garantia é estrutural, não disciplinar.

---

## D25 — O deploy passa pelo mesmo portão que a honestidade dos dados

**Decisão:** `.github/workflows/publicar.yml` só publica depois de `npm run validate` (tipos, lint, 146 testes, validador do banco) **e** `npm run e2e` (18 testes de navegador, incluindo a varredura axe).

**Por quê:** a regra "nunca invente um dado" vale pouco se o site pode ir ao ar com um registro sem fonte. Com o validador no portão de publicação, a regra deixa de ser promessa escrita e passa a ser condição mecânica: um preço sem fonte impede o deploy.

**O que se perde:** ~3 minutos por publicação e a possibilidade de subir uma correção urgente por cima de um teste quebrado. É o preço certo.

---

## D26 — Cidade-base do dia é adivinhada a partir do primeiro item agendado

**Decisão:** ao agendar o primeiro item num dia que ainda não tem cidade-base, o app assume a cidade daquele item.

**Por quê:** sem cidade-base o motor não tem de onde sair e não calcula o trajeto da hospedagem — a informação mais útil da tela do dia ("saia às 08:20") simplesmente não aparecia. Quem agenda a Catedral de Sal provavelmente dorme em Bogotá.

**Por que isto não fere a regra de honestidade:** é um palpite sobre o *plano do usuário*, não sobre o mundo. Fica visível no seletor do calendário e ele troca com um clique. A regra proíbe inventar telefone, preço, horário e endereço — fatos que têm fonte.

## D27 — O enriquecimento automático mora em `ajustes-manuais.json`, não em `/data`

**Decisão:** os scripts que preenchem coordenada e imagem gravam um patch em `pesquisa/<destino>/ajustes-manuais.json`. Nunca escrevem em `/data`.

**Por quê:** `/data` é **gerado** por `npm run importar:pesquisa` a partir de `/pesquisa`. Eu escrevi coordenadas direto em `/data`, rodei o importador de novo por outro motivo, e o trabalho sumiu — só percebi porque olhei o diff. `ajustes-manuais.json` é mesclado por cima do resultado do conversor, então sobrevive a qualquer reimportação.

**O que se perde:** um nível de indireção. Em troca, deixa de existir a classe de bug "o importador apagou meu trabalho".

---

## D28 — Confiança derivada das fontes quando a pesquisa não declara

**Decisão:** se um item de pesquisa não traz `confianca`, o conversor deduz: dois domínios independentes ou um domínio oficial → `verificado`; um domínio → `parcial`; nenhum → `estimado` (e o validador reprova).

**Por quê:** esqueci o campo no briefing de uma onda e os 296 itens do Nordeste entraram como `estimado`. Era falso **para baixo** — havia fonte oficial em boa parte deles — e mentir a favor da cautela continua sendo mentir: o usuário teria descartado item bom achando que era chute. A regra deduzida é a mesma do projeto inteiro, e é mecânica.

**O que se perde:** o julgamento do pesquisador, que é melhor que contar domínios. Por isso o campo declarado, quando existe, continua ganhando.

---

## D29 — Imagem só entra se o nome do arquivo trouxer a cidade

**Decisão:** o script de imagens só aceita um arquivo do Wikimedia Commons cujo nome contenha **todas** as palavras fortes do item **e** pelo menos uma palavra da cidade.

**Por quê:** nome de lugar se repete pelo mundo e o Commons não diz onde fica. Sem a exigência da cidade, a busca me entregou uma panorâmica de uma praia chamada "Coco Loco" para uma discoteca em San Andrés, uma igreja no lugar de um distrito criativo e um "Pozo Azul" que podia ser de qualquer país.

**O que se perde:** fotos corretas cujo arquivo não nomeia a cidade (uma fazenda de café de Salento, por exemplo). É o lado certo de errar: cartão com placeholder é honesto, cartão com a foto do lugar errado não é.

---

## D30 — Uma onda de pesquisa pode cobrir várias bases

**Decisão:** além da forma antiga (`base` + `notasDaBase`), um arquivo de pesquisa pode trazer `notasPorBase` — um mapa — com os itens de várias bases juntos. O conversor reparte usando o mesmo `cidadeDoItem` que já usa para o resto, e **avisa** quando a cidade de um item não está no mapa.

**Por quê:** uma onda por cidade funcionou para a Colômbia. O Nordeste tem 23 bases e exigiria 23 ondas. O aviso existe porque item com cidade desconhecida sumia em silêncio — o jeito mais fácil de perder pesquisa sem perceber.

---

## D31 — Lugar tem quatro níveis; região turística é etiqueta, não nível

**Decisão:** a árvore de lugares é **país > macrorregião > estado > cidade-base**. Os três primeiros níveis vêm de divisão administrativa oficial, pesquisada com fonte (IBGE, DANE, INEGI, IGN dominicano) e guardada em `pesquisa/_divisoes/divisoes.json`. A região turística ("Chapada Diamantina", "Eje Cafetero", "Zona Colonial") vira **etiqueta na cidade**, não degrau da árvore.

**Por quê:** "Nordeste" era *uma* opção de destino com 23 bases soltas dentro, e não havia como perguntar "o que tem na Bahia". Quem planeja pensa por estado.

**Por que a região turística ficou de fora da árvore:** ela não particiona o mapa. Oaxaca tem duas (vale e costa) dentro de um estado; o Eje Cafetero atravessa três departamentos. Encaixá-la entre estado e cidade produzia uma hierarquia falsa — e hierarquia falsa é pior que lista plana, porque parece confiável.

**O que se perde:** a árvore ganha um nível a mais para navegar. Em troca, cada nível é uma coisa que existe no mundo e tem fonte. Quando a macrorregião tem um estado só — as 5 províncias dominicanas caem em 5 das 10 regiões da Ley 345-22 — a interface **pula** o nível, porque um degrau que não agrupa nada é só mais um clique.

**Pacote continua sendo recorte, não país:** `data/nordeste/` cobre o Nordeste, e `destino.cobertura` diz isso em uma frase na tela inicial. Renomear a pasta para `brasil` daria a entender que dá para planejar o Rio aqui, e não dá.

---

## D32 — Grupo de item é derivado, nunca gravado

**Decisão:** além da `categoria` (12 valores, feita para o motor), todo item tem um **grupo** — praia e mar, natureza, aventura, cultura, comer, bares, festas e música, compras, passeios, transporte, referência — calculado em `src/engine/grupos.ts` a partir do **nome e das etiquetas**. Nada disso vai para `/data`.

**Por quê gravar seria pior:** criaria uma segunda verdade que envelhece sozinha. Um item ganha a etiqueta `forro` numa reimportação e o grupo gravado continua dizendo "passeios". Derivado, a regra mora num lugar só e vale para os quatro pacotes de uma vez.

**Por que não lê a descrição:** lendo a descrição, "Centro Histórico de João Pessoa" caiu em Bares (a descrição cita os bares da redondeza) e "Orla da Atalaia" caiu em Festas (cita shows). A descrição fala do **entorno**; o nome e as etiquetas falam da **coisa**.

**Um item pertence a mais de um grupo.** O cartão mostra o principal; o filtro usa todos. "São Cristóvão e a Praça São Francisco" é bate-volta **e** patrimônio da UNESCO, e quem filtra Cultura tem de encontrá-lo.

**As contagens das pílulas respeitam os outros filtros.** Clicar em "Bares 25" com a Bahia selecionada e receber três ensina o usuário a não confiar em nenhum número da tela.

---

## D33 — Duas ondas que cobrem a mesma base se somam

**Decisão:** quando dois arquivos de pesquisa trazem a mesma base, o conversor **mescla**: itens concatenam, listas concatenam, nota em texto vai para `notasExtras` e nunca sobrescreve objeto, e valor simples divergente mantém o primeiro e vira aviso.

**Por quê:** antes era `bases[baseId] = conteudo` — a última onda apagava a anterior. A onda de noite da Colômbia derrubou o pacote de 169 para 47 itens num único import, e trocou o objeto de pesquisa da base (como circular, bairros, segurança, taxas) pela frase de uma linha da onda nova. A linha logo acima do atalho **imprimia** `aviso: repete a base`: um aviso que anunciava a perda e seguia em frente.

**A lição maior:** aviso que não impede o estrago é decoração. Ou o código conserta, ou ele falha — imprimir e continuar é o pior dos três.

---

## D34 — Filtro de taxa olha o nome, nunca a prosa

**Decisão:** o conversor exclui do orçamento as cobranças percentuais e condicionais testando **apenas o `nome` da taxa** (e um campo `unidade` declarado), nunca o texto explicativo.

**Por quê:** o filtro lia `nome` + `quemPaga` juntos e comeu **as duas taxas de Fernando de Noronha**, que são os maiores custos fixos do pacote inteiro. A TPA caiu porque a explicação dela diz "reajuste de 4,4% sobre os R$ 101,33 de 2025"; o ingresso do PARNAMAR caiu porque diz "desconto de 50%". Nenhuma das duas é percentual — as duas têm valor em reais. O teste e2e que afirmava isso estava vermelho e foi empurrado vermelho.

**E a TPA é progressiva, não diária fixa.** A faixa registrada vai de 1 dia (R$ 105,79) a 7 dias (R$ 672,85), ambos números oficiais. A tabela publica também 30 dias = R$ 7.460,56, e usar um mês como teto de uma viagem de cinco dias fazia o orçamento variar sete mil reais por pessoa. A tabela completa dia a dia está nas pendências.

---

## D35 — Um teste varre o código-fonte por escape comido

**Decisão:** `scripts/verificar-codigo-fonte.test.ts` reprova qualquer `.ts` com caractere de controle.

**Por quê:** cinco linhas do repositório tinham o `\b` de fim de palavra trocado por um backspace de verdade (0x08), escritas por ferramenta de substituição que come uma camada de barra invertida. A expressão continua **válida** — ela só não casa com nada —, então `tsc` e `oxlint` passavam limpos. O estrago: o filtro que deveria recusar imagem com cara de mapa nunca recusou nada, e `scuba` e `diving` nunca foram reconhecidos como mergulho.

**O que o teste não pega:** a variante em que a barra some sem deixar controle (`\s+` vira `s+`). Tentei detectá-la e o detector acusou dezenas de comentários e URLs; heurística com mais ruído que sinal não entra na suíte. Contra essa, a defesa é de processo: ao editar expressão regular por script, monte a barra com `String.fromCharCode(92)`.
