import './style.css';
import { GameApp } from './game/GameApp';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLElement>('#ui-root');

if (!canvas || !uiRoot) {
  throw new Error('缺少游戏挂载节点');
}

const app = new GameApp(canvas, uiRoot);
app.start();
