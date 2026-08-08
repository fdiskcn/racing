const STORAGE_KEY = 'marble-race-progress';

export interface ProgressData {
  unlockedLevel: number;
  bestTimes: Record<number, number>;
}

const DEFAULT_PROGRESS: ProgressData = {
  unlockedLevel: 1,
  bestTimes: {},
};

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, bestTimes: {} };
    const parsed = JSON.parse(raw) as ProgressData;
    return {
      unlockedLevel: Math.max(1, Math.min(5, parsed.unlockedLevel || 1)),
      bestTimes: parsed.bestTimes ?? {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS, bestTimes: {} };
  }
}

export function saveProgress(data: ProgressData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function unlockNextLevel(currentLevel: number): ProgressData {
  const progress = loadProgress();
  progress.unlockedLevel = Math.max(progress.unlockedLevel, Math.min(5, currentLevel + 1));
  saveProgress(progress);
  return progress;
}

export function recordBestTime(levelId: number, time: number): ProgressData {
  const progress = loadProgress();
  const prev = progress.bestTimes[levelId];
  if (prev === undefined || time < prev) {
    progress.bestTimes[levelId] = time;
    saveProgress(progress);
  }
  return progress;
}
