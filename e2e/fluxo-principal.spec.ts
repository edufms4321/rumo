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

test('backup sai e volta', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');
  await page.getByRole('link', { name: 'Descobrir' }).click();
  const nome = await page.locator('main ul li h3').first().innerText();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();

  // Baixa o backup.
  await page.getByRole('link', { name: 'Exportar' }).click();
  const baixando = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Gerar: Backup (.json)' }).click();
  const arquivo = await (await baixando).path();

  // Apaga tudo e devolve o arquivo.
  await page.evaluate(
    async () =>
      new Promise<void>((pronto) => {
        localStorage.clear();
        // idb-keyval guarda tudo no banco 'keyval-store'.
        const pedido = indexedDB.deleteDatabase('keyval-store');
        pedido.onsuccess = () => pronto();
        pedido.onerror = () => pronto();
        pedido.onblocked = () => pronto();
      }),
  );
  // Volta ao inicio: e de la que se restaura um backup num aparelho novo,
  // onde nenhuma viagem existe ainda.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Planeje a viagem inteira');
  await expect(page.getByText('Nenhuma viagem ainda')).toBeVisible();

  // Importar abre a viagem restaurada direto, que e o que se quer ver.
  await page.locator('input[type=file]').setInputFiles(arquivo);
  await expect(page.getByRole('heading', { name: 'Calendario da viagem' })).toBeVisible();
  await page.getByRole('link', { name: 'Selecao' }).click();
  await expect(page.getByText(nome).first()).toBeVisible();
});

test('uma tela quebrada nao apaga o app', async ({ page }) => {
  await page.goto('/');
  // Rota de viagem que nao existe: o app tem de reagir, nao sumir.
  await page.goto('/#/viagem/nao-existe/calendario');
  await expect(page.locator('body')).not.toHaveText('');
  // Se a cerca pegou, ela promete que o dado esta salvo.
  const quebrou = await page.getByText('Esta tela quebrou').isVisible().catch(() => false);
  if (quebrou) {
    await expect(page.getByText('A sua viagem nao se perdeu')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao inicio' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Planeje a viagem inteira',
    );
  }
});

test('da para mover um bloco so com o teclado', async ({ page }) => {
  await criarViagem(page);
  await definirDatas(page, '2027-02-10', '2027-02-12');
  await page.getByRole('link', { name: 'Descobrir' }).click();
  await page.getByRole('button', { name: 'Favoritar' }).first().click();
  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('link', { name: 'Abrir o dia' }).first().click();
  await page.getByRole('button', { name: /^Adicionar/ }).first().click();

  const bloco = page.getByRole('group', { name: /das \d\d:\d\d as \d\d:\d\d/ }).first();
  const antes = (await bloco.getAttribute('aria-label')) ?? '';
  await bloco.focus();

  // Duas setas para baixo = 30 min mais tarde.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(bloco).not.toHaveAttribute('aria-label', antes);

  const hora = (rotulo: string) => {
    const m = /das (\d\d):(\d\d)/.exec(rotulo);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };
  const depois = (await bloco.getAttribute('aria-label')) ?? '';
  expect(hora(depois) - hora(antes)).toBe(30);

  // Shift+seta muda a duracao, nao o inicio.
  await page.keyboard.press('Shift+ArrowDown');
  const comShift = (await bloco.getAttribute('aria-label')) ?? '';
  expect(hora(comShift)).toBe(hora(depois));
});

test('destino domestico nao pede passaporte, visto nem cambio', async ({ page }) => {
  await criarViagem(page, 'nordeste');
  await definirDatas(page, '2027-07-10', '2027-07-14');

  // Nada de visto nem de cotacao: o destino usa a mesma moeda e o mesmo pais.
  await expect(page.getByText(/exige visto/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Buscar cotacao' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Descobrir' }).click();
  await expect(page.getByText(/\d+ resultados/)).toBeVisible();

  // A lista de bagagem pede identidade, nao passaporte.
  await page.getByRole('link', { name: 'Exportar' }).click();
  await expect(page.getByText('Documento de identidade com foto')).toBeVisible();
  await expect(page.getByText('Passaporte e copia digital')).toHaveCount(0);
});
