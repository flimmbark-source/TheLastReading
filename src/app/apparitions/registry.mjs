// Central lookup from an action node to its apparition play function.
// Aggression keeps its bespoke reference implementation; every other node is
// served by a spec built on the shared core framework.

import { ACTION_NODES } from '../../data/adventure/nodes.mjs';
import { playAggressionApparition } from './aggressionApparition.mjs';
import { nodeApparition } from './nodeApparitions.mjs';

/**
 * @param {string} node an ACTION_NODES value
 * @returns {null | ((target, anchorRect, options) => Promise<boolean>)}
 */
export function apparitionFor(node) {
  if (node === ACTION_NODES.AGGRESSION) return playAggressionApparition;
  return nodeApparition(node);
}
