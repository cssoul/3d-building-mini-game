import * as THREE from 'three'
import type { SeasonPreset } from '../game/types'

const VERT = `
attribute vec3 aSeed;
attribute float aVar;
uniform float uTime;
uniform float uSpeed;
uniform float uSwirl;
uniform float uPx;
uniform float uSpan;
uniform float uTop;
varying float vFade;
varying float vRot;
void main() {
  float t = fract( aSeed.z + uTime * uSpeed * ( 0.55 + aVar * 0.9 ) );
  float y = uTop * ( 1.0 - t ) - 1.4;
  float px = ( aSeed.x - 0.5 ) * uSpan + sin( uTime * 0.55 + aSeed.z * 9.0 ) * uSwirl * 3.2;
  float pz = ( aSeed.y - 0.5 ) * uSpan + cos( uTime * 0.47 + aSeed.z * 7.0 ) * uSwirl * 3.2;
  vFade = smoothstep( 0.0, 0.07, t ) * ( 1.0 - smoothstep( 0.88, 1.0, t ) ) * ( 0.3 + aVar * 0.7 );
  vRot = aSeed.z * 6.28 + uTime * ( 1.2 + aVar * 2.0 );
  vec4 mv = modelViewMatrix * vec4( px, y, pz, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * ( 0.6 + aVar * 0.8 );
}
`

const FRAG = `
uniform vec3 uColor;
uniform float uSquash;
varying float vFade;
varying float vRot;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float c = cos( vRot );
  float s = sin( vRot );
  d = vec2( d.x * c - d.y * s, d.x * s + d.y * c );
  d.x /= uSquash;
  float a = 1.0 - smoothstep( 0.08, 0.5, length( d ) );
  if ( a < 0.02 ) discard;
  gl_FragColor = vec4( uColor, a * vFade * 0.9 );
}
`

/**
 * 四季粒子场：花瓣 / 飞絮 / 落叶 / 落雪。
 * 全部在顶点着色器里按 uTime 循环下落，CPU 每帧只写一个 scalar。
 */
export class SeasonField {
  readonly points: THREE.Points
  private uniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 1.5 },
    uSwirl: { value: 1.2 },
    uPx: { value: 7 },
    uSpan: { value: 70 },
    uTop: { value: 10 },
    uColor: { value: new THREE.Color('#ffd4e4') },
    uSquash: { value: 0.6 },
  }
  private max: number

  constructor(max = 800, span = 70) {
    this.max = max
    const seed = new Float32Array(max * 3)
    const vr = new Float32Array(max)
    for (let i = 0; i < max; i++) {
      seed[i * 3] = Math.random()
      seed[i * 3 + 1] = Math.random()
      seed[i * 3 + 2] = Math.random()
      vr[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    g.setAttribute('aVar', new THREE.BufferAttribute(vr, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), span)
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    this.uniforms.uSpan.value = span
    this.points = new THREE.Points(g, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 3
    this.setPreset(null)
  }

  setPreset(p: SeasonPreset | null, pixelRatio = 1) {
    if (!p) {
      this.points.visible = false
      return
    }
    this.points.visible = true
    this.uniforms.uColor.value.set(p.particles.color)
    this.uniforms.uSpeed.value = p.particles.speed * 0.16
    this.uniforms.uSwirl.value = p.particles.swirl
    this.uniforms.uPx.value = p.particles.size * pixelRatio
    this.uniforms.uSquash.value = p.particles.mode === 'snow' ? 1 : p.particles.mode === 'petal' ? 0.62 : 0.78
    const n = Math.min(this.max, p.particles.count)
    this.points.geometry.setDrawRange(0, n)
  }

  update(t: number) {
    this.uniforms.uTime.value = t
  }
}
