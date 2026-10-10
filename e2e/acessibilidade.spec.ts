/**
 * Varredura de acessibilidade com axe-core, nas duas temperaturas de tema.
 *
 * Nao substitui usar o app com teclado e leitor de tela, mas pega de graca
 * a classe de defeito que mais escapa: botao so com icone, contraste baixo,
 * nivel de titulo pulado, conteudo fora de landmark. Esta na suite para que
 * uma regressao reprove o deploy, nao para tirar nota.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TELAS = [
  'descobrir',
  'selecao',
  'dormir',
  'calendario',
  'orcamento',
  'reservas',
  'documentos',
  'exportar',
  'config',
  'agora',
] as const;

async function varrer(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();

  // A mensagem precisa dizer o que corrigir sem abrir o relatorio.
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}, ${v.nodes.length}x): ${v.help}\n    ${v.nodes[0]?.html.slice(0, 160)}`,
  );
}

async function montarViagemComUmDia(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova viagem' }).click();
  await page.getByRole('dialog').locator('select').selectOption('colombia');
  await page.getByRole('button', { name: 'Criar e configurar' }).click();
  const datas = page.locator('input[type=date]');
  await datas.nth(0).fill('2027-02-10');
  await datas.nth(1).fill('2027-02-12');

  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.getByRole('button', { name: 'Favoritar' }).nth(0).click();
  await page.getByRole('button', { name: 'Favoritar' }).nth(1).click();

  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('link', { name: 'Abrir o dia' }).first().click();
  const adicionar = page.getByRole('button', { name: /^Adicionar/ });
  await adicionar.first().click();
  await adicionar.first().click();
  return page.url();
}

for (const tema of ['light', 'dark'] as const) {
  test(`sem violacao de acessibilidade nas telas — tema ${tema}`, async ({ page }) => {
    // Dez varreduras do axe num teste so: lento por natureza, e mais ainda
    // na maquina do CI. O limite padrao de 30 s nao serve aqui.
    test.setTimeout(180_000);
    const urlDoDia = await montarViagemComUmDia(page);
    await page.emulateMedia({ colorScheme: tema });

    const problemas: string[] = [];
    const base = urlDoDia.split('#')[0];
    const idDaViagem = urlDoDia.split('/viagem/')[1]?.split('/')[0];

    await page.goto(`${base}#/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    problemas.push(...(await varrer(page)).map((p) => `inicio: ${p}`));

    for (const tela of TELAS) {
      await page.goto(`${base}#/viagem/${idDaViagem}/${tela}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
      problemas.push(...(await varrer(page)).map((p) => `${tela}: ${p}`));
    }

    // A tela do dia e a mais densa: linha do tempo, trajetos, alertas.
    await page.goto(urlDoDia);
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
    problemas.push(...(await varrer(page)).map((p) => `dia: ${p}`));

    expect(problemas, problemas.join('\n')).toEqual([]);
  });
}

test('o detalhe do item tambem passa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova viagem' }).click();
  await page.getByRole('dialog').locator('select').selectOption('colombia');
  await page.getByRole('button', { name: 'Criar e configurar' }).click();
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.locator('main ul li h3').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const problemas = await varrer(page);
  expect(problemas, problemas.join('\n')).toEqual([]);
});
