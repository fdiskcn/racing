import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { LevelDef, ObstacleDef } from '../levels/levelDefs';
import type { PhysicsWorld } from './PhysicsWorld';

export interface MovingObstacle {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  baseX: number;
  amp: number;
  speed: number;
  phase: number;
}

export interface TrackData {
  group: THREE.Group;
  path: THREE.Vector3[];
  cumulative: number[];
  totalLength: number;
  halfWidth: number;
  startPositions: THREE.Vector3[];
  finishPosition: THREE.Vector3;
  finishNormal: THREE.Vector3;
  bodies: CANNON.Body[];
  moving: MovingObstacle[];
  lowestY: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function catmullPoint(points: THREE.Vector3[], t: number): THREE.Vector3 {
  const n = points.length;
  const maxIndex = n - 1;
  const scaled = t * maxIndex;
  const i = Math.floor(scaled);
  const localT = scaled - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(maxIndex, i + 1)];
  const p3 = points[Math.min(maxIndex, i + 2)];
  return new THREE.Vector3(
    catmullRom(p0.x, p1.x, p2.x, p3.x, localT),
    catmullRom(p0.y, p1.y, p2.y, p3.y, localT),
    catmullRom(p0.z, p1.z, p2.z, p3.z, localT),
  );
}

export class TrackBuilder {
  build(level: LevelDef, physics: PhysicsWorld): TrackData {
    const group = new THREE.Group();
    const raw = level.path.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const samples = 80;
    const path: THREE.Vector3[] = [];
    for (let i = 0; i <= samples; i++) {
      path.push(catmullPoint(raw, i / samples));
    }

    const cumulative: number[] = [0];
    let totalLength = 0;
    for (let i = 1; i < path.length; i++) {
      totalLength += path[i].distanceTo(path[i - 1]);
      cumulative.push(totalLength);
    }

    const bodies: CANNON.Body[] = [];
    const moving: MovingObstacle[] = [];
    const halfWidth = level.halfWidth;
    const railHeight = 0.85;
    const thickness = 0.35;

    const roadMat = new THREE.MeshStandardMaterial({
      color: level.theme === 'canyon' ? 0x9a6b45 : level.theme === 'storm' ? 0x6a6f68 : 0x8b7355,
      roughness: 0.88,
      metalness: 0.05,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x5c6b52,
      roughness: 0.8,
      metalness: 0.08,
    });

    let lowestY = Infinity;

    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 1e-4) continue;
      dir.normalize();

      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = -Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));

      // Road slab
      const roadW = halfWidth * 2;
      const roadGeo = new THREE.BoxGeometry(roadW, thickness, len + 0.15);
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.copy(mid);
      roadMesh.rotation.order = 'YXZ';
      roadMesh.rotation.y = yaw;
      roadMesh.rotation.x = pitch;
      roadMesh.castShadow = true;
      roadMesh.receiveShadow = true;
      group.add(roadMesh);

      const roadBody = new CANNON.Body({
        mass: 0,
        material: physics.groundMaterial,
        shape: new CANNON.Box(new CANNON.Vec3(roadW / 2, thickness / 2, (len + 0.15) / 2)),
      });
      roadBody.position.set(mid.x, mid.y, mid.z);
      roadBody.quaternion.setFromEuler(pitch, yaw, 0, 'YXZ');
      physics.addBody(roadBody);
      bodies.push(roadBody);

      // Side rails
      for (const side of [-1, 1]) {
        const offset = new THREE.Vector3(side * (halfWidth + 0.2), railHeight / 2, 0);
        offset.applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        const railPos = mid.clone().add(offset);
        const railGeo = new THREE.BoxGeometry(0.35, railHeight, len + 0.15);
        const railMesh = new THREE.Mesh(railGeo, railMat);
        railMesh.position.copy(railPos);
        railMesh.rotation.order = 'YXZ';
        railMesh.rotation.y = yaw;
        railMesh.rotation.x = pitch;
        railMesh.castShadow = true;
        railMesh.receiveShadow = true;
        group.add(railMesh);

        const railBody = new CANNON.Body({
          mass: 0,
          material: physics.groundMaterial,
          shape: new CANNON.Box(new CANNON.Vec3(0.175, railHeight / 2, (len + 0.15) / 2)),
        });
        railBody.position.set(railPos.x, railPos.y, railPos.z);
        railBody.quaternion.setFromEuler(pitch, yaw, 0, 'YXZ');
        physics.addBody(railBody);
        bodies.push(railBody);
      }

      lowestY = Math.min(lowestY, a.y, b.y);
    }

    // Start podium markings
    const start = path[0].clone();
    const startDir = new THREE.Vector3().subVectors(path[1], path[0]).normalize();
    const startRight = new THREE.Vector3().crossVectors(startDir, new THREE.Vector3(0, 1, 0)).normalize();
    const startPositions: THREE.Vector3[] = [];
    const laneCount = 1 + level.aiCount;
    for (let i = 0; i < laneCount; i++) {
      const lane = i - (laneCount - 1) / 2;
      const pos = start
        .clone()
        .addScaledVector(startRight, lane * Math.min(1.3, halfWidth * 0.45))
        .addScaledVector(startDir, -1.2);
      pos.y += 0.7;
      startPositions.push(pos);
    }

    const finishPosition = path[path.length - 1].clone();
    const finishNormal = new THREE.Vector3()
      .subVectors(path[path.length - 1], path[path.length - 2])
      .normalize();

    // Finish arch
    const archMat = new THREE.MeshStandardMaterial({
      color: 0xffd76a,
      emissive: 0x664400,
      roughness: 0.45,
      metalness: 0.3,
    });
    const postGeo = new THREE.BoxGeometry(0.35, 3.2, 0.35);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, archMat);
      const right = new THREE.Vector3().crossVectors(finishNormal, new THREE.Vector3(0, 1, 0)).normalize();
      post.position.copy(finishPosition).addScaledVector(right, side * halfWidth).add(new THREE.Vector3(0, 1.5, 0));
      post.castShadow = true;
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 0.7, 0.3, 0.35), archMat);
    beam.position.copy(finishPosition).add(new THREE.Vector3(0, 3.1, 0));
    group.add(beam);

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(halfWidth * 2, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x7dffa3,
        emissive: 0x145c30,
        side: THREE.DoubleSide,
      }),
    );
    banner.position.copy(finishPosition).add(new THREE.Vector3(0, 2.5, 0));
    banner.lookAt(finishPosition.clone().add(finishNormal));
    group.add(banner);

    for (const obs of level.obstacles) {
      this.addObstacle(obs, group, physics, bodies, moving);
    }

    // Gaps for canyon: remove nothing physically but lower terrain already handled;
    // ensure jump ramps by leaving segments discontinuous in path design.

    return {
      group,
      path,
      cumulative,
      totalLength,
      halfWidth,
      startPositions,
      finishPosition,
      finishNormal,
      bodies,
      moving,
      lowestY: lowestY - 8,
    };
  }

  private addObstacle(
    obs: ObstacleDef,
    group: THREE.Group,
    physics: PhysicsWorld,
    bodies: CANNON.Body[],
    moving: MovingObstacle[],
  ): void {
    const scale = obs.scale ?? { x: 1, y: 1, z: 1 };
    if (obs.type === 'rock') {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({
          color: 0x6d655c,
          roughness: 0.95,
          flatShading: true,
        }),
      );
      mesh.scale.set(scale.x, scale.y, scale.z);
      mesh.position.set(obs.position.x, obs.position.y, obs.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const body = new CANNON.Body({
        mass: 0,
        material: physics.groundMaterial,
        shape: new CANNON.Sphere(Math.max(scale.x, scale.y, scale.z) * 0.75),
      });
      body.position.set(obs.position.x, obs.position.y, obs.position.z);
      physics.addBody(body);
      bodies.push(body);
      return;
    }

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(scale.x, scale.y, scale.z),
      new THREE.MeshStandardMaterial({
        color: 0xc45c48,
        roughness: 0.55,
        metalness: 0.25,
        emissive: 0x3a120c,
      }),
    );
    mesh.position.set(obs.position.x, obs.position.y, obs.position.z);
    mesh.castShadow = true;
    group.add(mesh);

    const body = new CANNON.Body({
      mass: 0,
      material: physics.groundMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(scale.x / 2, scale.y / 2, scale.z / 2)),
    });
    body.position.set(obs.position.x, obs.position.y, obs.position.z);
    physics.addBody(body);
    bodies.push(body);

    moving.push({
      mesh,
      body,
      baseX: obs.position.x,
      amp: obs.moveAmp ?? 2,
      speed: obs.moveSpeed ?? 1.5,
      phase: Math.random() * Math.PI * 2,
    });
  }

  updateMoving(moving: MovingObstacle[], time: number): void {
    for (const m of moving) {
      const x = m.baseX + Math.sin(time * m.speed + m.phase) * m.amp;
      m.mesh.position.x = x;
      m.body.position.x = x;
      m.body.velocity.set(0, 0, 0);
    }
  }

  progressAlongTrack(track: TrackData, position: THREE.Vector3): number {
    let bestDist = Infinity;
    let bestProgress = 0;
    for (let i = 0; i < track.path.length - 1; i++) {
      const a = track.path[i];
      const b = track.path[i + 1];
      const ab = new THREE.Vector3().subVectors(b, a);
      const lenSq = ab.lengthSq();
      if (lenSq < 1e-8) continue;
      const t = THREE.MathUtils.clamp(
        new THREE.Vector3().subVectors(position, a).dot(ab) / lenSq,
        0,
        1,
      );
      const closest = a.clone().addScaledVector(ab, t);
      const d = closest.distanceToSquared(position);
      if (d < bestDist) {
        bestDist = d;
        const segLen = track.cumulative[i + 1] - track.cumulative[i];
        bestProgress = (track.cumulative[i] + segLen * t) / track.totalLength;
      }
    }
    return bestProgress;
  }

  dispose(track: TrackData, physics: PhysicsWorld): void {
    for (const body of track.bodies) {
      physics.removeBody(body);
    }
    track.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    track.group.removeFromParent();
  }
}
