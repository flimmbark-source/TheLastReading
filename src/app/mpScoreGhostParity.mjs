// Multiplayer-only score ghost parity.
// MP placement/meld effects create slot ghosts with the actual chip amount, but
// the score pill only emitted a single +1. This watches MP slot ghosts and adds
// the missing +1 score ghosts so the count matches earned chip points.

function parseChipAmount(text) {
  const match = String(text || '').trim().match(/^([+-]?\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestMpScoreId(doc, ghostNode) {
  const gr = ghostNode.getBoundingClientRect();
  const point = rectCenter(gr);
  const spreads = [
    { id: 'mpMyScore', node: doc.getElementById('spread') },
    { id: 'mpOppScore', node: doc.getElementById('mpOppSpread') },
  ].filter(item => item.node);
  if (!spreads.length) return null;
  spreads.sort((a, b) => distance(point, rectCenter(a.node.getBoundingClientRect())) - distance(point, rectCenter(b.node.getBoundingClientRect())));
  return spreads[0].id;
}

function fireMpScoreGhost(doc, scoreId) {
  const scoreNode = doc.getElementById(scoreId);
  const pill = scoreNode?.closest?.('.mp-pill-score') || scoreNode;
  if (!pill) return;
  const rect = pill.getBoundingClientRect();
  const ghost = doc.createElement('span');
  ghost.className = 'score-ghost';
  ghost.textContent = '+1';
  ghost.style.position = 'fixed';
  ghost.style.left = `${rect.left + 8 + Math.random() * Math.max(1, rect.width - 16)}px`;
  ghost.style.top = `${rect.top + rect.height * 0.25}px`;
  ghost.style.zIndex = '2147483300';
  doc.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 950);
}

function mirrorSlotGhostToScore(doc, ghostNode) {
  if (!doc.body.classList.contains('mp-game-active')) return;
  if (!(ghostNode instanceof HTMLElement)) return;
  if (!ghostNode.classList.contains('ghost') || ghostNode.classList.contains('score-ghost')) return;
  if (ghostNode.dataset.mpScoreGhostParity === '1') return;
  ghostNode.dataset.mpScoreGhostParity = '1';

  const amount = parseChipAmount(ghostNode.textContent);
  if (!amount) return;

  const alreadyEmittedByPlacement = ghostNode.classList.contains('big') ? 0 : 1;
  const missing = Math.max(0, amount - alreadyEmittedByPlacement);
  if (!missing) return;

  const scoreId = nearestMpScoreId(doc, ghostNode);
  if (!scoreId) return;

  for (let i = 0; i < missing; i += 1) {
    setTimeout(() => fireMpScoreGhost(doc, scoreId), 28 * i);
  }
}

export function installMpScoreGhostParity(target = window) {
  if (!target || target.__tlrMpScoreGhostParityInstalled) return;
  target.__tlrMpScoreGhostParityInstalled = true;
  const doc = target.document;
  if (!doc?.body) return;

  const observer = new MutationObserver(mutations => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) mirrorSlotGhostToScore(doc, node);
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: false });
}

if (typeof window !== 'undefined') {
  installMpScoreGhostParity(window);
}
