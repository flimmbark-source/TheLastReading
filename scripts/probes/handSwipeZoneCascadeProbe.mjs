function sample() {
  const zone = document.getElementById('handSwipeZone');
  const hint = zone?.querySelector('.hand-swipe-hint');
  const line1 = zone?.querySelector('.swipe-hint-line-1');
  const lower = zone?.querySelector('.hand-swipe-zone-lower');
  const zoneStyle = zone ? getComputedStyle(zone) : null;
  const hintStyle = hint ? getComputedStyle(hint) : null;
  const lineStyle = line1 ? getComputedStyle(line1) : null;
  const lowerStyle = lower ? getComputedStyle(lower) : null;
  return {
    zone: zoneStyle && {
      bottom: zoneStyle.bottom,
      height: zoneStyle.height,
      zIndex: zoneStyle.zIndex,
      cursor: zoneStyle.cursor,
      pointerEvents: zoneStyle.pointerEvents,
      touchAction: zoneStyle.touchAction,
    },
    hint: hintStyle && {
      display: hintStyle.display,
      opacity: hintStyle.opacity,
      transform: hintStyle.transform,
      position: hintStyle.position,
      zIndex: hintStyle.zIndex,
    },
    line1: lineStyle && {
      display: lineStyle.display,
      position: lineStyle.position,
      opacity: lineStyle.opacity,
      animationName: lineStyle.animationName,
    },
    lower: lowerStyle && {
      display: lowerStyle.display,
      height: lowerStyle.height,
      pointerEvents: lowerStyle.pointerEvents,
      cursor: lowerStyle.cursor,
    },
  };
}

async function setState(page, { bodyClass = '', width = 390, height = 844, zoneClass = '', attrs = {} }) {
  await page.setViewportSize({ width, height });
  await page.evaluate(({ bodyClass, zoneClass, attrs }) => {
    document.body.className = bodyClass;
    const zone = document.getElementById('handSwipeZone');
    if (!zone) return;
    zone.className = `hand-swipe-zone ${zoneClass}`.trim();
    for (const name of [...zone.getAttributeNames()]) {
      if (name.startsWith('data-')) zone.removeAttribute(name);
    }
    Object.entries(attrs).forEach(([key, value]) => zone.setAttribute(key, value));
  }, { bodyClass, zoneClass, attrs });
  await page.waitForTimeout(80);
  return page.evaluate(sample);
}

export default async function handSwipeZoneCascadeProbe(page) {
  return {
    classicMobile: await setState(page, { bodyClass: '', zoneClass: 'has-overflow' }),
    classicDesktop: await setState(page, { bodyClass: '', width: 900, height: 900, zoneClass: 'dragging has-overflow' }),
    atticMobileStep2: await setState(page, { bodyClass: 'mode-attic', zoneClass: 'has-overflow', attrs: { 'data-hint-step': '2' } }),
    completedHints: await setState(page, { bodyClass: '', zoneClass: 'hints-complete has-overflow' }),
    spv2Mobile: await setState(page, { bodyClass: 'single-player-v2 generated-sheet-ready mode-reading', zoneClass: 'has-overflow' }),
    mpSpv2Mobile: await setState(page, { bodyClass: 'mp-game-active single-player-v2 generated-sheet-ready mode-reading', zoneClass: 'has-overflow' }),
  };
}
