// Shared helpers: find React state refs through the fiber tree, and common UI actions.
module.exports.findState = `(() => {
  const root = document.querySelector('.hud-ribbon') || document.body;
  const key = Object.keys(root).find((k) => k.startsWith('__reactFiber'));
  let f = root[key];
  while (f && f.return) f = f.return;
  const seen = new Set();
  const stack = [f];
  while (stack.length) {
    const n = stack.pop(); if (!n || seen.has(n)) continue; seen.add(n);
    let h = n.memoizedState;
    while (h) {
      const v = h.memoizedState;
      if (v && typeof v === 'object' && v.current && typeof v.current === 'object' && 'fleet' in v.current && 'credits' in v.current) return v.current;
      h = h.next;
    }
    if (n.child) stack.push(n.child);
    if (n.sibling) stack.push(n.sibling);
    if (n.return && stack.length < 5000) {}
  }
  return null;
})()`;
module.exports.clickText = (page, re) => page.evaluate((src) => {
  const b = [...document.querySelectorAll('button')].find((x) => new RegExp(src, 'i').test(x.textContent) && !x.disabled);
  if (b) { b.click(); return b.textContent.trim(); }
  return null;
}, re);
