
import React, { useEffect, useRef, useState } from 'react';
import { FilmSettings } from '../types';
import { renderImage } from '../services/imageProcessing';

interface PreviewCanvasProps {
  imageUrl: string;
  originalUpload: string | null;
  settings: FilmSettings;
  onReupload: () => void;
  comparePos: number;
  setComparePos: (pos: number) => void;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({ 
  imageUrl, originalUpload, settings, onReupload, comparePos, setComparePos 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSnapshot, setDownloadSnapshot] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [renderTime, setRenderTime] = useState(0);
  const [imageFlash, setImageFlash] = useState(false);
  const [holdingOriginal, setHoldingOriginal] = useState(false);

  // Load image object
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.crossOrigin = "anonymous"; 
    img.onload = () => {
      setImageObj(img);
      setImageFlash(true);
      setTimeout(() => setImageFlash(false), 500);
    };
  }, [imageUrl]);

  // Render effect
  useEffect(() => {
    if (canvasRef.current && imageObj) {
      const start = performance.now();
      renderImage(canvasRef.current, imageObj, settings, 1200);
      setRenderTime(Math.round(performance.now() - start));
    }
  }, [imageObj, settings]);

  const handleDownload = () => {
    if (!imageObj) return;
    setIsDownloading(true);

    const tempCanvas = document.createElement('canvas');
    renderImage(tempCanvas, imageObj, settings, 1500); 
    setDownloadSnapshot(tempCanvas.toDataURL('image/jpeg', 0.8));

    setTimeout(() => {
      renderImage(tempCanvas, imageObj, settings, 0); 
      const link = document.createElement('a');
      link.download = 'analog-edit-' + Date.now() + '.jpg';
      link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
      link.click();
      
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadSnapshot(null);
      }, 1500);
    }, 3500);
  };

  // Slider logic
  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setComparePos(percent);
  };

  const onMouseMove = (e: React.MouseEvent) => { 
      if (isDragging) handleMove(e.clientX); 
      
      // 3D Tilt Logic
      if (tiltRef.current && !isDragging) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width; // 0 to 1
          const y = (e.clientY - rect.top) / rect.height; // 0 to 1
          
          const tiltX = (y - 0.5) * 2; // -1 to 1
          const tiltY = (x - 0.5) * -2; // -1 to 1
          
          tiltRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(0.98)`;
      }
  };
  
  const onMouseLeave = () => {
      setIsDragging(false);
      if (tiltRef.current) {
          tiltRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
      }
  }

  const onTouchMove = (e: React.TouchEvent) => { if (isDragging) handleMove(e.touches[0].clientX); };
  const onContainerClick = (e: React.MouseEvent) => { handleMove(e.clientX); };

  if (!imageObj) {
    return <div className="flex-1 flex items-center justify-center text-film-muted animate-pulse">Loading preview...</div>;
  }

  const isAiEdited = originalUpload && originalUpload !== imageUrl;

  return (
    <div className="flex-1 flex flex-col h-full relative bg-[#050505]">
      
      {/* Header Toolbar */}
      <div className="h-14 border-b border-film-border flex items-center justify-between px-4 bg-film-bg/90 backdrop-blur z-20">
        <div className="flex items-center gap-4">
           <button 
             onClick={onReupload}
             className="text-film-muted hover:text-white flex items-center gap-2 text-xs font-medium hover:bg-film-panel px-2 py-1 rounded transition-colors"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             Back
           </button>
           <div className="h-4 w-px bg-film-border hidden sm:block"></div>
           <span className="text-film-muted text-xs font-mono hidden sm:block">
             {imageObj.naturalWidth} × {imageObj.naturalHeight}
           </span>
           {isAiEdited && (
             <button
               onMouseDown={() => setHoldingOriginal(true)}
               onMouseUp={() => setHoldingOriginal(false)}
               onMouseLeave={() => setHoldingOriginal(false)}
               onTouchStart={() => setHoldingOriginal(true)}
               onTouchEnd={() => setHoldingOriginal(false)}
               className="ml-4 px-2 py-1 bg-zinc-800 text-[10px] text-film-accent uppercase font-bold rounded hover:bg-zinc-700 active:bg-film-accent active:text-black select-none transition-all"
             >
                Hold: Compare Original
             </button>
           )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className={`p-1.5 rounded hover:bg-film-panel transition-colors ${showDebug ? 'text-film-accent' : 'text-film-muted'}`}
            title="Debug Info"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </button>

          <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-film-text text-black hover:bg-white disabled:opacity-50 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 shadow-lg shadow-white/5"
          >
            {isDownloading ? 'Printing...' : 'Download'}
          </button>
        </div>
      </div>

      {/* Canvas Container Area */}
      {/* On mobile, allow resizing but maintain padding */}
      <div className="flex-1 relative overflow-hidden bg-checkerboard bg-checker flex items-center justify-center p-4"
           onMouseMove={onMouseMove}
           onTouchMove={onTouchMove}
           onMouseUp={() => setIsDragging(false)}
           onTouchEnd={() => setIsDragging(false)}
           onMouseLeave={onMouseLeave}
      >
        <div 
          ref={tiltRef}
          style={{ transition: 'transform 0.1s ease-out' }}
        >
            <div 
            ref={containerRef}
            className="relative shadow-2xl shadow-black/50 group select-none"
            style={{ 
                height: 'auto',
                width: 'auto',
                maxHeight: '60vh', // Smaller on mobile to ensure visibility
                maxWidth: '100%', 
                aspectRatio: `${imageObj.width} / ${imageObj.height}` 
            }}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onClick={onContainerClick}
            >
                {/* Flash Effect overlay for Image Update */}
                <div className={`absolute inset-0 bg-white z-40 pointer-events-none transition-opacity duration-500 ${imageFlash ? 'opacity-30' : 'opacity-0'}`}></div>

                {/* 1. Source Image (Current Working Copy - might be AI edited) */}
                <img 
                src={imageUrl} 
                alt="Source"
                className="block w-full h-full object-contain"
                draggable={false}
                />

                {/* 2. Processed Canvas (Clipped) */}
                <div 
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ 
                        clipPath: `inset(0 0 0 ${comparePos}%)` 
                    }}
                >
                    <canvas 
                        ref={canvasRef} 
                        className="w-full h-full object-contain block"
                    />
                </div>

                {/* 3. Original Upload Overlay (If Held) */}
                {holdingOriginal && originalUpload && (
                <div className="absolute inset-0 z-50 border-2 border-film-accent">
                    <img src={originalUpload} className="w-full h-full object-contain bg-black" alt="Original Upload" />
                    <div className="absolute top-4 left-4 bg-black/80 text-film-accent px-3 py-2 text-xs font-bold rounded border border-film-accent/50 shadow-xl">
                        ORIGINAL UPLOAD
                    </div>
                </div>
                )}

                {/* 4. Slider Handle */}
                <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white/60 cursor-ew-resize z-30 hover:bg-film-accent transition-colors"
                    style={{ left: `${comparePos}%` }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 backdrop-blur-md rounded-full border border-white/40 flex items-center justify-center shadow-xl transform transition-transform hover:scale-110">
                        <svg className="w-4 h-4 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" transform="rotate(90 12 12)" />
                        </svg>
                    </div>
                </div>

                {/* Labels */}
                <div className={`absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 text-[10px] font-bold text-white/80 backdrop-blur pointer-events-none transition-opacity duration-200 ${comparePos < 10 ? 'opacity-0' : 'opacity-100'}`}>
                    {isAiEdited ? 'AI BASE' : 'ORIGINAL'}
                </div>
                <div className={`absolute bottom-3 right-3 px-2 py-1 rounded bg-film-accent/80 text-[10px] font-bold text-black backdrop-blur pointer-events-none transition-opacity duration-200 ${comparePos > 90 ? 'opacity-0' : 'opacity-100'}`}>
                    DEVELOPED
                </div>
            </div>
        </div>
      </div>

      {/* Download Animation Overlay */}
      {isDownloading && downloadSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="bg-white p-4 pb-20 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-dropIn transform w-[340px]">
             <div className="aspect-[4/5] bg-zinc-900 overflow-hidden relative shadow-inner border border-zinc-100">
                <img src={downloadSnapshot} className="w-full h-full object-cover animate-develop" alt="Developing..." />
             </div>
             <div className="absolute bottom-6 left-0 right-0 text-center">
               <span className="font-handwriting text-zinc-400 text-sm animate-pulse font-mono tracking-widest opacity-70">DEVELOPING...</span>
             </div>
          </div>
        </div>
      )}

       {/* Debug Overlay */}
       {showDebug && (
        <div className="absolute top-16 left-4 z-50 w-56 bg-black/80 border border-film-border p-3 text-[10px] font-mono text-film-accent rounded shadow-xl backdrop-blur-md pointer-events-none">
          <div className="font-bold border-b border-white/10 pb-1 mb-2 text-white">DEBUG METRICS</div>
          <div className="grid grid-cols-2 gap-1">
             <span className="text-film-muted">Time:</span> <span>{renderTime}ms</span>
             <span className="text-film-muted">Src:</span> <span>{imageObj.naturalWidth}x{imageObj.naturalHeight}</span>
             <span className="text-film-muted">Canvas:</span> <span>{canvasRef.current?.width}x{canvasRef.current?.height}</span>
             <span className="text-film-muted">Halation:</span> <span>{settings.halation}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
