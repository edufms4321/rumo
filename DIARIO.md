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
6. **Preço é objeto** com faixa, moeda, data e fontes. Número solto seria mentira: faixa, moeda e data deixam o usuário conferir.

**Validador escrito** (`scripts/validate-data.ts`), duas camadas: forma (Zod) e coerência entre registros (id duplicado, referência quebrada, coordenada fora do país). Erro reprova; aviso alimenta o documento de pendências.

**Tropeços reais:**
- TypeScript 7 removeu `baseUrl` do tsconfig. Removi e mantive `paths` relativo ao arquivo.
- Zod 4 tipa `.default()` pela saída, não pela entrada: `Restricoes.default({})` não compila porque `outras` é obrigatório na saída. Virou `.default({ outras: [] })`.
- Heredoc do bash engasgou num arquivo grande com muitas aspas; passei a escrever os arquivos longos com a ferramenta de escrita direta.

**Estado:** typecheck e lint passam. `/data` vazio, então `validate:data` reprova de propósito. Onda A da pesquisa rodando em 3 subagentes.

**Próximo:** receber a onda A, montar `/data/colombia/` com os 5 itens reais, rodar o validador, commitar e abrir o portão 1.

---

## 2026-10-08 14:25 — Onda A importada, Fase 1 fechada

**Correção de rumo do Eduardo, e ele estava certo.** Eu tinha montado uma pergunta pedindo que ele escolhesse o que cortar (San Andrés ou Santa Marta) e qual janela de datas pegar. Ele respondeu que quer poder montar **qualquer** roteiro, com todas as opções disponíveis, e que a informação deve vir como sugestão.

Eu estava agindo como agente de viagens que poda opções, quando o produto é uma ferramenta que mantém tudo aberto e avisa. Isso era inclusive o que o briefing original dele já dizia ("o app nunca bloqueia, ele avisa"). Consequências no código, não só no discurso:

- **Toda base do país entra no banco**, não só as duas pesquisadas a fundo. Criei Santa Marta, Palomino, Medellín, Bogotá, Villa de Leyva e Salento com coordenada, altitude e clima de fonte; o resto chega na onda B.
- Para isso, **afrouxei três campos obrigatórios** do schema (`noitesRecomendadas`, `comoCircular`, `fatoresDeslocamento`). Ausente passa a significar "desconhecido, o motor usa padrão rotulado como estimativa". Antes, base sem pesquisa completa simplesmente não podia existir — o schema estava impedindo o usuário de planejar.
- Reverti em público o que eu tinha dito sobre rebaixar Medellín e Eje Cafetero na onda B por causa da chuva. A chuva vira **alerta no app**, não corte na pesquisa.

**Eu também inventei procedência e me peguei.** Num script para buscar coordenadas das cidades, digitei IDs de relação do OpenStreetMap que não estavam na saída que eu havia lido — escrevi de memória. Dos 6, só 1 estava certo. Refiz a busca gravando apenas o que a API devolveu. É exatamente o erro que o projeto inteiro existe para impedir; o fato de ter acontecido num script auxiliar não o torna menor.

**Conversor em vez de edição à mão.** `npm run importar:pesquisa` transforma a saída crua dos agentes no banco. Escolhi script porque as ondas B e C vêm no mesmo formato e porque o mapeamento precisa ser auditável. Ele imprime no fim a contagem de tudo que **deduziu** (224 janelas de horário lidas de prosa, 42 confianças mapeadas, 42 `dependeDeClima`, e assim por diante), separado do que veio de fonte.

Decisões do conversor que valem registrar:
- preço zerado vira **ausência** de preço + alerta no item, nunca zero;
- coordenada 0,0 vira ausência de coordenada;
- registro sem nenhuma fonte **não entra no banco**. Caso real: o agente registrou "não existe voo direto Brasil → San Andrés" como se fosse uma rota, com zero fonte, zero preço e zero duração. É um achado negativo honesto, não um registro de voo: foi para as pendências;
- dia da semana ausente em `horarios` significa **desconhecido**, não fechado;
- os 5 itens de aluguel de buggy foram escritos à mão em `pesquisa/ajustes-manuais.json`. Montar a tabela de veículos por expressão regular seria frágil justamente no dado mais importante da viagem dele.

**Defeito que achei conferindo a saída.** O parser criava duas janelas de horário quando as fontes divergiam ("08:00–17:15 ou 08:30–17:30"), e o schema leria isso como manhã e tarde — o motor concluiria que o lugar abre das 08:00 às 17:30, que nenhuma fonte afirma. Agora janelas sobrepostas são tratadas como fontes discordando: mantém a primeira e põe alerta no item. Aconteceu em 9 itens.

**Conferi eu mesmo os feriados**, que é o dado mais fácil de errar num calendário colombiano. 1º/nov/2026 cai num domingo e 11/nov numa quarta; pela Ley Emiliani os feriados vão para as segundas 2 e 16 de novembro. A aritmética do agente fecha.

**Também melhorei o validador**: o Zod apontava `itens.45.aluguel`, inútil num arquivo de 30 itens. Agora mostra `itens[co-adz-parchill-...].aluguel`.

**Estado:** 58 itens, 8 cidades, 20 trechos, 13 eventos. Validador com 0 erro e 50 avisos. 33 testes, typecheck e lint limpos. Abri o app no navegador e conferi: selo de confiança, preço, data de coleta e fontes clicáveis aparecem em cada card.

**Próximo:** portão 1 com o Eduardo. Depois, Fase 3 (motor) e onda B da pesquisa.

---

## 2026-10-08 15:50 — Fase 3, primeira fatia: deslocamento automático e explicado

Portão 1 aprovado. O Eduardo pediu prioridade no calendário com **tempo de deslocamento automático e bem didático**. Interpretei "novas habilidades" como capacidades do app, não skills do Claude Code, e avisei a ele que faço o outro se eu tiver errado.

Onda B da pesquisa disparada em 4 subagentes: Medellín+Guatapé+Jardín, Eje Cafetero, Santa Marta+Tayrona+Minca+Palomino, Bogotá+Zipaquirá+Guatavita+Villa de Leyva. Avisei os quatro que Firecrawl e Perplexity estão sem chave, para não desperdiçarem chamadas.

**"Didático" virou requisito de tipo, não de texto de interface.** O estimador devolve `resumo` (uma frase pronta em português) e `passos` (a conta aberta), e cada passo diz se veio de fonte ou se o motor estimou. Assim a interface não precisa reconstruir a explicação depois — e, mais importante, não existe caminho em que um número apareça sem procedência.

Camadas, da melhor para a pior: trecho porta a porta do banco → trecho calculado (duração do veículo + padrões de aeroporto) → par medido da cidade → linha reta × fator de rota → sem dados. A última devolve `minutos: null` em vez de chutar.

**Separei os padrões do motor em `src/engine/padroes.ts`, fora de `/data`.** Velocidade de modal, antecedência de embarque, tempo até o aeroporto: nada disso tem fonte. Se morasse no banco ficaria indistinguível de dado pesquisado. Morando no motor, tudo que passa por lá sai rotulado como estimativa.

**Dois defeitos achados rodando com dado real, não nos testes.**

1. **Falso conflito em todo dia com hospedagem.** Eu tratava "sair da hospedagem até o primeiro bloco" como lacuna comum, com intervalo disponível zero por construção — então todo dia nascia com um conflito inventado. São perguntas diferentes: entre blocos a pergunta é "cabe?"; na hospedagem é "a que horas sair?" e "a que horas chego de volta?". Virou um campo `tipo` na lacuna, com três valores, e teste nomeado para cada um.
2. Velocidade saía como "4.5 km/h" em vez de "4,5 km/h". Bobo, mas é texto que o usuário lê.

**Um teste meu estava errado, não o código**: esperei caminhada entre o almoço no centro e a Pinacoteca, mas são 1,49 km e o limite de caminhada é 1,2 km. Corrigi o teste.

**`npm run demo:dia`** mostra o motor rodando com os dados reais da Colômbia antes de existir interface. Montei o dia com um erro de propósito (última atividade em San Andrés, base em Cartagena) e ele acusa: "4 h 20 min de avião até San Andrés, porta a porta — NÃO CABE: faltam 3 h 20 min", e depois "você chega de volta às 01:50".

**Estado:** 63 testes, typecheck e lint limpos, validador com 0 erro.

**Próximo:** o resto do motor — as regras da seção 5 do briefing (horário de funcionamento, dia fechado, feriado, luz do dia, altitude, mergulho antes de voar, orçamento, noite sem hospedagem), cada uma com código de alerta e correção sugerida.

---

## 2026-10-08 16:24 — Onda B importada, e dois fatos que mudam a viagem

**Erro meu, corrigido: a viagem é no mês que vem, não daqui a treze meses.** Hoje é 8 de outubro de 2026 e a viagem é em novembro de 2026. Eu disse "13 meses" na Fase 0 e repeti no plano, nos documentos e nos commits. Corrigi em todos os arquivos. Consequência real: os preços coletados valem, e reservar virou urgente — as Festas de Cartagena são daqui a cinco semanas, num feriadão.

**Terremoto de magnitude 7,4 em 10/08/2026.** O agente do Eje Cafetero relatou; eu não repassei sem conferir. É real e pior que o resumo dele: 331 mortos, 4.595 feridos, 257 desaparecidos (UNGRD, 25/08); Cali 165, Pereira 109; aeroportos de Pereira, Cali, Armenia, Manizales e Quibdó suspensos. Gravei como `situacaoAtual` de Salento, Medellín e Bogotá, com as fontes que eu mesmo abri e com `verificadoEm`.

Criei o campo `situacaoAtual` em vez de enfiar isso em `seguranca`: são coisas diferentes. `seguranca` é o estado normal do lugar; `situacaoAtual` é conjuntural e **vence**. Por isso `verificadoEm` é obrigatório e a interface mostra a data junto do aviso — alerta de catástrofe desatualizado assusta à toa.

**Parque Tayrona fechado de 19/10 a 2/11/2026**, reabre dia 3. Confirmei no site da Parques Nacionales. Está no calendário do banco como `temporada` com `valeEstarPresente: evite`. É restrição dura de data para a viagem.

**Buraco real no schema que a onda B expôs:** eu assumi que todo item é uma atividade agendável. Não é. "TransMilenio: como funciona" e "Alugar carro no Eje Cafetero compensa?" são cartões de **referência**: ajudam a decidir, aparecem em Descobrir, mas não se arrastam para um dia e não têm duração. Criei `agendavel`, com `duracao` opcional quando `agendavel: false`, e as exigências de bloco (`aluguel`, `passeio`) passaram a valer só para o que se agenda.

A regra que resolve o caso difícil: **locadora sem tabela de veículos não é locadora, é conselho sobre aluguel.** O conversor rebaixa esses itens a cartão de referência e avisa, em vez de reprovar a importação.

Também afrouxei `passeio.pontoPartida` para opcional: nem toda fonte publica o ponto de encontro, e exigir isso estava descartando itens legítimos (chegada no aeroporto de Pereira, por exemplo).

**O conversor agora lê qualquer `pesquisa/onda-*.json` que declare uma `base`.** A onda C entra sem tocar em código.

**Os agentes me corrigiram:** escrevi no briefing que a Pedra do Peñol tem "698 degraus". Nenhuma fonte diz isso — são 740, algumas dizem 702. Escrevi de memória, como fiz com os IDs do OpenStreetMap. Segunda vez no mesmo projeto; o padrão é escrever número de cabeça dentro de texto auxiliar, onde eu não aplico a mesma disciplina que aplico ao banco.

**Estado:** 169 itens em 8 bases, 14 eventos, 17 sugestões de hospedagem, 20 trechos. Validador com 0 erro e 106 avisos. 63 testes, typecheck e lint limpos.

**Próximo:** as regras restantes do motor.

---

## 2026-10-08 16:40 — Motor de regras completo

**Correção do Eduardo: a data da viagem é livre.** Novembro de 2026 era só exemplo. Retirei o alarme de urgência de reserva que eu tinha dado e mandei um agente fechar o buraco: clima dos 12 meses e calendário anual da Colômbia, porque a onda A só cobriu novembro.

**México pedido com a mesma profundidade.** Oito agentes: logística e calendário anual, Cidade do México, Riviera Maya, Yucatán, Oaxaca, Chiapas, Baja e Pacífico, Bajío.

**19 regras implementadas**, cada uma com código estável e teste nomeado. 98 testes no total.

Decisões que valem registrar:

- **Pôr do sol é calculado, não guardado.** Algoritmo solar do NOAA a partir de coordenada e data. Guardar "anoitece às 17:45" seria verdade para uma data e mentira para as outras — e agora a data é livre. Conferi contra valores reais: Cartagena em 18/11 nasce 05:59 e põe 17:37; Cidade do México em 21/06 nasce 05:59 e põe 19:17. Bate.
- **Câmbio virou genérico** (`taxas` por código de moeda) porque o app é multi-destino: COP na Colômbia, MXN no México.
- **O orçamento não soma o que não sabe converter.** Sem taxa de câmbio para uma moeda, o valor fica fora do total e aparece em `semConversao`. Somar com taxa inventada seria pior do que admitir o buraco. O total é sempre faixa, nunca número único.
- **"Estourou" é quando o melhor caso já passa do teto**, não quando o pior caso passa. Com faixa de preço, alertar no pior caso geraria alarme constante.

**Defeito achado rodando contra dado real, não nos testes:** a regra de luz do dia usava a cidade onde o viajante dorme, não a cidade da atividade. Playa Spratt Bight, em San Andrés, recebia o pôr do sol de Cartagena — 17:37 em vez de 17:58. Vinte minutos de erro num alerta que existe justamente para dizer a hora certa. Corrigido, com teste de regressão.

**Dois testes meus estavam errados** (não o código): mergulho às 09:00 com voo às 08:00 do dia seguinte dá 20 h, que é seguro — eu esperava alerta. Refiz o caso com mergulho às 16:00, que dá 13 h e aí sim alerta.

**`npm run demo:dia` agora mostra os alertas.** Contra o dia de teste em Cartagena, o motor produz 8 alertas: 1 erro de deslocamento, 2 de luz do dia, dia sobrecarregado, item em cidade errada, dois de refeição e um de noites mínimas — todos com correção sugerida.

**Próximo:** generalizar o conversor para o México (hoje ele é fixo em `data/colombia`) e começar a interface.

---

## 2026-10-08 17:07 — México no banco, conversor multi-destino

**O México entrou e o app o mostrou sozinho.** 143 itens em 26 bases, ao lado dos 169 da Colômbia. Nenhuma linha de `src/` mudou — o critério de aceite 7 da v1 está provado na prática, não no papel.

**Visto do México: confirmei em fonte oficial.** O agente relatou e eu fui checar, porque é o tipo de coisa que estraga viagem. Brasileiro precisa de visto desde 18/08/2022, inclusive **para só conectar** em aeroporto mexicano desde 22/10/2023. Desde 05/02/2026 existe visto eletrônico de US$ 10,30, entrada única, só por via aérea. Isento quem tem visto válido de EUA, Canadá, Reino Unido, Japão ou Schengen.

**O México expôs quatro erros do meu modelo**, todos invisíveis enquanto só existia a Colômbia:

1. **Moeda era enum fechado** com 4 valores. Quebrou no primeiro import. Virou código ISO aberto. Num app multi-destino, lista fechada de moeda é retrabalho garantido a cada país.
2. **Fuso era um só por destino.** O México tem três. Sem corrigir, o pôr do sol e a chegada de voo sairiam errados em um terço do país. `CidadeBase.fusoOffsetMinutos` agora sobrescreve o do destino.
3. **Não havia modal de trem.** O Tren Maya existe e aparece nos trechos.
4. **O calendário só lia a forma da onda A da Colômbia.** O agente do México entregou calendário anual com `dataInicio`/`dataFim`/`recorrencia`. As duas formas convivem agora.

**Onde o conhecimento do país mora.** Criei `scripts/destinos/<pais>.ts` com as tabelas que não dá para derivar: quais lugares são base, quais são bate-volta e de que base, como o agente escreveu cada nome, que IATA serve que cidade. É da **ferramenta de pesquisa**, não do app — e isso importa: o app continua lendo `/data` por glob e aceitando pasta pronta sem código.

A regressão da Colômbia passou idêntica (169 itens, mesmos números) depois do refactor, que é como eu sei que a extração não mudou comportamento.

**Estado:** 312 itens em dois países, 0 erro de validação, 98 testes, typecheck e lint limpos. Três agentes do México ainda rodando (Cidade do México, Yucatán, Bajío) e um da Colômbia (clima dos 12 meses).

---

## 2026-10-08 17:35 — as 20 melhorias, parte 2

Executadas as seis de engenharia que faltavam: 1, 4, 6, 10, 16 e 19. Com as dez da leva anterior, faltam só as três de interface (2, 5, 15) e a 8, que é pós-v1.

**Matriz de rotas reais (1).** `npm run matriz -- <destino>` calcula de uma vez, por cidade, o tempo real de carro entre todos os itens com coordenada, e grava no banco. 1.301 pares na Colômbia, 1.353 no México. O trajeto que antes dizia "estimativa: 1,3 km em linha reta × 1,35" agora diz "4 min — trecho medido no banco".

É script separado e opcional de propósito: usa o servidor público de demonstração do OSRM, que existe para teste, não para carga. Uma requisição por cidade, com espera entre elas, e **nada no app depende disso em execução** — sem a matriz o estimador cai na camada 3 e avisa que é estimativa. Limite honesto: o servidor público só roteia carro, então caminhada continua saindo por haversine, que é justamente onde a linha reta erra menos.

**Regressão que eu mesmo introduzi e peguei olhando a saída:** com a matriz ligada, um salto de 264 m passou a sair "3 min de carro de app", porque a matriz (só de carro) vencia o estimador até onde qualquer um vai a pé. Tecnicamente certo e inútil. O modal passou a ser decidido **antes** de consultar a matriz. Três testes de regressão.

**Plano B de chuva (4).** Para um dia, lista o que depende de clima e propõe alternativas cobertas **da mesma cidade** que cabem na mesma duração — trocar uma praia de 5 h por um museu de 45 min deixaria o dia oco. Propõe, nunca aplica.

**Idade do dado (6).** `coletadoEm` já existia em todo registro e não servia de nada enquanto a tela não dissesse "coletado há 4 meses". Três níveis, e a frase muda de tom conforme envelhece. A confirmação do usuário (melhoria 7) vence o banco na exibição sem apagá-lo.

**Câmbio automático (10).** Fora de `src/engine/` de propósito: o motor é puro e não faz rede. Falha é o caso normal — viagem se planeja em avião e em hotel com wi-fi ruim. Se a rede cair, mantém a taxa anterior e diz por quê. Taxa travada a mão nunca é sobrescrita.

**Contatos de emergência (16).** Confirmei direto no Itamaraty o plantão da Embaixada em Bogotá (+57 310 809 6169) e o horário. O 123 da Colômbia e o 911 do México **não** confirmei em página oficial nesta coleta: estão gravados com essa ressalva no próprio campo.

**Comparar roteiros (19).** Resume dois roteiros em números comparáveis e devolve frases dizendo em que cada um ganha. Avisa quando a comparação de custo é fraca por falta de preço no banco.

**Estado:** 146 testes, typecheck e lint limpos, 435 itens em dois países com 0 erro de validação.

**Próximo:** a interface. É onde tudo isto finalmente aparece.

## 2026-10-08 18:52 — Suíte e2e verde, publicação configurada, acessibilidade limpa

Fechei a Fase 6 e, no caminho, a suíte de ponta a ponta achou cinco defeitos reais que os testes de unidade não pegariam.

**O que a suíte achou (e foi consertado):**

1. `vistoNecessario` estava fixo em `false` no conversor de pesquisa. O México **exige visto** de brasileiro e o pacote não dizia isso. Agora `exigeVisto()` lê a resposta da pesquisa e distingue "não sei" de "não precisa"; Colômbia ficou `false`, México `true`.
2. `base: './'` com `BrowserRouter` quebra recarregar qualquer link profundo. Troquei por `HashRouter` — feio na URL, funciona no GitHub Pages, no Netlify e numa pasta local.
3. O debounce de 400 ms podia perder a última ação ao fechar a aba. O `pagehide` que eu tinha adicionado **não resolvia**: IndexedDB é assíncrono e o navegador não espera promessa. Pus um espelho síncrono em `localStorage`; na abertura vence o mais recente (D23).
4. `baixar()` revogava a URL do blob na mesma linha do clique, o que aborta a transferência. O botão de backup não baixava nada. Descoberto porque escrevi um teste que de fato espera o download.
5. O manual prometia um botão de restaurar backup que **não existia na tela** — a função estava no store sem ninguém chamar. Agora existe, e importar pela tela inicial abre a viagem restaurada.

**Acessibilidade.** Botei axe-core na suíte (9 telas × 2 temas + o diálogo do item). Achou 97 botões sem nome (a imagem do cartão, que abre o detalhe), a barra de situação fora de qualquer landmark, telas sem `h1` quando caem no estado vazio, e quatro pares de cor abaixo de 4,5:1. Tudo corrigido; os valores de lightness foram **calculados**, e a razão está no comentário do CSS.

**Erro meu que vale registrar:** varri acessibilidade pelo navegador usando `data-theme="light"` e concluí "nenhuma violação". O atributo do app é `data-tema`, com valores `claro`/`escuro` — eu estava medindo o tema escuro duas vezes. Quem pegou foi o teste e2e, que usa `emulateMedia`. Lição: a ferramenta reproduzível ganha do meu harness improvisado.

**Cerca de erro.** Antes, uma exceção em qualquer tela deixava a página branca, sem mensagem e sem saída — e o usuário não tinha como saber que a viagem continuava salva. Agora diz que o dado sobreviveu, oferece voltar ao início e baixar o backup lido direto do armazenamento (não do estado do React, que pode ser justamente o que quebrou).

**Publicação.** GitHub Pages a cada push na `main`, atrás do `npm run validate` + `npm run e2e`. Um registro sem fonte impede o site de subir (D25). `netlify.toml` como alternativa, `docs/publicar.md` com o passo a passo.

Números de hoje: 146 testes de motor, 18 de navegador, 435 itens em dois países, 0 erro de validação, 0 violação de acessibilidade, 169 kB gz no carregamento inicial.

## 2026-10-08 20:10 — App publicado, Nordeste no banco, e o que o ICMBio desmentiu

**O app está no ar:** https://edufms4321.github.io/rumo/ — repositório `edufms4321/rumo`, deploy a cada push **atrás do validador de dados**. Um registro sem fonte impede o site de subir. Verifiquei no endereço real, não só local: link profundo recarrega, 169 itens carregam, service worker registrado, zero erro de console, zero resposta 4xx.

**Nordeste no banco:** 296 itens em 17 das 23 bases. Faltam Pernambuco, Fernando de Noronha e Alagoas — a onda de pesquisa foi interrompida por limite e foi relançada. Terceiro destino, e o primeiro **doméstico**, o que expôs três lugares onde o app assumia que toda viagem cruza fronteira: pedia passaporte e seguro internacional na mala, listava adaptador de tomada e mostrava campo de câmbio para uma viagem em reais. Agora tudo sai do dado (`codigoPais` × `nacionalidade`), sem Brasil escrito no código, e há teste e2e travando isso.

**O ICMBio desmentiu a pesquisa no ponto que mais importa.** A janela das lagoas dos Lençóis — o fato que decide a viagem ao Maranhão — tinha vindo de blog. A página oficial diz outra coisa e melhor: o parque é aberto o ano inteiro, o ICMBio **não cobra ingresso**, e as lagoas além da Azul "aparecem e desaparecem" conforme chuva, vento e a dinâmica das dunas. **Não existe calendário publicado.** Junho-setembro ficou, mas rotulado como padrão típico de fontes de viagem, com a posição do órgão ao lado e a recomendação de ligar para o parque. Também entrou a exigência de veículo, condutor e guia credenciados, com crachá para pedir.

**Verifiquei dois números eu mesmo, em vez de repassar:** Recife tem 390,5 mm em junho contra 39,0 mm em novembro (INMET 1991-2020, conferido na fonte) — o litoral leste chove no meio do ano e o norte no começo, então **não existe mês bom para o Nordeste inteiro**. E o Carnaval de 2027 cai em 9 de fevereiro, calculado pelo algoritmo da Páscoa, não lembrado.

**Erros meus desta sessão, todos custaram retrabalho:**

1. Varri acessibilidade usando `data-theme="light"` e disse "nenhuma violação". O atributo é `data-tema`, com `claro`/`escuro` — eu medi o tema escuro duas vezes. Quem pegou os quatro pares de contraste do tema claro foi o teste e2e, que usa `emulateMedia`.
2. Os scripts de coordenada e imagem escreviam em `/data`, que o importador regenera. Rodei o importador e perdi duas coordenadas; só vi no diff. Viraram patches em `ajustes-manuais.json` (D27).
3. Esqueci de pedir `confianca` no briefing de uma onda: 296 itens entraram como `estimado`, falso **para baixo**. O conversor agora deduz das fontes (D28).
4. O casador de imagem sem exigir a cidade me deu uma praia "Coco Loco" para uma discoteca e uma igreja para um distrito criativo. Revisei as 8 à mão, descartei 3, apertei a regra (D29).

**O que o ensaio salvou:** rodar os scripts sem `--gravar` primeiro virou regra. Na primeira rodada de coordenadas, **3 dos 5 "achados" estavam errados** — um café no lugar da cidade de Filandia, uma pousada no lugar da Playa San Luis, uma área rural no lugar de Pereira — todos porque o `display_name` do OSM contém o nome do lugar. Passou a casar só pelo nome do objeto.

**TripAdvisor:** o Eduardo perguntou e tem razão no essencial. Não dá para raspar — o `robots.txt` deles tem `Disallow: /` para o ClaudeBot e a página devolve 403, e as notas são conteúdo deles. Resolvido por fora: cada item tem botões que abrem a busca já preenchida no TripAdvisor e no Google Maps. Nada de terceiro guardado, e nunca envelhece.

## 2026-10-09 — Organização: país > estado > cidade, e grupos no lugar de 12 categorias

O Eduardo disse o essencial numa frase: "Nordeste tudo junto numa opção só? nem faz sentido". Tinha razão nas duas pontas — nos lugares e nas atividades.

**Lugares.** Agora a árvore é **país > macrorregião > estado > cidade-base**, com a região turística (Chapada Diamantina, Eje Cafetero, Zona Colonial) como **etiqueta na cidade**, não como degrau. Tentei encaixá-la no meio e não fecha: Oaxaca tem duas dentro de um estado e o Eje Cafetero atravessa três departamentos. Hierarquia falsa é pior que lista plana, porque parece confiável (D31).

Os três níveis administrativos vieram de pesquisa com fonte oficial — IBGE, DANE, INEGI, IGN dominicano. Três coisas que eu supunha e estavam erradas: Jericoacoara **não** é distrito de Jijoca (o município tem um distrito só, homônimo); Morro de São Paulo **não** é distrito de Cairu; e Sayulita é **Nayarit**, não Jalisco — a confusão vem do aeroporto, que é o de Puerto Vallarta. Trancoso, que eu só suspeitava, é distrito oficial de Porto Seguro. E as três macrorregiões dominicanas que eu esperava (Cibao/Sureste/Suroeste) foram **extintas pela Ley 345-22**; valem as 10 Regiones Únicas de Planificación.

**Não renomeei `data/nordeste` para `brasil`.** O pacote cobre o Nordeste, e chamá-lo de Brasil daria a entender que dá para planejar o Rio aqui. Em vez disso, cada pacote declara `cobertura` — uma frase dizendo o que ficou de fora — e a tela inicial mostra.

**Atividades.** As 12 categorias eram feitas para o motor ("restaurante" alimenta a regra de dia sem refeição). Para quem procura, "experiencia" com 130 itens quer dizer tudo e nada. Entraram 11 grupos derivados — praia e mar, natureza, aventura, cultura, comer, bares, festas e música, compras, passeios, transporte, referência —, calculados do nome e das etiquetas, nunca gravados (D32).

A auditoria desses grupos foi o que encontrou o buraco real do banco: **festas e música tinha 3 itens na Colômbia, 8 no México, 4 no Nordeste e 1 na República Dominicana**. Quatro ondas de pesquisa depois, Colômbia foi de 169 para 216 itens, México de 266 para 333 e a Dominicana de 115 para 179.

### O que quebrou, e o que isso ensina

**1. Importei e apaguei 122 itens da Colômbia.** O conversor fazia `bases[baseId] = conteudo`: a onda nova de noite cobria 6 bases que as ondas antigas já cobriam e sobrescreveu as duas coisas — os itens e o objeto de pesquisa da base (como circular, bairros, segurança, taxas). A linha logo acima **imprimia** `aviso: repete a base`. Um aviso que anuncia a perda e segue em frente é decoração. Agora as ondas se somam (D33).

**2. As duas taxas de Fernando de Noronha nunca estiveram no orçamento.** São o maior custo fixo do pacote inteiro — TPA de R$ 105,79 por dia e ingresso do PARNAMAR de R$ 192. O filtro de "percentual não é taxa" que eu mesmo escrevi lia o nome **e a prosa explicativa** juntos: a TPA caiu porque o texto dela diz "reajuste de 4,4%", o PARNAMAR porque diz "desconto de 50%". O teste e2e que afirmava isso estava **vermelho e foi empurrado vermelho** na sessão passada (D34).

**3. Cinco expressões regulares do repositório nunca funcionaram.** O `\b` de fim de palavra tinha virado um caractere de backspace de verdade (0x08), escrito por ferramenta de substituição que come uma camada de barra invertida. A expressão continua válida, `tsc` e `oxlint` passam limpos, e ela não casa com nada. O estrago: o filtro que deveria recusar imagem com cara de mapa **nunca recusou nada**, e `scuba` e `diving` nunca foram reconhecidos como mergulho. Hoje há um teste varrendo o fonte (D35) — e eu repeti o mesmo acidente três vezes enquanto consertava.

**4. O conversor lia só `dicasAgente`, e meu briefing novo pedia `dicas`.** As dicas da onda nova iam para o lixo em silêncio. Lê as duas grafias agora. Foi o agente de pesquisa que percebeu, não eu.

**5. `\bDAN\b` com `/i` casa com "dança"** — cedilha não é caractere de palavra, então a fronteira existe. Um bar de salsa cuja nota falava em dançar na calçada ganhava a regra de não voar depois de mergulhar. Também foi o agente que viu.

**6. Classificador de grupo, três erros medidos.** "Plâncton luminescente na foz do Rio Preguiças" virou **bar**, porque o item fica em BARreirinhas e o padrão não fechava a palavra. "Centro Histórico de João Pessoa" virou **bar**, porque a descrição cita os bares da redondeza — passou a ler só nome e etiquetas. E todo bar com a etiqueta `vida-noturna` virava **festa**, o que deixou Bares com 3 itens em 397: abrir à noite não é ser uma festa.

**Também padronizei a pasta de pesquisa da Colômbia** (`pesquisa/colombia/`, como as outras; morava na raiz por ter sido o primeiro destino) e a interface **pula o nível de região** quando ele não agrupa nada — as 5 províncias dominicanas caem em 5 das 10 regiões, e dois degraus para um caminho só é só mais um clique.

## 2026-10-09 (tarde) — Onde dormir, a tabela da TPA e mais 80 coordenadas

O Eduardo perguntou se já tínhamos as acomodações e disse que prefere hostel, ou o que for mais barato. A resposta era **não**, e pior do que não: havia 33 sugestões de bairro no banco (só Colômbia e México) e **nenhuma aparecia em tela nenhuma**. Ele digitava o nome do hotel à mão num campo de texto livre na tela do dia. Pesquisa que não chega na interface é pesquisa jogada fora.

**Agora há uma aba Dormir** e o banco tem **400 registros de hospedagem, 231 com nome, nas 63 bases dos quatro destinos** — nenhuma base vazia. A tela agrupa por base, põe primeiro as cidades onde ele dorme com a contagem de noites, ordena do mais barato, filtra hostel num clique e escreve a escolha direto naquela noite, com preço, para o orçamento pegar.

**A decisão que destravou a pesquisa foi deixar o preço opcional (D36).** Preço de hostel só existe nos agregadores, e Booking, Hostelworld e Airbnb estão proibidos por termos de uso e robots.txt. O site do próprio hostel quase nunca publica tarifa — joga para o motor de reserva, que é aplicação JavaScript e volta em branco. Com o campo obrigatório, só havia inventar ou descartar. 202 dos 400 têm preço; os outros têm nome, endereço e telefone, e dizem que o preço não foi achado.

### O que a pesquisa descobriu e que muda escolha

- **A República Dominicana quase não tem dormitório compartilhado:** dois em trinta e um, os dois em Santo Domingo. **Punta Cana não tem nenhum** — o Bavaro Hostel, que dezenas de agregadores ainda anunciam a partir de US$ 15, diz no próprio Instagram que fechou em definitivo. Lá o econômico é apartamento ou guesthouse, US$ 35–70 o quarto contra um piso de US$ 125 no all-inclusive.
- **Em dupla, o privativo de hostel muitas vezes empata com duas camas.** O Blacksheep de Medellín publica os dois: 2 × COP 80.000 = exatamente os COP 160.000 do piso do quarto fechado. Por isso `diaria` e `diariaPrivativo` são campos separados — sem os dois, essa conta não existe.
- **San Andrés inverteu a minha suposição.** Briefei o agente dizendo que a posada nativa seria a opção barata. Ela é mais barata que o hotel de orla (150–240 mil contra 450–585 mil), mas **não é mais barata que um hotelzinho dentro do próprio North End**: o Shalain fica a 500 m da praia principal por COP 179.999. O North End só é caro de frente para o mar.
- **Muito guia de viagem aponta para hostel que não existe mais.** Quinze na Colômbia, os clássicos de Salento entre eles; nove no Nordeste, dois deles ainda listados no portal oficial da Prefeitura de Salvador com o domínio suspenso. Duas armadilhas de domínio: `laserrana.co` hoje é outra propriedade em Urrao, e `pocna.com`, o hostel mais conhecido de Isla Mujeres, redireciona para um hotel em Tulum.
- **Noronha não tem hostel nem camping legal**; o piso é R$ 350 numa pousada domiciliar credenciada, e a TPA e o ingresso do parque são à parte.
- **Sosúa** divide os hotéis entre política rígida e "muito liberal" quanto a prostituição; para casal, perguntar a *guest policy* antes de reservar é a informação que importa, e está nos quatro registros de lá.

### A TPA de Noronha virou valor exato

Achei a tabela oficial do Distrito Estadual, dia a dia, 30 linhas. Ela **não é a diária multiplicada**: 5 dias custam R$ 520,50 e não os R$ 528,95 da conta linear que as fontes secundárias publicam; 30 dias custam R$ 7.460,56. O orçamento usa a linha do número real de noites na cidade e, fora do alcance da tabela, volta para a faixa — extrapolar uma curva progressiva de que só se conhece o fim seria inventar.

Escrevi junto os **primeiros testes de unidade do orçamento**. Ele não tinha nenhum, e foi exatamente por isso que as duas taxas obrigatórias de Noronha puderam ficar fora dele sem ninguém notar.

### Mais 80 coordenadas, 3 rejeitadas

O Nordeste tinha 289 itens agendáveis sem ponto no mapa; agora 213. As três rejeitadas são a mesma armadilha de sempre, e vale repetir porque nenhum raio resolve: a distância é medida da cidade-base, então **o lugar errado e perto ganha do certo e longe**. "Ilha de Itaparica" casou com uma *rua* em Salvador; "Praia do Forte" com um *edifício* na Pituba, com a vila a 65 km.

### O que não deu

O passo de imagens travou no limite de requisições do Wikimedia Commons. O ensaio na Dominicana tinha achado **4 em ~150 tentativas** — o Commons cobre mal o Caribe hispânico, e a regra de exigir a cidade no nome do arquivo (D29) é estrita de propósito. Nada gravado; está no PLANO para retomar.

E registro a pergunta que fica com ele: **55 lugares do Nordeste estão sem preço, e 38 têm telefone no app.** A diferença entre lista de nomes e lista usável são umas quinze mensagens de WhatsApp.

---

## 2026-10-09, noite — P1 do briefing de UX fechado

O Eduardo mandou um documento de 16 melhorias tiradas de um planejamento de viagem que ele fez **à mão** para o México, com instrução de implementar por prioridade e mostrar o resultado ao fim de cada uma. Primeiro fiz o que o documento pedia no passo 1: ler o código e dizer o que existe. Metade do P1 e do P2 já estava pronta — preço com moeda e data, câmbio datado, alertas com severidade, sazonalidade, esforço, deslocamento em pernas, fila por prazo, exportar. O que faltava é o resto deste diário.

### Antes disso: onze botões que não faziam nada

Procurando o item 1 (dias e horários de funcionamento) descobri que **onze dos dezoito tipos de correção que o motor emitia não tinham tratador na interface**. O alerta aparecia, o botão aparecia, o clique caía no `default` de um `switch`. Botão morto é pior que botão nenhum: gasta a confiança que os outros avisos construíram. `Correcao.tipo` virou união fechada e os tratadores viraram `Record` exaustivo — o compilador agora recusa o build enquanto faltar um. **Isso já cobrou o preço duas vezes nesta sessão**, nas duas correções novas que escrevi depois.

### Fuso por base (item 2)

A agenda continua hora de parede, como sempre foi. O que faltava era dizer de quem é o relógio: é o da cidade-base do dia (D38). Cancún é UTC−5 e Valladolid UTC−6, a 150 km. Ônibus que sai 11h de Cancún e leva 1h30 chega **11h30** em Valladolid; quem subtrai relógio diz 12h30 e inventa uma hora de folga.

Três lugares leem isso agora: o bloco de trecho mostra as duas pontas cada uma no seu relógio com selo "−1 h", o dia ganha faixa quando o relógio muda, e o cartão do calendário repete o selo para a mudança ser visível na viagem inteira. `offsetChegadaMinutos` era dado morto no schema desde o primeiro commit e agora alimenta a tela, em vez de eu criar um segundo campo com o mesmo nome.

**E consertei um bug da mesma família:** a regra de luz do dia comparava o pôr do sol no relógio da cidade da ATIVIDADE com um bloco posicionado no relógio do DIA. Com base em Cancún e bate-volta em Yucatán, ela errava para menos — deixava marcar um mirante 44 min depois de escurecer e **calava**.

### O trecho era inalcançável (item 2, de novo)

Para testar Cancún → Valladolid no app, descobri que **nenhuma tela criava um bloco de trecho**. O schema tinha `BlocoTrecho` desde o commit inicial, o motor somava acesso ao terminal e antecedência, a matriz tinha 30 rotas do México pesquisadas com fonte, as regras liam `tipo === 'trecho'` — e não havia gesto nenhum que criasse um. Agora há "Mudar de cidade" na tela do dia, com os modais pesquisados, operadoras, e a duração vindo do **mesmo** `estimarDeslocamento` que a linha do tempo usa nas lacunas. Virou decisão (D39): peça que existe e não tem caminho na interface conta como não implementada.

O painel **converte o horário na gravação**: o que ele digita é a hora do bilhete, no relógio de onde embarca, e `startMin` é posição numa linha do tempo desenhada no relógio da base. Entre Cancún e Valladolid isso é uma hora inteira — salvar sem converter desfaria na gravação a conta que a leitura acerta.

### `npm run e2e` não fazia build

Achei isso da pior forma: escrevi o teste do fuso, ele falhou, e o motivo era que o Playwright roda contra `vite preview`, que serve o `dist/` **do disco**. O script era só `playwright test`. Ou seja: **suíte verde não provava nada sobre o código recém-escrito**, e vinha sendo assim desde que a suíte existe. Agora constrói primeiro.

### Documentos (item 3)

O requisito de entrada do México era um parágrafo de dez linhas dentro de `destino.entrada.observacoes`. Aparecia inteiro no alerta da viagem, e ninguém lê dez linhas de prosa procurando o que fazer hoje. Pior: **nenhuma regra podia ler aquilo** — se o visto vale para uma entrada ou várias era uma frase.

Agora é campo: `entradasPermitidas`, `vias`, `validadeDias`, `isencoes`, `custo`, `prazo`, `linkOficial`, `escopo`. A situação mora na viagem, porque `/data` é somente leitura. E há tela própria, com prazo contado, link oficial e campo de protocolo.

**O filtro de escopo é a parte que vale explicar:** o Visitax é taxa de Quintana Roo, então só aparece quando o roteiro **entra** no estado — inclusive em bate-volta, porque a taxa é por entrar. Mostrar para quem só vai a Oaxaca erraria duas vezes: manda pagar o que não deve e ensina a ignorar a tela.

Regra nova, `visto-de-entrada-unica`: o único lugar do app em que o visto e o itinerário se olham juntos. O e-visto mexicano vale para **uma** entrada e só por via aérea; trecho que sai do país queima o visto no meio da viagem, e a descoberta é no balcão de imigração com a passagem comprada. Só dispara quando o dado **diz** quantas entradas permite — supor entrada única assustaria sem base. `BlocoTrecho` ganhou `escalaEmOutroPais` e o painel pergunta, senão a regra não teria o que ler.

**Os dados do México são reais:** e-visto USD 10, 180 dias, entrada única, só aérea, com a lista de isenções, do guia do próprio Consulado em São Paulo e da página da Embaixada — `verificado`. Visitax do `visitax.gob.mx` para quem paga e como pagar, mas **o portal oficial não publica o valor** (é 2,5 UMA e muda com ela), então o preço é faixa de MXN 280–300 com imprensa local como fonte e a ressalva na tela — `parcial`. A tela mostra faixa porque número redondo ali seria afirmação que eu não sustento.

### A fila de reservas ganhou o voo e os documentos (item 4)

A tela listava só atividades agendadas. O voo internacional e os documentos — as duas coisas mais caras e mais irreversíveis — ficavam cada um na sua tela, sem prazo e sem ordem. Quem abria a fila via o tour no topo e o visto em lugar nenhum.

Três regimes, de propósito diferentes: **comprar-antes** para o voo, que não tem data limite e tem curva de preço — vai no topo **sem data**, porque "compre até dia X" é número que nenhuma fonte sustenta; **prazo conhecido**, por data, vencido na frente; **sem prazo** no fim, dizendo que o banco não sabe a antecedência em vez de insinuar folga.

**Escrevendo o teste disso, a fila abriu com "Passaporte válido — prazo vencido"** numa viagem a 44 dias. O motivo era meu: eu tinha dado 90 dias de antecedência ao passaporte, sem fonte. Número inventado não é só imprecisão — produz alarme falso, e alarme falso no topo da fila gasta a confiança de todos os avisos verdadeiros abaixo (D41). O campo saiu.

### Orçamento com folga e ponto de estouro (item 5)

A tela dizia "planejado R$ 11.624, teto R$ 12.000" e parava. Num teto apertado isso esconde o que decide a viagem: a folga é R$ 376, uma linha vale R$ 3.850, e a faixa dessa linha é mil reais larga. A pergunta real não é "quanto deu", é **"se a passagem subir, ainda cabe"**.

Entraram três contas no motor: **folga** nos dois extremos, **as três linhas mais caras**, e o **ponto de estouro** — até quanto a linha mais incerta (faixa mais larga) pode subir com o resto no melhor caso. Quando já estourou, ela diz para quanto teria de cair. Custo de documento entra no orçamento em categoria própria; documento marcado "não se aplica" fica fora, porque quem tem visto americano está dispensado do e-visto e não deve ver o custo dele.

O briefing pedia "avisar antes de confirmar" ao adicionar um card que estoura o teto. **Diálogo de confirmação seria bloquear, e a regra do projeto é nunca bloquear.** Então o aviso vai no próprio cartão, antes do dedo: cada item não agendado mostra o que custa e o que sobraria, ou que estoura e por quanto.

### O achado que não era meu

Um dos agentes de pesquisa da Bolívia, lendo o conversor para saber em que formato gravar, avisou que `converterHorarios` fazia `String(valor)` em cima do horário de cada dia. **Conferi contra os dados antes de acreditar, e era verdade e pior:** nas ondas que gravam a forma estruturada aquilo dava a string "[object Object]", o dia saía ausente, e o lixo era **gravado em `/data`**. O Nordeste tinha horário em **4 itens de 459**. Depois do conserto, 58; Punta Cana foi de 22 para 45; **77 itens recuperaram horário que já estava pesquisado e com fonte** (D40).

Isso também explicava por que o item 1 do briefing parecia funcionar e não funcionava: "fecha na segunda" não dispara para item cujo horário foi descartado. O pacote do Nordeste era incapaz de avisar sobre dia de fechamento.

### Estado

`npm run validate`: 0 erro, 217 testes verdes. `npm run e2e`: 35 testes verdes, agora contra um build de verdade. Tudo publicado.

Três das quatro ondas da Bolívia voltaram — 206 itens em 12 bases, com a onda de logística gravada e o agente ainda fechando. Entre os achados: o histórico fatal documentado dos tours do Salar, os 123 mortos no Cerro Rico em 2025 com o debate ético dos dois lados, a Bolívia tendo abandonado o câmbio fixo em 29/06/2026, e a taxa da Reserva Eduardo Avaroa confirmada em duas fontes independentes a três anos de distância. Importar e validar é o próximo passo.
