const PROPS = ['position','top','right','bottom','left','width','height','display','flexDirection','justifyContent','alignItems','gap','zIndex','filter','margin','transform'];

function snapshotStyle(style) {
  return Object.fromEntries(PROPS.map(prop => [prop, style[prop]]));
}

async function sample(page, label, { width = 1024, classes = [] } = {}) {
  await page.setViewportSize({ width, height: 720 });
  await page.evaluate((classList) => {
    document.body.className = classList.join(' ');
    const rack = document.getElementById('relicRack');
    rack.className = 'relic-rack';
    rack.innerHTML = '<button class="relic-btn relic-rare">✦</button><div class="relic-slot-empty"></div>';
  }, classes);
  await page.waitForTimeout(100);
  return page.evaluate((sampleLabel) => {
    const props = ['position','top','right','bottom','left','width','height','display','flexDirection','justifyContent','alignItems','gap','zIndex','filter','margin','transform'];
    const snapshotStyle = style => Object.fromEntries(props.map(prop => [prop, style[prop]]));
    const rack = document.getElementById('relicRack');
    const btn = rack.querySelector('.relic-btn');
    const slot = rack.querySelector('.relic-slot-empty');
    return {
      label: sampleLabel,
      rack: snapshotStyle(getComputedStyle(rack)),
      button: snapshotStyle(getComputedStyle(btn)),
      slot: snapshotStyle(getComputedStyle(slot)),
    };
  }, label);
}

export default async function relicRackCascadeProbe(page) {
  return {
    classic: await sample(page, 'classic'),
    mobile: await sample(page, 'mobile', { width: 390 }),
    atticMobile: await sample(page, 'atticMobile', { width: 390, classes: ['mode-attic'] }),
    spv2Mobile: await sample(page, 'spv2Mobile', { width: 390, classes: ['single-player-v2', 'generated-sheet-ready'] }),
    mpActive: await sample(page, 'mpActive', { classes: ['mp-game-active'] }),
  };
}
