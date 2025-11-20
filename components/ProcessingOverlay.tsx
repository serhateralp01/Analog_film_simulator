
import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface ProcessingOverlayProps {
  isVisible: boolean;
  text: string;
}

const PROCESS_LOGS = [
  "INITIALIZING TENSORS :: 0x4F",
  "MAPPING LATENT SPACE...",
  "ANALYZING LUMA HISTOGRAM",
  "APPLYING NEURAL GRADING",
  "QUANTIZING COLOR PALETTE",
  "GENERATING NOISE SEED",
  "OPTIMIZING OUTPUT BUFFER",
  "FINALIZING RENDER..."
];

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isVisible, text }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [logIndex, setLogIndex] = useState(0);
  const [displayLog, setDisplayLog] = useState<string[]>([]);

  // Reset logs when visibility changes
  useEffect(() => {
    if (isVisible) {
      setLogIndex(0);
      setDisplayLog([]);
      
      // Log stream interval
      const interval = setInterval(() => {
        setLogIndex(prev => {
          const next = prev + 1;
          if (next < PROCESS_LOGS.length) {
             setDisplayLog(curr => [...curr.slice(-3), PROCESS_LOGS[next]]); // Keep last 4
          }
          return next;
        });
      }, 400); // Speed of logs

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && textRef.current) {
      // Text Scramble Effect
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&";
      const originalText = text;
      let iterations = 0;
      
      const scrambleInterval = setInterval(() => {
        if (!textRef.current) return;
        textRef.current.innerText = originalText
          .split("")
          .map((letter, index) => {
            if (index < iterations) {
              return originalText[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
        
        if (iterations >= originalText.length) { 
          clearInterval(scrambleInterval);
        }
        
        iterations += 1 / 3;
      }, 30);

      // Animate Rings
      gsap.to(".neural-ring", { 
        rotation: "+=360", 
        duration: 4, 
        ease: "none", 
        repeat: -1, 
        transformOrigin: "50% 50%",
        stagger: {
            each: 0.5,
            from: "end"
        }
      });

      return () => {
        clearInterval(scrambleInterval);
        gsap.killTweensOf(".neural-ring");
      };
    }
  }, [isVisible, text]);

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
       
       {/* Background Grid */}
       <div className="absolute inset-0 opacity-10 pointer-events-none" 
            style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
       </div>

       {/* Center Tech Visual */}
       <div className="relative w-48 h-48 flex items-center justify-center mb-12">
          {/* Outer Rings */}
          <div className="absolute inset-0 border border-zinc-800 rounded-full"></div>
          <div className="absolute inset-2 border border-dashed border-zinc-700 rounded-full neural-ring"></div>
          <div className="absolute inset-8 border-2 border-t-film-accent border-r-transparent border-b-film-accent border-l-transparent rounded-full neural-ring"></div>
          <div className="absolute inset-12 border border-pink-500/30 rounded-full neural-ring" style={{ animationDirection: 'reverse' }}></div>
          
          {/* Core Pulse */}
          <div className="w-20 h-20 bg-film-accent/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_15px_rgba(56,189,248,1)] animate-ping"></div>
       </div>
       
       {/* Typography */}
       <div className="relative z-10 flex flex-col items-center text-center max-w-xs">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-1.5 h-1.5 bg-pink-500 animate-pulse"></div>
             <span className="text-[9px] font-mono text-pink-500 tracking-widest uppercase">System Busy</span>
          </div>

          <h2 ref={textRef} className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white mb-6 mix-blend-screen min-h-[40px]">
            {text}
          </h2>
          
          {/* Terminal Output */}
          <div className="w-full bg-black/50 border border-zinc-800 p-3 rounded font-mono text-[9px] text-left h-24 flex flex-col justify-end overflow-hidden shadow-2xl relative">
             <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black to-transparent z-10"></div>
             {displayLog.map((log, i) => (
                 <div key={i} className="text-film-accent/80 truncate animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <span className="text-zinc-600 mr-2">{`>`}</span>
                    {log}
                 </div>
             ))}
             <div className="w-2 h-4 bg-film-accent/50 animate-pulse ml-1 inline-block align-middle"></div>
          </div>
       </div>
       
       {/* Scanline Overlay */}
       <div className="absolute inset-0 pointer-events-none opacity-5 bg-gradient-to-b from-transparent via-film-accent to-transparent h-[20%] w-full animate-[dropIn_3s_linear_infinite]"></div>
    </div>
  );
};
