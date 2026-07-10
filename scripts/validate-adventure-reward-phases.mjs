import assert from 'node:assert/strict';
import fs from 'node:fs';

const mode = fs.readFileSync(new URL('../src/app/adventureModeV3.mjs', import.meta.url), 'utf8');
const content = fs.readFileSync(new URL('../src/data/adventure/adventureContentV3.mjs', import.meta.url), 'utf8');
const sigils = fs.readFileSync(new URL('../src/data/adventure/sigils.mjs', import.meta.url), 'utf8');
const sigilRuntime = fs.readFileSync(new URL('../src/app/adventureCardSigils.mjs', import.meta.url), 'utf8');

assert.match(sigils, /ACTION_NODES\.MYSTERY\]: Object\.freeze\(\{ id: 'moon', name: 'Omen'/);
assert.doesNotMatch(content, /Moon card|Moon Great Success|Heart and Moon/);
assert.match(mode, /effectiveEventRequirement\(session\.run, approach\)/);
assert.match(mode, /const handRing = inHand/);
assert.match(mode, /const requirementText = requirement === null/);
assert.match(mode, /adv-reward-card-selected/);
assert.match(mode, /function cancelRewardCardPicker\(\)/);
assert.match(mode, /state\.applicationSnapshot = cloneRunForRewardApplication\(\)/);
assert.match(mode, /session\.run = JSON\.parse\(JSON\.stringify\(state\.applicationSnapshot\)\)/);
assert.match(mode, /isTriumph: resolution\.rewardTier === 'triumph'/);
assert.match(mode, /function randomOfferForLane/);
assert.match(mode, /laneOverride/);
assert.match(mode, /CHOOSE_PASSIVE/);
assert.match(mode, /PASSIVE_ITEM_LIST\.filter\(item => !hasItem\(item\.id\)\)/);
assert.match(mode, /target\.tlrAdventureDebug = api/);
assert.doesNotMatch(mode, /offers\[index\] = randomOrdinaryOffer/);
assert.match(sigilRuntime, /const REWARD_CHOICE_KIND = Object\.freeze\(\{\}\)/);
assert.match(sigilRuntime, /function decorateApproachRequirements\(\) \{\}/);
assert.match(sigilRuntime, /function installRequirementSetTracking\(\) \{\}/);

const laneDeclaration = mode.indexOf("const lane = offer.laneOverride || lanes[index] || '';");
const laneUse = mode.indexOf('sourceForOneReroll(lane)', laneDeclaration);
assert(laneDeclaration >= 0 && laneUse > laneDeclaration, 'Reward lane must be declared before reroll lookup');

console.log('Adventure reward phase validation passed.');
