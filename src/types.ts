export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  NEXT_ROUND = 'NEXT_ROUND'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Point;
  target?: Point;
  speed?: number;
  radius?: number;
  color?: string;
}

export interface Missile extends Entity {
  startPos: Point;
  progress: number; // 0 to 1
}

export interface Enemy extends Entity {
  startPos: Point;
  progress: number;
}

export interface Explosion extends Entity {
  maxRadius: number;
  currentRadius: number;
  growing: boolean;
  alpha: number;
}

export interface City extends Entity {
  active: boolean;
}

export interface Battery extends Entity {
  active: boolean;
  missiles: number;
  maxMissiles: number;
}

export const LANGUAGES = {
  en: {
    title: 'Z Jiang Nova Defense',
    start: 'Start Game',
    restart: 'Play Again',
    win: 'Mission Accomplished!',
    lose: 'Defense Collapsed!',
    score: 'Score',
    target: 'Target: 1000',
    missiles: 'Missiles',
    round: 'Round',
    instructions: 'Click to intercept incoming rockets. Protect your cities!',
  },
  zh: {
    title: 'Z Jiang 新星防御',
    start: '开始游戏',
    restart: '再玩一次',
    win: '任务完成！',
    lose: '防御崩溃！',
    score: '得分',
    target: '目标: 1000',
    missiles: '导弹',
    round: '回合',
    instructions: '点击屏幕发射拦截导弹。保护你的城市！',
  }
};
