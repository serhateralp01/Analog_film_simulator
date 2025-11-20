
import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface OnboardingProps {
  onGetStarted: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onGetStarted }) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    
    tl.fromTo(titleRef.current, 
      { y: 50, opacity: 0, filter: 'blur(10px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }
    )
    .fromTo(subRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' },
      "-=0.8"
    )
    .fromTo(btnRef.current,
      { scale: 0.9, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' },
      "-=0.6"
    );

  }, []);

  return (
    <div className="relative h-screen w-screen flex flex-col items-center justify-center overflow-hidden text-white bg-transparent z-20">
      
      {/* CRT Scanlines Overlay */}
      <div className="absolute inset-0 scanlines z-10 opacity-30 pointer-events-none mix-blend-overlay"></div>

      {/* Content */}
      <div className="z-20 relative flex flex-col items-center max-w-4xl px-6 text-center space-y-8">
         
         <div className="flex items-center gap-2 mb-4 opacity-70 tracking-[0.3em] text-[10px] font-mono text-film-accent uppercase">
             <span>v2.0.0</span> 
             <span className="w-1 h-1 bg-film-accent rounded-full"></span>
             <span>System Online</span>
         </div>

         <h1 ref={titleRef} className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.8] mix-blend-difference drop-shadow-2xl">
           ANALOG<span className="text-film-accent">.AI</span>
         </h1>
         
         <div className="h-px w-24 bg-film-accent/50 my-6"></div>

         <p ref={subRef} className="text-lg md:text-xl text-zinc-200 font-light leading-relaxed max-w-md font-mono drop-shadow-md">
           Procedural film simulation &<br/>generative color grading.
         </p>

         <button 
           ref={btnRef}
           onClick={onGetStarted}
           className="group relative mt-8 px-10 py-4 bg-transparent border border-film-accent text-film-accent hover:text-black hover:bg-film-accent rounded-none font-bold uppercase tracking-widest transition-all duration-300 overflow-hidden shadow-[0_0_20px_rgba(56,189,248,0.2)]"
         >
           <span className="relative z-10 flex items-center gap-2">
             Initialize
             <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
           </span>
           <div className="absolute inset-0 bg-film-accent transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-0"></div>
         </button>

         {/* Footer Tech specs */}
         <div className="absolute bottom-[-30vh] md:bottom-12 flex justify-between w-full max-w-2xl text-[9px] font-mono text-zinc-400 uppercase tracking-widest px-4">
            <div className="flex flex-col items-start gap-1">
                <span>Engine: WebGL2</span>
                <span>Shader: Bayer Dither</span>
            </div>
            <div className="flex flex-col items-end gap-1">
                <span>Model: Gemini 2.5</span>
                <span>Latency: 12ms</span>
            </div>
         </div>
      </div>
    </div>
  );
};
