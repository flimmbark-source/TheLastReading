import { NODE_GRAPH } from '../../data/adventure/nodes.mjs';

// Breadth-first routing over the global spiderweb. Neighbor order in NODE_GRAPH
// is the global tie breaker; Events never redefine semantic relationships.
export function routeNode(sourceNode, acceptedNodes = []) {
  const accepted = new Set(acceptedNodes);
  if (!sourceNode || !accepted.size) return null;
  if (accepted.has(sourceNode)) {
    return { sourceNode, resolvedNode: sourceNode, exact: true, distance: 0 };
  }

  const seen = new Set([sourceNode]);
  const queue = [{ node: sourceNode, distance: 0 }];
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of NODE_GRAPH[current.node] || []) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      const distance = current.distance + 1;
      if (accepted.has(neighbor)) {
        return { sourceNode, resolvedNode: neighbor, exact: false, distance };
      }
      queue.push({ node: neighbor, distance });
    }
  }

  return null;
}

export function nodeDistance(sourceNode, targetNode) {
  const route = routeNode(sourceNode, [targetNode]);
  return route ? route.distance : Infinity;
}
