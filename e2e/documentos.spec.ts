/**
 * Critério de pronto do briefing, item 3:
 *
 *   "a viagem do México lista e-Visa e Visitax com prazo, e um trecho
 *    fictício via outro país dispara o alerta."
 *
 * O e-visto e o Visitax são dados reais, pesquisados com fonte oficial: o
 * guia do Consulado do México em São Paulo e a página da Embaixada do Brasil
 * para o visto, o portal visitax.gob.mx para a taxa. O VALOR do Visitax não
 * sai do portal oficial (ele não publica), então entra como faixa com as
 * fontes de imprensa — e a tela tem de mostrar isso como faixa, não como
 * número redondo.
 */
import { expect, test } from '@playwright/test';

async function viagemNoMexico(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova viagem' }).click();
  await page.getByRole('dialog').locator('select').selectOption('mexico');
  await page.getByRole('button', { name: 'Criar e configurar' }).click();
  const datas = page.locator('input[type=date]');
  await datas.nth(0).fill('2026-11-22');
  await datas.nth(1).fill('2026-11-24');
}

test('a viagem do Mexico lista e-visto e Visitax com prazo e link oficial', async ({ page }) => {
  await viagemNoMexico(page);

  // Visitax e taxa de Quintana Roo: ainda nao aparece, porque o roteiro nao
  // encosta no estado. Essa e a diferenca entre listar documento e listar o
  // documento DESTA viagem.
  await page.getByRole('link', { name: 'Documentos' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos da viagem' })).toBeVisible();
  const evisto = page.locator('li', { hasText: 'Visto eletronico' });
  await expect(evisto).toContainText('USD 10 por pessoa');
  await expect(evisto).toContainText('entrada unica');
  await expect(evisto).toContainText('so via aerea');
  await expect(evisto).toContainText('Resolver ate 23 de outubro de 2026');
  await expect(page.getByText('Visitax (Quintana Roo)')).toHaveCount(0);

  // Coloca uma noite em Cancun: agora a taxa do estado se aplica.
  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('combobox', { name: /Cidade-base de/ }).nth(0).selectOption('cancun');
  await page.getByRole('link', { name: 'Documentos' }).click();

  const visitax = page.locator('li', { hasText: 'Visitax' });
  await expect(visitax).toContainText('cobrado em Quintana Roo');
  // Faixa, nao numero redondo: o portal oficial nao publica o valor.
  await expect(visitax).toContainText('MXN 280-300');
  await expect(visitax).toContainText('antes de sair de Quintana Roo');
  await expect(visitax.getByRole('button', { name: 'site oficial' })).toBeVisible();

  // A situacao e por viagem e sobrevive a navegar.
  await visitax.getByLabel('Situacao').selectOption('pronto');
  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('link', { name: 'Documentos' }).click();
  await expect(page.locator('li', { hasText: 'Visitax' }).getByLabel('Situacao')).toHaveValue(
    'pronto',
  );
});

test('um trecho que sai do pais dispara o alerta de visto de entrada unica', async ({ page }) => {
  await viagemNoMexico(page);
  await page.getByRole('link', { name: 'Calendario' }).click();
  const bases = page.getByRole('combobox', { name: /Cidade-base de/ });
  await bases.nth(0).selectOption('cancun');
  await bases.nth(1).selectOption('merida');

  await page.getByRole('link', { name: 'Abrir o dia' }).nth(1).click();
  await page.getByRole('button', { name: 'Mudar de cidade' }).click();
  const painel = page.getByRole('dialog');
  await painel.getByLabel('Sai de').selectOption('cancun');
  await painel.getByLabel('Chega em').selectOption('merida');
  await painel.getByLabel(/Faz escala em outro pais/).fill('Panama');
  await painel.getByRole('button', { name: 'Colocar na agenda' }).click();

  // O alerta aparece no dia, com o pais citado e o botao que leva aos
  // documentos.
  await page.getByRole('button', { name: /conflito/ }).click();
  await expect(page.getByText(/vale para uma entrada so/)).toBeVisible();
  await expect(page.getByText(/O roteiro sai de Mexico \(Panama\) e volta/)).toBeVisible();
  await page.getByRole('button', { name: 'Ver os documentos da viagem' }).click();
  await expect(page).toHaveURL(/\/documentos$/);
});
