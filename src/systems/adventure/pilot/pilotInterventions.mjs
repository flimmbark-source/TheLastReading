// Selects which authored interventions speak in a reading.
//
// Interventions are how earlier events (a companion, a signature item, a
// dangerous status, a prior memory) change the CAUSE of a later beat rather
// than bolt a bonus onto it. Only relevant state should speak: the prose is
// expected to carry at most one major intervention, while others may apply
// their effects silently.

// priority convention (higher wins the prose slot):
//   90+  direct callback to an earlier event / thread
//   70   companion or signature item
//   50   dangerous status
//   30   relevant ordinary item / material
export function selectInterventions(interventions = [], run) {
  const matched = [];
  for (const intervention of interventions) {
    let ok = true;
    if (typeof intervention.when === 'function') {
      try {
        ok = Boolean(intervention.when({ run }));
      } catch {
        ok = false;
      }
    }
    if (ok) matched.push(intervention);
  }
  matched.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return matched;
}

// The single intervention that gets the prose slot (highest priority with a
// narrative), if any.
export function proseIntervention(matched = []) {
  return matched.find(intervention => intervention.replaceNarrative || intervention.addNarrative) || null;
}
