import { LEVELS, type LevelDef } from '../levels/levelDefs';
import { loadProgress, type ProgressData } from '../utils/storage';
import { formatTime } from '../utils/math';

export type MenuScreen = 'main' | 'levels' | 'help' | 'result' | 'pause' | 'hidden';

export interface ResultPayload {
  win: boolean;
  level: LevelDef;
  time: number;
  rank: number;
  total: number;
  stars: number;
  reason?: string;
}

export class Menu {
  readonly root: HTMLDivElement;
  private screen: MenuScreen = 'main';
  private progress: ProgressData = loadProgress();

  onStartLevel?: (levelId: number) => void;
  onResume?: () => void;
  onExitToMenu?: () => void;
  onRetry?: () => void;
  onNext?: () => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
    this.render();
  }

  refreshProgress(): void {
    this.progress = loadProgress();
  }

  showMain(): void {
    this.screen = 'main';
    this.render();
  }

  showLevels(): void {
    this.screen = 'levels';
    this.refreshProgress();
    this.render();
  }

  showHelp(): void {
    this.screen = 'help';
    this.render();
  }

  showPause(): void {
    this.screen = 'pause';
    this.render();
  }

  showResult(payload: ResultPayload): void {
    this.screen = 'result';
    this.render(payload);
  }

  hide(): void {
    this.screen = 'hidden';
    this.render();
  }

  private render(result?: ResultPayload): void {
    if (this.screen === 'hidden') {
      this.root.innerHTML = '';
      return;
    }

    if (this.screen === 'main') {
      this.root.innerHTML = `
        <div class="overlay">
          <div class="panel menu-card">
            <h1>弹珠比赛</h1>
            <p class="subtitle">第一视角 3D 弹珠竞速 · 自然环境赛道 · 五关逐级挑战</p>
            <div class="btn-row">
              <button data-action="play">开始游戏</button>
              <button class="secondary" data-action="levels">选择关卡</button>
              <button class="secondary" data-action="help">操作说明</button>
            </div>
          </div>
        </div>
      `;
      this.bindCommon();
      return;
    }

    if (this.screen === 'levels') {
      const cards = LEVELS.map((level) => {
        const locked = level.id > this.progress.unlockedLevel;
        const best = this.progress.bestTimes[level.id];
        return `
          <button class="level-card ${locked ? 'locked' : ''}" data-level="${level.id}" ${locked ? 'disabled' : ''}>
            <div class="name">第 ${level.id} 关 · ${level.name}</div>
            <div class="meta">${level.description}<br/>${best !== undefined ? `最佳 ${formatTime(best)}` : '尚未通关'}${locked ? '<br/>未解锁' : ''}</div>
          </button>
        `;
      }).join('');
      this.root.innerHTML = `
        <div class="overlay">
          <div class="panel menu-card">
            <h1>选择关卡</h1>
            <p class="subtitle">通关后解锁下一关。当前已解锁至第 ${this.progress.unlockedLevel} 关。</p>
            <div class="level-grid">${cards}</div>
            <div class="btn-row">
              <button class="secondary" data-action="main">返回</button>
            </div>
          </div>
        </div>
      `;
      this.bindCommon();
      this.root.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.level);
          this.onStartLevel?.(id);
        });
      });
      return;
    }

    if (this.screen === 'help') {
      this.root.innerHTML = `
        <div class="overlay">
          <div class="panel menu-card">
            <h1>操作说明</h1>
            <ul class="help-list">
              <li><b>W / ↑</b> 加速前进</li>
              <li><b>S / ↓</b> 刹车 / 后退</li>
              <li><b>A D / ← →</b> 左右转向</li>
              <li><b>空格</b> 跳跃（第 3 关起）</li>
              <li><b>Esc</b> 暂停</li>
            </ul>
            <p class="subtitle" style="margin-top:16px">掉落会在赛道附近重生；超时将失败。抵达金色终点拱门即可完赛。</p>
            <div class="btn-row">
              <button class="secondary" data-action="main">返回</button>
            </div>
          </div>
        </div>
      `;
      this.bindCommon();
      return;
    }

    if (this.screen === 'pause') {
      this.root.innerHTML = `
        <div class="overlay">
          <div class="panel pause-card">
            <h2>已暂停</h2>
            <div class="btn-row" style="justify-content:center">
              <button data-action="resume">继续比赛</button>
              <button class="secondary" data-action="exit">返回菜单</button>
            </div>
          </div>
        </div>
      `;
      this.root.querySelector('[data-action="resume"]')?.addEventListener('click', () => this.onResume?.());
      this.root.querySelector('[data-action="exit"]')?.addEventListener('click', () => this.onExitToMenu?.());
      return;
    }

    if (this.screen === 'result' && result) {
      const title = result.win ? '完赛！' : '挑战失败';
      const stars = result.win ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) : '——';
      this.root.innerHTML = `
        <div class="overlay">
          <div class="panel result-card">
            <h2>${title}</h2>
            <div class="stars">${stars}</div>
            <div class="stats">
              关卡：${result.level.name}<br/>
              ${result.win ? `用时：${formatTime(result.time)}` : result.reason ?? '未完成'}<br/>
              名次：${result.rank} / ${result.total}
            </div>
            <div class="btn-row" style="justify-content:center">
              <button data-action="retry">再试一次</button>
              ${result.win && result.level.id < 5 ? '<button data-action="next">下一关</button>' : ''}
              <button class="secondary" data-action="levels">选关</button>
              <button class="secondary" data-action="main">主菜单</button>
            </div>
          </div>
        </div>
      `;
      this.root.querySelector('[data-action="retry"]')?.addEventListener('click', () => this.onRetry?.());
      this.root.querySelector('[data-action="next"]')?.addEventListener('click', () => this.onNext?.());
      this.root.querySelector('[data-action="levels"]')?.addEventListener('click', () => this.showLevels());
      this.root.querySelector('[data-action="main"]')?.addEventListener('click', () => this.onExitToMenu?.());
    }
  }

  private bindCommon(): void {
    this.root.querySelector('[data-action="play"]')?.addEventListener('click', () => {
      this.refreshProgress();
      this.onStartLevel?.(this.progress.unlockedLevel);
    });
    this.root.querySelector('[data-action="levels"]')?.addEventListener('click', () => this.showLevels());
    this.root.querySelector('[data-action="help"]')?.addEventListener('click', () => this.showHelp());
    this.root.querySelector('[data-action="main"]')?.addEventListener('click', () => this.showMain());
  }
}
