import { installMpGame as installBaseMpGame } from './mpGame.mjs';

// The multiplayer game is now fully self-contained in mpGame.mjs. The former
// extension seam (mult-span sync, singleplayer-style ability flow) has been
// folded into the base game, so the host is just a thin entry point kept for a
// stable import path from main.mjs.
export function installMpGame(target = window) {
  installBaseMpGame(target);
}
