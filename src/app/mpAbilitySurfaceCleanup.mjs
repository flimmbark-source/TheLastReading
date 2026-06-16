// Multiplayer ability surfaces are now owned by mpGame.mjs/mpGameHost.mjs.
// This observer reacted to the same modal and prompt class mutations that occur
// during the async card-choice transition, which could create repeated cleanup
// passes and make the UI lock up after pressing Choose.
export function installMpAbilitySurfaceCleanup() {}
