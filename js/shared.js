// Shared uniforms + material patches (underwater tint, caustics, wet rocks, wind)
import * as THREE from 'three';
import { FALL_Z, FALL_H, WL_SLOPE } from './world.js';

export const shared = {
  uTime: { value: 0 },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
};

export const GLSL_COMMON = /* glsl */`
float waterLevelAt(float z){
  return ${(-WL_SLOPE).toFixed(4)}*z + ${FALL_H.toFixed(3)}*(1.0 - smoothstep(${(FALL_Z - 1.5).toFixed(3)}, ${FALL_Z.toFixed(3)}, z));
}
float causticF(vec2 uv, float time){
  vec2 p = mod(uv*6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n+1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0/length(vec2(p.x / (sin(i.x+t)/inten), p.y / (cos(i.y+t)/inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.5);
}
`;

/**
 * opts: { underwater: bool, wind: {height, amp} }
 */
export function patchMaterial(mat, opts = {}) {
  const key = JSON.stringify(opts);
  mat.customProgramCacheKey = () => 'patch' + key;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uSunColor = shared.uSunColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWPos = (modelMatrix * wp).xyz;
        }`);
    if (opts.wind) {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #endif
          float hgt = max(position.y, 0.0) / ${opts.wind.height.toFixed(2)};
          float sw = hgt * hgt * ${opts.wind.amp.toFixed(3)};
          float gust = 0.6 + 0.4 * sin(uTime * 0.37 + ip.z * 0.05);
          transformed.x += sin(uTime * 1.3 + ip.x * 0.2 + ip.z * 0.13) * sw * gust;
          transformed.z += cos(uTime * 1.1 + ip.z * 0.21 + ip.x * 0.07) * sw * 0.6 * gust;
        }`);
    }
    if (opts.underwater) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uSunColor;\nvarying vec3 vWPos;\n' + GLSL_COMMON)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float wlv = waterLevelAt(vWPos.z);
          float uw = wlv - vWPos.y;
          float uwF = smoothstep(0.0, 0.04, uw);
          float dF = clamp(uw / 2.2, 0.0, 1.0);
          vec3 tinted = diffuseColor.rgb * mix(vec3(0.78, 0.95, 0.86), vec3(0.22, 0.45, 0.42), dF);
          diffuseColor.rgb = mix(diffuseColor.rgb, tinted, uwF);
          float wet = (1.0 - uwF) * (1.0 - smoothstep(0.0, 0.2, -uw));
          diffuseColor.rgb *= mix(1.0, 0.62, wet);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.35, max(wet, uwF * 0.5));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float ca = causticF(vWPos.xz * 0.33, uTime * 0.55);
            totalEmissiveRadiance += uSunColor * ca * 0.22 * uwF * (1.0 - dF * 0.8) * diffuseColor.rgb;
          }`);
    }
  };
  return mat;
}
