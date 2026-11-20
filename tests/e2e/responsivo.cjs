/* ============================================================================
 * TESTES DE INTERFACE (E2E) — Playwright
 * Cobre TST-02 (multi-tela), TST-03 (toque), TST-04 (recorde/som), TST-06
 * (teclado) e verifica erros de console (RNF-03).
 * Executar:  npm run test:e2e
 *   (opcional) CHROME_PATH=/caminho/do/chrome  URL=https://...  SHOTS=pasta
 * ==========================================================================*/
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const URL = process.env.URL || 'file://' + path.resolve(__dirname, '../../index.html');
const SHOTS = process.env.SHOTS || path.resolve(__dirname, '../../docs/capturas');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { nome: 'celular', width: 360, height: 800, touch: true },
  { nome: 'celular-390', width: 390, height: 844, touch: true },
  { nome: 'celular-paisagem', width: 800, height: 360, touch: true },
  { nome: 'tablet', width: 768, height: 1024, touch: true },
  { nome: 'notebook', width: 1366, height: 768, touch: false },
  { nome: 'desktop', width: 1920, height: 1080, touch: false }
];

const resultados = [];
function registrar(id, ok, detalhe) {
  resultados.push({ id, ok, detalhe });
  console.log((ok ? '  ✔ ' : '  ✘ ') + id + ' — ' + detalhe);
}

// Lê a sequência atual e espera a fase ENTRADA (vez do jogador)
async function aguardarVez(page) {
  await page.waitForFunction(() => window.__genius.estado().fase === 'ENTRADA', null, { timeout: 30000 });
  return page.evaluate(() => window.__genius.estado().sequencia);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  let falhas = 0;

  // ---------------- TST-02: responsividade em 6 viewports ----------------
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => localStorage.setItem('geniusweb:v1', JSON.stringify({ viuAjuda: true })));
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    // A fonte do Google é opcional (há fallback local); falhas de rede dela não contam como erro
    let falhasFonte = 0;
    page.on('requestfailed', (req) => { if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) falhasFonte++; });
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource/.test(m.text()) && falhasFonte > 0) { falhasFonte--; return; }
      erros.push(m.text());
    });
    await page.goto(URL);

    const medidas = await page.evaluate(() => {
      const r = document.querySelector('#tabuleiro').getBoundingClientRect();
      const alvos = [...document.querySelectorAll('button, select')].filter((b) => b.offsetParent !== null)
        .map((b) => { const x = b.getBoundingClientRect(); return { id: b.id || b.textContent.trim(), w: x.width, h: x.height }; });
      return {
        scrollX: document.documentElement.scrollWidth > window.innerWidth,
        tab: { x: r.left, y: r.top, w: r.width, h: r.height, dentro: r.left >= 0 && r.right <= window.innerWidth },
        pequenos: alvos.filter((a) => a.w < 44 || a.h < 44),
        fonteMin: Math.min(...[...document.querySelectorAll('.status, .placar dd, .btn, label')].map((n) => parseFloat(getComputedStyle(n).fontSize)))
      };
    });
    const ok = !medidas.scrollX && medidas.tab.dentro && medidas.tab.w >= 250 && Math.abs(medidas.tab.w - medidas.tab.h) < 2 && medidas.pequenos.length === 0 && erros.length === 0;
    registrar('TST-02 ' + vp.nome + ' ' + vp.width + 'x' + vp.height, ok,
      'tabuleiro ' + Math.round(medidas.tab.w) + 'px, scroll-x=' + medidas.scrollX + ', alvos<44px=' + medidas.pequenos.length + ', fonte mín=' + medidas.fonteMin + 'px, erros=' + erros.length);
    if (!ok) { falhas++; console.log(medidas, erros); }
    await page.screenshot({ path: path.join(SHOTS, 'inicial-' + vp.nome + '.png') });

    // Capturas extras para o diagrama de telas (celular e desktop)
    if (vp.nome === 'celular' || vp.nome === 'desktop') {
      await page.evaluate(() => window.__genius.iniciar());
      await aguardarVez(page);
      await page.screenshot({ path: path.join(SHOTS, 'partida-' + vp.nome + '.png') });
      await page.keyboard.press('p');
      await page.waitForSelector('#dlg-pausa[open]');
      await page.screenshot({ path: path.join(SHOTS, 'pausa-' + vp.nome + '.png') });
      await page.click('#pausa-continuar');
      const seq = await page.evaluate(() => window.__genius.estado().sequencia);
      await page.keyboard.press(String(((seq[0] + 1) % 4) + 1)); // tecla errada
      await page.waitForSelector('#dlg-fim[open]', { timeout: 10000 });
      await page.screenshot({ path: path.join(SHOTS, 'fim-' + vp.nome + '.png') });
      await page.keyboard.press('Escape');
      await page.click('#btn-ajuda');
      await page.waitForSelector('#dlg-ajuda[open]');
      await page.screenshot({ path: path.join(SHOTS, 'ajuda-' + vp.nome + '.png') });
    }
    await ctx.close();
  }

  // ---------------- TST-03: toque (tap) sem disparo duplo ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => localStorage.setItem('geniusweb:v1', JSON.stringify({ viuAjuda: true, som: true })));
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.tap('#btn-iniciar');
    let seq = await aguardarVez(page);
    const nomes = ['verde', 'vermelho', 'amarelo', 'azul'];
    await page.tap('#quadrante-' + nomes[seq[0]]);
    await page.waitForFunction(() => window.__genius.estado().sequencia.length === 2, null, { timeout: 5000 });
    const e = await page.evaluate(() => window.__genius.estado());
    const ok = e.sequencia.length === 2 && e.jogadores[0].pontos === 1;
    registrar('TST-03 toque', ok, 'um toque = uma jogada (pontos=' + e.jogadores[0].pontos + ', sequência=' + e.sequencia.length + ')');
    if (!ok) falhas++;
    await ctx.close();
  }

  // ---------------- TST-04: recorde persiste após recarregar; som desliga ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('geniusweb:v1', JSON.stringify({ viuAjuda: true })));
    await page.reload();
    await page.click('#btn-iniciar');
    for (let rodada = 1; rodada <= 3; rodada++) {
      const seq = await aguardarVez(page);
      for (const c of seq) await page.keyboard.press(String(c + 1));
      await page.waitForFunction((n) => window.__genius.estado().sequencia.length === n + 1, rodada);
    }
    await aguardarVez(page);
    const seq = await page.evaluate(() => window.__genius.estado().sequencia);
    await page.keyboard.press(String(((seq[0] + 1) % 4) + 1));
    await page.waitForSelector('#dlg-fim[open]', { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.click('#btn-som');
    await page.reload();
    const r = await page.evaluate(() => ({ recorde: document.querySelector('#placar-recorde').textContent, som: document.querySelector('#btn-som').getAttribute('aria-pressed') }));
    const ok = r.recorde === '3' && r.som === 'false';
    registrar('TST-04 persistência', ok, 'recorde após F5 = ' + r.recorde + ', som = ' + r.som);
    if (!ok) falhas++;
    await ctx.close();
  }

  // ---------------- TST-06: jogar só com teclado (Tab + Enter) ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.addInitScript(() => localStorage.setItem('geniusweb:v1', JSON.stringify({ viuAjuda: true })));
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.keyboard.press('Tab'); // link "pular"
    const pular = await page.evaluate(() => document.activeElement.className);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // Enter na área do tabuleiro inicia
    const seq = await aguardarVez(page);
    // Navega por Tab até o quadrante certo e confirma com Espaço
    const alvoId = '#quadrante-' + ['verde', 'vermelho', 'amarelo', 'azul'][seq[0]];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate((s) => document.activeElement === document.querySelector(s), alvoId)) break;
    }
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__genius.estado().sequencia.length === 2, null, { timeout: 5000 });
    const anel = await page.evaluate((s) => getComputedStyle(document.querySelector(s + ' path[id^="forma-"]')).strokeWidth, alvoId);
    const ok = pular.includes('pular-link') && anel === '9px';
    registrar('TST-06 teclado', ok, 'skip-link ok, partida iniciada com Enter, jogada com Tab+Espaço, anel de foco ' + anel);
    if (!ok) falhas++;
    await ctx.close();
  }

  // ---------------- Capturas: sequência sendo exibida (com narração) e multiplayer ----------------
  for (const vp of [VIEWPORTS[0], VIEWPORTS[5]]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
    await ctx.addInitScript(() => localStorage.setItem('geniusweb:v1', JSON.stringify({ viuAjuda: true, narrar: true, jogadores: 3 })));
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.evaluate(() => window.__genius.iniciar());
    await page.waitForSelector('.aceso.ativo', { timeout: 10000 });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(SHOTS, 'exibindo-' + vp.nome + '.png') });
    // Jogador 1 acerta → vez do Jogador 2
    let seq = await aguardarVez(page);
    await page.keyboard.press(String(seq[0] + 1));
    await page.waitForFunction(() => window.__genius.estado().jogadorAtual === 1);
    await aguardarVez(page);
    const e = await page.evaluate(() => window.__genius.estado());
    const ok = e.jogadorAtual === 1 && e.jogadores.length === 3;
    registrar('TST-07 multiplayer ' + vp.nome, ok, 'vez passou para o Jogador ' + (e.jogadorAtual + 1) + ' de ' + e.jogadores.length);
    if (!ok) falhas++;
    await page.screenshot({ path: path.join(SHOTS, 'multiplayer-' + vp.nome + '.png') });
    await ctx.close();
  }

  // ---------------- TST-11: "Narrar cores" fala os nomes em voz alta ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.addInitScript(() => {
      localStorage.setItem('geniusweb:v1', JSON.stringify({ viuAjuda: true, narrar: true }));
      // Substitui o sintetizador por um "gravador" para o teste ouvir o que seria falado
      window.__falas = [];
      const falso = { speak: (u) => window.__falas.push(u.text), cancel: () => {}, getVoices: () => [], addEventListener: () => {}, onvoiceschanged: null };
      Object.defineProperty(window, 'speechSynthesis', { value: falso, configurable: true });
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.click('#btn-iniciar');
    for (let rodada = 1; rodada <= 2; rodada++) {
      const seq = await aguardarVez(page);
      for (const c of seq) await page.keyboard.press(String(c + 1));
      await page.waitForFunction((n) => window.__genius.estado().sequencia.length === n + 1, rodada);
    }
    const seq = await aguardarVez(page);
    await page.waitForTimeout(400);
    const nomes = ['Verde', 'Vermelho', 'Amarelo', 'Azul'];
    const falas = await page.evaluate(() => window.__falas);
    // Na 3ª rodada, as últimas falas devem ser as 3 cores da sequência e "Sua vez"
    const esperado = seq.map((c) => nomes[c]).concat(['Sua vez']);
    const ok = JSON.stringify(falas.slice(-4)) === JSON.stringify(esperado);
    registrar('TST-11 narração por voz', ok, 'falou: ' + falas.slice(-4).join(', '));
    if (!ok) { falhas++; console.log(falas); }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(SHOTS, 'resultado-e2e.json'), JSON.stringify(resultados, null, 2));
  console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes E2E passaram.');
  process.exit(falhas ? 1 : 0);
})();
