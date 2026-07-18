// Static attic architecture: plank floor, side walls, gable walls with a real
// window opening, roof planes with rafters, the reading table and chair, and
// non-interactive clutter. Low-poly primitives + flat Lambert shading on
// purpose — the game's ps1aesthetic direction, not a budget shortcut.

import { useMemo } from 'react';
import * as THREE from 'three';
import { ROOM, TABLE, CHAIR, DECK_SPOT, WINDOW_SPOT } from './atticLayout.mjs';
import { radialGlowTexture, shaftTexture } from './canvasTextures.mjs';

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

export function AtticRoom() {
  const materials = useMemo(
    () => ({
      floorA: lambert('#4b3320'),
      floorB: lambert('#453020'),
      floorC: lambert('#503722'),
      wall: lambert('#3f2c1c'),
      gable: lambert('#372718', { side: THREE.DoubleSide }),
      roof: lambert('#241610', { side: THREE.DoubleSide }),
      beam: lambert('#5a3f26'),
      cloth: lambert('#2c463a'),
      wood: lambert('#53381f'),
      crate: lambert('#55432a'),
      trunk: lambert('#4a2e1c'),
      brass: lambert('#8a6a3a'),
      rug: lambert('#4a2430'),
      card: lambert('#d8c9a8'),
      frame: lambert('#2e1f12'),
    }),
    [],
  );

  const gables = useMemo(() => {
    const outline = new THREE.Shape();
    outline.moveTo(-ROOM.halfX, 0);
    outline.lineTo(ROOM.halfX, 0);
    outline.lineTo(ROOM.halfX, ROOM.eaveY);
    outline.lineTo(0, ROOM.ridgeY);
    outline.lineTo(-ROOM.halfX, ROOM.eaveY);
    outline.closePath();
    const plain = new THREE.ShapeGeometry(outline);

    const withWindow = outline.clone();
    const [wx, wy] = WINDOW_SPOT.center;
    const hw = WINDOW_SPOT.width / 2;
    const hh = WINDOW_SPOT.height / 2;
    const hole = new THREE.Path();
    hole.moveTo(wx - hw, wy - hh);
    hole.lineTo(wx + hw, wy - hh);
    hole.lineTo(wx + hw, wy + hh);
    hole.lineTo(wx - hw, wy + hh);
    hole.closePath();
    withWindow.holes.push(hole);
    return { plain, windowed: new THREE.ShapeGeometry(withWindow) };
  }, []);

  const shaft = useMemo(() => {
    const from = new THREE.Vector3(...WINDOW_SPOT.center);
    const to = new THREE.Vector3(0.55, 0, -1.05);
    const dir = to.clone().sub(from);
    const length = dir.length();
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { mid, quaternion, length, texture: shaftTexture() };
  }, []);

  const moonTexture = useMemo(() => radialGlowTexture('rgba(225,235,255,0.95)', 'rgba(150,175,235,0.4)'), []);

  const planks = useMemo(() => {
    const list = [];
    const count = 18;
    const width = (ROOM.halfX * 2) / count;
    for (let i = 0; i < count; i++) {
      list.push({
        x: -ROOM.halfX + width * (i + 0.5),
        width: width - 0.015,
        material: i % 3 === 0 ? 'floorC' : i % 2 ? 'floorB' : 'floorA',
      });
    }
    return { list, width };
  }, []);

  const rafters = useMemo(() => {
    const slope = Math.atan2(ROOM.ridgeY - ROOM.eaveY, ROOM.halfX);
    const length = Math.hypot(ROOM.halfX, ROOM.ridgeY - ROOM.eaveY) + 0.15;
    const rows = [-2.2, -1.1, 0, 1.1, 2.2];
    return { slope, length, rows };
  }, []);

  const midY = (ROOM.eaveY + ROOM.ridgeY) / 2;

  return (
    <group>
      {/* floor */}
      {planks.list.map((plank, i) => (
        <mesh key={i} position={[plank.x, -0.02, 0]} material={materials[plank.material]}>
          <boxGeometry args={[plank.width, 0.04, ROOM.halfZ * 2]} />
        </mesh>
      ))}

      {/* side walls under the eaves */}
      <mesh position={[-ROOM.halfX - 0.05, ROOM.eaveY / 2, 0]} material={materials.wall}>
        <boxGeometry args={[0.1, ROOM.eaveY, ROOM.halfZ * 2]} />
      </mesh>
      <mesh position={[ROOM.halfX + 0.05, ROOM.eaveY / 2, 0]} material={materials.wall}>
        <boxGeometry args={[0.1, ROOM.eaveY, ROOM.halfZ * 2]} />
      </mesh>

      {/* gable walls; the -Z gable carries the window opening */}
      <mesh geometry={gables.windowed} material={materials.gable} position={[0, 0, -ROOM.halfZ]} />
      <mesh
        geometry={gables.plain}
        material={materials.gable}
        position={[0, 0, ROOM.halfZ]}
        rotation={[0, Math.PI, 0]}
      />

      {/* roof slabs + ridge + rafters. The slabs are thin boxes whose long
          axis is X, tilted about Z exactly like the rafters — a plane here
          would sit in the XY plane and wall off the room. */}
      <mesh position={[-ROOM.halfX / 2, midY + 0.09, 0]} rotation={[0, 0, -rafters.slope]} material={materials.roof}>
        <boxGeometry args={[rafters.length + 0.4, 0.06, ROOM.halfZ * 2]} />
      </mesh>
      <mesh position={[ROOM.halfX / 2, midY + 0.09, 0]} rotation={[0, 0, rafters.slope]} material={materials.roof}>
        <boxGeometry args={[rafters.length + 0.4, 0.06, ROOM.halfZ * 2]} />
      </mesh>
      <mesh position={[0, ROOM.ridgeY - 0.12, 0]} material={materials.beam}>
        <boxGeometry args={[0.16, 0.2, ROOM.halfZ * 2]} />
      </mesh>
      {/* fascia trim along both gable rooflines; also hides the sky plane
          through the hairline seam between gable top edge and roof slab */}
      {[-ROOM.halfZ + 0.05, ROOM.halfZ - 0.05].map(z => (
        <group key={z}>
          <mesh
            position={[-ROOM.halfX / 2, midY + 0.02, z]}
            rotation={[0, 0, -rafters.slope]}
            material={materials.beam}
          >
            <boxGeometry args={[rafters.length, 0.2, 0.14]} />
          </mesh>
          <mesh position={[ROOM.halfX / 2, midY + 0.02, z]} rotation={[0, 0, rafters.slope]} material={materials.beam}>
            <boxGeometry args={[rafters.length, 0.2, 0.14]} />
          </mesh>
        </group>
      ))}
      {rafters.rows.map(z => (
        <group key={z}>
          <mesh
            position={[-ROOM.halfX / 2, midY - 0.08, z]}
            rotation={[0, 0, -rafters.slope]}
            material={materials.beam}
          >
            <boxGeometry args={[rafters.length, 0.14, 0.1]} />
          </mesh>
          <mesh position={[ROOM.halfX / 2, midY - 0.08, z]} rotation={[0, 0, rafters.slope]} material={materials.beam}>
            <boxGeometry args={[rafters.length, 0.14, 0.1]} />
          </mesh>
          <mesh position={[0, ROOM.eaveY + 0.45, z]} material={materials.beam}>
            <boxGeometry args={[3.4, 0.12, 0.09]} />
          </mesh>
        </group>
      ))}

      {/* window: night sky, moon, frame cross, light shaft */}
      <group position={[WINDOW_SPOT.center[0], WINDOW_SPOT.center[1], -ROOM.halfZ]}>
        <mesh position={[0, 0, -0.35]}>
          <planeGeometry args={[WINDOW_SPOT.width + 1.6, WINDOW_SPOT.height + 1.6]} />
          <meshBasicMaterial color="#0e1a33" />
        </mesh>
        <sprite position={[0.15, 0.32, -0.3]} scale={[1.15, 1.15, 1]}>
          <spriteMaterial map={moonTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <mesh position={[0, 0, 0.02]} material={materials.frame}>
          <boxGeometry args={[0.06, WINDOW_SPOT.height, 0.07]} />
        </mesh>
        <mesh position={[0, 0.05, 0.02]} material={materials.frame}>
          <boxGeometry args={[WINDOW_SPOT.width, 0.06, 0.07]} />
        </mesh>
        <pointLight position={[0, 0.1, 0.55]} color="#9fb6e8" intensity={3.2} distance={6.5} decay={1.6} />
      </group>
      <group position={shaft.mid} quaternion={shaft.quaternion}>
        {[0, Math.PI / 2].map(rotation => (
          <mesh key={rotation} rotation={[0, rotation, 0]}>
            <planeGeometry args={[1.15, shaft.length]} />
            <meshBasicMaterial
              map={shaft.texture}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* the reading table */}
      <group position={TABLE.position}>
        <mesh position={[0, TABLE.topY - 0.045, 0]} material={materials.wood}>
          <cylinderGeometry args={[TABLE.radius, TABLE.radius, 0.07, 18]} />
        </mesh>
        <mesh position={[0, TABLE.topY - 0.002, 0]} material={materials.cloth}>
          <cylinderGeometry args={[TABLE.radius - 0.06, TABLE.radius - 0.06, 0.015, 18]} />
        </mesh>
        <mesh position={[0, (TABLE.topY - 0.08) / 2, 0]} material={materials.wood}>
          <cylinderGeometry args={[0.11, 0.16, TABLE.topY - 0.08, 10]} />
        </mesh>
        <mesh position={[0, 0.035, 0]} material={materials.wood}>
          <cylinderGeometry args={[0.42, 0.46, 0.07, 12]} />
        </mesh>
        {/* face-down spread waiting on the cloth */}
        {[-0.36, 0, 0.36].map((x, i) => (
          <mesh
            key={i}
            position={[x, TABLE.topY + 0.008, -0.18]}
            rotation={[0, [0.12, -0.05, 0.18][i], 0]}
            material={materials.card}
          >
            <boxGeometry args={[0.24, 0.008, 0.38]} />
          </mesh>
        ))}
      </group>

      {/* the chair the run begins and ends in */}
      <group position={CHAIR.position} rotation={[0, CHAIR.facing, 0]}>
        <mesh position={[0, 0.47, 0]} material={materials.wood}>
          <boxGeometry args={[0.48, 0.06, 0.46]} />
        </mesh>
        <mesh position={[0, 0.82, -0.21]} material={materials.wood}>
          <boxGeometry args={[0.48, 0.78, 0.06]} />
        </mesh>
        {[
          [-0.2, -0.19],
          [0.2, -0.19],
          [-0.2, 0.19],
          [0.2, 0.19],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.22, z]} material={materials.wood}>
            <boxGeometry args={[0.06, 0.44, 0.06]} />
          </mesh>
        ))}
      </group>

      {/* rug under the table */}
      <mesh position={[0, 0.006, 0.6]} rotation={[-Math.PI / 2, 0, 0]} material={materials.rug}>
        <circleGeometry args={[1.7, 24]} />
      </mesh>

      {/* clutter: crates, trunk, and the crate the deck box sits on */}
      <group position={[-2.95, 0, -1.85]}>
        <mesh position={[0, 0.35, 0]} rotation={[0, 0.2, 0]} material={materials.crate}>
          <boxGeometry args={[0.85, 0.7, 0.85]} />
        </mesh>
        <mesh position={[0.12, 0.98, -0.08]} rotation={[0, -0.35, 0]} material={materials.crate}>
          <boxGeometry args={[0.62, 0.55, 0.62]} />
        </mesh>
      </group>
      <group position={[2.85, 0, -1.95]} rotation={[0, -0.28, 0]}>
        <mesh position={[0, 0.3, 0]} material={materials.trunk}>
          <boxGeometry args={[1.15, 0.6, 0.65]} />
        </mesh>
        <mesh position={[0, 0.62, 0]} material={materials.trunk}>
          <boxGeometry args={[1.15, 0.12, 0.65]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={materials.brass}>
          <boxGeometry args={[0.08, 0.72, 0.7]} />
        </mesh>
      </group>
      <mesh
        position={[DECK_SPOT.position[0], 0.32, DECK_SPOT.position[2]]}
        rotation={[0, 0.45, 0]}
        material={materials.crate}
      >
        <boxGeometry args={[0.7, 0.64, 0.7]} />
      </mesh>
    </group>
  );
}
