import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const COUNT = 20000;
const PARAMS = { radius: 150, spin: 0.5, hueShift: 0.2, wobble: 0.3 };

export default function ParticleBackground({ burstCount = 0 }) {
    const mountRef = useRef(null);
    // Store positions array so we can scatter them from outside the animation loop
    const positionsRef = useRef(null);
    const burstRef = useRef(burstCount);

    // When burstCount prop changes, scatter the particles
    useEffect(() => {
        if (burstRef.current === burstCount) return; // skip initial mount
        burstRef.current = burstCount;
        const positions = positionsRef.current;
        if (!positions) return;
        // Explode particles to random far-away positions
        for (let i = 0; i < COUNT; i++) {
            positions[i].set(
                (Math.random() - 0.5) * 600,
                (Math.random() - 0.5) * 600,
                (Math.random() - 0.5) * 600
            );
        }
    }, [burstCount]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // ── Scene ──────────────────────────────────────────────────────
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.006);

        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 2000);
        camera.position.set(0, 0, 220);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        // ── Bloom ──────────────────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(
            new THREE.Vector2(mount.clientWidth, mount.clientHeight),
            1.8, 0.4, 0
        );
        composer.addPass(bloom);

        // ── Instanced mesh ─────────────────────────────────────────────
        const geometry = new THREE.TetrahedronGeometry(0.22);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);

        // ── Init positions scattered (like page load) ──────────────────
        const positions = Array.from({ length: COUNT }, () =>
            new THREE.Vector3(
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400
            )
        );
        positionsRef.current = positions;

        const color = new THREE.Color();
        const target = new THREE.Vector3();
        const dummy = new THREE.Object3D();
        for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, color.setHex(0x00ff88));

        // ── Camera orbit ───────────────────────────────────────────────
        let autoAngle = 0;
        const clock = new THREE.Clock();
        let animId;

        function animate() {
            animId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            autoAngle += 0.0012;
            camera.position.x = Math.sin(autoAngle) * 220;
            camera.position.z = Math.cos(autoAngle) * 220;
            camera.lookAt(0, 0, 0);

            const { radius, spin, hueShift, wobble } = PARAMS;

            for (let i = 0; i < COUNT; i++) {
                const phi = Math.acos(1 - 2 * (i + 0.5) / COUNT);
                const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
                const r = radius + Math.sin(time + i * 0.01) * wobble * 20;

                target.set(
                    r * Math.cos(theta + time * spin) * Math.sin(phi),
                    r * Math.sin(theta + time * spin) * Math.sin(phi),
                    r * Math.cos(phi)
                );

                color.setHSL(((i / COUNT) + time * hueShift) % 1, 0.7, 0.5);

                // lerp speed 0.05 — slower = longer dramatic reform after scatter
                positions[i].lerp(target, 0.05);
                dummy.position.copy(positions[i]);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                mesh.setColorAt(i, color);
            }

            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceColor.needsUpdate = true;
            composer.render();
        }

        animate();

        // ── Resize ─────────────────────────────────────────────────────
        const onResize = () => {
            const w = mount.clientWidth, h = mount.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            positionsRef.current = null;
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
