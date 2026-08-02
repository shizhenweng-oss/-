import { useState } from 'react';
import './index.css';
import { GameArena } from './components/GameArena';

export default function App() {
  const [showGame, setShowGame] = useState(false);
  const [started, setStarted] = useState(false);

  if (!showGame) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden relative">
        {!started ? (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer z-50 bg-black"
            onClick={() => setStarted(true)}
          >
            <div className="text-white text-4xl font-bold animate-pulse">
              点击屏幕开始游戏
            </div>
            <div className="text-gray-500 mt-4">Click to Start</div>
          </div>
        ) : (
          <>
            <video 
              src="/assets/opening.mp4" 
              autoPlay 
              className="absolute inset-0 w-full h-full object-contain"
              onEnded={() => setShowGame(true)}
            />
            <button 
              onClick={() => setShowGame(true)}
              className="absolute bottom-8 right-8 text-white/30 hover:text-white bg-black/50 px-4 py-2 rounded text-sm z-50 transition-colors"
            >
              Skip
            </button>
          </>
        )}
      </div>
    );
  }

  return <GameArena />;
}
