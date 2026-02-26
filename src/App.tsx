/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Shield, Zap, Info, Globe, RotateCcw } from 'lucide-react';
import { GameStatus, Point, Missile, Enemy, Explosion, City, Battery, LANGUAGES } from './types';
import { audioService } from './services/audioService';
import { cn } from './lib/utils';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [totalScore, setTotalScore] = useState(0);
  const [levelScore, setLevelScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const t = LANGUAGES[lang];

  // Game State Refs (for the loop)
  const missilesRef = useRef<Missile[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const batteriesRef = useRef<Battery[]>([]);
  const requestRef = useRef<number>(null);
  const lastEnemySpawnRef = useRef<number>(0);

  const initLevel = useCallback((isNewGame: boolean) => {
    if (isNewGame) {
      // 6 cities
      const cityXPositions = [
        150, 220, 290, 510, 580, 650
      ];

      citiesRef.current = cityXPositions.map((x, i) => ({
        id: `c${i}`,
        pos: { x, y: CANVAS_HEIGHT - 15 },
        active: true,
        radius: 15,
        color: '#4cc9f0'
      }));
      setTotalScore(0);
      setLevel(1);
    }

    // Reset batteries and ammo
    const batteryPositions = [50, CANVAS_WIDTH / 2, CANVAS_WIDTH - 50];
    batteriesRef.current = [
      { id: 'b0', pos: { x: batteryPositions[0], y: CANVAS_HEIGHT - 20 }, active: true, missiles: 20, maxMissiles: 20, radius: 25, color: '#00ff41' },
      { id: 'b1', pos: { x: batteryPositions[1], y: CANVAS_HEIGHT - 20 }, active: true, missiles: 40, maxMissiles: 40, radius: 30, color: '#00ff41' },
      { id: 'b2', pos: { x: batteryPositions[2], y: CANVAS_HEIGHT - 20 }, active: true, missiles: 20, maxMissiles: 20, radius: 25, color: '#00ff41' },
    ];

    setLevelScore(0);
    missilesRef.current = [];
    enemiesRef.current = [];
    explosionsRef.current = [];
  }, []);

  const spawnEnemy = useCallback(() => {
    const targets = [...citiesRef.current.filter(c => c.active), ...batteriesRef.current.filter(b => b.active)];
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const startX = Math.random() * CANVAS_WIDTH;
    
    // Difficulty increases with level
    const speed = 0.001 + (level * 0.0004); 

    enemiesRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      startPos: { x: startX, y: 0 },
      pos: { x: startX, y: 0 },
      target: { x: target.pos.x, y: target.pos.y },
      progress: 0,
      speed: Math.min(speed, 0.008),
      color: '#ff4444'
    });
  }, [level]);

  const fireMissile = (targetX: number, targetY: number) => {
    if (status !== GameStatus.PLAYING) return;

    // Find closest active battery with missiles
    let bestBattery: Battery | null = null;
    let minDist = Infinity;

    batteriesRef.current.forEach(b => {
      if (b.active && b.missiles > 0) {
        const d = Math.abs(b.pos.x - targetX);
        if (d < minDist) {
          minDist = d;
          bestBattery = b;
        }
      }
    });

    if (bestBattery) {
      bestBattery.missiles--;
      // Launch sound removed as per user request
      missilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        startPos: { ...bestBattery.pos },
        pos: { ...bestBattery.pos },
        target: { x: targetX, y: targetY },
        progress: 0,
        speed: 0.06,
        color: '#ffffff'
      });
    }
  };

  const update = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) return;

    // Spawn enemies - Rate increases with level
    const spawnRate = Math.max(1500 - (level * 150), 300);
    if (time - lastEnemySpawnRef.current > spawnRate) {
      spawnEnemy();
      lastEnemySpawnRef.current = time;
    }

    // Update Missiles
    missilesRef.current = missilesRef.current.filter(m => {
      m.progress += m.speed!;
      m.pos.x = m.startPos.x + (m.target!.x - m.startPos.x) * m.progress;
      m.pos.y = m.startPos.y + (m.target!.y - m.startPos.y) * m.progress;

      if (m.progress >= 1) {
        // Explode
        audioService.playExplosion();
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          pos: { ...m.target! },
          currentRadius: 0,
          maxRadius: 40,
          growing: true,
          alpha: 1,
          color: '#ffffff'
        });
        return false;
      }
      return true;
    });

    // Update Enemies
    enemiesRef.current = enemiesRef.current.filter(e => {
      e.progress += e.speed!;
      e.pos.x = e.startPos.x + (e.target!.x - e.startPos.x) * e.progress;
      e.pos.y = e.startPos.y + (e.target!.y - e.startPos.y) * e.progress;

      if (e.progress >= 1) {
        // Hit target
        audioService.playExplosion();
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          pos: { ...e.target! },
          currentRadius: 0,
          maxRadius: 30,
          growing: true,
          alpha: 1,
          color: '#ff4444'
        });

        // Check what was hit
        citiesRef.current.forEach(c => {
          if (c.active && Math.abs(c.pos.x - e.target!.x) < 10) c.active = false;
        });
        batteriesRef.current.forEach(b => {
          if (b.active && Math.abs(b.pos.x - e.target!.x) < 10) b.active = false;
        });

        return false;
      }
      return true;
    });

    // Update Explosions
    explosionsRef.current = explosionsRef.current.filter(exp => {
      if (exp.growing) {
        exp.currentRadius += 1.5;
        if (exp.currentRadius >= exp.maxRadius) exp.growing = false;
      } else {
        exp.currentRadius -= 0.5;
        exp.alpha -= 0.02;
      }

      // Collision with enemies
      if (exp.growing && exp.color === '#ffffff') {
        enemiesRef.current = enemiesRef.current.filter(e => {
          const dx = e.pos.x - exp.pos.x;
          const dy = e.pos.y - exp.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < exp.currentRadius) {
            setTotalScore(prev => prev + 20);
            setLevelScore(prev => prev + 20);
            // Chain explosion
            explosionsRef.current.push({
              id: Math.random().toString(36).substr(2, 9),
              pos: { ...e.pos },
              currentRadius: 0,
              maxRadius: 30,
              growing: true,
              alpha: 1,
              color: '#ffffff'
            });
            return false;
          }
          return true;
        });
      }

      return exp.alpha > 0;
    });

    // Check Game Over
    const activeBatteries = batteriesRef.current.filter(b => b.active).length;
    if (activeBatteries === 0) {
      setStatus(GameStatus.LOST);
      audioService.stopMusic();
    }

    // Check Level Complete
    if (levelScore >= 800) {
      setStatus(GameStatus.NEXT_ROUND);
      audioService.stopMusic();
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [status, levelScore, level, spawnEnemy]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Cities
    citiesRef.current.forEach(c => {
      if (!c.active) return;
      ctx.fillStyle = c.color!;
      ctx.beginPath();
      ctx.rect(c.pos.x - 10, c.pos.y - 10, 20, 10);
      ctx.fill();
      // Dome
      ctx.beginPath();
      ctx.arc(c.pos.x, c.pos.y - 10, 10, Math.PI, 0);
      ctx.fill();
    });

    // Draw Batteries
    batteriesRef.current.forEach(b => {
      if (!b.active) return;
      ctx.fillStyle = b.color!;
      ctx.beginPath();
      ctx.moveTo(b.pos.x - 20, b.pos.y);
      ctx.lineTo(b.pos.x + 20, b.pos.y);
      ctx.lineTo(b.pos.x, b.pos.y - 25);
      ctx.closePath();
      ctx.fill();
      
      // Missile count text
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(b.missiles.toString(), b.pos.x, b.pos.y + 12);
    });

    // Draw Enemy Rockets
    enemiesRef.current.forEach(e => {
      ctx.strokeStyle = e.color!;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.startPos.x, e.startPos.y);
      ctx.lineTo(e.pos.x, e.pos.y);
      ctx.stroke();
      
      // Head - Even bigger for visibility
      ctx.fillStyle = e.color!;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Missiles
    missilesRef.current.forEach(m => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.startPos.x, m.startPos.y);
      ctx.lineTo(m.pos.x, m.pos.y);
      ctx.stroke();

      // Head - Added for visibility
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(m.pos.x, m.pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Target X
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.target!.x - 5, m.target!.y - 5);
      ctx.lineTo(m.target!.x + 5, m.target!.y + 5);
      ctx.moveTo(m.target!.x + 5, m.target!.y - 5);
      ctx.lineTo(m.target!.x - 5, m.target!.y + 5);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      ctx.globalAlpha = exp.alpha;
      ctx.fillStyle = exp.color!;
      ctx.beginPath();
      ctx.arc(exp.pos.x, exp.pos.y, exp.currentRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

  }, []);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, update]);

  const startGame = () => {
    initLevel(true);
    setStatus(GameStatus.PLAYING);
    audioService.startMusic();
  };

  const startNextLevel = () => {
    setLevel(prev => prev + 1);
    initLevel(false);
    setStatus(GameStatus.PLAYING);
    audioService.startMusic();
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== GameStatus.PLAYING) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Don't fire too low
    if (y < CANVAS_HEIGHT - 50) {
      fireMissile(x, y);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#050505] font-sans selection:bg-[#00ff41] selection:text-black">
      {/* Header HUD */}
      <div className="w-full max-w-[800px] mb-4 flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-2xl font-display font-bold tracking-tighter text-[#00ff41] flex items-center gap-2">
            <Shield className="w-6 h-6" />
            {t.title}
          </h1>
          <div className="flex gap-4 text-xs font-mono opacity-60 uppercase tracking-widest">
            <span>{t.round}: {level}</span>
            <span>{t.target}: {levelScore}/800</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs font-mono opacity-50 uppercase">{t.score}</div>
            <div className="text-3xl font-display font-bold tabular-nums text-[#00ff41]">{totalScore}</div>
          </div>
          <button 
            onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Globe className="w-5 h-5 opacity-60" />
          </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-[#00ff41]/20 blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative glass-panel rounded-xl overflow-hidden shadow-2xl border-white/10">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handleCanvasClick}
            onTouchStart={handleCanvasClick}
            className="w-full h-auto max-h-[70vh] cursor-crosshair"
          />
          <div className="scanline" />
          
          {/* Overlays */}
          <AnimatePresence>
            {status === GameStatus.START && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 p-8 text-center"
              >
                <div className="mb-8 space-y-4">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-20 h-20 bg-[#00ff41]/10 rounded-full flex items-center justify-center mx-auto border border-[#00ff41]/30"
                  >
                    <Target className="w-10 h-10 text-[#00ff41]" />
                  </motion.div>
                  <h2 className="text-4xl font-display font-bold tracking-tight">{t.title}</h2>
                  <p className="text-sm opacity-60 max-w-xs mx-auto leading-relaxed">{t.instructions}</p>
                </div>
                <button 
                  onClick={startGame}
                  className="px-8 py-3 bg-[#00ff41] text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,65,0.4)]"
                >
                  {t.start}
                </button>
              </motion.div>
            )}

            {status === GameStatus.NEXT_ROUND && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-20 p-8 text-center"
              >
                <div className="mb-6 text-5xl font-display font-bold tracking-tighter text-[#00ff41]">
                  {lang === 'en' ? `Level ${level} Complete!` : `第 ${level} 关完成！`}
                </div>
                <div className="mb-10 space-y-2">
                  <div className="text-xs font-mono opacity-50 uppercase">{t.score}</div>
                  <div className="text-6xl font-display font-bold tabular-nums">{totalScore}</div>
                  <p className="text-[#00ff41] font-mono text-sm animate-pulse">
                    {lang === 'en' ? 'Enemy rockets accelerating...' : '敌方火箭正在加速...'}
                  </p>
                </div>
                <button 
                  onClick={startNextLevel}
                  className="flex items-center gap-2 px-8 py-4 bg-[#00ff41] text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,65,0.4)]"
                >
                  {lang === 'en' ? 'Next Level' : '下一关'}
                </button>
              </motion.div>
            )}

            {status === GameStatus.LOST && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-20 p-8 text-center"
              >
                <div className="mb-6 text-5xl font-display font-bold tracking-tighter text-[#ff4444]">
                  {t.lose}
                </div>
                <div className="mb-10">
                  <div className="text-xs font-mono opacity-50 uppercase mb-1">{t.score}</div>
                  <div className="text-6xl font-display font-bold tabular-nums">{totalScore}</div>
                </div>
                <button 
                  onClick={startGame}
                  className="flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  <RotateCcw className="w-5 h-5" />
                  {t.restart}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 flex gap-8 items-center opacity-40 text-[10px] font-mono uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00ff41]" />
          <span>Battery Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4cc9f0]" />
          <span>City Protected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#ff4444]" />
          <span>Incoming Threat</span>
        </div>
      </div>

      {/* Mobile Controls Hint */}
      <div className="mt-4 md:hidden text-[10px] font-mono opacity-30 text-center">
        Tap screen to intercept
      </div>
    </div>
  );
}
