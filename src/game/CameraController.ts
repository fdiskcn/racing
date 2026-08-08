import * as THREE from 'three';
import { damp } from '../utils/math';

export class CameraController {
  private readonly desiredPos = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, -1);
  private readonly smoothedForward = new THREE.Vector3(0, 0, -1);
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  reset(): void {
    this.initialized = false;
  }

  update(
    dt: number,
    marblePos: THREE.Vector3,
    velocity: THREE.Vector3,
    fallbackForward: THREE.Vector3,
  ): void {
    const speed = velocity.length();
    if (speed > 1.2) {
      this.forward.set(velocity.x, 0, velocity.z);
      if (this.forward.lengthSq() > 1e-5) this.forward.normalize();
      else this.forward.copy(fallbackForward);
    } else {
      this.forward.copy(fallbackForward);
      this.forward.y = 0;
      if (this.forward.lengthSq() < 1e-5) this.forward.set(0, 0, -1);
      else this.forward.normalize();
    }

    this.smoothedForward.x = damp(this.smoothedForward.x, this.forward.x, 8, dt);
    this.smoothedForward.y = 0;
    this.smoothedForward.z = damp(this.smoothedForward.z, this.forward.z, 8, dt);
    if (this.smoothedForward.lengthSq() > 1e-6) this.smoothedForward.normalize();

    // First-person-ish: sit on the marble looking ahead.
    this.desiredPos
      .copy(marblePos)
      .addScaledVector(this.smoothedForward, -0.05)
      .add(new THREE.Vector3(0, 0.42, 0));

    this.lookAt
      .copy(marblePos)
      .addScaledVector(this.smoothedForward, 8)
      .add(new THREE.Vector3(0, 0.15, 0));

    if (!this.initialized) {
      this.camera.position.copy(this.desiredPos);
      this.camera.lookAt(this.lookAt);
      this.initialized = true;
      return;
    }

    this.camera.position.x = damp(this.camera.position.x, this.desiredPos.x, 14, dt);
    this.camera.position.y = damp(this.camera.position.y, this.desiredPos.y, 14, dt);
    this.camera.position.z = damp(this.camera.position.z, this.desiredPos.z, 14, dt);
    this.camera.lookAt(this.lookAt);
  }

  getForward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.smoothedForward);
  }
}
