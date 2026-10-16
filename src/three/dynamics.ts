import * as THREE from 'three'
import { PALETTE } from '../game/constants'
import { Geo, boxGeo, coneGeo, hipRoofGeo, sphereGeo, torusGeo, withWhiteColor } from './geo'
import { matFountain, matGlow, matSolid } from './materials'

const P = PALETTE
const _sv = new THREE.Vector3(1, 1, 1)
const _pv = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

export interface Dynamic {
  group: THREE.Group
  /** t: 游戏内累计秒（暂停则停），dt: 帧间隔 */
  update(t: number, dt: number): void
}

type Factory = (seed: number) => Dynamic

const mergedMesh = (g: Geo) => new THREE.Mesh(g.toGeometry(), matSolid)

const glowMesh = (g: Geo) => new THREE.Mesh(g.toGeometry(), matGlow)

/** 统一走一套「静态部分合并 + 少量动态节点」的做法，draw call 可控 */

/* ───────────────────────── 水磨坊 ───────────────────────── */

function mill(seed: number): Dynamic {
  // 水面就是局部 y = 0（这个建筑的 group 落在 WATER_Y 上）。
  // 原来甲板放在 y = -0.08，整座磨坊连着水轮全沉到水面以下，自然「看不见水轮」。
  // 现在把栈台抬到水面上，水轮挂在甲板外侧，只有下半叶入水。
  const DECK = 0.62
  const stat = new Geo()
  // 木桩：水下 1.8 一直撑到甲板
  for (const x of [-1.0, -0.15, 0.7, 1.45]) {
    for (const z of [-1.25, 1.25]) {
      stat.cyl(0.1, 0.12, 2.4, x, DECK - 1.2, z, P.woodDark, { seg: 6 })
    }
  }
  // 甲板 + 板缝
  stat.box(2.9, 0.18, 2.9, 0.25, DECK - 0.09, 0, P.wood)
  for (let i = 0; i < 8; i++) {
    stat.box(2.9, 0.03, 0.05, 0.25, DECK + 0.005, -1.25 + i * 0.36, P.woodDark)
  }
  // 小屋
  stat.box(2.0, 1.0, 1.9, 0.45, DECK + 0.5, 0, P.wallWarm)
  stat.add(hipRoofGeo(2.0, 1.9, 0.52, 0.2, 0.34), P.roofSlate, {
    m: new THREE.Matrix4().makeTranslation(0.45, DECK + 1.0, 0),
  })
  stat.box(0.52, 0.66, 0.06, 0.45, DECK + 0.33, 0.96, P.woodDark)
  // 挑杆 + 灯笼
  stat.cyl(0.05, 0.06, 1.5, 1.4, DECK + 0.75, 0.95, P.woodDark, { seg: 5 })
  stat.box(0.24, 0.3, 0.24, 1.4, DECK + 1.52, 0.95, P.lantern)
  const body = mergedMesh(stat)

  // 水轮：挂在甲板外侧的水面上，先在世界里摆好方向，再让它绕自己的轴转
  const wheelGeo = new Geo()
  wheelGeo.add(torusGeo(0.92, 0.07, 18, 6), P.woodDark)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    wheelGeo.box(1.84, 0.08, 0.08, 0, 0, 0, P.wood, { rz: a })
    wheelGeo.box(0.3, 0.34, 0.06, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, P.woodDark, { rz: a })
  }
  // 轴得够长，才能从甲板边缘一直连到轮心
  wheelGeo.cyl(0.16, 0.16, 1.0, 0, 0, 0, P.woodDark, { seg: 8, rx: Math.PI / 2 })
  const spin = mergedMesh(wheelGeo)
  const pivot = new THREE.Group()
  pivot.position.set(-1.66, DECK, 0)
  pivot.rotation.y = Math.PI / 2
  pivot.add(spin)

  const group = new THREE.Group()
  group.add(body, pivot)
  return {
    group,
    update(_t, dt) {
      spin.rotation.z += dt * 1.1
    },
  }
}

/* ───────────────────────── 旋转木马 ───────────────────────── */

function carousel(seed: number): Dynamic {
  const stat = new Geo()
  stat.cyl(1.85, 1.95, 0.18, 0, 0.09, 0, '#dcd8ce', { seg: 16 })
  const base = mergedMesh(stat)

  const spinGeo = new Geo()
  // 顶篷
  spinGeo.cyl(0.09, 0.09, 1.7, 0, 1.35, 0, P.woodDark, { seg: 6 })
  spinGeo.cyl(1.5, 1.5, 0.1, 0, 0.32, 0, '#e8e2d2', { seg: 16 })
  spinGeo.add(coneGeo(1.72, 0.72, 16), '#e2766a', { m: new THREE.Matrix4().makeTranslation(0, 1.98, 0) })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    spinGeo.box(1.72, 0.16, 0.02, 0, 1.9, 0, i % 2 ? '#f7f2e6' : '#f0c060', { ry: a, rx: 0.42 })
  }
  spinGeo.add(sphereGeo(0.12, 8, 6), P.gold, { m: new THREE.Matrix4().makeTranslation(0, 2.4, 0) })
  spinGeo.add(coneGeo(0.09, 0.22, 6), P.gold, { m: new THREE.Matrix4().makeTranslation(0, 2.52, 0) })
  // 灯泡
  const bulbGeo = new Geo()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    bulbGeo.add(sphereGeo(0.055, 6, 5), i % 2 ? '#fff3c8' : '#ffd0a0', {
      m: new THREE.Matrix4().makeTranslation(Math.cos(a) * 1.52, 1.62, Math.sin(a) * 1.52),
    })
  }
  const spin = mergedMesh(spinGeo)
  const bulbs = glowMesh(bulbGeo)

  // 八匹木马
  const horseGeo = new Geo()
  horseGeo.box(0.34, 0.3, 0.72, 0, 0.6, 0, '#ffffff')
  horseGeo.box(0.28, 0.26, 0.22, 0, 0.78, 0.4, '#ffffff')
  horseGeo.box(0.06, 0.3, 0.06, 0, 0.42, 0.36, '#ffffff')
  horseGeo.box(0.06, 0.3, 0.06, 0, 0.42, -0.36, '#ffffff')
  horseGeo.box(0.06, 0.34, 0.06, 0, 0.72, 0.52, '#ffffff')
  horseGeo.box(0.55, 0.07, 0.07, 0, 0.5, 0, P.gold)
  const horseMesh = new THREE.Mesh(horseGeo.toGeometry(), matSolid)
  const horses = new THREE.InstancedMesh(horseMesh.geometry, matSolid, 8)
  horses.castShadow = true
  const colors = ['#f6e6c8', '#e2766a', '#7bc8a4', '#8fb8e0', '#f0c060', '#f0b8cc', '#f6f2e8', '#c8a8e0']
  for (let i = 0; i < 8; i++) {
    horses.setColorAt(i, new THREE.Color(colors[i]))
  }
  horses.instanceColor!.needsUpdate = true

  spin.add(horses, bulbs)

  const group = new THREE.Group()
  group.add(base, spin)
  const R = 1.12
  const m4 = new THREE.Matrix4()
  return {
    group,
    update(t) {
      spin.rotation.y = t * 0.42
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        _e.set(0, -a, 0)
        _q.setFromEuler(_e)
        _pv.set(Math.cos(a) * R, 0.34 + Math.sin(t * 2.4 + i) * 0.16, Math.sin(a) * R)
        m4.compose(_pv, _q, _sv)
        horses.setMatrixAt(i, m4)
      }
      horses.instanceMatrix.needsUpdate = true
    },
  }
}

/* ───────────────────────── 转转茶盅 ───────────────────────── */

function teacup(seed: number): Dynamic {
  const stat = new Geo()
  stat.cyl(1.9, 2.0, 0.18, 0, 0.09, 0, '#dcd8ce', { seg: 16 })
  stat.cyl(0.1, 0.12, 0.9, 0, 0.6, 0, P.woodDark, { seg: 6 })
  const base = mergedMesh(stat)

  const deckGeo = new Geo()
  deckGeo.cyl(1.78, 1.78, 0.1, 0, 0.24, 0, '#e6e0d0', { seg: 16 })
  deckGeo.add(torusGeo(1.78, 0.07, 20, 6), '#f0c060', {
    m: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.3, 0),
  })
  const deck = mergedMesh(deckGeo)

  const cupGeo = new Geo()
  cupGeo.cyl(0.34, 0.26, 0.42, 0, 0.21, 0, '#ffffff', { seg: 10 })
  cupGeo.cyl(0.36, 0.36, 0.06, 0, 0.44, 0, '#ffffff', { seg: 10 })
  cupGeo.cyl(0.34, 0.34, 0.05, 0, 0.3, 0, '#f0c060', { seg: 10 })
  // 一只大茶壶坐中间
  cupGeo.cyl(0.3, 0.34, 0.5, 0, 0.62, 0, '#e2766a', { seg: 10 })
  cupGeo.cyl(0.12, 0.2, 0.22, 0, 0.9, 0, '#e2766a', { seg: 10 })
  cupGeo.box(0.3, 0.06, 0.06, 0.34, 0.66, 0, '#e2766a', { rz: -0.3 })
  const cupMesh = new THREE.Mesh(cupGeo.toGeometry(), matSolid)
  const cups = new THREE.InstancedMesh(cupMesh.geometry, matSolid, 6)
  cups.castShadow = true
  const colors = ['#f6e6c8', '#e2766a', '#7bc8a4', '#8fb8e0', '#f0c060', '#f0b8cc']
  for (let i = 0; i < 6; i++) cups.setColorAt(i, new THREE.Color(colors[i]))
  cups.instanceColor!.needsUpdate = true
  deck.add(cups)

  const group = new THREE.Group()
  group.add(base, deck)
  const R = 1.28
  const m4 = new THREE.Matrix4()
  return {
    group,
    update(t) {
      deck.rotation.y = t * 0.55
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        _e.set(0, t * 1.9 + i, 0)
        _q.setFromEuler(_e)
        _pv.set(Math.cos(a) * R, 0.08, Math.sin(a) * R)
        m4.compose(_pv, _q, _sv)
        cups.setMatrixAt(i, m4)
      }
      cups.instanceMatrix.needsUpdate = true
    },
  }
}

/* ───────────────────────── 摩天轮 ───────────────────────── */

function ferris(seed: number): Dynamic {
  // 轮心高度 H 必须留得下「轮半径 R + 吊舱悬挂 0.86 - 舱底 0.25」，
  // 否则最低那个吊舱会插进基座台里 —— 腿柱也要从地面一路撑到轮轴。
  const H = 3.5
  const R = 2.1
  const LX = 0.82
  const LZ = 0.64
  const stat = new Geo()
  // 基座台
  stat.cyl(2.45, 2.65, 0.24, 0, 0.12, 0, '#d9d5ca', { seg: 18 })
  stat.cyl(2.16, 2.16, 0.07, 0, 0.28, 0, '#efece4', { seg: 18 })
  // 四根腿柱：地面 → 轮轴
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      stat.box(0.17, H, 0.17, sx * LX, H / 2, sz * LZ, '#9aa3ad')
    }
  }
  // 上下两圈系梁
  for (const y of [H * 0.34, H * 0.68]) {
    stat.box(LX * 2, 0.1, 0.1, 0, y, -LZ, '#8b949e')
    stat.box(LX * 2, 0.1, 0.1, 0, y, LZ, '#8b949e')
    stat.box(0.1, 0.1, LZ * 2, -LX, y, 0, '#8b949e')
    stat.box(0.1, 0.1, LZ * 2, LX, y, 0, '#8b949e')
  }
  stat.box(LX * 2, 0.14, 0.14, 0, H - 0.26, 0, '#9aa3ad')
  stat.cyl(0.24, 0.24, 0.74, 0, H, 0, '#7d868f', { seg: 10, rz: Math.PI / 2 })
  const frame = mergedMesh(stat)

  const wheelGeo = new Geo()
  wheelGeo.add(torusGeo(R, 0.075, 28, 6), '#e2766a')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    wheelGeo.box(0.06, R * 2, 0.06, 0, 0, 0, '#f0c060', { rz: a })
  }
  wheelGeo.add(torusGeo(0.42, 0.07, 12, 6), '#f0c060')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    wheelGeo.add(sphereGeo(0.09, 6, 5), i % 2 ? '#fff3c8' : '#ffd0a0', {
      m: new THREE.Matrix4().makeTranslation(Math.cos(a) * R, Math.sin(a) * R, 0),
    })
  }
  const spin = mergedMesh(wheelGeo)
  spin.position.set(0, H, 0)

  // 吊舱：CPU 每帧摆位，永远保持水平
  const gonGeo = new Geo()
  gonGeo.box(0.05, 0.26, 0.05, 0, 0.72, 0, '#7d868f')
  gonGeo.box(0.46, 0.34, 0.4, 0, 0.42, 0, '#ffffff')
  gonGeo.box(0.5, 0.07, 0.44, 0, 0.61, 0, '#ffffff')
  gonGeo.add(coneGeo(0.4, 0.26, 4), '#ffffff', { m: new THREE.Matrix4().makeTranslation(0, 0.76, 0) })
  const gon = new THREE.Mesh(gonGeo.toGeometry(), matSolid)
  const gons = new THREE.InstancedMesh(gon.geometry, matSolid, 12)
  gons.castShadow = true
  const gcolors = ['#e2766a', '#7bc8a4', '#8fb8e0', '#f0c060', '#f0b8cc', '#b8a0e0']
  for (let i = 0; i < 12; i++) gons.setColorAt(i, new THREE.Color(gcolors[i % gcolors.length]))
  gons.instanceColor!.needsUpdate = true

  const group = new THREE.Group()
  group.add(frame, spin, gons)
  const m4 = new THREE.Matrix4()
  return {
    group,
    update(t) {
      const rot = t * 0.3
      spin.rotation.z = rot
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + rot
        _pv.set(Math.cos(a) * R, H + Math.sin(a) * R - 0.86, 0)
        m4.compose(_pv, _q.identity(), _sv)
        gons.setMatrixAt(i, m4)
      }
      gons.instanceMatrix.needsUpdate = true
    },
  }
}

/* ───────────────────────── 过山车 ───────────────────────── */

function coaster(seed: number): Dynamic {
  const pts: THREE.Vector3[] = []
  const N = 10
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = 3.05 + 0.55 * Math.sin(a * 2 + 0.4)
    const y = 1.05 + 0.85 * Math.abs(Math.sin(a * 1.5 + 0.8))
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.4)

  const stat = new Geo()
  // 站台
  stat.box(2.2, 0.24, 2.2, 0, 0.12, 0, '#d9d5ca')
  stat.box(2.4, 0.06, 2.4, 0, 0.27, 0, P.stone)
  // 立柱：沿轨道每隔一段落一根到地面
  const SEG = 30
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < SEG; i++) {
    const p = curve.getPointAt(i / SEG)
    const h = p.y
    stat.box(0.11, h, 0.11, p.x, h / 2, p.z, '#b9bec7')
  }
  // 木架横撑
  for (let i = 0; i < SEG; i += 2) {
    const p = curve.getPointAt(i / SEG)
    stat.box(0.09, 0.09, 0.9, p.x, p.y * 0.62, p.z, '#c9bda8')
  }
  const frame = mergedMesh(stat)

  // 轨道：一条主轨 + Frenet 标架上的枕木
  const rail = new THREE.Mesh(
    withWhiteColor(new THREE.TubeGeometry(curve, 140, 0.085, 5, true)),
    matSolid,
  )
  const tieGeo = new Geo()
  const frames = curve.computeFrenetFrames(140, true)
  for (let i = 0; i < 140; i += 2) {
    const p = curve.getPointAt(i / 140)
    const n = frames.normals[i].clone()
    const b = frames.binormals[i].clone()
    tieGeo.add(boxGeo(0.5, 0.05, 0.07), '#8e939c', {
      m: new THREE.Matrix4().makeBasis(n, b, up).setPosition(p.x, p.y, p.z),
    })
  }
  const ties = mergedMesh(tieGeo)

  // 列车
  const carGeo = new Geo()
  carGeo.box(0.34, 0.24, 0.56, 0, 0.0, 0, '#ffffff')
  carGeo.box(0.3, 0.2, 0.1, 0, 0.2, -0.2, '#ffffff')
  carGeo.add(sphereGeo(0.13, 6, 5), '#ffffff', { m: new THREE.Matrix4().makeTranslation(0, 0.16, 0.14) })
  carGeo.box(0.36, 0.06, 0.6, 0, -0.14, 0, '#5b6169')
  const carMesh = new THREE.Mesh(carGeo.toGeometry(), matSolid)
  const train = new THREE.InstancedMesh(carMesh.geometry, matSolid, 4)
  train.castShadow = true
  const ccolors = ['#e2766a', '#f0c060', '#7bc8a4', '#8fb8e0']
  for (let i = 0; i < 4; i++) train.setColorAt(i, new THREE.Color(ccolors[i]))
  train.instanceColor!.needsUpdate = true

  const group = new THREE.Group()
  group.add(frame, rail, ties, train)

  const m4 = new THREE.Matrix4()
  const eye = new THREE.Vector3()
  const look = new THREE.Matrix4()
  return {
    group,
    update(t) {
      const base = (t * 0.055) % 1
      for (let i = 0; i < 4; i++) {
        const u = (base - i * 0.018 + 1) % 1
        const p = curve.getPointAt(u)
        const tg = curve.getTangentAt(u)
        eye.copy(p).add(tg)
        look.lookAt(p, eye, up)
        m4.copy(look)
        m4.setPosition(p.x, p.y + 0.16, p.z)
        train.setMatrixAt(i, m4)
      }
      train.instanceMatrix.needsUpdate = true
    },
  }
}

/* ───────────────────────── 喷泉 ───────────────────────── */

const JET_VERT = `
attribute float aPhase;
attribute float aAngle;
attribute float aUp;
uniform float uTime;
uniform float uScale;   // 正交相机下点尺寸不随距离变化，直接用像素尺度
varying float vFade;
void main() {
  float t = fract( uTime * 0.62 + aPhase );
  float r = aUp * 0.22 + t * ( 0.55 + aAngle * 0.35 );
  float y = aUp * 1.05 * t - 3.1 * t * t + 0.42;
  vec3 p = vec3( cos( aAngle * 6.28318 ) * r, y, sin( aAngle * 6.28318 ) * r );
  vFade = smoothstep( 0.0, 0.12, t ) * ( 1.0 - smoothstep( 0.72, 1.0, t ) );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
  gl_PointSize = uScale * ( 1.6 + aUp * 1.2 );
}
`

const JET_FRAG = `
uniform vec3 uColor;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - vec2( 0.5 );
  float a = 1.0 - smoothstep( 0.08, 0.5, length( d ) );
  if ( a * vFade < 0.01 ) discard;
  gl_FragColor = vec4( uColor, a * vFade * 0.9 );
}
`

function fountain(seed: number): Dynamic {
  const stat = new Geo()
  stat.cyl(1.7, 1.85, 0.44, 0, 0.22, 0, '#dcd8ce', { seg: 18 })
  stat.cyl(1.52, 1.52, 0.1, 0, 0.44, 0, '#b9bec7', { seg: 18 })
  stat.cyl(0.22, 0.3, 0.7, 0, 0.75, 0, '#dcd8ce', { seg: 10 })
  stat.cyl(0.62, 0.16, 0.28, 0, 1.2, 0, '#dcd8ce', { seg: 12 })
  stat.cyl(0.5, 0.5, 0.1, 0, 1.32, 0, '#b9bec7', { seg: 14 })
  stat.add(sphereGeo(0.16, 8, 6), '#cfd4da', { m: new THREE.Matrix4().makeTranslation(0, 1.46, 0) })
  const frame = mergedMesh(stat)

  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 20), matFountain)
  pool.position.y = 0.4

  // 水柱：GPU 抛物线粒子，一个 Points 搞定
  const COUNT = 240
  const pos = new Float32Array(COUNT * 3)
  const phase = new Float32Array(COUNT)
  const angle = new Float32Array(COUNT)
  const upv = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    phase[i] = Math.random()
    angle[i] = Math.random()
    upv[i] = Math.random() < 0.35 ? 1 : 0
    pos[i * 3 + 1] = 0.4
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  g.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1))
  g.setAttribute('aUp', new THREE.BufferAttribute(upv, 1))
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#eaf7ff') },
    uScale: { value: 3 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: JET_VERT,
    fragmentShader: JET_FRAG,
    transparent: true,
    depthWrite: false,
  })
  const jets = new THREE.Points(g, mat)
  jets.position.y = 0.4
  jets.frustumCulled = false

  const group = new THREE.Group()
  group.add(frame, pool, jets)
  return {
    group,
    update(t) {
      uniforms.uTime.value = t
    },
  }
}

export const DYNAMIC_FACTORIES: Record<string, Factory> = {
  mill,
  carousel,
  teacup,
  ferris,
  coaster,
  fountain,
}
