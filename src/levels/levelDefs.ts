export type ThemeId = 'meadow' | 'forest' | 'mountain' | 'canyon' | 'storm';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface ObstacleDef {
  type: 'rock' | 'gate';
  position: Vec3Like;
  scale?: Vec3Like;
  /** For moving gates: amplitude along X */
  moveAmp?: number;
  moveSpeed?: number;
}

export interface LevelDef {
  id: number;
  name: string;
  description: string;
  theme: ThemeId;
  halfWidth: number;
  path: Vec3Like[];
  timeLimit: number;
  starTimes: [number, number, number];
  aiCount: number;
  aiSpeed: number;
  jumpEnabled: boolean;
  windStrength: number;
  obstacles: ObstacleDef[];
  fogDensity: number;
  sunIntensity: number;
  hint: string;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: '青青牧场',
    description: '开阔草地，熟悉滚动与转向。',
    theme: 'meadow',
    halfWidth: 4.2,
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0.2, z: -18 },
      { x: 6, y: 0.4, z: -36 },
      { x: 4, y: 0.6, z: -54 },
      { x: -2, y: 0.8, z: -72 },
      { x: 0, y: 1.0, z: -92 },
      { x: 3, y: 1.1, z: -112 },
      { x: 0, y: 1.2, z: -132 },
    ],
    timeLimit: 90,
    starTimes: [55, 70, 90],
    aiCount: 1,
    aiSpeed: 11,
    jumpEnabled: false,
    windStrength: 0,
    obstacles: [],
    fogDensity: 0.012,
    sunIntensity: 1.35,
    hint: 'WASD / 方向键控制弹珠，滚到终点即可通关。',
  },
  {
    id: 2,
    name: '林间小径',
    description: 'S 弯密林，注意控速过弯。',
    theme: 'forest',
    halfWidth: 3.2,
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 8, y: 0.4, z: -16 },
      { x: -8, y: 0.8, z: -32 },
      { x: 10, y: 1.2, z: -50 },
      { x: -6, y: 1.6, z: -68 },
      { x: 8, y: 2.0, z: -86 },
      { x: -4, y: 2.3, z: -104 },
      { x: 0, y: 2.5, z: -124 },
    ],
    timeLimit: 80,
    starTimes: [48, 62, 80],
    aiCount: 2,
    aiSpeed: 13,
    jumpEnabled: false,
    windStrength: 0,
    obstacles: [
      { type: 'rock', position: { x: 1.5, y: 1.0, z: -40 }, scale: { x: 1.2, y: 1.1, z: 1.2 } },
      { type: 'rock', position: { x: -1.2, y: 1.8, z: -72 }, scale: { x: 1.4, y: 1.2, z: 1.3 } },
    ],
    fogDensity: 0.018,
    sunIntensity: 1.1,
    hint: '弯道前减速，贴内侧更容易保持速度。',
  },
  {
    id: 3,
    name: '岩石山道',
    description: '窄道与岩石障碍，可用空格跳跃。',
    theme: 'mountain',
    halfWidth: 2.6,
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 1.5, z: -14 },
      { x: -4, y: 3.2, z: -28 },
      { x: 5, y: 5.0, z: -44 },
      { x: -3, y: 6.5, z: -60 },
      { x: 6, y: 8.0, z: -78 },
      { x: 0, y: 9.0, z: -96 },
      { x: -2, y: 9.5, z: -114 },
      { x: 0, y: 10.0, z: -132 },
    ],
    timeLimit: 85,
    starTimes: [52, 68, 85],
    aiCount: 2,
    aiSpeed: 14.5,
    jumpEnabled: true,
    windStrength: 0,
    obstacles: [
      { type: 'rock', position: { x: 0, y: 3.5, z: -30 }, scale: { x: 1.6, y: 1.4, z: 1.5 } },
      { type: 'rock', position: { x: 1.1, y: 6.8, z: -62 }, scale: { x: 1.3, y: 1.5, z: 1.3 } },
      { type: 'rock', position: { x: -0.8, y: 9.2, z: -98 }, scale: { x: 1.5, y: 1.3, z: 1.4 } },
    ],
    fogDensity: 0.015,
    sunIntensity: 1.25,
    hint: '空格可短跳越过岩石；落地后再加速。',
  },
  {
    id: 4,
    name: '峡谷奔流',
    description: '断崖跳跃与移动挡板，掌握节奏。',
    theme: 'canyon',
    halfWidth: 2.4,
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0.5, z: -16 },
      { x: 4, y: 0.5, z: -28 },
      // gap around z -34..-40
      { x: 4, y: 0.2, z: -42 },
      { x: -2, y: 0.6, z: -58 },
      { x: -2, y: 0.6, z: -70 },
      // gap
      { x: 3, y: 0.3, z: -84 },
      { x: 6, y: 1.0, z: -100 },
      { x: 0, y: 1.4, z: -118 },
      { x: 0, y: 1.6, z: -136 },
    ],
    timeLimit: 95,
    starTimes: [58, 75, 95],
    aiCount: 3,
    aiSpeed: 15,
    jumpEnabled: true,
    windStrength: 0,
    obstacles: [
      {
        type: 'gate',
        position: { x: 0, y: 1.4, z: -58 },
        scale: { x: 1.2, y: 2.2, z: 0.6 },
        moveAmp: 2.2,
        moveSpeed: 1.6,
      },
      {
        type: 'gate',
        position: { x: 3, y: 1.8, z: -100 },
        scale: { x: 1.2, y: 2.4, z: 0.6 },
        moveAmp: 2.6,
        moveSpeed: 2.0,
      },
      { type: 'rock', position: { x: -0.5, y: 1.0, z: -70 }, scale: { x: 1.2, y: 1.1, z: 1.2 } },
    ],
    fogDensity: 0.01,
    sunIntensity: 1.4,
    hint: '加速后起跳越过断崖；避开左右移动的挡板。',
  },
  {
    id: 5,
    name: '高峰风暴',
    description: '最窄山脊、大落差与侧风干扰。',
    theme: 'storm',
    halfWidth: 2.0,
    path: [
      { x: 0, y: 2, z: 0 },
      { x: 3, y: 4, z: -14 },
      { x: -4, y: 7, z: -28 },
      { x: 5, y: 10, z: -44 },
      { x: -6, y: 12, z: -60 },
      { x: 4, y: 11, z: -76 },
      { x: -3, y: 9, z: -92 },
      { x: 6, y: 12, z: -110 },
      { x: 0, y: 14, z: -128 },
      { x: 0, y: 15, z: -148 },
    ],
    timeLimit: 100,
    starTimes: [62, 80, 100],
    aiCount: 3,
    aiSpeed: 16.5,
    jumpEnabled: true,
    windStrength: 7.5,
    obstacles: [
      { type: 'rock', position: { x: 0.6, y: 7.4, z: -30 }, scale: { x: 1.3, y: 1.4, z: 1.3 } },
      {
        type: 'gate',
        position: { x: 0, y: 12.4, z: -62 },
        scale: { x: 1.1, y: 2.2, z: 0.55 },
        moveAmp: 1.8,
        moveSpeed: 2.4,
      },
      { type: 'rock', position: { x: -0.8, y: 11.4, z: -78 }, scale: { x: 1.4, y: 1.3, z: 1.4 } },
      {
        type: 'gate',
        position: { x: 2, y: 12.8, z: -112 },
        scale: { x: 1.1, y: 2.3, z: 0.55 },
        moveAmp: 2.0,
        moveSpeed: 2.8,
      },
    ],
    fogDensity: 0.022,
    sunIntensity: 0.85,
    hint: '侧风会把你吹偏，反向微调并抓紧落地时机。',
  },
];

export function getLevel(id: number): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`未知关卡: ${id}`);
  return level;
}

export function computeStars(level: LevelDef, time: number): number {
  if (time <= level.starTimes[0]) return 3;
  if (time <= level.starTimes[1]) return 2;
  if (time <= level.starTimes[2]) return 1;
  return 0;
}
