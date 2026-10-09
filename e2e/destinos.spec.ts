/**
 * Todo destino que existe em /data tem de funcionar no app sem nenhuma
 * linha de codigo especifica dele. E o criterio de aceite numero 7, e e a
 * promessa que mais barato se quebra: basta um pacote novo trazer um
 * campo num formato diferente.
 *
 * A lista sai do proprio banco, entao um destino novo entra neste teste
 * sozinho — ninguem precisa lembrar de adiciona-lo.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const DESTINOS = readdirSync('data', { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join('data', e.name, 'indice.json')))
  .map((e) => {
    const i = JSON.parse(readFileSync(join('data', e.name, 'indice.json'), 'utf8')) as {
      id: string;
      nome: string;
      totais: { itens: number };
    };
    return i;
  });

for (const destino of DESTINOS) {
  test(`${destino.id}: abre, lista os itens e monta um dia`, async ({ page }) => {
    // Um pacote grande renderiza centenas de cartoes de uma vez (o Nordeste
    // tem 397). Sozinho leva ~1 s; com tres navegadores disputando a
    // maquina, estoura o limite padrao de 30 s. E lentidao do CI, nao do
    // app — medi o render isolado antes de mexer no numero.
    test.setTimeout(120_000);
    await page.goto('/');
    await page.getByRole('button', { name: 'Nova viagem' }).click();
    await page.getByRole('dialog').locator('select').selectOption(destino.id);
    await page.getByRole('button', { name: 'Criar e configurar' }).click();
    await expect(page.getByRole('heading', { name: 'Configuracao da viagem' })).toBeVisible();

    const datas = page.locator('input[type=date]');
    await datas.nth(0).fill('2027-05-10');
    await datas.nth(1).fill('2027-05-14');

    // Descobrir mostra o pacote inteiro.
    await page.getByRole('link', { name: 'Descobrir' }).click();
    await expect(page.getByText(`${destino.totais.itens} resultados`)).toBeVisible();

    // Todo item traz procedencia: e a regra que o app promete na capa.
    await expect(page.locator('main ul li').first().getByText(/coletado/)).toBeVisible();

    /*
      Favoritar dois itens QUE SE AGENDAM.

      Favoritar por posicao na lista toda era instavel: um quarto dos itens
      de alguns pacotes e cartao de referencia ("AVISO: a balsa come seu fim
      de tarde"), que de proposito nao tem botao de adicionar ao dia. Quando
      a posicao 0 ou 1 caia num deles, o teste ficava esperando um botao que
      nunca ia existir e estourava o limite - e em outro pacote, nao sempre
      no mesmo, o que fazia parecer problema de lentidao.

      O grupo "Comer" nao tem cartao de referencia em pacote nenhum.
    */
    // Escopo na navegacao de grupos: existe um item do Mexico chamado
    // "Comer barato: Mercado de Santa Ana...", que colidia com a pilula.
    await page
      .getByRole('navigation', { name: 'Grupos' })
      .getByRole('button', { name: /^Comer/ })
      .click();
    await page.getByRole('button', { name: 'Favoritar' }).nth(0).click();
    await page.getByRole('button', { name: 'Favoritar' }).nth(1).click();
    await page.getByRole('link', { name: 'Calendario' }).click();
    await page.getByRole('link', { name: 'Abrir o dia' }).first().click();
    const adicionar = page.getByRole('button', { name: /^Adicionar .* ao dia$/ });
    await adicionar.first().click();
    await adicionar.first().click();
    await expect(page.getByText(/de atividade/)).toBeVisible();

    // E o orcamento soma sem explodir.
    await page.getByRole('link', { name: 'Orcamento' }).click();
    await expect(page.getByRole('heading', { name: 'Orcamento', exact: true })).toBeVisible();
  });
}
