import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fractal brownian motion aurora shader — dark backdrop, glowing color streaks
const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Hash function
  vec3 hash3(vec2 p) {
    vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                  dot(p, vec2(269.5, 183.3)),
                  dot(p, vec2(419.2, 371.9)));
    return fract(sin(q) * 43758.5453);
  }

  // Value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = dot(hash3(i),            vec3(1.0, 0.0, 0.0));
    float b = dot(hash3(i + vec2(1,0)), vec3(1.0, 0.0, 0.0));
    float c = dot(hash3(i + vec2(0,1)), vec3(1.0, 0.0, 0.0));
    float d = dot(hash3(i + vec2(1,1)), vec3(1.0, 0.0, 0.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal brownian motion
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++) {
      v += amp * noise(p);
      p = rot * p * 2.1 + vec2(0.3 * float(i));
      amp *= 0.48;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    // slow morph over time
    float t = uTime * 0.08;

    // domain warping — two layers give organic swirl
    vec2 q;
    q.x = fbm(uv * 2.2 + vec2(0.00, 0.00) + t * 0.5);
    q.y = fbm(uv * 2.2 + vec2(5.20, 1.30) + t * 0.4);

    vec2 r;
    r.x = fbm(uv * 1.8 + 4.0 * q + vec2(1.7, 9.2) + t * 0.6);
    r.y = fbm(uv * 1.8 + 4.0 * q + vec2(8.3, 2.8) + t * 0.55);

    float f = fbm(uv * 1.4 + 4.0 * r + t * 0.3);

    // Color palette: deep indigo, purple, teal, pink — stays dark overall
    vec3 col = vec3(0.0);

    // Base layer — very dark navy
    col = mix(col, vec3(0.02, 0.02, 0.08), 1.0);

    // Indigo/purple vein
    col = mix(col, vec3(0.18, 0.10, 0.55), clamp(f * f * 3.5, 0.0, 1.0));

    // Cyan-teal highlight
    col = mix(col, vec3(0.05, 0.55, 0.72), clamp(length(q) * 0.8, 0.0, 1.0));

    // Hot pink / magenta edge
    col = mix(col, vec3(0.85, 0.15, 0.55), clamp(pow(f, 3.0) * 1.8, 0.0, 1.0));

    // Soft lilac bloom
    col = mix(col, vec3(0.55, 0.35, 0.95), clamp(f * length(r) * 1.2, 0.0, 1.0));

    // Final brightness — keep it subtle so UI text is readable
    float brightness = f * f * f + 0.55 * f * f + 0.3 * f;
    col = col * brightness * 1.6;

    // Vignette — darkens edges, focuses center
    vec2 center = vUv - 0.5;
    float vignette = 1.0 - dot(center, center) * 2.0;
    col *= clamp(vignette, 0.0, 1.0);

    // Keep overall very dark so text stays readable
    col = clamp(col * 0.75, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function AuroraBackground() {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const W = mount.clientWidth, H = mount.clientHeight;

        // Scene with a single fullscreen quad
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
        renderer.setSize(W, H);
        // Render at half resolution for performance, CSS stretches it
        renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.75, 1.5));
        mount.appendChild(renderer.domElement);

        const uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(W, H) },
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        scene.add(new THREE.Mesh(geometry, material));

        const clock = new THREE.Clock();
        let animId;

        function animate() {
            animId = requestAnimationFrame(animate);
            uniforms.uTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);
        }
        animate();

        const onResize = () => {
            const w = mount.clientWidth, h = mount.clientHeight;
            renderer.setSize(w, h);
            uniforms.uResolution.value.set(w, h);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
                width: '100vw',
                height: '100vh',
            }}
        />
    );
}
