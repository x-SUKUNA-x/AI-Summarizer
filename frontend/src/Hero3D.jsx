import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export default function Hero3D({ className = '' }) {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        const W = mount.clientWidth, H = mount.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
        camera.position.set(0, 0, 70);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        // ── Bloom ──────────────────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 2.2, 0.5, 0);
        composer.addPass(bloom);

        // ── Central torus knot ─────────────────────────────────────────
        const knotGeo = new THREE.TorusKnotGeometry(16, 3.5, 200, 20, 2, 3);
        const knotMat = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6,
            wireframe: true,
        });
        const knot = new THREE.Mesh(knotGeo, knotMat);
        scene.add(knot);

        // ── Solid inner torus knot (smaller, different color) ──────────
        const innerKnotGeo = new THREE.TorusKnotGeometry(10, 1.5, 128, 16, 3, 5);
        const innerKnotMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
        const innerKnot = new THREE.Mesh(innerKnotGeo, innerKnotMat);
        scene.add(innerKnot);

        // ── Orbit rings ────────────────────────────────────────────────
        const rings = [];
        const ringConfigs = [
            { r: 28, tube: 0.3, color: 0x6366f1, rx: Math.PI / 3, ry: 0 },
            { r: 35, tube: 0.2, color: 0x06b6d4, rx: Math.PI / 5, ry: Math.PI / 4 },
            { r: 42, tube: 0.15, color: 0xa78bfa, rx: -Math.PI / 4, ry: Math.PI / 3 },
        ];
        ringConfigs.forEach(cfg => {
            const geo = new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 120);
            const mat = new THREE.MeshBasicMaterial({ color: cfg.color });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = cfg.rx;
            mesh.rotation.y = cfg.ry;
            scene.add(mesh);
            rings.push(mesh);
        });

        // ── Floating particles ─────────────────────────────────────────
        const count = 800;
        const pGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const palette = [
            new THREE.Color(0x8b5cf6),
            new THREE.Color(0x6366f1),
            new THREE.Color(0xec4899),
            new THREE.Color(0x06b6d4),
        ];
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 50 + Math.random() * 25;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            const c = palette[Math.floor(Math.random() * palette.length)];
            colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const pMat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, sizeAttenuation: true });
        scene.add(new THREE.Points(pGeo, pMat));

        // ── Animation ──────────────────────────────────────────────────
        const clock = new THREE.Clock();
        let animId;
        function animate() {
            animId = requestAnimationFrame(animate);
            const t = clock.getElapsedTime();

            knot.rotation.x = t * 0.18;
            knot.rotation.y = t * 0.25;
            innerKnot.rotation.x = -t * 0.22;
            innerKnot.rotation.z = t * 0.30;

            rings[0].rotation.z = t * 0.12;
            rings[1].rotation.z = -t * 0.08;
            rings[2].rotation.x = t * 0.06;

            // Color pulse on outer knot
            const hue = (t * 0.05) % 1;
            knotMat.color.setHSL(hue, 0.9, 0.65);

            composer.render();
        }
        animate();

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
            knotGeo.dispose(); knotMat.dispose();
            innerKnotGeo.dispose(); innerKnotMat.dispose();
            pGeo.dispose(); pMat.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            className={className}
            style={{ pointerEvents: 'none' }}
        />
    );
}
