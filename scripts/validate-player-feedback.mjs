import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import { installPlayerFeedback } from '../src/app/playerFeedback.mjs';

const html = readFileSync(new URL('../game.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/game.html' });
const { window } = dom;
let request = null;

window.requestAnimationFrame = callback => window.setTimeout(callback, 0);
window.fetch = async (url, options) => {
  request = { url, options };
  return { ok: true, status: 200 };
};

installPlayerFeedback(window);

const button = window.document.getElementById('mainMenuFeedbackBtn');
const backdrop = window.document.getElementById('mainMenuFeedback');
const form = window.document.getElementById('mainMenuFeedbackForm');
const status = window.document.getElementById('mainMenuFeedbackStatus');

assert.ok(button, 'Feedback button is installed on the main menu');
assert.ok(window.document.getElementById('tlrPlayerFeedbackStyles'), 'Feedback styles are installed once');
button.click();
assert.equal(backdrop.hidden, false, 'Feedback dialog opens');
assert.equal(button.getAttribute('aria-expanded'), 'true', 'Feedback button exposes open state');

form.elements.feedback.value = 'The card picker opened the wrong Arcana.';
form.elements.email.value = 'player@example.com';
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await new Promise(resolve => window.setTimeout(resolve, 0));

assert.equal(request?.url, '/', 'Feedback posts through the deployed site origin');
assert.equal(request?.options?.method, 'POST', 'Feedback uses POST');
assert.match(request?.options?.body || '', /form-name=player-feedback/, 'Submission identifies the Netlify form');
assert.match(request?.options?.body || '', /feedback=The\+card\+picker/, 'Submission includes the player message');
assert.match(request?.options?.body || '', /email=player%40example.com/, 'Submission includes optional contact details');
assert.match(request?.options?.body || '', /mode=reading/, 'Submission includes the selected main-menu mode');
assert.match(request?.options?.body || '', /viewport=\d+x\d+/, 'Submission includes viewport context');
assert.equal(status.dataset.state, 'success', 'Successful submission receives inline confirmation');

window.tlrClosePlayerFeedback();
assert.equal(backdrop.hidden, true, 'Feedback dialog closes');
assert.equal(button.getAttribute('aria-expanded'), 'false', 'Feedback button exposes closed state');

dom.window.close();
console.log('Player feedback checks passed.');
