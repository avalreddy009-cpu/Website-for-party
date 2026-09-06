"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type ShaderAnimationProps = {
  className?: string;
};

export function ShaderAnimation({ className }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    uniforms: {
      time: { value: number };
      resolution: { value: THREE.Vector2 };
    };
    animationId: number;
    geometry: THREE.PlaneGeometry;
    material: THREE.ShaderMaterial;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.05;
        float lineWidth = 0.002;

        vec3 raw = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            raw[j] += lineWidth * float(i * i) /
              abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
          }
        }

        // Regrade the RGB rings into the UTOPIA palette: deep periwinkle,
        // violet haze, and a low ember of signal red on near-black.
        vec3 color =
          raw.r * vec3(0.30, 0.36, 0.98) +
          raw.g * vec3(0.42, 0.30, 0.95) * 0.62 +
          raw.b * vec3(0.95, 0.22, 0.30) * 0.24;

        color *= 0.78;
        // Crush the shadows so the field stays cinematic, not neon-rainbow.
        color = pow(color, vec3(1.18));
        // Vignette into the void.
        color *= smoothstep(2.1, 0.35, length(uv));

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    scene.add(new THREE.Mesh(geometry, material));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      // No WebGL (headless browsers, blocked GPU). Fall back to a still
      // gradient so the intro keeps its timing instead of crashing the tree.
      geometry.dispose();
      material.dispose();
      container.style.background =
        "radial-gradient(ellipse at center, rgba(48,58,157,0.5) 0%, rgba(23,20,64,0.55) 38%, #030307 78%)";
      return;
    }
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const onResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      uniforms.resolution.value.x = renderer.domElement.width;
      uniforms.resolution.value.y = renderer.domElement.height;
    };

    onResize();
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;
      renderer.render(scene, camera);
      if (sceneRef.current) sceneRef.current.animationId = animationId;
    };

    sceneRef.current = {
      renderer,
      uniforms,
      animationId: 0,
      geometry,
      material,
    };

    animate();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-screen w-full"}
      style={{ background: "#000", overflow: "hidden" }}
    />
  );
}
