// Real-browser visual regression guard for a bug jsdom can never catch:
// components/mpGameChrome.css blankly hid #abilityPrompt/#purgePrompt with a
// marked-important declaration in the mpGameChrome layer (declared before
// mpCore, where earlier layers win the marked-important tier). mpGame.mjs's
// own ability-targeting/Surgeon-swap/Purge flows reuse those same shared
// elements and set their own marked-important display:flex to reveal them,
// but that override is an unlayered <style> tag — the weakest tier once
// importance is marked at all — so it silently lost every time. Every one of
// these flows tracked its state correctly and rendered its prompt content,
// just into a DOM node stuck at display:none: no popup ever appeared for a
// real player, while scripts/validate-mp-ability-flow.mjs's jsdom-based
// dispatchEvent tests kept passing because they never compute real cascade
// layer priority. This drives the real UI in a real browser and asserts the
// prompt is actually visible.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// Some sandboxed dev environments pre-install Chromium outside Playwright's
// own managed browser cache and need this path spelled out explicitly (a
// plain chromium.launch() won't find it even with PLAYWRIGHT_BROWSERS_PATH
// set); a normal Playwright install (CI, local dev) resolves the browser on
// its own, so only override when this specific path is actually present.
const PRE_INSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = { headless: true };
if (existsSync(PRE_INSTALLED_CHROMIUM)) launchOptions.executablePath = PRE_INSTALLED_CHROMIUM;

const port = Number(process.env.MP_PROMPT_VISUAL_PORT || 18081);
const baseUrl = `http://127.0.0.1:${port}`;

function startServer() {
  const child = spawn(process.execPath, ['scripts/serve.mjs', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  return child;
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/game.html`, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function assertVisible(box, name) {
  assert.ok(box, `${name} should exist`);
  assert.notEqual(box.display, 'none', `${name} should not be display:none`);
  assert.ok(box.width > 0, `${name} should have width`);
  assert.ok(box.height > 0, `${name} should have height`);
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      const message = 'MP prompt visual smoke skipped: Playwright browser executable is not installed.';
      if (process.env.CI === 'true' || process.env.MP_PROMPT_VISUAL_REQUIRED === '1') {
        throw new Error(`${message} Run: npx playwright install chromium`);
      }
      console.warn(message);
      return;
    }
    throw error;
  }

  const server = startServer();
  try {
    await waitForServer();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });

    // Drive the real Duel entry path: loadout -> Surgeon -> Ready -> vs CPU.
    await page.click('button[onclick="tlrMainMenuMultiplayer()"]');
    await page.waitForSelector('.loadout-slot[data-persona="surgeon"]', { state: 'visible' });
    // A short settle delay avoids clicking mid-entrance-animation, which can
    // make a plain click land on stale coordinates before the loadout finishes
    // laying out (not a real interaction concern — see the persona-selection
    // guard added below, which fails loudly if this were ever insufficient).
    await page.waitForTimeout(350);
    await page.click('.loadout-slot[data-persona="surgeon"]', { force: true });
    await page.waitForFunction(() => document.querySelector('.loadout-slot.active')?.dataset?.persona === 'surgeon');
    await page.click('#loadoutReadyBtn', { force: true });
    await page.waitForSelector('.mm-cpu-btn', { state: 'visible' });
    await page.click('.mm-cpu-btn', { force: true });
    await page.waitForSelector('#hand .card[data-uid]', { state: 'visible' });
    await page.waitForTimeout(500);

    // --- Purge prompt: always available (hand starts at 5 cards) ---
    await page.click('#mpPurgeBtn', { force: true });
    await page.waitForFunction(() => document.getElementById('purgePrompt')?.classList.contains('show'));
    const purgeBox = await page.evaluate(() => {
      const el = document.getElementById('purgePrompt');
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return { display: cs.display, width: rect.width, height: rect.height };
    });
    assertVisible(purgeBox, 'Purge prompt');
    await page.click('#purgeCancel', { force: true });
    await page.waitForFunction(() => !document.getElementById('purgePrompt')?.classList.contains('show'));

    // --- Surgeon's swap prompt: always available (persona's own passive) ---
    // Place a card first so there is a Spread slot to swap out. Hand cards run a
    // continuous hover/wave animation, so a plain click fails Playwright's
    // actionability "stability" check; {force:true} is the established fix used
    // throughout this codebase's other MP visual tests for the same reason.
    await page.click('#hand .card[data-uid]', { force: true });
    await page.waitForTimeout(200);
    await page.click('#spread .slot', { force: true });
    // waitForFunction's signature is (pageFunction, arg, options) -- passing only
    // two args makes Playwright bind the object to `arg`, not `options`, silently
    // dropping the timeout override back to its 30s default. The explicit
    // `undefined` arg here is required to reach the options position.
    await page.waitForFunction(() => window.tlrMpGetState?.()?.players?.[0]?.spread?.[0] != null, undefined, { timeout: 20000 });

    await page.waitForFunction(() => document.getElementById('mpAbilityBtn')?.classList.contains('mp-visible'), undefined, { timeout: 20000 });
    await page.click('#mpAbilityBtn', { force: true });
    await page.waitForFunction(() => document.body.classList.contains('mp-persona-ability-active'));
    const swapBox = await page.evaluate(() => {
      const el = document.getElementById('abilityPrompt');
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        display: cs.display,
        width: rect.width,
        height: rect.height,
        title: document.getElementById('abilityPromptTitle')?.textContent,
        text: document.getElementById('abilityPromptText')?.textContent,
      };
    });
    assertVisible(swapBox, 'Surgeon swap prompt');
    assert.equal(swapBox.title, 'Transposition', 'swap prompt should show the ability name');
    assert.ok(swapBox.text?.includes('Spread'), 'swap prompt should explain the Spread/Hand targeting');

    await page.close();
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log('Multiplayer ability/purge prompt visual checks passed.');
}

await main();
