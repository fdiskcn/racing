import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { MarbleActor } from './MarbleController';
import type { TrackData } from './TrackBuilder';
import { clamp } from '../utils/math';

export class AIController {
  private targetIndex = 1;

  constructor(
    readonly actor: MarbleActor,
    private readonly track: TrackData,
    private readonly maxSpeed: number,
  ) {}

  update(dt: number): void {
    if (this.actor.finished) return;

    const pos = this.actor.body.position;
    const path = this.track.path;

    // Advance target waypoint when close.
    while (this.targetIndex < path.length - 1) {
      const target = path[this.targetIndex];
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      if (dx * dx + dz * dz < 4.5) this.targetIndex++;
      else break;
    }

    const lookAhead = Math.min(path.length - 1, this.targetIndex + 2);
    const target = path[lookAhead];
    const wish = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
    if (wish.lengthSq() > 1e-6) wish.normalize();

    // Slight centering toward path to reduce wall hits.
    const nearest = this.nearestPoint(pos);
    const centerPull = new THREE.Vector3(nearest.x - pos.x, 0, nearest.z - pos.z);
    if (centerPull.lengthSq() > 1e-6) {
      centerPull.normalize().multiplyScalar(0.35);
      wish.add(centerPull);
      if (wish.lengthSq() > 1e-6) wish.normalize();
    }

    const accel = 34 + this.maxSpeed * 0.4;
    this.actor.body.applyForce(
      new CANNON.Vec3(wish.x * accel, 0, wish.z * accel),
      this.actor.body.position,
    );

    // Jump if stuck against a taller obstacle (simple heuristic).
    const speed = Math.hypot(this.actor.body.velocity.x, this.actor.body.velocity.z);
    if (speed < 2.2 && Math.abs(this.actor.body.velocity.y) < 0.2) {
      this.actor.body.velocity.y = 7.5;
    }

    const vel = this.actor.body.velocity;
    const horizontal = Math.hypot(vel.x, vel.z);
    const cap = this.maxSpeed * (0.9 + Math.sin(performance.now() * 0.001 + this.targetIndex) * 0.05);
    if (horizontal > cap) {
      const scale = cap / horizontal;
      vel.x *= scale;
      vel.z *= scale;
    }

    // Mild steering damping
    vel.x *= 1 - clamp(dt * 0.15, 0, 0.2);
    vel.z *= 1 - clamp(dt * 0.15, 0, 0.2);
  }

  private nearestPoint(pos: CANNON.Vec3): THREE.Vector3 {
    let best = this.track.path[0];
    let bestD = Infinity;
    for (const p of this.track.path) {
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  syncMesh(): void {
    this.actor.mesh.position.set(
      this.actor.body.position.x,
      this.actor.body.position.y,
      this.actor.body.position.z,
    );
    this.actor.mesh.quaternion.set(
      this.actor.body.quaternion.x,
      this.actor.body.quaternion.y,
      this.actor.body.quaternion.z,
      this.actor.body.quaternion.w,
    );
  }
}
