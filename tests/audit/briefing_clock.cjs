// Regression check: the Flight Academy briefing holds the clock and fuel on every step, and resumes when it is entered.
// Run against a built dist: node tests/audit/briefing_clock.cjs [url]   (default http://127.0.0.1:4173/)
const {chromium} = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: 1280, height: 800}})).newPage();
  p.setDefaultTimeout(10000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const fails = [];
  const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
  const snap = () => p.evaluate(() => ({speed: window.__relic.scene.speed, elapsed: window.__relic.st.current.elapsed, fuel: window.__relic.st.current.fuel, open: !!window.__relic.u.current?.briefing}));

  await p.goto(url + '?audit=1', {waitUntil: 'load'});
  await sleep(800);
  await p.getByRole('button', {name: /new campaign/i}).click();
  await sleep(400);
  await p.getByText(/Commander Fenris/).first().click();
  await sleep(500);
  await p.getByRole('button', {name: /commander\s*the intended/i}).click();
  await sleep(1500);

  const academy = p.locator('.academy-box');
  check(await academy.count() === 1, 'briefing opens after the commander is chosen');
  for (let step = 1; step <= 4; step++) {
    const kicker = await academy.locator('.academy-kicker').textContent();
    check(kicker.includes(`${step} / 4`), `step ${step} of 4 is showing (${kicker.trim()})`);
    const a = await snap();
    await sleep(3000);
    const c = await snap();
    check(c.speed === 0, `step ${step}: clock is stopped (speed ${c.speed})`);
    check(c.elapsed === a.elapsed, `step ${step}: simulation tick holds (${a.elapsed} -> ${c.elapsed})`);
    check(c.fuel === a.fuel, `step ${step}: fuel holds (${a.fuel} -> ${c.fuel})`);
    if (step < 4) await academy.getByRole('button', {name: 'Next'}).click();
    await sleep(300);
  }
  await academy.getByRole('button', {name: 'Enter Command Deck'}).click();
  await sleep(1000);
  const after = await snap();
  check(!after.open, 'briefing closes on Enter Command Deck');
  check(after.speed > 0, `clock resumes after the briefing (speed ${after.speed})`);
  const a2 = await snap();
  await sleep(2000);
  const c2 = await snap();
  check(c2.elapsed > a2.elapsed, `simulation tick advances after the briefing (${a2.elapsed} -> ${c2.elapsed})`);
  check(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
  console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.message.split('\n')[0]); process.exit(1); });
