import * as THREE from 'three'
import { COLS, TILE, WORLD_H, WORLD_W } from '../game/constants'
import { Geo } from './geo'
import { matSolid } from './materials'

export const tileCX = (col: number) => (col + 0.5) * TILE - WORLD_W / 2
export const tileCZ = (row: number) => (row + 0.5) * TILE - WORLD_H / 2

interface Agent {
  c: number
  r: number
  tc: number
  tr: number
  u: number
  speed: number
  phase: number
  dirX: number
  dirZ: number
}

const CLOTHES = [
  '#e2766a', '#5fa8d3', '#7bc8a4', '#f0c060', '#b8a0e0', '#f0a8c0',
  '#8fb8e0', '#c8d67a', '#e0a86a', '#9fc9c0', '#d68fa8', '#7f9ec2',
]

/** 街上走动的小人。全部靠矩阵驱动，2 个 draw call 装下所有人。 */
export class Crowd {
  readonly group = new THREE.Group()
  private body: THREE.InstancedMesh
  private skin: THREE.InstancedMesh
  private agents: Agent[] = []
  private roads = new Set<number>()
  private m4 = new THREE.Matrix4()
  private pv = new THREE.Vector3()
  private sv = new THREE.Vector3(1, 1, 1)
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()

  constructor(private max = 30) {
    const bodyGeo = new Geo()
    bodyGeo.box(0.062, 0.22, 0.062, -0.055, 0.11, 0, '#6d7a86')
    bodyGeo.box(0.062, 0.22, 0.062, 0.055, 0.11, 0, '#6d7a86')
    bodyGeo.box(0.2, 0.26, 0.13, 0, 0.34, 0, '#ffffff')
    bodyGeo.box(0.055, 0.2, 0.055, -0.125, 0.35, 0, '#ffffff')
    bodyGeo.box(0.055, 0.2, 0.055, 0.125, 0.35, 0, '#ffffff')

    const skinGeo = new Geo()
    skinGeo.add(
      new THREE.SphereGeometry(0.085, 7, 5),
      '#f2d6b8',
      { m: new THREE.Matrix4().makeTranslation(0, 0.55, 0) },
    )
    skinGeo.add(
      new THREE.ConeGeometry(0.155, 0.1, 8),
      '#e0c48a',
      { m: new THREE.Matrix4().makeTranslation(0, 0.63, 0) },
    )

    this.body = new THREE.InstancedMesh(bodyGeo.toGeometry(), matSolid, max)
    this.skin = new THREE.InstancedMesh(skinGeo.toGeometry(), matSolid, max)
    for (const m of [this.body, this.skin]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      m.castShadow = true
      m.count = 0
    }
    const c = new THREE.Color()
    for (let i = 0; i < max; i++) {
      c.set(CLOTHES[i % CLOTHES.length])
      this.body.setColorAt(i, c)
      this.skin.setColorAt(i, new THREE.Color().setHSL(0.08, 0.1, 0.9 + (i % 3) * 0.03))
    }
    this.body.instanceColor!.needsUpdate = true
    this.skin.instanceColor!.needsUpdate = true
    this.group.add(this.body, this.skin)
  }

  setRoads(cells: { col: number; row: number }[]) {
    this.roads.clear()
    for (const c of cells) this.roads.add(c.row * COLS + c.col)
    this.agents = []
    if (!this.roads.size) {
      this.body.count = 0
      this.skin.count = 0
      return
    }
    const pool = cells
    for (let i = 0; i < this.max; i++) {
      const a = pool[Math.floor(Math.random() * pool.length)]
      const nb = this.neighbors(a.col, a.row)
      if (!nb.length) continue
      const n = nb[Math.floor(Math.random() * nb.length)]
      this.agents.push({
        c: a.col,
        r: a.row,
        tc: n.col,
        tr: n.row,
        u: Math.random(),
        speed: 0.55 + Math.random() * 0.5,
        phase: Math.random() * 6.28,
        dirX: 0,
        dirZ: 0,
      })
    }
    this.body.count = this.agents.length
    this.skin.count = this.agents.length
  }

  private neighbors(col: number, row: number) {
    const out: { col: number; row: number }[] = []
    if (this.roads.has(row * COLS + col + 1)) out.push({ col: col + 1, row })
    if (this.roads.has(row * COLS + col - 1)) out.push({ col: col - 1, row })
    if (this.roads.has((row + 1) * COLS + col)) out.push({ col, row: row + 1 })
    if (this.roads.has((row - 1) * COLS + col)) out.push({ col, row: row - 1 })
    return out
  }

  update(t: number, dt: number) {
    if (!this.agents.length) return
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i]
      a.u += a.speed * dt
      while (a.u >= 1) {
        a.u -= 1
        a.c = a.tc
        a.r = a.tr
        const nb = this.neighbors(a.c, a.r).filter((n) => !(n.col === a.c - (a.tc - a.c) && n.row === a.r - (a.tr - a.r)))
        const pick = nb.length ? nb[Math.floor(Math.random() * nb.length)] : this.neighbors(a.c, a.r)[0]
        if (!pick) break
        a.tc = pick.col
        a.tr = pick.row
      }
      const x0 = tileCX(a.c)
      const z0 = tileCZ(a.r)
      const x1 = tileCX(a.tc)
      const z1 = tileCZ(a.tr)
      const x = x0 + (x1 - x0) * a.u
      const z = z0 + (z1 - z0) * a.u
      const dx = x1 - x0
      const dz = z1 - z0
      a.dirX = dx
      a.dirZ = dz
      const bob = Math.abs(Math.sin(t * 7.5 * a.speed + a.phase)) * 0.045
      this.e.set(0, Math.atan2(dx, dz), 0)
      this.q.setFromEuler(this.e)
      this.pv.set(x, bob, z)
      this.m4.compose(this.pv, this.q, this.sv)
      this.body.setMatrixAt(i, this.m4)
      this.skin.setMatrixAt(i, this.m4)
    }
    this.body.instanceMatrix.needsUpdate = true
    this.skin.instanceMatrix.needsUpdate = true
  }
}
