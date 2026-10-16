import * as THREE from 'three'
import type { SeasonPreset } from '../game/types'

function hexToRgb(hex: string) {
  const c = new THREE.Color(hex)
  return [
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
  ] as [number, number, number]
}

/**
 * 程序化 equirect 天空。没有 HDR 文件 —— 一张按预设 stop 画的 512×256 画布。
 * 它同时充当：① 场景背景（四季的纸面底色）② 太阳方位上的高光斑。
 */
export function buildSkyTexture(p: SeasonPreset): THREE.Texture {
  const W = 512
  const H = 256
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!

  const g = ctx.createLinearGradient(0, 0, 0, H)
  const [t0, t1, t2] = hexToRgb(p.sky.top)
  const [m0, m1, m2] = hexToRgb(p.sky.mid)
  const [h0, h1, h2] = hexToRgb(p.sky.horizon)
  const [b0, b1, b2] = hexToRgb(p.sky.bottom)
  g.addColorStop(0, `rgb(${t0},${t1},${t2})`)
  g.addColorStop(0.34, `rgb(${m0},${m1},${m2})`)
  g.addColorStop(0.5, `rgb(${h0},${h1},${h2})`)
  g.addColorStop(0.62, `rgb(${b0},${b1},${b2})`)
  g.addColorStop(1, `rgb(${b0},${b1},${b2})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // 太阳斑：方向光从这儿来，环境里就有个软亮区
  const su = ((p.sun.azimuth / (Math.PI * 2)) % 1 + 1) % 1
  const sv = 0.5 - (p.sun.elevation / (Math.PI / 2)) * 0.48
  const sx = su * W
  const sy = Math.max(8, Math.min(H * 0.5, sv * H))
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.19)
  const [sr, sg, sb] = hexToRgb(p.sun.color)
  sun.addColorStop(0, `rgba(${sr},${sg},${sb},0.95)`)
  sun.addColorStop(0.35, `rgba(${sr},${sg},${sb},0.30)`)
  sun.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, W, H)

  const t = new THREE.CanvasTexture(cv)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** 供局部反光件（喷泉水面等）用的 PMREM 环境贴图 */
export function buildSkyPMREM(renderer: THREE.WebGLRenderer, p: SeasonPreset): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const src = buildSkyTexture(p)
  const rt = pmrem.fromEquirectangular(src)
  src.dispose()
  pmrem.dispose()
  return rt.texture
}

const DOME_VERT = `
varying vec3 vDir;
void main() {
  // 天穹始终跟着相机，所以物体空间的球面点方向就是视线方向
  vDir = normalize( position );
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
}
`

const DOME_FRAG = `
uniform vec3 cTop;
uniform vec3 cMid;
uniform vec3 cHor;
uniform vec3 cBot;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGlow;
varying vec3 vDir;
void main() {
  vec3 d = vDir;
  float up = d.y;
  vec3 col;
  if ( up > 0.0 ) {
    col = mix( cHor, mix( cMid, cTop, smoothstep( 0.30, 1.0, up ) ), smoothstep( 0.0, 0.30, up ) );
  } else {
    col = mix( cHor, cBot, smoothstep( 0.0, 0.62, -up ) );
  }
  float sd = max( dot( d, uSunDir ), 0.0 );
  col += uSunColor * pow( sd, 18.0 ) * uGlow;
  gl_FragColor = vec4( col, 1.0 );
}
`

/**
 * 程序化天穹：一个跟着相机走的球，靠 4 个渐变 stop + 太阳斑画出天空。
 * 不用 HDR、不用贴图文件；换季只改 4 个颜色 uniform。
 */
export function makeSkyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      cTop: { value: new THREE.Color('#bcdcf0') },
      cMid: { value: new THREE.Color('#dbeaf3') },
      cHor: { value: new THREE.Color('#f6f5ea') },
      cBot: { value: new THREE.Color('#e7ead9') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color('#fff3dd') },
      uGlow: { value: 0.22 },
    },
    vertexShader: DOME_VERT,
    fragmentShader: DOME_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16), mat)
  mesh.renderOrder = -1000
  mesh.frustumCulled = false
  mesh.name = 'skyDome'
  return mesh
}

export function applySkyDome(dome: THREE.Mesh, p: SeasonPreset) {
  const u = (dome.material as THREE.ShaderMaterial).uniforms
  u.cTop.value.set(p.sky.top)
  u.cMid.value.set(p.sky.mid)
  u.cHor.value.set(p.sky.horizon)
  u.cBot.value.set(p.sky.bottom)
  u.uSunColor.value.set(p.sun.color)
  const ce = Math.cos(p.sun.elevation)
  u.uSunDir.value
    .set(Math.cos(p.sun.azimuth) * ce, Math.sin(p.sun.elevation), Math.sin(p.sun.azimuth) * ce)
    .normalize()
  u.uGlow.value = p.id === 'winter' ? 0.14 : 0.24
}

/** 把季节点光源配置写进场景（唯一写入点，换季只改灯，绝不重建几何） */
export function applySeasonToLights(
  p: SeasonPreset,
  sun: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight,
  amb: THREE.AmbientLight,
) {
  sun.color.set(p.sun.color)
  sun.intensity = p.sun.intensity
  const r = 62
  sun.position.set(
    Math.cos(p.sun.azimuth) * Math.cos(p.sun.elevation) * r,
    Math.sin(p.sun.elevation) * r,
    Math.sin(p.sun.azimuth) * Math.cos(p.sun.elevation) * r,
  )
  hemi.color.set(p.hemi.skyColor)
  hemi.groundColor.set(p.hemi.groundColor)
  hemi.intensity = p.hemi.intensity
  amb.color.set(p.ambient.color)
  amb.intensity = p.ambient.intensity
}
