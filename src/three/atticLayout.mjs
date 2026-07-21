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

// Shared world-space centre for the playable reading surface. The seated
// camera and the DOM spread both target this point so moving the reading on
// the cloth cannot leave the camera looking at the old position.
//
// It sits 0.15m toward the player from the table's geometric centre, not on
// it: the seated camera looks across the cloth at a downward slant, so the
// near half foreshortens larger and the geometric centre projects high into
// the frame (all the empty cloth ends up below the reading). Nudging the
// reading toward the near edge lands it in the *visual* centre of the table
// as seen, which is what "the spread is in the middle of the table" means on
// screen. The seated eye (POSES.seated) pulls back to match so the whole
// cloth — far rim to near rim — stays in frame around it.
export const READING_CENTER = [0, TABLE.topY + 0.01, TABLE.position[2] + 0.15];

// Portrait frames the table more top-down and taller, so the near/far
// foreshortening is stronger: the reading has to sit a little further toward
// the player again to land on the visual centre of the cloth oval. Its own
// centre (used by PORTRAIT_POSES.seated.look and PORTRAIT_TABLE_ANCHORS)
// keeps this off the desktop composition, which is already centred at 0.5.
export const PORTRAIT_READING_CENTER = [0, TABLE.topY + 0.01, TABLE.position[2] + 0.25];

export const CHAIR = {
  position: [0, 0, 1.62],
  facing: Math.PI, // seat faces -Z, toward the table
};

// Camera poses for the player rig. `look` is a world-space point.
//
// The seated pose doubles as the hybrid reading camera: it is deliberately
// more top-down than a natural sitting eye-line so the cloth offers enough
// usable acreage for the five SPv2 spread slots plus the hand fan. The camera
// has moved back with the reading centre, keeping the middle of the cloth in
// the middle of the screen instead of chasing the old far-table anchor.
export const POSES = {
  seated: {
    // Leaned in close over the cloth so the table dominates the frame (the
    // hand fan lives at the screen bottom, off the cloth, so the camera is free
    // to zoom the reading surface right in). Still a presentation backdrop, not
    // a literal sitting eye-line.
    eye: [0, 1.82, 1.10],
    look: [...READING_CENTER],
  },
  standing: {
    eye: [0, 1.58, 2.05],
    look: [0, 1.05, 0.1],
  },
  // A believable low sitting eye-line that the get-up / sit-down choreography
  // routes *through* — it is NOT a camera the game ever holds. POSES.seated is
  // a deliberately raised, pulled-back presentation backdrop (eye y 1.64, well
  // behind the chair at z 2.05) so the whole cloth fits the 2D reading frame;
  // that puts it *higher* than the standing eye (1.58), so lerping straight
  // seated -> standing drifts the camera slightly DOWN and never reads as
  // rising. Sinking to this real seat first (leaned in over the cloth), then
  // pushing up out of it, restores ~0.36m of visible vertical travel — the
  // thing that actually sells standing up. The sit-down runs it in reverse.
  seatedEyeline: {
    eye: [0, 1.22, 1.74],
    look: [0, 0.8, 0.46],
  },
};

// Portrait reading camera: deliberately NOT pose-parity with desktop. It is
// higher, more top-down (~45°), and closer, so the cloth dominates the tall
// frame and proves play space; the composition keeps a sliver of the far
// wall (the window's glow just clears the top edge), the light shaft's pool
// on the floor, and the table candle. The approach cinematic retargets its
// final keyframe to this pose on portrait so the reveal stays continuous.
export const PORTRAIT_POSES = {
  seated: {
    // Lowered and moved forward (leaning in over the cloth, still in front
    // of the chair, z < CHAIR.z) so the viewpoint sits down toward the table:
    // the far rim rides up near the top edge and the near cloth fills the
    // frame, so the table dominates the view instead of the room above it.
    // Look stays on the reading centre, so the spread holds the middle of
    // the frame.
    eye: [0, 1.85, 1.35],
    look: [...PORTRAIT_READING_CENTER],
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

// The trunk doubles as the archives: discovered items appear on its lid as
// keepsakes, and interacting with it opens the archives drawer.
export const TRUNK_SPOT = {
  position: [2.85, 0, -1.95],
  rotationY: -0.28,
  lidY: 0.68, // top surface of the lid — keepsakes stand here
  focusPoint: [2.85, 0.62, -1.95],
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
  // Ends exactly on POSES.seated so the reveal of the live hybrid table
  // continues from the same camera.
  { t: 5.2, eye: POSES.seated.eye, look: POSES.seated.look },
];

// ── hybrid seated-table anchors ──────────────────────────────────────────
// Named world-space points on the cloth. While the seated table mode is
// live, these are projected through the camera into screen coordinates and
// published as CSS variables (--t3d-*) so the real SPv2 DOM spread and hand
// sit ON the 3D table instead of at viewport percentages. Span pairs are
// used to derive px-per-meter scales at each row's depth.
// The cloth's far rim (center) — projected as --t3d-cloth-rim-y so the
// hybrid's rim-overlap check (scripts/validate-attic3d-mobile-states.mjs)
// has a real geometric reference instead of an eyeballed screenshot. The
// spread row's card tops should stay below this line.
export const CLOTH_FAR_RIM = [0, TABLE.topY, TABLE.position[2] - TABLE.radius];

export const TABLE_ANCHORS = {
  'spread-1': [-0.62, READING_CENTER[1], READING_CENTER[2] + 0.04],
  'spread-2': [-0.31, READING_CENTER[1], READING_CENTER[2] - 0.02],
  'spread-3': [0, READING_CENTER[1], READING_CENTER[2] - 0.04],
  'spread-4': [0.31, READING_CENTER[1], READING_CENTER[2] - 0.02],
  'spread-5': [0.62, READING_CENTER[1], READING_CENTER[2] + 0.04],
  'spread-c': [...READING_CENTER],
  // Centre of the live number printed on the left cabinet face. The legacy
  // score sequencer projects its animated count and +1 beats onto this point.
  'score-counter': [-0.205, TABLE.topY + 0.188, TABLE.position[2] - 0.517],
  // Tiny discard-charge cards sit between spread and hand, biased toward the
  // near edge and left side of the fan.
  'discard-icons': [-0.46, TABLE.topY + 0.015, TABLE.position[2] + 0.41],
  discard: [-0.82, 0.79, 0.42],
  purge: [0.82, 0.79, 0.42],
  'hand-c': [0, 0.79, 0.95],
};

// World width the hand DOM row is scaled to occupy at its anchor depth (only
// used where hand-anchoring is engaged — Test B / landscape). The spread is
// never scaled: it is repositioned only, at its native SPv2 size.
export const HAND_WORLD_WIDTH = 0.52; // fan resting along the near edge

// Portrait rebuilds the composition rather than reprojecting desktop's:
// the spread spans less of the narrow cloth, while its centre remains the
// same physical table centre as landscape. The hand row hugs the near edge
// to close the vertical gap.
export const PORTRAIT_TABLE_ANCHORS = {
  ...TABLE_ANCHORS,
  'spread-1': [-0.42, PORTRAIT_READING_CENTER[1], PORTRAIT_READING_CENTER[2] + 0.04],
  'spread-2': [-0.21, PORTRAIT_READING_CENTER[1], PORTRAIT_READING_CENTER[2]],
  'spread-3': [0, PORTRAIT_READING_CENTER[1], PORTRAIT_READING_CENTER[2] - 0.02],
  'spread-4': [0.21, PORTRAIT_READING_CENTER[1], PORTRAIT_READING_CENTER[2]],
  'spread-5': [0.42, PORTRAIT_READING_CENTER[1], PORTRAIT_READING_CENTER[2] + 0.04],
  'spread-c': [...PORTRAIT_READING_CENTER],
  'hand-c': [0, 0.79, 0.82],
};
export const PORTRAIT_HAND_WORLD_WIDTH = 0.5;

// Solid clutter the player cannot walk through: [x, z, radius].
export const KEEP_OUT = [
  [TABLE.position[0], TABLE.position[2], 1.15],
  [-2.95, -1.85, 0.95], // crate cluster
  [2.85, -1.95, 0.9], // trunk
  [2.55, 1.55, 0.65], // deck crate
  [-1.5, -2.35, 0.55], // candle shelf
  [-2.1, -2.25, 0.6], // newspaper stack
];