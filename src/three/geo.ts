import * as THREE from 'three'

/** 顶点标记：决定该顶点在着色器里的行为 */
export const TAG = {
  /** 普通实体：建筑、地面、木构件 */
  SOLID: 0,
  /** 阔叶树冠：随季节变色 + 风摆 + 冬季落叶收缩 */
  LEAF: 1,
  /** 针叶树冠：随季节变色 + 风摆（不落叶） */
  PINE: 2,
  /** 软性摇摆件：旗帜、幌子、水波 */
  FLEX: 3,
} as const

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

const cache = new Map<string, THREE.BufferGeometry>()
const k2 = (n: number) => Math.round(n * 1000) / 1000

export function boxGeo(w: number, h: number, d: number) {
  const k = `b|${k2(w)}|${k2(h)}|${k2(d)}`
  let g = cache.get(k)
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d)
    cache.set(k, g)
  }
  return g
}

export function cylGeo(rt: number, rb: number, h: number, seg: number) {
  const k = `c|${k2(rt)}|${k2(rb)}|${k2(h)}|${seg}`
  let g = cache.get(k)
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg, 1)
    cache.set(k, g)
  }
  return g
}

export function coneGeo(r: number, h: number, seg: number) {
  const k = `n|${k2(r)}|${k2(h)}|${seg}`
  let g = cache.get(k)
  if (!g) {
    g = new THREE.ConeGeometry(r, h, seg, 1)
    cache.set(k, g)
  }
  return g
}

export function sphereGeo(r: number, seg = 8, rings = 6) {
  const k = `s|${k2(r)}|${seg}|${rings}`
  let g = cache.get(k)
  if (!g) {
    g = new THREE.SphereGeometry(r, seg, rings)
    cache.set(k, g)
  }
  return g
}

export function torusGeo(r: number, tube: number, seg = 12, tubeSeg = 6, arc = Math.PI * 2) {
  const k = `t|${k2(r)}|${k2(tube)}|${seg}|${tubeSeg}|${k2(arc)}`
  let g = cache.get(k)
  if (!g) {
    g = new THREE.TorusGeometry(r, tube, tubeSeg, seg, arc)
    cache.set(k, g)
  }
  return g
}

export interface AddOpts {
  m?: THREE.Matrix4
  tag?: number
  /** 风摆幅度（可以是常数，也可以按顶点位置计算） */
  flex?: number | ((x: number, y: number, z: number) => number)
  /** 1 = 冬季随 uLeaf 收缩（阔叶树冠） */
  leaf?: number
  /** 每面颜色的随机扰动，做出纸模手作感 */
  jitter?: number
}

/**
 * 顶点色几何合成器。
 * 全部建筑/道具都走这里 → 合并成一种材质（1 个 draw call / 类型），
 * 同时把 tag / flex / leaf 三个语义烘进顶点属性，交给生长与季节着色器。
 */
export class Geo {
  pos: number[] = []
  nrm: number[] = []
  col: number[] = []
  tag: number[] = []
  flex: number[] = []
  leaf: number[] = []

  add(g: THREE.BufferGeometry, color: string | number, opts: AddOpts = {}) {
    const src = (g.index ? g.toNonIndexed() : g.clone())
    if (opts.m) src.applyMatrix4(opts.m)
    const p = src.getAttribute('position') as THREE.BufferAttribute
    const n = src.getAttribute('normal') as THREE.BufferAttribute
    const tag = opts.tag ?? 0
    const leaf = opts.leaf ?? 0
    const jit = opts.jitter ?? 0.02
    _c.set(color as THREE.ColorRepresentation)
    const cr = _c.r
    const cg = _c.g
    const cb = _c.b
    for (let i = 0; i < p.count; i += 3) {
      // 逐三角面做一次亮度扰动，保持平涂但不像塑料
      const j = 1 + (Math.random() * 2 - 1) * jit
      const x0 = p.getX(i)
      const y0 = p.getY(i)
      const z0 = p.getZ(i)
      for (let k = 0; k < 3; k++) {
        const x = p.getX(i + k)
        const y = p.getY(i + k)
        const z = p.getZ(i + k)
        this.pos.push(x, y, z)
        if (n) this.nrm.push(n.getX(i + k), n.getY(i + k), n.getZ(i + k))
        else this.nrm.push(0, 1, 0)
        this.col.push(cr * j, cg * j, cb * j)
        this.tag.push(tag)
        this.leaf.push(leaf)
        this.flex.push(typeof opts.flex === 'function' ? opts.flex(x, y, z) : opts.flex ?? 0)
      }
      if (!n) {
        // 没有法线时按面法线补
        _v.set(p.getX(i + 1) - x0, p.getY(i + 1) - y0, p.getZ(i + 1) - z0)
        const ax = _v.x
        const ay = _v.y
        const az = _v.z
        _v.set(p.getX(i + 2) - x0, p.getY(i + 2) - y0, p.getZ(i + 2) - z0)
        const nx = ay * _v.z - az * _v.y
        const ny = az * _v.x - ax * _v.z
        const nz = ax * _v.y - ay * _v.x
        const len = Math.hypot(nx, ny, nz) || 1
        const at = this.nrm.length - 9
        for (let k = 0; k < 3; k++) {
          this.nrm[at + k * 3] = nx / len
          this.nrm[at + k * 3 + 1] = ny / len
          this.nrm[at + k * 3 + 2] = nz / len
        }
      }
    }
    src.dispose()
    return this
  }

  /** 轴对齐/可旋转的方块 */
  box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string | number,
    o: AddOpts & { rx?: number; ry?: number; rz?: number } = {},
  ) {
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)
    _q.setFromEuler(_e)
    _m.compose(_v.set(x, y, z), _q, { x: 1, y: 1, z: 1 } as THREE.Vector3)
    this.add(boxGeo(w, h, d), color, { ...o, m: _m })
    return this
  }

  /** 圆柱 / 立柱 */
  cyl(
    rt: number,
    rb: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color: string | number,
    o: AddOpts & { seg?: number; rx?: number; ry?: number; rz?: number } = {},
  ) {
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)
    _q.setFromEuler(_e)
    _m.compose(_v.set(x, y, z), _q, { x: 1, y: 1, z: 1 } as THREE.Vector3)
    this.add(cylGeo(rt, rb, h, o.seg ?? 8), color, { ...o, m: _m })
    return this
  }

  cone(
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color: string | number,
    o: AddOpts & { seg?: number } = {},
  ) {
    _q.identity()
    _m.compose(_v.set(x, y, z), _q, { x: 1, y: 1, z: 1 } as THREE.Vector3)
    this.add(coneGeo(r, h, o.seg ?? 8), color, { ...o, m: _m })
    return this
  }

  sphere(r: number, x: number, y: number, z: number, color: string | number, o: AddOpts = {}) {
    _q.identity()
    _m.compose(_v.set(x, y, z), _q, { x: 1, y: 1, z: 1 } as THREE.Vector3)
    this.add(sphereGeo(r), color, { ...o, m: _m })
    return this
  }

  /** 直接塞入顶点数组（自定义曲面用） */
  raw(positions: number[], color: string | number, o: AddOpts = {}) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.computeVertexNormals()
    return this.add(g, color, o)
  }

  /** 把另一个已上色的 Geo 整体并进来（保留它自己的顶点色与语义属性） */
  append(other: Geo, m?: THREE.Matrix4) {
    const n = other.tag.length
    const p = _p
    for (let i = 0; i < n; i++) {
      p.set(other.pos[i * 3], other.pos[i * 3 + 1], other.pos[i * 3 + 2])
      if (m) p.applyMatrix4(m)
      this.pos.push(p.x, p.y, p.z)
      this.nrm.push(other.nrm[i * 3], other.nrm[i * 3 + 1], other.nrm[i * 3 + 2])
      this.col.push(other.col[i * 3], other.col[i * 3 + 1], other.col[i * 3 + 2])
      this.tag.push(other.tag[i])
      this.flex.push(other.flex[i])
      this.leaf.push(other.leaf[i])
    }
    return this
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aTag', new THREE.Float32BufferAttribute(this.tag, 1))
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(this.flex, 1))
    g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(this.leaf, 1))
    g.computeBoundingSphere()
    return g
  }
}

/* ─────────────── 中式屋顶：两个核心形态 ─────────────── */

/**
 * 庑殿 / 悬山顶：一条正脊 + 四面坡。
 * `ridge` 是正脊半长（0 则退化为攒尖）。over 是出檐。
 */
export function hipRoofGeo(w: number, d: number, h: number, over: number, ridge: number) {
  const a = w / 2 + over
  const b = d / 2 + over
  const rx = Math.min(ridge, a * 0.92)
  const A = [-a, 0, -b]
  const B = [a, 0, -b]
  const C = [a, 0, b]
  const D = [-a, 0, b]
  const L = [-rx, h, 0]
  const R = [rx, h, 0]
  const tri = (...pts: number[][]) => pts.flat()
  const pos = [
    ...tri(A, R, B),
    ...tri(A, L, R),
    ...tri(C, L, D),
    ...tri(C, R, L),
    ...tri(A, D, L),
    ...tri(B, R, C),
  ]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/**
 * 攒尖顶：八点檐口 + 宝顶，四角起翘。
 * `lift` 是角部相对檐口中点的高差 —— 中式屋顶的那口气全靠它。
 */
export function pyramidRoofGeo(w: number, d: number, h: number, over: number, lift: number) {
  const a = w / 2 + over
  const b = d / 2 + over
  // 逆时针（自上方俯视顺时针）排列，法线朝外
  const P: number[][] = [
    [a, 0, 0],
    [a, lift, -b],
    [0, 0, -b],
    [-a, lift, -b],
    [-a, 0, 0],
    [-a, lift, b],
    [0, 0, b],
    [a, lift, b],
  ]
  const apex = [0, h, 0]
  const pos: number[] = []
  for (let i = 0; i < 8; i++) {
    const p0 = P[i]
    const p1 = P[(i + 1) % 8]
    pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], apex[0], apex[1], apex[2])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** 三角柱：山墙、坡道、屋顶脊 */
export function prismGeo(w: number, h: number, d: number) {
  const x = w / 2
  const z = d / 2
  const pos = [
    // 两个三角形端面
    -x, 0, -z, x, 0, -z, 0, h, -z,
    x, 0, z, -x, 0, z, 0, h, z,
    // 北坡
    -x, 0, -z, 0, h, -z, 0, h, z, -x, 0, -z, 0, h, z, -x, 0, z,
    // 南坡
    x, 0, -z, x, 0, z, 0, h, z, x, 0, -z, 0, h, z, 0, h, -z,
  ]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** 从几何体抽一份描线用的边表（合并后一次画完） */
export function edgePositions(g: THREE.BufferGeometry, threshold = 26): Float32Array {
  const e = new THREE.EdgesGeometry(g, threshold)
  const p = e.getAttribute('position') as THREE.BufferAttribute
  const out = new Float32Array(p.array as Float32Array)
  e.dispose()
  return out
}

/**
 * 给普通几何体补一份「全白顶点色 + 语义属性」。
 * three 的 instanceColor 只在 vertexColors=true 时进片元，缺了 color 属性会读到常量 0（全黑），
 * 所以凡是走 instancing 的地表/道具几何都必须过这一道。
 */
export function withWhiteColor(g: THREE.BufferGeometry, tag = TAG.SOLID) {
  const src = g.index ? g.toNonIndexed() : g
  const n = src.getAttribute('position').count
  src.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  src.setAttribute('aTag', new THREE.Float32BufferAttribute(new Float32Array(n).fill(tag), 1))
  src.setAttribute('aFlex', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
  src.setAttribute('aLeaf', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
  return src
}
