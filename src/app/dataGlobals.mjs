// Installs src/data/ module exports on window under the legacy names that
// the inline script uses for display. Called from main.mjs before tlrLegacyBoot()
// so every gameplay function that references these globals finds them on window.
import {
  ROMAN, SUITS, RANKS, SUIT_GLYPHS, ABILITY_LABELS, MAJOR_GLYPHS,
  MAJOR_ARCANA, COURT_CARD_TEMPLATES,
  CARD_MEANINGS, COURT_MEANINGS, SUIT_MEANINGS,
} from '../data/cards.mjs';
import { THRESHOLDS } from '../data/thresholds.mjs';
import { RELICS as RELICS_MODULE, RELIC_SPRITE } from '../data/relics.mjs';
import { RESONATIONS, ARCHIVE_FRAGMENTS, ARCHIVE_ITEMS } from '../data/archiveFragments.mjs';

export function installDataGlobals(target) {
  // Direct matches
  target.ROMAN  = ROMAN;
  target.SUITS  = SUITS;
  target.RANKS  = RANKS;
  target.TH     = THRESHOLDS;
  target.RELIC_SPRITE = RELIC_SPRITE;

  // Same format, different legacy name
  target.GLYPH      = SUIT_GLYPHS;
  target.TXT        = ABILITY_LABELS;
  target.MAJOR_G    = MAJOR_GLYPHS;
  target.MEAN       = CARD_MEANINGS;
  target.COURT_MEAN = COURT_MEANINGS;
  target.SUIT_MEAN  = SUIT_MEANINGS;

  // Object format → legacy tuple format used by buildDeck()
  target.MAJORS = MAJOR_ARCANA.map(c => [c.number, c.name, c.points, c.trull, c.ability]);
  target.COURTS = COURT_CARD_TEMPLATES.map(c => [c.rank, c.points, c.ability]);

  // RELICS: module uses `description`; display code uses `desc`
  target.RELICS = Object.fromEntries(
    Object.entries(RELICS_MODULE).map(([k, r]) => [k, { ...r, desc: r.description }])
  );
  target._relicMeldNames    = new Set(Object.values(target.RELICS).map(r => r.name));
  target._relicMeldNameToKey = new Map(Object.entries(target.RELICS).map(([k, r]) => [r.name, k]));

  // Archive / resonation data (same format, different legacy names)
  target.RESONATIONS   = RESONATIONS;
  target.INV_FRAGMENTS = ARCHIVE_FRAGMENTS;
  target.INV_ITEMS     = ARCHIVE_ITEMS;
}
