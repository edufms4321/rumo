/**
 * O caso que o briefing deu como critério de pronto, de ponta a ponta:
 *
 *   "o trecho Cancún → Valladolid exibe saída e chegada em horas locais
 *    corretas e um selo −1h."
 *
 * Cancún está em Quintana Roo (UTC−5), Valladolid em Yucatán (UTC−6). O Tren
 * Maya leva 1h30 entre as duas, e esse número vem do pacote pesquisado, não
 * deste teste. Saindo 11:00 de Cancún chega-se 11:30 em Valladolid — a mesma
 * hora e meia de viagem, meia hora no relógio. Se o app subtraísse relógios,
 * diria 12:30 e daria uma hora de folga que não existe.
 */
import { expect, test } from '@playwright/test';

test('o trecho Cancun para Valladolid mostra as duas horas locais e o selo de fuso', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova viagem' }).click();
  await page.getByRole('dialog').locator('select').selectOption('mexico');
  await page.getByRole('button', { name: 'Criar e configurar' }).click();

  const datas = page.locator('input[type=date]');
  await datas.nth(0).fill('2026-11-22');
  await datas.nth(1).fill('2026-11-24');

  // Dorme em Cancun na primeira noite e em Valladolid na segunda: e a troca
  // de base que faz o relogio mudar.
  await page.getByRole('link', { name: 'Calendario' }).click();
  const cartoes = page.getByRole('combobox', { name: /Cidade-base de/ });
  await cartoes.nth(0).selectOption('cancun');
  await cartoes.nth(1).selectOption('valladolid');

  // O calendario avisa que o fuso mudou no segundo dia.
  await expect(page.getByText(/fuso -1 h/).first()).toBeVisible();

  // Abre o dia da troca.
  await page.getByRole('link', { name: 'Abrir o dia' }).nth(1).click();
  await expect(page.getByText('O fuso mudou hoje.')).toBeVisible();
  await expect(page.getByText(/Valladolid esta 1 h atras de Cancun/)).toBeVisible();

  await page.getByRole('button', { name: 'Mudar de cidade' }).click();
  const painel = page.getByRole('dialog');
  await painel.getByLabel('Sai de').selectOption('cancun');
  await painel.getByLabel('Chega em').selectOption('valladolid');
  await painel.getByRole('radio', { name: /trem/ }).check();
  await painel.getByLabel(/^Sai as/).fill('11:00');

  // O painel avisa que o horario digitado e o do bilhete, em Cancun, e que
  // na linha do tempo (relogio de Valladolid) o bloco cai as 10:00.
  await expect(painel.getByText(/Cancun esta \+1 h em relacao ao relogio deste dia/)).toBeVisible();
  await expect(painel.getByText(/o bloco aparece as 10:00/)).toBeVisible();

  await painel.getByRole('button', { name: 'Colocar na agenda' }).click();

  // O bloco na linha do tempo: 1h30 reais, 11:00 em Cancun, 11:30 em
  // Valladolid, selo -1 h.
  const bloco = page.locator('[role=group]', { hasText: 'cancun para valladolid' });
  await expect(bloco).toContainText('1 h 30 min');
  await expect(bloco).toContainText('sai 11:00 em Cancun');
  await expect(bloco).toContainText('chega 11:30 em Valladolid');
  await expect(bloco.getByText('-1 h')).toBeVisible();
});

test('sem mudanca de fuso o bloco nao polui a tela com horario local', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova viagem' }).click();
  await page.getByRole('dialog').locator('select').selectOption('mexico');
  await page.getByRole('button', { name: 'Criar e configurar' }).click();

  const datas = page.locator('input[type=date]');
  await datas.nth(0).fill('2026-11-22');
  await datas.nth(1).fill('2026-11-23');

  await page.getByRole('link', { name: 'Calendario' }).click();
  const cartoes = page.getByRole('combobox', { name: /Cidade-base de/ });
  // Cancun e Tulum estao no mesmo fuso: nada de selo.
  await cartoes.nth(0).selectOption('cancun');
  await cartoes.nth(1).selectOption('tulum');
  await expect(page.getByText(/fuso -/)).toHaveCount(0);

  await page.getByRole('link', { name: 'Abrir o dia' }).nth(1).click();
  await expect(page.getByText('O fuso mudou hoje.')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mudar de cidade' }).click();
  const painel = page.getByRole('dialog');
  await painel.getByLabel('Sai de').selectOption('cancun');
  await painel.getByLabel('Chega em').selectOption('tulum');
  await painel.getByRole('button', { name: 'Colocar na agenda' }).click();

  const bloco = page.locator('[role=group]', { hasText: 'cancun para tulum' });
  await expect(bloco).toBeVisible();
  await expect(bloco).not.toContainText('sai ');
});
