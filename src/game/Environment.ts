import * as THREE from 'three';
import type { LevelDef, ThemeId } from '../levels/levelDefs';
import { seededRandom } from '../utils/math';

interface ThemePalette {
  skyTop: number;
  skyBottom: number;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  grass: number;
  grassDark: number;
}

const THEMES: Record<ThemeId, ThemePalette> = {
  meadow: {
    skyTop: 0x87c8ff,
    skyBottom: 0xdff4ff,
    fog: 0xc8e6ff,
    hemiSky: 0xb7d9ff,
    hemiGround: 0x6a8f4a,
    sun: 0xfff2d0,
    grass: 0x5f9a45,
    grassDark: 0x3f6d2e,
  },
  forest: {
    skyTop: 0x6aa8d8,
    skyBottom: 0xc7e2c8,
    fog: 0xa8c9b0,
    hemiSky: 0x9ec4d8,
    hemiGround: 0x3d5c32,
    sun: 0xffe8b8,
    grass: 0x3f7040,
    grassDark: 0x2a4a2b,
  },
  mountain: {
    skyTop: 0x7eb0d8,
    skyBottom: 0xe8eef5,
    fog: 0xd0dbe8,
    hemiSky: 0xc2d4e8,
    hemiGround: 0x6b6a5a,
    sun: 0xfff5e0,
    grass: 0x6d7a4e,
    grassDark: 0x4a5340,
  },
  canyon: {
    skyTop: 0xffb36b,
    skyBottom: 0xffe0b0,
    fog: 0xedc89a,
    hemiSky: 0xffd1a0,
    hemiGround: 0x8a5a3a,
    sun: 0xffd9a0,
    grass: 0xa67c52,
    grassDark: 0x6e4a2e,
  },
  storm: {
    skyTop: 0x3d4f66,
    skyBottom: 0x8a97a8,
    fog: 0x6b7788,
    hemiSky: 0x8ea0b8,
    hemiGround: 0x4a4f45,
    sun: 0xcfd8e6,
    grass: 0x4f5a42,
    grassDark: 0x333a2d,
  },
};

function createSkyMaterial(top: number, bottom: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(top) },
      bottomColor: { value: new THREE.Color(bottom) },
      offset: { value: 0.15 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
}

export class Environment {
  readonly group = new THREE.Group();
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private sky!: THREE.Mesh;
  private ground!: THREE.Mesh;
  private decor = new THREE.Group();

  constructor(private readonly scene: THREE.Scene) {
    this.scene.add(this.group);
    this.group.add(this.decor);
  }

  build(level: LevelDef, pathPoints: THREE.Vector3[]): void {
    this.clear();
    const palette = THEMES[level.theme];

    this.scene.fog = new THREE.FogExp2(palette.fog, level.fogDensity);
    this.scene.background = new THREE.Color(palette.fog);

    this.hemi = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, 0.75);
    this.group.add(this.hemi);

    this.sun = new THREE.DirectionalLight(palette.sun, level.sunIntensity);
    this.sun.position.set(40, 70, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.bias = -0.0002;
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    const skyGeo = new THREE.SphereGeometry(280, 32, 16);
    this.sky = new THREE.Mesh(skyGeo, createSkyMaterial(palette.skyTop, palette.skyBottom));
    this.group.add(this.sky);

    this.ground = this.createTerrain(palette, level.theme, pathPoints);
    this.group.add(this.ground);

    this.populateDecor(level, palette, pathPoints);
  }

  private createTerrain(
    palette: ThemePalette,
    theme: ThemeId,
    pathPoints: THREE.Vector3[],
  ): THREE.Mesh {
    const size = 320;
    const segments = 96;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(palette.grass);
    const c2 = new THREE.Color(palette.grassDark);
    const tmp = new THREE.Color();
    const center = pathPoints[Math.floor(pathPoints.length / 2)] ?? new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x - center.x, z - center.z);
      let h =
        Math.sin(x * 0.035) * Math.cos(z * 0.03) * 1.8 +
        Math.sin(x * 0.01 + z * 0.012) * 3.5;

      if (theme === 'mountain' || theme === 'storm') {
        h += Math.abs(Math.sin(x * 0.02) * Math.cos(z * 0.018)) * 8;
      }
      if (theme === 'canyon') {
        h -= Math.exp(-((x - center.x) ** 2) / 900) * 4;
      }

      // Carve a soft valley near the track so the road sits naturally.
      let minTrack = Infinity;
      for (const p of pathPoints) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < minTrack) minTrack = d;
      }
      if (minTrack < 18) {
        const t = 1 - minTrack / 18;
        h = h * (1 - t * 0.85) + (pathPoints[0]?.y ?? 0) * t * 0.2 - t * 0.4;
      }

      pos.setY(i, h - 1.2);
      tmp.copy(c1).lerp(c2, (Math.sin(x * 0.2) + Math.cos(z * 0.17) + 2) / 4);
      if (dist > 90) tmp.multiplyScalar(0.85);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private populateDecor(level: LevelDef, palette: ThemePalette, pathPoints: THREE.Vector3[]): void {
    const rand = seededRandom(level.id * 9973 + 42);
    const treeCount = level.theme === 'forest' ? 220 : level.theme === 'meadow' ? 70 : 110;
    const rockCount = level.theme === 'mountain' || level.theme === 'storm' ? 90 : 40;

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6);
    const leafGeo = new THREE.ConeGeometry(1.1, 2.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: level.theme === 'storm' ? 0x3f5a38 : 0x2f7a3a,
      roughness: 0.85,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeCount);
    trunks.castShadow = true;
    leaves.castShadow = true;
    leaves.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;
    while (placed < treeCount && attempts < treeCount * 20) {
      attempts++;
      const idx = Math.floor(rand() * pathPoints.length);
      const base = pathPoints[idx];
      const side = rand() < 0.5 ? -1 : 1;
      const dist = 8 + rand() * 55;
      const x = base.x + side * dist * (0.6 + rand());
      const z = base.z + (rand() - 0.5) * 30;
      if (this.tooCloseToPath(x, z, pathPoints, level.halfWidth + 3.5)) continue;

      const scale = 0.8 + rand() * 1.4;
      dummy.position.set(x, base.y + scale * 0.5, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      dummy.position.y = base.y + scale * 2.0;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      leaves.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    trunks.count = placed;
    leaves.count = placed;
    this.decor.add(trunks, leaves);

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: palette.grassDark,
      roughness: 0.95,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    placed = 0;
    attempts = 0;
    while (placed < rockCount && attempts < rockCount * 20) {
      attempts++;
      const idx = Math.floor(rand() * pathPoints.length);
      const base = pathPoints[idx];
      const side = rand() < 0.5 ? -1 : 1;
      const dist = 6 + rand() * 40;
      const x = base.x + side * dist;
      const z = base.z + (rand() - 0.5) * 24;
      if (this.tooCloseToPath(x, z, pathPoints, level.halfWidth + 2.2)) continue;
      const scale = 0.5 + rand() * 1.8;
      dummy.position.set(x, base.y + scale * 0.35, z);
      dummy.rotation.set(rand() * 1.2, rand() * Math.PI * 2, rand() * 1.2);
      dummy.scale.set(scale, scale * (0.7 + rand() * 0.6), scale);
      dummy.updateMatrix();
      rocks.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    rocks.count = placed;
    this.decor.add(rocks);
  }

  private tooCloseToPath(
    x: number,
    z: number,
    pathPoints: THREE.Vector3[],
    minDist: number,
  ): boolean {
    for (const p of pathPoints) {
      if (Math.hypot(x - p.x, z - p.z) < minDist) return true;
    }
    return false;
  }

  updateFollow(target: THREE.Vector3): void {
    if (this.sun) {
      this.sun.position.set(target.x + 40, target.y + 70, target.z + 20);
      this.sun.target.position.copy(target);
      this.sun.target.updateMatrixWorld();
    }
    if (this.sky) {
      this.sky.position.copy(target);
    }
  }

  clear(): void {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      if (!child) break;
      this.disposeObject(child);
    }
    this.decor = new THREE.Group();
    this.group.add(this.decor);
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  }
}
