/**
 * Testes de ponta a ponta do fluxo que importa: criar viagem, escolher
 * datas, favoritar, montar um dia e ver o motor reagir.
 *
 * Nao testam aparencia. Testam que o app faz o que promete, inclusive as
 * promessas de honestidade: procedencia visivel, conflito explicado e
 * nada inventado.
 */
import { expect, test } from '@playwright/test';

async function criarViagem(page: import('@playwright/test').Page, destino = 'colombia') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova viagem' }).click();
  await page.getByRole('dialog').locator('select').selectOption(destino);
  await page.getByRole('button', { name: 'Criar e configurar' }).click();
  await expect(page.getByRole('heading', { name: 'Configuracao da viagem' })).toBeVisible();
}

async function definirDatas(page: import('@playwright/test').Page, inicio: string, fim: string) {
  const datas = page.locator('input[type=date]');
  await datas.nth(0).fill(inicio);
  await datas.nth(1).fill(fim);
}

test.beforeEach(async ({ context }) => {
  // Cada teste comeca com o navegador limpo: o app guarda tudo no IndexedDB.
  await context.clearCookies();
});

test('a tela inicial lista os destinos com a contagem de confianca', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Planeje a viagem inteira');

  const colombia = page.locator('li', { hasText: 'Colombia' }).first();
  await expect(colombia).toContainText('itens em');
  await expect(colombia).toContainText('verificado');
  await expect(colombia).toContainText('estimado');
});

test('cria uma viagem e define as datas', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-14');

  await page.getByRole('link', { name: 'Calendario' }).click();
  // 10 a 14 de fevereiro sao 5 dias.
  await expect(page.getByRole('heading', { name: 'Calendario da viagem' })).toBeVisible();
  await expect(page.getByText('5 dias', { exact: false })).toBeVisible();
});

test('sugere janelas de data com o porque em numero', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-19');

  const quandoIr = page.locator('section', { hasText: 'QUANDO IR' });
  await expect(quandoIr.getByText(/mm e \d+ dias de chuva/).first()).toBeVisible();
  await expect(quandoIr.getByText(/nota \d+/).first()).toBeVisible();
});

test('todo item em Descobrir mostra procedencia', async ({ page }) => {
  await criarViagem(page);
  await page.getByRole('link', { name: 'Descobrir' }).click();

  const primeiro = page.locator('main ul li').first();
  await expect(primeiro).toBeVisible();
  // "coletado hoje" / "coletado ha N dias": a idade do dado sempre aparece.
  await expect(primeiro.getByText(/coletado/)).toBeVisible();
});

test('o detalhe do item mostra fontes clicaveis e a frase de confianca', async ({ page }) => {
  await criarViagem(page);
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.locator('main ul li h3').first().click();

  const painel = page.getByRole('dialog');
  await expect(painel).toBeVisible();
  await expect(painel.getByText(/fonte/).first()).toBeVisible();
  await expect(painel.getByRole('link').first()).toHaveAttribute('href', /^https?:\/\//);
});

test('favoritar leva o item para a selecao', async ({ page }) => {
  await criarViagem(page);
  await page.getByRole('link', { name: 'Descobrir' }).click();

  const nome = await page.locator('main ul li h3').first().innerText();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();

  await page.getByRole('link', { name: 'Selecao' }).click();
  await expect(page.getByText(nome).first()).toBeVisible();
});

test('o motor acusa o conflito de deslocamento e oferece correcao', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');

  // Favorita itens de duas cidades distantes.
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('button', { name: /^Cartagena/ }).click();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();
  // O painel de filtros fica aberto: troca a base sem reabrir.
  await page.getByRole('button', { name: /^Cartagena/ }).click();
  await page.getByRole('button', { name: /^San Andres/ }).click();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();

  // Põe os dois no mesmo dia.
  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('link', { name: 'Abrir o dia' }).first().click();

  const adicionar = page.getByRole('button', { name: /^Adicionar/ });
  await adicionar.first().click();
  await adicionar.first().click();

  // A barra de alertas resume os conflitos; abrindo, vem a explicacao.
  const barra = page.getByRole('button', { name: /conflito|atencao|dica/ });
  await expect(barra).toBeVisible();
  await barra.click();
  await expect(page.getByText(/Faltam .* para o trajeto|fica em outra cidade/).first()).toBeVisible();
});

test('o trajeto explica a propria conta', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.getByRole('button', { name: 'Favoritar' }).nth(0).click();
  await page.getByRole('button', { name: 'Favoritar' }).nth(1).click();

  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('link', { name: 'Abrir o dia' }).first().click();
  const adicionar = page.getByRole('button', { name: /^Adicionar/ });
  await adicionar.first().click();
  await adicionar.first().click();

  // A etiqueta de saida da hospedagem ja traz a conta aberta.
  await expect(page.getByText(/Saia da hospedagem as/)).toBeVisible();
  await expect(page.getByText(/estimativa:|trecho medido no banco/).first()).toBeVisible();
});

test('o que foi planejado sobrevive a recarregar a pagina', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');
  await page.getByRole('link', { name: 'Descobrir' }).click();
  const nome = await page.locator('main ul li h3').first().innerText();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();

  await page.reload();
  await page.getByRole('link', { name: 'Selecao' }).click();
  await expect(page.getByText(nome).first()).toBeVisible();
});

test('desfazer devolve o favorito', async ({ page }) => {
  await criarViagem(page);
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();

  await page.getByRole('link', { name: 'Selecao' }).click();
  await expect(page.getByRole('heading', { name: 'Minha selecao' })).toBeVisible();

  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Nenhum favorito ainda')).toBeVisible();
});

test('o orcamento soma a taxa obrigatoria da cidade', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');

  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.locator('select').first().selectOption('san-andres');

  await page.getByRole('link', { name: 'Orcamento' }).click();
  await expect(page.getByText('Taxas obrigatorias', { exact: true }).first()).toBeVisible();
  // A Tarjeta de Turismo de San Andres entra sozinha, por pessoa.
  await expect(page.locator('body')).toContainText('R$');
});

test('o app funciona no celular sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');
  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('link', { name: 'Abrir o dia' }).first().click();

  const estoura = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(estoura).toBe(false);
});

test('um segundo destino funciona igual, sem nada especifico de pais', async ({ page }) => {
  await criarViagem(page, 'mexico');
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await expect(page.getByText(/\d+ resultados/)).toBeVisible();

  // O Mexico exige visto de brasileiro: o aviso tem de estar na configuracao.
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByText(/exige visto/)).toBeVisible();
});
