# Orbiter: Stellar Conquest - notes for Claude

## Standing approval (from the owner, applies to every future task in this repo)

Approved without asking each time:
- Run `node --test tests/*.test.mjs` and `npx vite build --base=./`.
- Run headless browser checks against the built game (Playwright, served from `dist`).
- Commit with explicit paths only (never `git add .`), using the trailers below.
- Push to `origin master` AND `origin main`.
- Fix gaps you find yourself, then re-verify. Do not hand back "not done yet" items you can finish.

Trailers on every commit:
Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CGhzfio7eMELyyBHXuoN51

Do not modify the orbit-business repo.

## Before you report anything as working (checklist)

Nothing is "done" until every item below is checked in the running game, not just in unit tests:
1. Build passes and all tests pass.
2. The feature was triggered in a browser and its panel or effect was seen on screen (screenshot read back).
3. Every button was clicked at least once, and each one changes something visible or in state. A disabled button shows why.
4. No `pageerror` in the browser console during the check.
5. Layout checked at the screenshot: nothing overlaps, no empty grid columns, close buttons reachable.
6. Shared state is read from the game state (`st.current`), never from the UI object (`u.current`).
7. Only then: commit, push both branches, and report what was verified and how.

## Debug hooks

- `window.__relic.st.current`: game state.
- `window.__relic.u`: UI flags (dev raid trigger: `u.raidNow = true`).
- Start a campaign: "New campaign", pick "Commander Fenris", "Commander the Intended", skip the intro.
