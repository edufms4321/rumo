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
