import { formatTime } from '../utils/math';

export class HUD {
  readonly root: HTMLDivElement;
  private levelEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private rankEl: HTMLDivElement;
  private centerEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private speedEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud hidden';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-chip" data-level></div>
        <div class="hud-chip" data-time></div>
        <div class="hud-chip" data-rank></div>
      </div>
      <div class="hud-center hidden" data-center></div>
      <div class="hud-hint" data-hint></div>
      <div class="hud-speed" data-speed>0 km/h</div>
    `;
    parent.appendChild(this.root);
    this.levelEl = this.root.querySelector('[data-level]')!;
    this.timeEl = this.root.querySelector('[data-time]')!;
    this.rankEl = this.root.querySelector('[data-rank]')!;
    this.centerEl = this.root.querySelector('[data-center]')!;
    this.hintEl = this.root.querySelector('[data-hint]')!;
    this.speedEl = this.root.querySelector('[data-speed]')!;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.centerEl.classList.add('hidden');
  }

  setLevel(name: string): void {
    this.levelEl.textContent = name;
  }

  setHint(text: string): void {
    this.hintEl.textContent = text;
  }

  update(time: number, timeLimit: number, rank: number, total: number, speed: number): void {
    const remain = Math.max(0, timeLimit - time);
    this.timeEl.textContent = `用时 ${formatTime(time)} / 限时 ${formatTime(remain)}`;
    this.rankEl.textContent = `名次 ${rank}/${total}`;
    this.speedEl.textContent = `${Math.round(speed * 3.6)} km/h`;
  }

  setCenter(text: string | null): void {
    if (!text) {
      this.centerEl.classList.add('hidden');
      this.centerEl.textContent = '';
      return;
    }
    this.centerEl.classList.remove('hidden');
    this.centerEl.textContent = text;
  }
}
