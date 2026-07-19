// Single source of truth for the 3D attic's spatial layout: room bounds, the
// table/chair, prop stations, and the camera poses the sit/stand choreography
// moves between. Distances are meters; +Z runs toward the chair the player
// starts seated in, -Z toward the gable window wall.

export const ROOM = {
  halfX: 3.8, // gable walls at +/- halfX
  halfZ: 2.8, // long walls at +/- halfZ
  eaveY: 2.0, // wall height where the roof planes start
  ridgeY: 3.35, // roof peak over x = 0
  walkInset: 0.45, // how far movement is clamped inside the walls
};

export const TABLE = {
  position: [0, 0, 0.35],
  topY: 0.78,
  radius: 0.85,
};

export const CHAIR = {
  position: [0, 0, 1.62],
  facing: Math.PI, // seat faces -Z, toward the table
};

// Camera poses for the player rig. `look` is a world-space point.
export const POSES = {
  seated: {
    eye: [0, 1.04, 1.46],
    look: [0, 0.82, 0.35],
  },
  standing: {
    eye: [0, 1.58, 2.05],
    look: [0, 1.05, 0.1],
  },
};

export const EYE_HEIGHT = 1.58;

// Interactable stations. Prop art planes reuse the existing 2D attic PNGs;
// ids match src/app/atticFlow.mjs's prop catalog so searched-state, pickups,
// and archive unlocks flow through the exact same code path as the 2D attic.
export const PROP_STATIONS = [
  {
    id: 'coat_01',
    position: [-3.72, 1.18, -0.4],
    rotationY: Math.PI / 2,
    size: [1.05, 1.7],
    focusPoint: [-3.5, 1.2, -0.4],
  },
  {
    id: 'covered_frame_01',
    position: [3.72, 1.42, -0.7],
    rotationY: -Math.PI / 2,
    size: [1.35, 1.6],
    focusPoint: [3.5, 1.35, -0.7],
  },
  {
    id: 'newspaper_stack_01',
    position: [-2.1, 0.42, -2.35],
    rotationY: 0.35,
    size: [1.05, 0.85],
    focusPoint: [-2.1, 0.6, -2.2],
  },
];

export const NOTE_SPOT = {
  position: [0.3, TABLE.topY + 0.006, 0.62],
  focusPoint: [0.3, TABLE.topY, 0.62],
};

export const DECK_SPOT = {
  position: [2.55, 0, 1.55], // crate the deck box sits on
  focusPoint: [2.55, 0.72, 1.55],
};

export const CANDLE_SHELF = {
  position: [-1.5, 1.12, -2.66],
  spacing: 0.34,
};

export const WINDOW_SPOT = {
  center: [1.1, 1.72, -ROOM.halfZ],
  width: 1.05,
  height: 1.35,
};

// The attic door the run-start approach walks in from (set dressing on the
// +Z gable wall, near the corner opposite the deck crate).
export const DOOR_SPOT = {
  position: [-2.7, 0, 2.79],
  width: 0.95,
  height: 2.0,
};

// Run-start approach: the camera walks from the attic door to the chair and
// sits, then the overlay cross-fades into the 2D table UI. `t` is seconds;
// `look` is a world-space aim point. Sampled with per-segment smoothing in
// PlayerRig; a subtle head-bob is layered on until the standing beat.
export const APPROACH_KEYFRAMES = [
  { t: 0.0, eye: [-2.45, 1.58, 2.25], look: [0, 1.0, 0.1] },
  { t: 1.7, eye: [-1.2, 1.58, 2.5], look: [0, 0.95, 0.25] },
  { t: 3.0, eye: [-0.3, 1.58, 2.25], look: [0, 0.95, 0.35] },
  { t: 3.9, eye: [0, 1.58, 2.05], look: [0, 1.05, 0.1] },
  { t: 5.2, eye: [0, 1.04, 1.46], look: [0, 0.82, 0.35] },
];

// Solid clutter the player cannot walk through: [x, z, radius].
export const KEEP_OUT = [
  [TABLE.position[0], TABLE.position[2], 1.15],
  [-2.95, -1.85, 0.95], // crate cluster
  [2.85, -1.95, 0.9], // trunk
  [2.55, 1.55, 0.65], // deck crate
  [-1.5, -2.35, 0.55], // candle shelf
  [-2.1, -2.25, 0.6], // newspaper stack
];
