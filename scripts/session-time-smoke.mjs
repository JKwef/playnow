import assert from 'node:assert/strict';

export async function checkSessionTimeAndSearch(page) {
  const button = (name) => page.getByRole('button', { name, exact: true });
  const radio = (name) => page.getByRole('radio', { name, exact: true });
  const heading = (name) => page.getByRole('heading', { name, exact: true });
  await button('Попробовать подбор по времени').click();
  await radio('15 мин').click();
  await heading('Tetris Effect: Connected').waitFor();
  assert.equal(await heading('20 Minutes Till Dawn').count(), 0);
  await radio('30 мин').click();
  await heading('20 Minutes Till Dawn').waitFor();
  await button('Я бы сыграл в эту игру').first().click();
  await button('✓ Выбрано для пробы').waitFor();
  await button('Ничего не подходит').click();
  await button('✓ Ничего не подходит').waitFor();
  await button('Закрыть подбор по времени').click();

  const swipe = page.getByRole('checkbox', { name: 'Режим свайпа' });
  await swipe.click();
  await button('Избранное (0)').click();
  await page.getByRole('tab', { name: 'Избранное у друзей', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Поиск друга по нику' });
  await search.click();
  await page.keyboard.type('mint', { delay: 100 });
  assert.equal(await search.inputValue(), 'mint');
  assert.equal(await search.evaluate((input) => input === input.ownerDocument.activeElement), true);
  assert.equal(await button('MintKnight').isVisible(), true);
  assert.equal(await button('MoonRunner').count(), 0);
  await page.keyboard.press('Backspace');
  assert.equal(await search.inputValue(), 'min');
  await swipe.click();
}
