import * as THREE from 'three';
import { shared } from './shared.js';

export function buildSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: shared.uSunDir,
    uSunColor: shared.uSunColor,
    uTime: shared.uTime,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.02+vec2(3.1,1.7); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.45));
        float s = max(dot(d, uSunDir), 0.0);
        vec3 sunc = uSunColor / max(1.0, max(uSunColor.r, max(uSunColor.g, uSunColor.b)));
        col += sunc * (pow(s, 900.0) * 12.0 + pow(s, 14.0) * 0.3 + pow(s, 3.0) * 0.08);
        if (d.y > 0.0) {
          vec2 cp = d.xz / (d.y + 0.12) * 1.1 + vec2(uTime * 0.008, uTime * 0.003);
          float c = fbm(cp);
          c = smoothstep(0.48, 0.78, c) * smoothstep(0.0, 0.2, d.y);
          vec3 cc = mix(uHorizon * 1.05, vec3(1.0) * (0.55 + 0.45 * sunc), 0.55);
          col = mix(col, cc, c * 0.8);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
