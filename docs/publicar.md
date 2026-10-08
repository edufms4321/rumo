# Como colocar o app no ar

O Rumo é um site estático: HTML, CSS, JavaScript e os pacotes de dados em JSON. Não há servidor, não há banco de dados, não há conta. Isso significa que **hospedar é de graça em qualquer um dos dois caminhos abaixo**, e que não existe custo que cresça com uso.

---

## Caminho A — GitHub Pages (recomendado)

1. Crie um repositório no GitHub (pode ser privado; o Pages de repositório privado exige conta paga, então para plano grátis use **público**).
2. No seu computador, aponte o projeto para ele:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/rumo.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Pronto. A cada `git push` na `main`, o arquivo `.github/workflows/publicar.yml` roda sozinho e publica.

O endereço sai como `https://SEU-USUARIO.github.io/rumo/`.

### O que o robô faz antes de publicar

O deploy **só acontece se tudo passar**:

| Etapa | O que barra |
|---|---|
| `npm run validate` | erro de tipo, lint, qualquer um dos 146 testes do motor, ou um registro de dados sem fonte |
| `npm run e2e` | qualquer um dos 13 testes de fluxo no navegador de verdade |
| `npm run build` | erro de compilação |

Ou seja: **um dado sem fonte impede o site de ir ao ar.** A regra de honestidade não é só promessa escrita, é portão de publicação.

---

## Caminho B — Netlify

1. Conecte o repositório em [app.netlify.com](https://app.netlify.com) → *Add new site* → *Import an existing project*.
2. O `netlify.toml` já está no projeto: comando e pasta de saída vêm dele, não precisa configurar nada na tela.
3. O endereço sai como `https://algum-nome.netlify.app`, e você pode trocar por um domínio próprio depois.

Netlify dá domínio próprio com HTTPS de graça; o GitHub Pages também, mas pede um passo a mais no DNS.

---

## Instalar no celular

Depois de abrir o endereço uma vez no celular:

- **Android/Chrome**: menu ⋮ → *Adicionar à tela inicial*.
- **iPhone/Safari**: botão de compartilhar → *Adicionar à Tela de Início*.

Ele vira um ícone, abre sem barra de navegador e **funciona sem internet** depois da primeira visita — o que importa quando você está em Palomino sem sinal. O mapa precisa de rede na primeira vez que você abre cada região.

---

## Atualizar os dados sem mexer em código

O banco é só arquivo. Para corrigir um preço ou um horário:

1. Abra `data/colombia/itens/<arquivo>.json`.
2. Mude o valor **e junto dele** a `fonte` e o `coletadoEm`. Se você confirmou por telefone, a fonte pode ser `{ "tipo": "telefone", "url": "", "consultadoEm": "2026-10-20", "observacao": "falei com a recepcao" }`.
3. `npm run validate:data` — se faltar fonte, ele reprova e diz qual registro.
4. `git commit` + `git push`. O site se atualiza em ~3 minutos.

Para um destino novo, veja [`como-adicionar-destino.md`](como-adicionar-destino.md): é criar uma pasta em `data/`, sem tocar em nenhuma linha de código do app.

---

## Backup — leia isto

**Sua viagem mora no navegador do seu aparelho, não no servidor.** Vantagem: ninguém vê seus dados, nem eu, nem o GitHub. Desvantagem: se você limpar os dados do navegador, trocar de celular ou usar o modo anônimo, a viagem vai embora.

Então: **Exportar → Backup (.json)** antes de viajar, e o arquivo no seu Drive. O mesmo arquivo volta pelo botão de importar, em qualquer aparelho.

---

## O que custa dinheiro (nada, por enquanto)

| Item | Custo | Observação |
|---|---|---|
| Hospedagem (Pages ou Netlify) | R$ 0 | limites generosos para um app pessoal |
| Mapa (OpenFreeMap) | R$ 0 | sem chave, sem cartão |
| Fontes, ícones | R$ 0 | licença aberta |
| Domínio próprio | ~R$ 40/ano | opcional |

Se um dia você quiser rota de carro de verdade em vez da estimativa por distância, aí entra um provedor com chave (OpenRouteService tem camada grátis). O app já está preparado para isso atrás de uma interface — e continua funcionando sem.
