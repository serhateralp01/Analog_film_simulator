
import React, { useEffect, useRef, useState } from 'react';
import { FilmSettings } from '../types';
import { renderImage } from '../services/imageProcessing';

interface HistogramProps {
  imageSrc: string | null;
  settings: FilmSettings;
  comparePos: number;
}

export const Histogram: React.FC<HistogramProps> = ({ imageSrc, settings, comparePos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  // Logic matches PreviewCanvas: 
  // Right side of slider (>50%) reveals Original. 
  // Left side of slider (<50%) reveals Developed.
  const showOriginal = comparePos > 50;
  const showDeveloped = comparePos <= 50;

  // We calculate blend based on slider proximity to center to smooth the transition
  // 0-45% = Mostly Dev, 45-55% = Blend, 55-100% = Mostly Orig
  const blendFactor = Math.max(0, Math.min(1, (comparePos - 45) / 10)); 
  // 0 = Dev Fully Visible, 1 = Orig Fully Visible

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "anonymous";
    img.onload = () => setImgObj(img);
  }, [imageSrc]);

  useEffect(() => {
    if (!imgObj || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    if (width === 0 || height === 0) return;

    // Use low res for performance
    const w = 200; 
    const h = Math.floor(w * (imgObj.height / imgObj.width));
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    // --- DATA COLLECTION HELPER ---
    const getHistogramData = (useSettings: boolean) => {
        tCtx.clearRect(0, 0, w, h);
        if (!useSettings) {
            tCtx.drawImage(imgObj, 0, 0, w, h);
        } else {
            renderImage(tempCanvas, imgObj, settings, w);
        }
        
        const pixelData = tCtx.getImageData(0, 0, w, h).data;
        const rCounts = new Array(256).fill(0);
        const gCounts = new Array(256).fill(0);
        const bCounts = new Array(256).fill(0);
        
        for (let i = 0; i < pixelData.length; i += 4) {
            rCounts[pixelData[i]]++;
            gCounts[pixelData[i+1]]++;
            bCounts[pixelData[i+2]]++;
        }
        return { r: rCounts, g: gCounts, b: bCounts };
    };

    const originalData = getHistogramData(false);
    const developedData = getHistogramData(true);

    // --- SCALING LOGIC ---
    // Instead of finding the absolute MAX peak (which flattens the graph if there's a huge spike),
    // we calculate the Average height and allow peaks to go up to 5x the average.
    // Anything higher is clipped visually.
    const totalPixels = w * h;
    const averageCount = totalPixels / 256;
    const scaleLimit = averageCount * 6; // Allow peaks 6x higher than average

    // --- DRAWING HELPER ---
    ctx.clearRect(0, 0, width, height);
    
    const drawGraph = (r: number[], g: number[], b: number[], opacity: number, isColor: boolean) => {
        if (opacity <= 0.01) return;
        
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = 'screen';

        const drawChannel = (counts: number[], color: string) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, height);
            
            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * width;
                // Normalize based on our safe scale limit
                let val = counts[i] / scaleLimit;
                
                // Optional: Apply smooth roll-off for extreme values so they don't hit ceiling too hard
                if (val > 1) val = 1; 
                
                const barHeight = val * height;
                ctx.lineTo(x, height - barHeight);
            }
            
            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fill();
        };

        if (isColor) {
            drawChannel(r, 'rgba(255, 80, 80, 0.8)');   // R
            drawChannel(g, 'rgba(80, 255, 80, 0.8)');   // G
            drawChannel(b, 'rgba(80, 80, 255, 0.8)');   // B
        } else {
            // Luma for Original
            const luma = new Array(256).fill(0);
            for(let i=0; i<256; i++) luma[i] = (r[i] + g[i] + b[i]) / 3;
            drawChannel(luma, 'rgba(200, 200, 200, 0.6)');
        }
    };

    // Draw blended graphs
    // 1. Draw Developed (fades out as slider goes right)
    drawGraph(developedData.r, developedData.g, developedData.b, 1 - blendFactor, true);

    // 2. Draw Original (fades in as slider goes right)
    drawGraph(originalData.r, originalData.g, originalData.b, blendFactor, false);

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

  }, [imgObj, settings, blendFactor]);

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 mb-4 shadow-inner relative group select-none transition-colors duration-300">
      <div className="flex justify-between text-[9px] text-zinc-400 mb-2 uppercase font-bold tracking-wider">
        <span>Shadows</span>
        <span className="flex gap-2">
           <span style={{ opacity: Math.max(0.3, blendFactor) }} className="transition-opacity">ORIG (LUMA)</span>
           <span className="text-zinc-700">/</span>
           <span style={{ opacity: Math.max(0.3, 1 - blendFactor) }} className="text-film-accent transition-opacity">DEV (RGB)</span>
        </span>
        <span>Highlights</span>
      </div>
      <canvas ref={canvasRef} width={280} height={90} className="w-full h-24 block mix-blend-screen" />
    </div>
  );
};
