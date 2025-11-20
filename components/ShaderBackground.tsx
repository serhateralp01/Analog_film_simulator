
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ShaderBackgroundProps {
  intensity?: number;
}

export const ShaderBackground: React.FC<ShaderBackgroundProps> = ({ intensity = 1.0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));
  const frameIdRef = useRef<number>(0);

  // 1. Initialization Effect (Runs Once)
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 1;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Custom Dither Shader
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform float uIntensity;
      varying vec2 vUv;

      // Bayer Matrix 4x4 for Dithering
      float bayerDither(vec2 uv) {
        int x = int(mod(uv.x * uResolution.x, 4.0));
        int y = int(mod(uv.y * uResolution.y, 4.0));
        int index = x + y * 4;
        float limit = 0.0;
        if (index == 0) limit = 0.0625;
        else if (index == 1) limit = 0.5625;
        else if (index == 2) limit = 0.1875;
        else if (index == 3) limit = 0.6875;
        else if (index == 4) limit = 0.8125;
        else if (index == 5) limit = 0.3125;
        else if (index == 6) limit = 0.9375;
        else if (index == 7) limit = 0.4375;
        else if (index == 8) limit = 0.25;
        else if (index == 9) limit = 0.75;
        else if (index == 10) limit = 0.125;
        else if (index == 11) limit = 0.625;
        else if (index == 12) limit = 1.0;
        else if (index == 13) limit = 0.5;
        else if (index == 14) limit = 0.875;
        else if (index == 15) limit = 0.375;
        return limit;
      }

      // Simple Noise
      float random (in vec2 _st) {
        return fract(sin(dot(_st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      float noise (in vec2 _st) {
        vec2 i = floor(_st);
        vec2 f = fract(_st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 st = gl_FragCoord.xy / uResolution.xy;
        float aspect = uResolution.x / uResolution.y;
        st.x *= aspect;

        // Flowing liquid effect
        float n = noise(st * 3.0 + uTime * 0.1);
        n += noise(st * 6.0 - uTime * 0.15) * 0.5;
        
        // Mouse interaction
        float dist = distance(st, vec2(uMouse.x * aspect, 1.0 - uMouse.y));
        float interact = smoothstep(0.5, 0.0, dist) * 0.2;
        
        // Combine
        float val = n + interact;
        
        // Color Palette (Dark Zinc to Sky Blue)
        vec3 c1 = vec3(0.02, 0.02, 0.03); // Zinc 950
        vec3 c2 = vec3(0.05, 0.05, 0.1);  // Deep Blue-Grey
        vec3 c3 = vec3(0.22, 0.74, 0.97); // Sky 400
        
        vec3 color = mix(c1, c2, val);
        // Highlight
        color = mix(color, c3, smoothstep(0.7, 1.0, val) * uIntensity);

        // Apply Dither
        float ditherLimit = bayerDither(vUv);
        
        // Quantize colors based on dither
        float brightness = (color.r + color.g + color.b) / 3.0;
        
        vec3 finalColor = color;
        if (brightness < ditherLimit) {
           finalColor *= 0.8; // Darken
        } else {
           finalColor *= 1.2; // Lighten
        }
        
        // Vignette
        vec2 uv = vUv * (1.0 - vUv.yx);
        float vig = uv.x*uv.y * 15.0;
        vig = pow(vig, 0.15);
        finalColor *= vig;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uIntensity: { value: intensity } // Initial value
      }
    });
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    // Animation Loop
    const clock = new THREE.Clock();
    
    const animate = () => {
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
        materialRef.current.uniforms.uMouse.value.lerp(mouseRef.current, 0.05);
      }
      if (renderer && scene && camera) {
          renderer.render(scene, camera);
      }
      frameIdRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Event Listeners
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && materialRef.current) {
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        materialRef.current.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.set(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameIdRef.current);
      if(containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []); // Dependencies empty: Only mount once!

  // 2. Intensity Update Effect (Runs when prop changes)
  useEffect(() => {
    if (materialRef.current) {
      // Smoothly animate to new intensity if needed, but direct set is fine for now
      materialRef.current.uniforms.uIntensity.value = intensity;
    }
  }, [intensity]);

  return <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none" />;
};
