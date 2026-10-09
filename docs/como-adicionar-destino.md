# Como adicionar um destino

Adicionar um destino novo é **criar uma pasta e rodar o validador**. Nenhuma linha de código muda.

---

## 1. Crie a pasta

```
data/<id-do-destino>/
```

O `id-do-destino` é um slug: letras minúsculas, números e hífens. Ex.: `colombia`, `peru`, `costa-rica`.

## 2. Crie os arquivos

Só `destino.json` é obrigatório. Os outros podem começar como lista vazia (`[]`) e crescer depois.

| Arquivo | Conteúdo | Obrigatório |
|---|---|---|
| `destino.json` | objeto do país | **sim** |
| `regioes.json` | macrorregiões do país (Nordeste, Caribe) | não |
| `estados.json` | estados, departamentos ou províncias | não |
| `zonas.json` | regiões turísticas (Chapada Diamantina) | não |
| `cidades.json` | lista de cidades-base | não |
| `aeroportos.json` | lista de aeroportos | não |
| `trechos.json` | lista de trechos entre cidades | não |
| `voos-internacionais.json` | lista de rotas origem → destino | não |
| `calendario.json` | lista de feriados, festas e eventos | não |
| `hospedagem.json` | lista de sugestões por bairro | não |
| `itens/<qualquer-nome>.json` | lista de itens | não |

### Os quatro níveis de lugar

A árvore é **país > macrorregião > estado > cidade-base**, e cada nível é uma
divisão que existe no mundo e tem fonte. A **zona turística** (`zonas.json`)
é uma etiqueta na cidade, não um degrau: ela não particiona o mapa — Oaxaca
tem duas dentro de um estado, o Eje Cafetero atravessa três departamentos.

`regioes.json` e `estados.json` podem vir vazios. Aí a árvore degrada para
país > cidade e o validador **avisa**; o que ele não aceita é cidade apontando
para um estado de uma região diferente da que ela mesma declara, porque isso
põe Cartagena debaixo dos Andes no menu.

`zonas.json` é a única coleção do banco **sem `fontes`**: uma zona é recorte
editorial nosso, não afirmação sobre o mundo. A versão anterior herdava a
exigência de fonte e o conversor carimbava uma relação do OpenStreetMap que
era o Maranhão como fonte das 16 regiões do Nordeste.

A pasta `itens/` pode ter quantos arquivos você quiser — o carregador concatena todos. A convenção é um arquivo por cidade: `itens/cartagena.json`, `itens/san-andres.json`.

Qualquer outro arquivo é **ignorado com aviso** pelo validador. Subpasta diferente de `itens/` também.

## 3. Rode o validador

```bash
npm run validate:data
```

Ele reprova (sai com código 1) se houver **erro** e só avisa se houver **aviso**.

**Erros** — o build não passa:
- campo obrigatório faltando, tipo errado
- registro sem `fontes` (toda entrada precisa de pelo menos uma)
- `id` ou IATA duplicado
- `item.cidadeId`, `cidade.regiaoId`, `trecho.deCidadeId`, `hospedagem.cidadeId` ou `calendario.escopo` apontando para algo que não existe
- coordenada fora da `caixaDelimitadora` do destino
- faixa de preço invertida (`max < min`), duração incoerente (`min > tipica > max`)
- imagem sem crédito ou sem licença
- item de categoria `aluguel-veiculo` sem o bloco `aluguel`; `passeio` sem o bloco `passeio`
- item marcado `gratuito` que também tem preço

**Avisos** — passam, mas vão para `docs/pendencias-de-verificacao.md`:
- item sem coordenada (não entra no mapa; deslocamento sai como estimativa grosseira)
- item sem imagem licenciada (card usa placeholder)
- preço sem fonte (interface mostra como estimado)
- "precisa reservar" sem antecedência em dias
- cidade sem clima por mês (fica fora da sugestão de janela de datas)

## 4. Abra o app

```bash
npm run dev
```

O destino aparece sozinho. `src/data/carregar.ts` usa `import.meta.glob` sobre `/data/*/`, então o Vite descobre a pasta no build.

---

## Campos que todo registro precisa

Definidos em `BaseRecord`, em `src/schema/base.ts`:

```json
{
  "id": "co-ctg-castillo-san-felipe",
  "fontes": [
    { "url": "https://exemplo.gov.co/pagina", "titulo": "Site oficial", "publicadoEm": "2026-03-10" }
  ],
  "coletadoEm": "2026-10-08",
  "confianca": "verificado"
}
```

- `id` — slug estável. Convenção: `<pais>-<cidade>-<nome>`. **Nunca mude um `id` já usado**: a viagem salva no navegador aponta para ele.
- `fontes` — pelo menos uma URL http(s) completa, que você realmente abriu.
- `coletadoEm` — data no formato `AAAA-MM-DD`.
- `confianca` — `verificado` (site oficial ou duas fontes independentes concordando), `parcial` (uma fonte razoável) ou `estimado` (deduzido; a interface mostra isso ao usuário).

## Preço

Nunca um número solto:

```json
"preco": {
  "moeda": "COP",
  "min": 35000,
  "max": 35000,
  "por": "pessoa",
  "inclui": "entrada; nao inclui guia",
  "coletadoEm": "2026-10-08",
  "fontes": [{ "url": "https://exemplo.gov.co/tarifas" }],
  "observacao": "tarifa de 2026, confirmar na bilheteria"
}
```

## Horários

A **ausência** de um dia da semana significa "desconhecido", não "fechado". A distinção importa: o motor de regras alerta sobre horário fechado, mas cala sobre horário desconhecido.

```json
"horarios": {
  "seg": "fechado",
  "ter": [{ "abre": "09:00", "fecha": "17:00" }],
  "qua": [{ "abre": "09:00", "fecha": "12:00" }, { "abre": "14:00", "fecha": "17:00" }],
  "dom": "24h"
}
```

## Imagens

Só Wikimedia Commons (com autor e licença exatos) ou site oficial que declare permissão. Crédito e licença são obrigatórios — sem eles o registro reprova. Sem imagem adequada, omita o campo: o card usa um placeholder.

```json
"imagens": [
  {
    "url": "https://upload.wikimedia.org/...jpg",
    "credito": "Nome do Autor",
    "licenca": "CC BY-SA 4.0",
    "fonte": "https://commons.wikimedia.org/wiki/File:...",
    "descricao": "Vista da muralha ao por do sol"
  }
]
```

## Ferramentas que preenchem buracos para você

Depois que a pasta existe e o validador passa, três comandos cuidam do que sobrou. Nenhum deles inventa nada: o que não vier da API fica vazio.

```bash
npm run coords -- <destino>      # coordenada vinda do OpenStreetMap
npm run imagens -- <destino>     # imagem de licença livre do Wikimedia Commons
npm run pendencias               # regera docs/pendencias-de-verificacao.md
```

Os dois primeiros **só mostram** o que achariam; acrescente `--gravar` para gravar. Rode sempre sem `--gravar` primeiro e leia a lista: na primeira vez que rodei o de coordenadas, três dos cinco "achados" estavam errados — um café no lugar da cidade de Filandia, uma pousada no lugar da Playa San Luis e uma área rural no lugar de Pereira, porque o endereço devolvido contém o nome do lugar. Os critérios ficaram mais duros depois disso, mas **o olho continua sendo o último filtro**.

Quando o script acha, ele acrescenta a URL devolvida pela API às `fontes` do item e anota na observação de confiança que o dado não foi conferido no local.

**Confira sempre os bate-voltas.** O script mede a distância a partir do centro da cidade-base, e um bate-volta legítimo fica longe: Praia do Forte está a 65 km de Salvador. Com o raio apertado, o ponto certo era rejeitado e um homônimo dentro da cidade entrava no lugar dele — foi assim que "Praia do Forte" virou um forte no centro de Salvador e "Ilha de Itaparica" virou um ponto do lado errado da baía. Nenhum raio distingue "o lugar certo, longe" de "o lugar errado, perto": só o olho.

## Fatores de deslocamento da cidade

Alimentam a camada 3 do estimador (sempre rotulada "estimativa" na interface). `kmh` é a velocidade média real do modal naquela cidade; `fatorRota` corrige a distância em linha reta para a distância percorrida.

```json
"fatoresDeslocamento": {
  "a-pe": { "kmh": 4.5, "fatorRota": 1.25 },
  "carro-app": { "kmh": 22, "fatorRota": 1.35 },
  "transporte-publico": { "kmh": 14, "fatorRota": 1.5 },
  "veiculo-alugado": { "kmh": 25, "fatorRota": 1.3 }
}
```

Numa cidade de trânsito pesado, baixe o `kmh` do carro. Numa ilha pequena, suba o do veículo alugado.
