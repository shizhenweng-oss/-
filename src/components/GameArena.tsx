import React, { useRef, useState, useEffect } from 'react';
import { usePhaserGame }    from '../hooks/usePhaserGame';
import { PlayerPanel }      from './PlayerPanel';
import { SubstitutionRing } from './SubstitutionRing';
import { EventBus, EVENTS } from '../game/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// GameArena
//
// Data flow:
//   Phaser (BaseCharacter) → EventBus.emit() → React state → HUD render
//
// Events consumed:
//   PLAYER_HP_CHANGED    → HP bar width
//   PLAYER_FORCE_CHANGED → Magnetic Force bar width
//   PLAYER_SUB_CHANGED   → Substitution cooldown ring
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_DURATION = 99;
const MAX_HP         = 100;

// ── Per-player HUD state ────────────────────────────────────────────────────
interface FighterState {
  name:  string;
  hp:    number;   // 0 – maxHp
  maxHp: number;
  force: number;   // 0 – 100
  overloaded?: boolean;
  avatarUrl?: string;
}

// ── Per-player sub ring state ───────────────────────────────────────────────
interface SubRingState {
  secondsLeft: number;
  status:      'ready' | 'active' | 'cooling';
  progress:    number;   // 0 – 1 fill fraction
}

const initFighter = (name: string, avatarUrl?: string): FighterState => ({
  name, hp: MAX_HP, maxHp: MAX_HP, force: 0, overloaded: false, avatarUrl
});
const initSub = (): SubRingState => ({ secondsLeft: 0, status: 'ready', progress: 1 });

// ─────────────────────────────────────────────────────────────────────────────
export const GameArena: React.FC = () => {
  // ── Phaser canvas ─────────────────────────────────────────────────────────
  const phaserMount = useRef<HTMLDivElement>(null);
  usePhaserGame(phaserMount);

  // ── Fighter display state (driven by Phaser EventBus) ─────────────────────
  const [p1, setP1] = useState<FighterState>(initFighter('SEATIGER', '/assets/seatiger_avatar.png'));
  const [p2, setP2] = useState<FighterState>(initFighter('REIKA', '/assets/reika_avatar.png'));

  // ── Substitution ring state (driven by Phaser EventBus) ───────────────────
  const [sub1, setSub1] = useState<SubRingState>(initSub());
  const [sub2, setSub2] = useState<SubRingState>(initSub());

  // ── Round timer ───────────────────────────────────────────────────────────
  const [roundTime, setRoundTime]       = useState(ROUND_DURATION);
  const [roundRunning, setRoundRunning] = useState(true);
  const [timeOverPhase, setTimeOverPhase] = useState<number>(0);
  const [ultimatePhase, setUltimatePhase] = useState<number>(0);
  const [videoIndex, setVideoIndex] = useState<number>(1);
  const [phase1Text, setPhase1Text] = useState("");

  // ── Narration overlay ─────────────────────────────────────────────────────
  const [narration, setNarration] = useState({ text: '', visible: false, imageUrl: '' });
  const [displayedNarration, setDisplayedNarration] = useState('');
  
  // ── Cut-in Text & Buffs ───────────────────────────────────────────────────
  const [cutins, setCutins] = useState<{ id: number; text: string }[]>([]);
  const [buffs, setBuffs] = useState({ p1Thunder: false, p2Thunder: false });

  // ── Subscribe to Phaser events ────────────────────────────────────────────
  useEffect(() => {
    type HpPayload    = { player: 1 | 2; hp: number; maxHp: number };
    type ForcePayload = { player: 1 | 2; force: number; maxForce: number };
    type OverloadPayload = { player: 1 | 2; overloaded: boolean };
    type SubPayload   = { player: 1 | 2; secondsLeft: number; status: 'ready' | 'active' | 'cooling'; progress: number };

    const onHp = ({ player, hp, maxHp }: HpPayload) => {
      const upd: Partial<FighterState> = { hp, maxHp };
      if (player === 1) setP1(p => ({ ...p, ...upd }));
      else              setP2(p => ({ ...p, ...upd }));
    };

    const onForce = ({ player, force }: ForcePayload) => {
      if (player === 1) setP1(p => ({ ...p, force, overloaded: false }));
      else              setP2(p => ({ ...p, force, overloaded: false }));
    };

    const onOverload = ({ player, overloaded }: OverloadPayload) => {
      if (player === 1) setP1(p => ({ ...p, overloaded }));
      else              setP2(p => ({ ...p, overloaded }));
    };

    const onSub = ({ player, secondsLeft, status, progress }: SubPayload) => {
      const upd: SubRingState = { secondsLeft, status, progress };
      if (player === 1) setSub1(upd);
      else              setSub2(upd);
    };

    const onNarration = ({ text, imageUrl }: { text: string, imageUrl?: string }) => {
      setNarration({ text, visible: true, imageUrl: imageUrl || '' });
      setDisplayedNarration('');
    };

    const onCutin = ({ text }: { player: number, text: string }) => {
      const id = Date.now();
      setCutins(prev => [...prev, { id, text }]);
      setTimeout(() => setCutins(prev => prev.filter(c => c.id !== id)), 1500);
    };

    const onBuff = ({ player, active, type }: { player: number, active: boolean, type: string }) => {
      if (type === 'thunder') {
        setBuffs(prev => ({ ...prev, [player === 1 ? 'p1Thunder' : 'p2Thunder']: active }));
      }
    };

    const onCinematic = ({ phase }: { phase: number }) => {
      setUltimatePhase(phase);
    };

    EventBus.on(EVENTS.PLAYER_HP_CHANGED,    onHp);
    EventBus.on(EVENTS.PLAYER_FORCE_CHANGED, onForce);
    EventBus.on(EVENTS.PLAYER_FORCE_OVERLOAD, onOverload);
    EventBus.on(EVENTS.PLAYER_SUB_CHANGED,   onSub);
    EventBus.on(EVENTS.PLAY_NARRATION,       onNarration);
    EventBus.on(EVENTS.UI_TEXT_CUTIN,        onCutin);
    EventBus.on(EVENTS.UI_BUFF_EFFECT,       onBuff);
    EventBus.on(EVENTS.UI_CINEMATIC_ULTIMATE, onCinematic);

    return () => {
      EventBus.off(EVENTS.PLAYER_HP_CHANGED,    onHp);
      EventBus.off(EVENTS.PLAYER_FORCE_CHANGED, onForce);
      EventBus.off(EVENTS.PLAYER_FORCE_OVERLOAD, onOverload);
      EventBus.off(EVENTS.PLAYER_SUB_CHANGED,   onSub);
      EventBus.off(EVENTS.PLAY_NARRATION,       onNarration);
      EventBus.off(EVENTS.UI_TEXT_CUTIN,        onCutin);
      EventBus.off(EVENTS.UI_BUFF_EFFECT,       onBuff);
      EventBus.off(EVENTS.UI_CINEMATIC_ULTIMATE, onCinematic);
    };
  }, []);

  // ── Typewriter effect for narration ───────────────────────────────────────
  useEffect(() => {
    if (!narration.visible) return;
    
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedNarration((prev) => prev + narration.text.charAt(index));
      index++;
      if (index >= narration.text.length) {
        clearInterval(interval);
        setTimeout(() => setNarration({ text: '', visible: false, imageUrl: '' }), 3000); // Hide after 3s
      }
    }, 50);

    return () => clearInterval(interval);
  }, [narration]);

  // ── Round countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!roundRunning || roundTime <= 0) { 
       if (roundTime <= 0 && p1.hp > 0 && p2.hp > 0 && timeOverPhase === 0) {
         setTimeOverPhase(1);
         EventBus.emit(EVENTS.UI_TIME_OVER);
       }
       setRoundRunning(false); 
       return; 
    }
    const id = setInterval(() => setRoundTime(t => Math.max(0, t - 1)), 1_000);
    return () => clearInterval(id);
  }, [roundRunning, roundTime, p1.hp, p2.hp, timeOverPhase]);

  // ── Phase 1 Typewriter ──────────────────────────────────────────────────
  useEffect(() => {
    if (ultimatePhase === 1) {
      const fullText = "他媽的…現在，已是去盡的時候。\n已他媽不能再忍耐！\n100萬匹力量…出來！！！";
      let i = 0;
      setPhase1Text("");
      const interval = setInterval(() => {
        setPhase1Text(fullText.slice(0, i));
        i++;
        if (i > fullText.length) clearInterval(interval);
      }, 70); // Typwriter speed
      return () => clearInterval(interval);
    } else if (ultimatePhase === 5) {
      setVideoIndex(1);
    }
  }, [ultimatePhase]);

  const isUrgent  = roundTime <= 10;

  return (
    <div className="game-arena" id="game-arena">
      <style>{`
        @keyframes cutin-zoom {
          0% { transform: scale(5) rotate(-10deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes cutin-fade {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.8) translateY(-50px); opacity: 0; }
        }
        @keyframes cinematic-scale-up {
          0% { transform: scale(0.5); opacity: 0; }
          20% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes war-mark {
          0% { height: 0vh; opacity: 1; }
          10% { height: 100vh; opacity: 1; }
          80% { height: 100vh; opacity: 1; }
          100% { height: 100vh; opacity: 0; }
        }
        @keyframes screen-crack {
          0% { opacity: 0; }
          10% { opacity: 1; }
          20% { opacity: 0; }
          30% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes image-zoom-fade {
          0% { transform: scale(1.2); opacity: 0; }
          10% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes ultimate-fade-text {
          0% { transform: translateY(20px); opacity: 0; }
          10% { transform: translateY(0); opacity: 1; }
          80% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
        @keyframes slow-fade-out {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      {/* Phaser canvas (aria-hidden — HUD is the accessible layer) */}
      <div id="phaser-mount" ref={phaserMount} aria-hidden="true" />

      {/* HUD overlay */}
      <div className="hud-overlay" aria-label="Game HUD">

        {/* TOP — health bars, force bars, round timer */}
        <div className="hud-top">

          <div className="flex flex-col items-start gap-2">
            <PlayerPanel
              playerId={1}
              name={p1.name}
              hp={p1.hp}
              maxHp={p1.maxHp}
              force={p1.force}
              overloaded={p1.overloaded}
              avatarUrl={p1.avatarUrl}
            />
            {buffs.p1Thunder && (
              <div className="text-cyan-400 font-black italic drop-shadow-[0_0_8px_rgba(0,255,255,1)] uppercase tracking-widest text-sm bg-cyan-900/60 px-3 py-1 rounded border border-cyan-400/80 w-full text-center">
                ⚡ 电绝强化 (THUNDER ARRAY)
              </div>
            )}
          </div>

          {/* Centre timer */}
          <div className="hud-center">
            <span className="round-label">ROUND 1</span>
            <div
              id="round-timer"
              className={`round-timer${isUrgent ? ' urgent' : ''}`}
              role="timer"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${roundTime} seconds remaining`}
            >
              {roundTime}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <PlayerPanel
              playerId={2}
              name={p2.name}
              hp={p2.hp}
              maxHp={p2.maxHp}
              force={p2.force}
              overloaded={p2.overloaded}
              avatarUrl={p2.avatarUrl}
            />
            {buffs.p2Thunder && (
              <div className="text-cyan-400 font-black italic drop-shadow-[0_0_8px_rgba(0,255,255,1)] uppercase tracking-widest text-sm bg-cyan-900/60 px-3 py-1 rounded border border-cyan-400/80 w-full text-center">
                ⚡ 电绝强化 (THUNDER ARRAY)
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM — substitution cooldown rings */}
        <div className="hud-bottom">
          <SubstitutionRing
            playerId={1}
            progress={sub1.progress}
            status={sub1.status}
            seconds={sub1.secondsLeft}
            onActivate={() => { /* triggered by F key in Phaser */ }}
          />
          <SubstitutionRing
            playerId={2}
            progress={sub2.progress}
            status={sub2.status}
            seconds={sub2.secondsLeft}
            onActivate={() => { /* triggered by H key in Phaser */ }}
          />
        </div>

        {/* NARRATION OVERLAY */}
        {narration.visible && (
          <div className="narration-box" style={{
            position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.85)', border: '4px solid #ffaa00',
            padding: '20px', width: '80%', maxWidth: '800px',
            color: '#fff', fontSize: '24px', fontFamily: '"Arial Black", sans-serif',
            boxShadow: '0 0 20px rgba(255, 170, 0, 0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: '20px'
          }}>
            {narration.imageUrl && (
              <img src={narration.imageUrl} alt="Narration" style={{ width: '120px', height: '120px', objectFit: 'cover', border: '2px solid #ffaa00' }} />
            )}
            <p style={{ margin: 0, textShadow: '2px 2px 0 #ff0000', fontStyle: 'italic', flex: 1 }}>
              {displayedNarration}
            </p>
          </div>
        )}

        {/* CUT-IN OVERLAY */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {cutins.map(c => (
            <div key={c.id} className="absolute text-9xl font-black italic text-red-600 tracking-tighter mix-blend-screen"
                 style={{
                   textShadow: '8px 8px 0 #000, 0 0 40px #ff0000',
                   WebkitTextStroke: '4px #fff',
                   animation: 'cutin-zoom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, cutin-fade 0.5s ease-in 1s forwards'
                 }}>
              {c.text}
            </div>
          ))}
        </div>

        {/* ULTIMATE CINEMATIC OVERLAY */}
        {ultimatePhase > 0 && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
            {/* Phase 1: Text scale up with Typewriter */}
            {ultimatePhase === 1 && (
              <div 
                className="text-red-600 font-black italic text-center whitespace-pre-wrap leading-tight drop-shadow-[0_0_20px_rgba(255,0,0,1)]"
                style={{ 
                  animation: 'cinematic-scale-up 4s ease-in-out forwards',
                  WebkitTextStroke: '2px #000',
                  fontSize: '4rem'
                }}
              >
                {phase1Text}
              </div>
            )}
            
            {/* Phase 2: Absolute Black, Marks, Crack, Text */}
            {ultimatePhase === 2 && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
                {/* 3 War Marks */}
                <div className="absolute flex gap-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 3.5s ease-out forwards', boxShadow: '0 0 20px #ff0000' }}></div>
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 3.5s ease-out forwards 0.2s', boxShadow: '0 0 20px #ff0000' }}></div>
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 3.5s ease-out forwards 0.4s', boxShadow: '0 0 20px #ff0000' }}></div>
                </div>
                
                {/* Crack flash */}
                <div 
                  className="absolute inset-0 bg-white z-20 mix-blend-overlay"
                  style={{ animation: 'screen-crack 3s step-end forwards 1s' }}
                />
                
                {/* 1 Million Power Image */}
                <div 
                  className="absolute inset-0 z-25 bg-contain bg-no-repeat bg-center mix-blend-screen opacity-0"
                  style={{ 
                    backgroundImage: 'url(/assets/1m_horsepower.jpg)',
                    animation: 'image-zoom-fade 3s ease-out forwards 1.2s'
                  }}
                />
                
                {/* Main Impact Text */}
                <div 
                  className="z-30 text-red-500 font-black italic text-8xl text-center leading-none opacity-0"
                  style={{ 
                    animation: 'ultimate-fade-text 3s ease-in-out forwards 1.2s',
                    textShadow: '10px 10px 0 #000, 0 0 50px #ff0000',
                    WebkitTextStroke: '4px #fff'
                  }}
                >
                  战他娘亲<br/>一百万匹力量<br/>给我破呀！！！
                </div>
              </div>
            )}
            
            {/* Phase 3: Moon Shatter Cinematic */}
            {ultimatePhase === 3 && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
                {/* Intense full screen red flash */}
                <div className="absolute inset-0 bg-red-600 z-10" style={{ animation: 'screen-crack 0.5s ease-out forwards' }} />
                
                {/* Moon Shatter Image */}
                <div 
                  className="absolute inset-0 z-20 bg-cover bg-no-repeat bg-center opacity-0 mix-blend-screen"
                  style={{ 
                    backgroundImage: 'url(/assets/ultimate_blast.jpg)',
                    animation: 'image-zoom-fade 2.5s ease-out forwards 0.2s'
                  }}
                />
                
                {/* Shatter Text */}
                <div 
                  className="z-30 text-white font-black italic text-8xl md:text-[8rem] text-center leading-none opacity-0 tracking-tighter"
                  style={{ 
                    animation: 'ultimate-fade-text 2.5s ease-in-out forwards 0.3s',
                    textShadow: '0 0 50px #ff0000, 0 0 100px #ffaa00',
                    WebkitTextStroke: '4px #000'
                  }}
                >
                  轰碎月球！<br/>灰飞烟灭！！
                </div>
              </div>
            )}

            {/* Phase 4: Survival Ending */}
            {ultimatePhase === 4 && (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                {/* War Marks */}
                <div className="absolute flex gap-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 3.5s ease-out forwards', boxShadow: '0 0 20px #ff0000' }}></div>
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 3.5s ease-out forwards 0.2s', boxShadow: '0 0 20px #ff0000' }}></div>
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 3.5s ease-out forwards 0.4s', boxShadow: '0 0 20px #ff0000' }}></div>
                </div>
                
                {/* Dark Face Image */}
                <div 
                  className="absolute inset-0 z-20 bg-contain bg-no-repeat bg-center opacity-0"
                  style={{ 
                    backgroundImage: 'url(/assets/black_face.png)',
                    animation: 'image-zoom-fade 4s ease-out forwards 0.5s'
                  }}
                />
                
                <div 
                  className="z-30 text-red-600 font-black italic text-7xl text-center opacity-0"
                  style={{ 
                    animation: 'ultimate-fade-text 3s ease-in-out forwards 1s',
                    textShadow: '0 0 30px #ff0000'
                  }}
                >
                  次男 爹来杀你了。
                </div>
              </div>
            )}
            
            {/* Phase 6: Death Ending */}
            {ultimatePhase === 6 && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
                {/* War Marks */}
                <div className="absolute flex gap-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 1s ease-out forwards', boxShadow: '0 0 20px #ff0000' }}></div>
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 1s ease-out forwards 0.2s', boxShadow: '0 0 20px #ff0000' }}></div>
                  <div className="w-4 bg-red-600" style={{ animation: 'war-mark 1s ease-out forwards 0.4s', boxShadow: '0 0 20px #ff0000' }}></div>
                </div>
                {/* Crack flash */}
                <div 
                  className="absolute inset-0 bg-white z-20 mix-blend-overlay"
                  style={{ animation: 'screen-crack 1s step-end forwards 0.5s' }}
                />
                <div 
                  className="z-30 text-red-800 font-serif italic text-4xl text-center whitespace-pre-wrap leading-relaxed opacity-0"
                  style={{ 
                    animation: 'slow-fade-out 5s ease-in-out forwards 1.5s',
                  }}
                >
                  小瞳…我…未能做到。<br/>首男…我对你不起…
                </div>
              </div>
            )}

            {/* Phase 5: MP4 Video Playback Sequence */}
            {ultimatePhase === 5 && videoIndex === 1 && (
              <video 
                src="/assets/seatiger_ultimate_1.mp4" 
                autoPlay 
                className="absolute inset-0 w-full h-full object-contain bg-black z-[999]"
                onEnded={() => setVideoIndex(2)}
              />
            )}
            {ultimatePhase === 5 && videoIndex === 2 && (
              <video 
                src="/assets/seatiger_ultimate_2.mp4" 
                autoPlay 
                className="absolute inset-0 w-full h-full object-contain bg-black z-[999]"
                onEnded={() => EventBus.emit(EVENTS.UI_CINEMATIC_VIDEO_ENDED)}
              />
            )}
          </div>
        )}

        {/* TIME OVER VIDEO */}
        {timeOverPhase === 1 && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
            <video 
              src="/assets/planet_explosion.mp4" 
              autoPlay 
              className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-80"
              onEnded={() => setTimeOverPhase(2)}
            />
            <div 
              className="z-30 text-white font-black italic text-8xl md:text-[8rem] text-center whitespace-pre-wrap leading-tight drop-shadow-[0_0_50px_rgba(255,0,0,1)] tracking-tighter"
              style={{
                textShadow: '0 0 50px #ff0000, 0 0 100px #ffaa00',
                WebkitTextStroke: '4px #000',
                animation: 'ultimate-fade-text 5s ease-in-out forwards 0.5s'
              }}
            >
              绝对不行<br/>轻易不行
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
