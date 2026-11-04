const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Remove the dark theme attr so landing is light (LandingPage should force light anyway)
  const probes = await page.evaluate(() => {
    const out = [];
    const sels = ['.lp-button-primary', '.lp-button-sun'];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el, i) => {
        const cs = getComputedStyle(el);
        const txt = (el.textContent || '').trim().slice(0, 24);
        out.push({
          sel, i,
          text: txt,
          bg: cs.backgroundColor,
          color: cs.color,
          theme: document.documentElement.getAttribute('data-theme'),
        });
      });
    }
    return out;
  });

  console.log('THEME attr:', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
  console.log('BUTTON PROBES:');
  for (const p of probes) console.log('  ', JSON.stringify(p));

  await page.screenshot({ path: '.workbuddy-ai/tmp-shots/btn-probe-1440-top.png' });
  // scroll to CTA
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.workbuddy-ai/tmp-shots/btn-probe-1440-bottom.png' });

  console.log('CONSOLE ERRORS:', errors.length ? errors : '(none)');
  await browser.close();
})();
