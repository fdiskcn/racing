import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { PhysicsWorld } from './PhysicsWorld';
import { clamp } from '../utils/math';

export interface MarbleActor {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  isPlayer: boolean;
  finished: boolean;
  finishTime: number;
  name: string;
  color: number;
}

export class InputState {
  forward = false;
  back = false;
  left = false;
  right = false;
  jump = false;

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.forward = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.back = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = true;
    if (e.code === 'Space') {
      this.jump = true;
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.forward = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.back = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.right = false;
    if (e.code === 'Space') this.jump = false;
  };
}

const RADIUS = 0.45;

export class MarbleFactory {
  static create(
    physics: PhysicsWorld,
    position: THREE.Vector3,
    color: number,
    name: string,
    isPlayer: boolean,
  ): MarbleActor {
    const geo = new THREE.SphereGeometry(RADIUS, 32, 24);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.15,
      metalness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      transmission: isPlayer ? 0.15 : 0,
      thickness: 0.4,
      reflectivity: 0.7,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);

    const body = new CANNON.Body({
      mass: 1.2,
      material: physics.marbleMaterial,
      linearDamping: 0.12,
      angularDamping: 0.25,
      shape: new CANNON.Sphere(RADIUS),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      allowSleep: false,
    });
    physics.addBody(body);

    return {
      mesh,
      body,
      isPlayer,
      finished: false,
      finishTime: 0,
      name,
      color,
    };
  }
}

export class MarbleController {
  private jumpCooldown = 0;
  readonly input = new InputState();

  constructor(
    private readonly actor: MarbleActor,
    private readonly physics: PhysicsWorld,
  ) {}

  attachInput(): void {
    this.input.attach();
  }

  detachInput(): void {
    this.input.detach();
  }

  private isGrounded(): boolean {
    const from = this.actor.body.position;
    const to = new CANNON.Vec3(from.x, from.y - RADIUS - 0.12, from.z);
    const result = new CANNON.RaycastResult();
    const ray = new CANNON.Ray(from, to);
    ray.mode = CANNON.Ray.CLOSEST;
    ray.intersectWorld(this.physics.world, {
      skipBackfaces: true,
      result,
      collisionFilterMask: -1,
    });
    return result.hasHit;
  }

  update(dt: number, forward: THREE.Vector3, jumpEnabled: boolean, maxSpeed = 18): void {
    if (this.actor.finished) return;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const wish = new THREE.Vector3();
    if (this.input.forward) wish.add(forward);
    if (this.input.back) wish.sub(forward);
    if (this.input.left) wish.sub(right);
    if (this.input.right) wish.add(right);
    wish.y = 0;
    if (wish.lengthSq() > 1e-6) wish.normalize();

    const grounded = this.isGrounded();
    const accel = grounded ? 36 : 10;
    this.actor.body.applyForce(
      new CANNON.Vec3(wish.x * accel, 0, wish.z * accel),
      this.actor.body.position,
    );

    if (jumpEnabled && this.input.jump && grounded && this.jumpCooldown <= 0) {
      this.actor.body.velocity.y = 8.5;
      this.jumpCooldown = 0.55;
      this.input.jump = false;
    }

    const vel = this.actor.body.velocity;
    const horizontal = Math.hypot(vel.x, vel.z);
    if (horizontal > maxSpeed) {
      const scale = maxSpeed / horizontal;
      vel.x *= scale;
      vel.z *= scale;
    }

    // Soft brake when no input on ground
    if (grounded && wish.lengthSq() < 1e-6) {
      vel.x *= 1 - clamp(dt * 1.8, 0, 0.5);
      vel.z *= 1 - clamp(dt * 1.8, 0, 0.5);
    }
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
