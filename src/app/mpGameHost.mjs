import { installMpGame as installBaseMpGame } from './mpGame.mjs';
import { installMpGameExtensions } from './mpGameExtensions.mjs';

export function installMpGame(target = window) {
  installBaseMpGame(target);
  installMpGameExtensions(target);
}
