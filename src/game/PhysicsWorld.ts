import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  readonly world: CANNON.World;
  readonly groundMaterial: CANNON.Material;
  readonly marbleMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    (this.world.solver as CANNON.GSSolver).iterations = 12;

    this.groundMaterial = new CANNON.Material('ground');
    this.marbleMaterial = new CANNON.Material('marble');

    const contact = new CANNON.ContactMaterial(this.groundMaterial, this.marbleMaterial, {
      friction: 0.55,
      restitution: 0.18,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(contact);

    const marbleContact = new CANNON.ContactMaterial(this.marbleMaterial, this.marbleMaterial, {
      friction: 0.2,
      restitution: 0.4,
    });
    this.world.addContactMaterial(marbleContact);
  }

  step(dt: number): void {
    const clamped = Math.min(dt, 1 / 30);
    this.world.step(1 / 60, clamped, 4);
  }

  addBody(body: CANNON.Body): void {
    this.world.addBody(body);
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }

  clear(): void {
    const bodies = [...this.world.bodies];
    for (const body of bodies) {
      this.world.removeBody(body);
    }
  }
}
