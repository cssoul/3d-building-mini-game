import * as THREE from 'three'
import { edgePositions } from './geo'

export interface Rec {
  uid: number
  /** 变体序号（同一种建筑的颜色/形态变体） */
  variant: number
  matrix: THREE.Matrix4
  color: THREE.Color
}

const _v = new THREE.Vector3()

/**
 * 合批容器：同一种建筑 = 每个变体一个 InstancedMesh（1 draw call），
 * 描线则把所有实例的边表在 CPU 侧变换后拼成一条 LineSegments（1 draw call）。
 * 实例数变化（用户建造/拆除）时才重建，建造动画期间只改被动画到的那几个矩阵。
 */
export class InstancedBatch {
  readonly group = new THREE.Group()
  private meshes: THREE.InstancedMesh[] = []
  private cap: number[] = []
  private geos: THREE.BufferGeometry[] = []
  private edge: Float32Array[] = []
  private mat: THREE.Material
  private lineMat?: THREE.LineBasicMaterial
  private threshold: number
  private castShadow: boolean
  private outline: THREE.LineSegments | null = null
  /** uid → 槽位 */
  readonly slot = new Map<number, { v: number; i: number }>()
  private dirtyOutline = true

  constructor(
    geos: THREE.BufferGeometry[],
    mat: THREE.Material,
    opts: { outline?: THREE.LineBasicMaterial; threshold?: number; castShadow?: boolean } = {},
  ) {
    this.geos = geos
    this.mat = mat
    this.lineMat = opts.outline
    this.threshold = opts.threshold ?? 26
    this.castShadow = opts.castShadow ?? true
    if (opts.outline) this.edge = geos.map((g) => edgePositions(g, this.threshold))
  }

  private ensure(v: number, need: number) {
    let m = this.meshes[v]
    if (!m || this.cap[v] < need) {
      if (m) {
        this.group.remove(m)
        m.dispose()
      }
      const cap = Math.max(64, Math.ceil(need * 1.5))
      m = new THREE.InstancedMesh(this.geos[v], this.mat, cap)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.castShadow = this.castShadow
      m.receiveShadow = true
      m.frustumCulled = false
      m.count = 0
      this.meshes[v] = m
      this.cap[v] = cap
      this.group.add(m)
    }
    return m
  }

  setAll(recs: Rec[], rebuildOutline = true) {
    const byVariant: Rec[][] = this.geos.map(() => [])
    for (const r of recs) byVariant[r.variant % this.geos.length].push(r)
    this.slot.clear()
    for (let v = 0; v < this.geos.length; v++) {
      const list = byVariant[v]
      if (!list.length) {
        if (this.meshes[v]) this.meshes[v].count = 0
        continue
      }
      const m = this.ensure(v, list.length)
      for (let i = 0; i < list.length; i++) {
        m.setMatrixAt(i, list[i].matrix)
        m.setColorAt(i, list[i].color)
        this.slot.set(list[i].uid, { v, i })
      }
      m.count = list.length
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    this.dirtyOutline = true
    if (rebuildOutline) this.rebuildOutline()
  }

  updateSlot(uid: number, matrix: THREE.Matrix4) {
    const s = this.slot.get(uid)
    if (!s) return
    const m = this.meshes[s.v]
    if (!m) return
    m.setMatrixAt(s.i, matrix)
    m.instanceMatrix.needsUpdate = true
  }

  markDirty() {
    this.dirtyOutline = true
  }

  /** 把每个实例的边表变换后拼成一条 LineSegments */
  rebuildOutline() {
    if (!this.lineMat) return
    let total = 0
    const perVariant: number[] = []
    for (let v = 0; v < this.geos.length; v++) {
      const n = this.meshes[v]?.count ?? 0
      perVariant[v] = n
      total += n * (this.edge[v]?.length ?? 0)
    }
    if (!total) {
      if (this.outline) {
        this.group.remove(this.outline)
        this.outline.geometry.dispose()
        this.outline = null
      }
      return
    }
    const out = new Float32Array(total)
    let o = 0
    const m = new THREE.Matrix4()
    for (let v = 0; v < this.geos.length; v++) {
      const e = this.edge[v]
      if (!e || !perVariant[v]) continue
      const mesh = this.meshes[v]
      const verts = e.length / 3
      for (let i = 0; i < perVariant[v]; i++) {
        mesh.getMatrixAt(i, m)
        for (let k = 0; k < verts; k++) {
          _v.set(e[k * 3], e[k * 3 + 1], e[k * 3 + 2]).applyMatrix4(m)
          out[o++] = _v.x
          out[o++] = _v.y
          out[o++] = _v.z
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(out.subarray(0, o), 3))
    if (this.outline) {
      this.group.remove(this.outline)
      this.outline.geometry.dispose()
    }
    this.outline = new THREE.LineSegments(g, this.lineMat)
    this.outline.frustumCulled = false
    this.outline.renderOrder = 2
    this.group.add(this.outline)
    this.dirtyOutline = false
  }

  get needsOutline() {
    return this.dirtyOutline
  }

  get firstGeometry() {
    return this.geos[0]
  }

  /** 单纯的地块/道具批：没有描线，只写矩阵与颜色 */
  static simple(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, receive = true) {
    const m = new THREE.InstancedMesh(geo, mat, cap)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    m.frustumCulled = false
    m.receiveShadow = receive
    m.castShadow = false
    m.count = 0
    return m
  }
}
