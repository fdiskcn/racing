import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Environment } from './Environment';
import { PhysicsWorld } from './PhysicsWorld';
import { TrackBuilder, type TrackData } from './TrackBuilder';
import { CameraController } from './CameraController';
import { MarbleController, MarbleFactory, type MarbleActor } from './MarbleController';
import { AIController } from './AIController';
import { HUD } from './HUD';
import { Menu, type ResultPayload } from '../ui/Menu';
import { getLevel, computeStars, type LevelDef } from '../levels/levelDefs';
import { unlockNextLevel, recordBestTime } from '../utils/storage';

type Phase = 'menu' | 'countdown' | 'racing' | 'paused' | 'result';

const AI_COLORS = [0xff6b6b, 0x6bc5ff, 0xffb86b, 0xd28bff];
const AI_NAMES = ['赤焰', '青羽', '金砂', '紫电'];

export class GameApp {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly physics = new PhysicsWorld();
  private readonly environment: Environment;
  private readonly trackBuilder = new TrackBuilder();
  private readonly cameraController: CameraController;
  private readonly hud: HUD;
  private readonly menu: Menu;

  private phase: Phase = 'menu';
  private level: LevelDef | null = null;
  private track: TrackData | null = null;
  private player: MarbleActor | null = null;
  private playerController: MarbleController | null = null;
  private ais: AIController[] = [];
  private actors: MarbleActor[] = [];
  private raceTime = 0;
  private countdown = 3;
  private windPhase = 0;
  private lastTs = 0;
  private readonly tmpVel = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3(0, 0, -1);

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
    this.cameraController = new CameraController(this.camera);
    this.environment = new Environment(this.scene);

    this.hud = new HUD(uiRoot);
    this.menu = new Menu(uiRoot);
    this.menu.onStartLevel = (id) => this.startLevel(id);
    this.menu.onResume = () => this.resume();
    this.menu.onExitToMenu = () => this.exitToMenu();
    this.menu.onRetry = () => {
      if (this.level) this.startLevel(this.level.id);
    };
    this.menu.onNext = () => {
      if (this.level && this.level.id < 5) this.startLevel(this.level.id + 1);
    };

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onGlobalKey);
  }

  start(): void {
    this.menu.showMain();
    this.lastTs = performance.now();
    this.tick();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onGlobalKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      if (this.phase === 'racing' || this.phase === 'countdown') this.pause();
      else if (this.phase === 'paused') this.resume();
    }
  };

  private clearLevel(): void {
    if (this.playerController) {
      this.playerController.detachInput();
      this.playerController = null;
    }
    for (const actor of this.actors) {
      this.physics.removeBody(actor.body);
      actor.mesh.removeFromParent();
      actor.mesh.geometry.dispose();
      const mat = actor.mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    this.actors = [];
    this.ais = [];
    this.player = null;
    if (this.track) {
      this.trackBuilder.dispose(this.track, this.physics);
      this.track = null;
    }
    this.environment.clear();
  }

  private startLevel(levelId: number): void {
    this.clearLevel();
    this.level = getLevel(levelId);
    this.track = this.trackBuilder.build(this.level, this.physics);
    this.scene.add(this.track.group);
    this.environment.build(this.level, this.track.path);

    const starts = this.track.startPositions;
    this.player = MarbleFactory.create(
      this.physics,
      starts[0],
      0x7dffa3,
      '你',
      true,
    );
    this.scene.add(this.player.mesh);
    this.actors.push(this.player);
    this.playerController = new MarbleController(this.player, this.physics);
    this.playerController.attachInput();

    for (let i = 0; i < this.level.aiCount; i++) {
      const start = starts[Math.min(i + 1, starts.length - 1)].clone();
      start.y += 0.05 * i;
      const aiActor = MarbleFactory.create(
        this.physics,
        start,
        AI_COLORS[i % AI_COLORS.length],
        AI_NAMES[i % AI_NAMES.length],
        false,
      );
      this.scene.add(aiActor.mesh);
      this.actors.push(aiActor);
      this.ais.push(new AIController(aiActor, this.track, this.level.aiSpeed));
    }

    this.raceTime = 0;
    this.countdown = 3;
    this.windPhase = 0;
    this.cameraController.reset();
    this.phase = 'countdown';
    this.menu.hide();
    this.hud.show();
    this.hud.setLevel(`第 ${this.level.id} 关 · ${this.level.name}`);
    this.hud.setHint(this.level.hint);
    this.hud.setCenter('3');

    // Place camera immediately
    const vel = new THREE.Vector3();
    const fwd = new THREE.Vector3()
      .subVectors(this.track.path[1], this.track.path[0])
      .setY(0)
      .normalize();
    this.cameraController.update(1, this.player.mesh.position, vel, fwd);
  }

  private pause(): void {
    if (this.phase !== 'racing' && this.phase !== 'countdown') return;
    this.phase = 'paused';
    this.menu.showPause();
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = this.countdown > 0 ? 'countdown' : 'racing';
    this.menu.hide();
    this.lastTs = performance.now();
  }

  private exitToMenu(): void {
    this.clearLevel();
    this.phase = 'menu';
    this.hud.hide();
    this.menu.showMain();
  }

  private finishRace(win: boolean, reason?: string): void {
    if (!this.level || !this.player || this.phase === 'result') return;
    this.phase = 'result';

    const rankings = [...this.actors].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return 0;
    });
    // Fill unfinished by progress
    if (!win) {
      rankings.sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        const pa = this.track ? this.trackBuilder.progressAlongTrack(this.track, a.mesh.position) : 0;
        const pb = this.track ? this.trackBuilder.progressAlongTrack(this.track, b.mesh.position) : 0;
        return pb - pa;
      });
    }

    const rank = rankings.findIndex((a) => a === this.player) + 1;
    const stars = win ? computeStars(this.level, this.raceTime) : 0;
    if (win) {
      unlockNextLevel(this.level.id);
      recordBestTime(this.level.id, this.raceTime);
    }

    const payload: ResultPayload = {
      win,
      level: this.level,
      time: this.raceTime,
      rank,
      total: this.actors.length,
      stars,
      reason,
    };
    this.hud.setCenter(win ? '冲线！' : '失败');
    this.menu.showResult(payload);
  }

  private checkFinish(actor: MarbleActor): void {
    if (!this.track || actor.finished) return;
    const toFinish = new THREE.Vector3(
      actor.body.position.x - this.track.finishPosition.x,
      actor.body.position.y - this.track.finishPosition.y,
      actor.body.position.z - this.track.finishPosition.z,
    );
    const along = toFinish.dot(this.track.finishNormal);
    const lateral = toFinish.clone().addScaledVector(this.track.finishNormal, -along);
    if (along > -0.6 && along < 2.5 && lateral.length() < this.track.halfWidth + 1.2) {
      actor.finished = true;
      actor.finishTime = this.raceTime;
      actor.body.velocity.scale(0.2, actor.body.velocity);
      if (actor.isPlayer) this.finishRace(true);
    }
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const now = performance.now();
    const dt = Math.min((now - this.lastTs) / 1000, 0.05);
    this.lastTs = now;

    if (this.phase === 'menu') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'result') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.level || !this.track || !this.player || !this.playerController) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      this.hud.setCenter(n > 0 ? String(n) : '开始！');
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.hud.setCenter(null);
      }
      // Still sync camera while frozen
      this.syncAllMeshes();
      this.updateCamera(dt);
      this.environment.updateFollow(this.player.mesh.position);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // racing
    this.raceTime += dt;
    this.windPhase += dt;

    const fallback = this.tmpForward
      .subVectors(this.track.path[1], this.track.path[0])
      .setY(0)
      .normalize();
    // Better fallback: track tangent near player
    const progress = this.trackBuilder.progressAlongTrack(this.track, this.player.mesh.position);
    const idx = Math.min(
      this.track.path.length - 2,
      Math.floor(progress * (this.track.path.length - 1)),
    );
    fallback.subVectors(this.track.path[idx + 1], this.track.path[idx]).setY(0);
    if (fallback.lengthSq() > 1e-6) fallback.normalize();
    else fallback.set(0, 0, -1);

    this.playerController.update(
      dt,
      this.cameraController.getForward(),
      this.level.jumpEnabled,
      18,
    );

    for (const ai of this.ais) ai.update(dt);

    if (this.level.windStrength > 0) {
      const wind = Math.sin(this.windPhase * 1.3) * this.level.windStrength;
      for (const actor of this.actors) {
        if (actor.finished) continue;
        actor.body.applyForce(new CANNON.Vec3(wind, 0, 0), actor.body.position);
      }
    }

    this.trackBuilder.updateMoving(this.track.moving, this.raceTime);
    this.physics.step(dt);
    this.syncAllMeshes();
    this.updateCamera(dt);
    this.environment.updateFollow(this.player.mesh.position);

    for (const actor of this.actors) this.checkFinish(actor);

    // Fail conditions
    if (this.player.body.position.y < this.track.lowestY) {
      this.finishRace(false, '掉出赛道');
    } else if (this.raceTime >= this.level.timeLimit) {
      this.finishRace(false, '超时');
    }

    const rank = this.computeLiveRank();
    const speed = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.z);
    this.hud.update(this.raceTime, this.level.timeLimit, rank, this.actors.length, speed);

    this.renderer.render(this.scene, this.camera);
  };

  private syncAllMeshes(): void {
    this.playerController?.syncMesh();
    for (const ai of this.ais) ai.syncMesh();
  }

  private updateCamera(dt: number): void {
    if (!this.player || !this.track) return;
    this.tmpVel.set(
      this.player.body.velocity.x,
      this.player.body.velocity.y,
      this.player.body.velocity.z,
    );
    const progress = this.trackBuilder.progressAlongTrack(this.track, this.player.mesh.position);
    const idx = Math.min(
      this.track.path.length - 2,
      Math.floor(progress * (this.track.path.length - 1)),
    );
    this.tmpForward.subVectors(this.track.path[idx + 1], this.track.path[idx]).setY(0);
    if (this.tmpForward.lengthSq() > 1e-6) this.tmpForward.normalize();
    else this.tmpForward.set(0, 0, -1);
    this.cameraController.update(dt, this.player.mesh.position, this.tmpVel, this.tmpForward);
  }

  private computeLiveRank(): number {
    if (!this.track || !this.player) return 1;
    const scored = this.actors.map((actor) => {
      if (actor.finished) {
        return { actor, score: 1000 - actor.finishTime };
      }
      const p = this.trackBuilder.progressAlongTrack(this.track!, actor.mesh.position);
      return { actor, score: p };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.findIndex((s) => s.actor === this.player) + 1;
  }
}
