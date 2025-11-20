
import { FilmSettings } from "../types";

// Helper to clamp values
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

// Helper for Hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export const renderImage = (
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  settings: FilmSettings,
  maxResolution: number = 0
) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // Calculate target dimensions
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Safety check for zero dimension images
  if (width === 0 || height === 0) return;

  if (maxResolution > 0) {
    const maxDim = Math.max(width, height);
    if (maxDim > maxResolution) {
      const scale = maxResolution / maxDim;
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
  }

  // Ensure positive integer dimensions
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));

  // Update canvas logic size
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  // 1. Draw Base Image
  ctx.filter = 'none';
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, 0, 0, width, height);

  // 2. Halation Pass (Must be done before pixel manipulation to get organic bloom source)
  // Halation creates a red/orange glow around highlights, typical of Cinestill
  if (settings.halation > 0) {
    ctx.save();
    const tempCanvas = document.createElement('canvas');
    // Lower res for blur performance and softer glow
    const smallW = Math.max(20, Math.floor(width / 4));
    const smallH = Math.max(20, Math.floor(height / 4));
    tempCanvas.width = smallW;
    tempCanvas.height = smallH;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
        // Draw high contrast version to isolate highlights
        tempCtx.filter = 'contrast(200%) brightness(150%) grayscale(100%)';
        tempCtx.drawImage(canvas, 0, 0, smallW, smallH);
        
        // Blur the highlights
        ctx.globalCompositeOperation = 'screen'; 
        ctx.filter = `blur(${Math.max(2, width * 0.02)}px) sepia(100%) saturate(300%) hue-rotate(-50deg)`; // Red/Orange Tint
        ctx.globalAlpha = settings.halation / 100;
        ctx.drawImage(tempCanvas, 0, 0, width, height);
        ctx.filter = 'none';
    }
    ctx.restore();
  }

  // 3. Pixel Manipulation (Color Grading & Grain)
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const exposureFactor = Math.pow(2, settings.exposure / 50); // More natural log exposure
  const contrastVal = settings.contrast;
  const saturationFactor = (settings.saturation + 100) / 100; 
  
  const warmth = settings.warmth; 
  const rWarmth = warmth > 0 ? 1 + (warmth / 150) : 1;
  const bWarmth = warmth < 0 ? 1 + (Math.abs(warmth) / 150) : 1 - (warmth / 150);
  
  // REDUCED GRAIN STRENGTH (User request: -20%)
  // Previously 2.5, now 2.0
  const grainAmount = settings.grain * 2.0; 
  
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Normalize to 0-1 for calculations
    r /= 255;
    g /= 255;
    b /= 255;

    // Exposure (Linear)
    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;

    // Film-like Contrast (S-Curve)
    // Instead of linear contrast, we push shadows down and highlights up non-linearly
    if (contrastVal !== 0) {
        const factor = (1.015 * (contrastVal + 100.0)) / (100.0 * (1.015 - contrastVal / 100.0));
        r = factor * (r - 0.5) + 0.5;
        g = factor * (g - 0.5) + 0.5;
        b = factor * (b - 0.5) + 0.5;
    }

    // Clamp before saturation to avoid weird artifacts
    r = clamp(r, 0, 1);
    g = clamp(g, 0, 1);
    b = clamp(b, 0, 1);

    // Saturation
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * saturationFactor;
    g = gray + (g - gray) * saturationFactor;
    b = gray + (b - gray) * saturationFactor;

    // Warmth (White Balance)
    r *= rWarmth;
    b *= bWarmth;

    // Convert back to 0-255
    r *= 255;
    g *= 255;
    b *= 255;

    // Organic Grain (Luminance based)
    // Film grain is more visible in midtones than pure black/white
    if (grainAmount > 0) {
      const luma = (r + g + b) / 3;
      // Grain mask: weakest at 0 and 255, strongest at 128
      const grainStrength = 1 - Math.abs((luma / 127.5) - 1); 
      // Ensure grainStrength is safe
      const safeGrainStrength = isNaN(grainStrength) ? 0 : grainStrength;
      const noise = (Math.random() - 0.5) * grainAmount * safeGrainStrength;
      r += noise;
      g += noise;
      b += noise;
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);

  // 4. Strong Vignette (Organic lens falloff with color support)
  if (settings.vignette > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    
    // Smaller radius = vignette encroaches more on the image
    const radius = Math.max(width, height) * 0.65; 
    
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, radius * 0.4, 
      width / 2, height / 2, radius
    );
    
    const rgb = hexToRgb(settings.vignetteColor || '#000000');
    
    // Center is transparent
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    // Smooth ramp
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${settings.vignette * 0.005})`);
    
    // Outer edges
    const vStrength = (settings.vignette / 80); // Increase strength factor
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, vStrength)})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 5. Bloom/Softness (Dreamy effect)
  if (settings.blur > 0) {
    ctx.save();
    const tempCanvas = document.createElement('canvas');
    const smallW = Math.max(20, Math.floor(width / 3));
    const smallH = Math.max(20, Math.floor(height / 3));
    tempCanvas.width = smallW;
    tempCanvas.height = smallH;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0, smallW, smallH);
        
        ctx.globalCompositeOperation = 'screen'; 
        ctx.filter = `blur(${Math.max(1, width * 0.01 * (settings.blur/20))}px)`; 
        ctx.globalAlpha = settings.blur / 100; 
        ctx.drawImage(tempCanvas, 0, 0, width, height);
    }
    ctx.restore();
  }
};
