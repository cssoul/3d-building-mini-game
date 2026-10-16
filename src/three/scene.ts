import * as THREE from 'three'
import {
  BASE_DEPTH,
  BUILDING_MAP,
  CAM_YAW_BASE,
  COLS,
  ISO_ELEV,
  PALETTE,
  ROWS,
  SEASON_MAP,
  TILE,
  WORLD_H,
  WORLD_W,
} from '../game/constants'
import { ISLAND_R } from '../game/island'
import { getByUid, getTerrain, growing, state } from '../game/store'
import type { BuildingDef, SeasonId } from '../game/types'
import { InstancedBatch, type Rec } from './batches'
import { BUILDERS, DYNAMIC_TYPES, groundTileGeo, plazaTileGeo, roadTileGeo, waterTileGeo } from './buildings'
import { Crowd, tileCX, tileCZ } from './crowd'
import { DYNAMIC_FACTORIES, type Dynamic } from './dynamics'
import {
  U,
  matFountain,
  matGhostBad,
  matGhostOk,
  matGround,
  matOutline,
  matPaving,
  matRoad,
  matSelectRing,
  matSolid,
  matWater,
} from './materials'
import { SeasonField } from './particles'
import { applySeasonToLights, applySkyDome, buildSkyPMREM, makeSkyDome } from './sky'
import { texWater } from './textures'

/** 水面高度：比陆地低一点，露出水岸 */
const WATER_Y = -0.34
const GROW_TIME = 0.55
/** 岛缘的世界半径，用来把崖体从中心往边缘收薄 */
const ISLAND_R_W = (ISLAND_R * WORLD_W) / 2

/* 拖拽「拨地球」的参数 */
const ORBIT_K = 0.0072 // 每像素转多少弧度
const PITCH_MIN = 0.17 // ≈ 10°，贴地看星球侧面
const PITCH_MAX = 1.43 // ≈ 82°，接近俯视
const ORBIT_DAMP = 0.0018 // 松手后每秒速度衰减到原来的万分之十八
const ORBIT_MAX_V = 7 // rad/s 上限，防止甩飞
const clampV = (v: number) => Math.max(-ORBIT_MAX_V, Math.min(ORBIT_MAX_V, v))

export interface SceneStats {
  fps: number
  calls: number
  tris: number
  geoms: number
  props: number
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
const _sc = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()
const _m4 = new THREE.Matrix4()
const _mat = (x: number, y: number, z: number) => _m4.identity().setPosition(x, y, z)

/**
 * 与 matSolid / matWater 这类 `vertexColors: true` 的材质配套的几何，
 * 必须自带 `color` 属性 —— 否则 three 的内建 `color_vertex` 会去乘一个
 * 缺省值为常量 0 的 attribute，整块渲染成纯黑（本项目踩过的坑）。
 * `aTag` / `aFlex` / `aLeaf` 同理，缺失时季节着色器会读到 0。
 * 这里做兜底补齐，任何内联几何都不至于漏掉。
 */
function ensureInstanceAttrs(g: THREE.BufferGeometry) {
  const n = g.getAttribute('position').count
  if (!g.getAttribute('color')) {
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  }
  if (!g.getAttribute('aTag')) {
    g.setAttribute('aTag', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
  }
  return g
}

/** 每种建筑的变体数（同一几何的多个配色/形态版本，靠实例轮转分配） */
const VARIANTS: Record<string, number> = {
  house: 4,
  courtyard: 2,
  teahouse: 2,
  blossom: 2,
  pine: 3,
  pavilion: 2,
}

export class TownScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.OrthographicCamera

  private canvas: HTMLCanvasElement
  private sun: THREE.DirectionalLight
  private hemi: THREE.HemisphereLight
  private amb: THREE.AmbientLight
  private field: SeasonField
  private crowd: Crowd
  private batches = new Map<string, InstancedBatch>()
  private dynamics: { d: Dynamic; uid: number }[] = []
  private ground!: THREE.InstancedMesh
  private cliff!: THREE.InstancedMesh
  private water!: THREE.InstancedMesh
  private roads!: THREE.InstancedMesh
  private plazas!: THREE.InstancedMesh
  private dashes!: THREE.InstancedMesh
  private hoverRing!: THREE.Mesh
  private selRing!: THREE.Mesh
  private ghost: THREE.Mesh | null = null
  private ghostType = ''
  private islandRoot = new THREE.Group()
  private skyDome: THREE.Mesh
  private pmremCache = new Map<string, THREE.Texture>()

  private target = new THREE.Vector3(0, 0, 0)
  private viewSize = 44
  private yaw = CAM_YAW_BASE
  private pitch = ISO_ELEV
  private yawVel = 0
  private pitchVel = 0
  private orbitActive = false
  private lastOrbitAt = 0
  private rev = -1
  private time = 0
  private fpsAcc = 0
  private fpsN = 0
  private fps = 60
  private statAcc = 0
  private shadowAcc = 0
  private outlineAcc = 0
  private dirtyGroundColor = true
  private seedTint = new Float32Array(COLS * ROWS)
  private raycaster = new THREE.Raycaster()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private ndc = new THREE.Vector2()
  private hit = new THREE.Vector3()
  private _sand = new THREE.Color('#e9dcbb')

  onStats?: (s: SceneStats) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // 平涂粉彩风格：关掉色调映射，颜色全交给顶点色与贴图
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.shadowMap.autoUpdate = false

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 400)

    this.sun = new THREE.DirectionalLight(0xffffff, 2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const sc = this.sun.shadow.camera
    sc.left = -44
    sc.right = 44
    sc.top = 44
    sc.bottom = -44
    sc.near = 1
    sc.far = 220
    this.sun.shadow.bias = -0.0011
    this.sun.shadow.normalBias = 0.03
    this.sun.target = new THREE.Object3D()
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5)
    this.amb = new THREE.AmbientLight(0xffffff, 0.35)
    this.scene.add(this.sun, this.sun.target, this.hemi, this.amb)

    this.skyDome = makeSkyDome()
    this.scene.add(this.skyDome)
    this.scene.add(this.islandRoot)

    for (let i = 0; i < COLS * ROWS; i++) this.seedTint[i] = 0.94 + Math.random() * 0.1

    const cap = COLS * ROWS
    this.ground = InstancedBatch.simple(groundTileGeo(), matGround, cap)
    // 崖体几何的顶面落在 y = 0，于是「按格缩放 y」就是从顶面往下收薄 ——
    // 岛缘薄、岛心厚，低俯角看过去才像一块星球碎片而不是一块方板。
    this.cliff = InstancedBatch.simple(
      ensureInstanceAttrs(new THREE.BoxGeometry(TILE, BASE_DEPTH, TILE).translate(0, -BASE_DEPTH / 2, 0)),
      matSolid,
      cap,
    )
    this.cliff.castShadow = true
    // 水面必须走 waterTileGeo()（内部已 withWhiteColor）；直接内联裸 BoxGeometry 会因缺 color 属性全黑
    this.water = InstancedBatch.simple(ensureInstanceAttrs(waterTileGeo()), matWater, cap, false)
    this.roads = InstancedBatch.simple(roadTileGeo(), matRoad, cap)
    this.plazas = InstancedBatch.simple(plazaTileGeo(), matPaving, cap)
    this.dashes = InstancedBatch.simple(
      ensureInstanceAttrs(new THREE.BoxGeometry(0.11, 0.03, TILE * 0.4)),
      matSolid,
      cap,
      false,
    )
    this.islandRoot.add(this.ground, this.cliff, this.water, this.roads, this.plazas, this.dashes)

    this.hoverRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matGhostOk)
    this.hoverRing.rotation.x = -Math.PI / 2
    this.hoverRing.renderOrder = 4
    this.hoverRing.visible = false
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 22), matSelectRing)
    this.selRing.rotation.x = -Math.PI / 2
    this.selRing.renderOrder = 4
    this.selRing.visible = false
    this.scene.add(this.hoverRing, this.selRing)

    this.crowd = new Crowd(30)
    this.scene.add(this.crowd.group)

    this.field = new SeasonField(820, WORLD_W + 18)
    this.scene.add(this.field.points)

    this.buildBatches()
    this.updateCamera()
    this.applySeason(state.season, true)
    this.resize()
    this.fitIsland()
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__town = this
    }
  }

  private buildBatches() {
    for (const [type, build] of Object.entries(BUILDERS)) {
      const def = BUILDING_MAP[type]
      if (!def) continue
      const b = new InstancedBatch(build(), matSolid, {
        outline: def.solid ? matOutline : undefined,
        threshold: def.w >= 3 ? 34 : 28,
      })
      this.batches.set(type, b)
      this.islandRoot.add(b.group)
    }
  }

  /* ───────────────────────── 场景同步 ───────────────────────── */

  sync() {
    const t = getTerrain()
    const cap = COLS * ROWS
    let nGround = 0
    let nCliff = 0
    let nWater = 0
    let nRoad = 0
    let nPlaza = 0
    let nDash = 0
    const roadSet = new Set<number>()
    const plazaSet = new Set<number>()

    for (const p of state.placed) {
      if (p.type === 'road') roadSet.add(p.row * COLS + p.col)
      else if (p.type === 'plaza') plazaSet.add(p.row * COLS + p.col)
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        const tile = t.tiles[i]
        if (!tile || tile.kind === 'void') continue
        const x = tileCX(c)
        const z = tileCZ(r)
        if (tile.kind === 'land') {
          this.ground.setMatrixAt(nGround++, _mat(x, tile.lift, z))
        } else {
          this.water.setMatrixAt(nWater, _mat(x, WATER_Y, z))
          // 水色基色来自材质（PALETTE.water），instanceColor 只叠一点逐格微差
          this.water.setColorAt(nWater, _c.setScalar(this.seedTint[i]))
          nWater++
        }
        // 岛缘薄、岛心厚：崖厚随离岛心的距离收拢，底面自然成阶梯状穹顶
        const wr = Math.min(1, Math.hypot(x, z) / ISLAND_R_W)
        _sc.set(1, 0.2 + 0.8 * Math.max(0, 1 - Math.pow(wr, 1.35)), 1)
        this.cliff.setMatrixAt(
          nCliff,
          _m4.identity().compose(_v.set(x, tile.lift - 0.55, z), _q.identity(), _sc),
        )
        this.cliff.setColorAt(nCliff, _c.set(tile.kind === 'water' ? '#84b8d2' : PALETTE.cliff))
        nCliff++
        if (tile.kind === 'land') {
          if (roadSet.has(i)) this.roads.setMatrixAt(nRoad++, _mat(x, tile.lift + 0.035, z))
          if (plazaSet.has(i)) this.plazas.setMatrixAt(nPlaza++, _mat(x, tile.lift + 0.03, z))
        } else if (roadSet.has(i)) {
          this.roads.setMatrixAt(nRoad++, _mat(x, WATER_Y + 0.16, z))
        }
      }
    }
    // 标线第二遍：此时 roadSet 已完整，能正确判断路口走向
    for (const i of roadSet) {
      const c = i % COLS
      const r = (i / COLS) | 0
      const tile = t.tiles[i]
      if (!tile || tile.kind === 'void') continue
      const ew = roadSet.has(r * COLS + c + 1) || roadSet.has(r * COLS + c - 1)
      const ns = roadSet.has((r + 1) * COLS + c) || roadSet.has((r - 1) * COLS + c)
      if (!ew && !ns) continue
      _e.set(0, ew && !ns ? Math.PI / 2 : 0, 0)
      _q.setFromEuler(_e)
      const y = (tile.kind === 'water' ? WATER_Y + 0.16 : tile.lift + 0.035) + 0.026
      this.dashes.setMatrixAt(nDash, _m4.compose(_v.set(tileCX(c), y, tileCZ(r)), _q, _s))
      this.dashes.setColorAt(nDash, _c.set(PALETTE.roadLine))
      nDash++
    }

    this.ground.count = nGround
    this.cliff.count = nCliff
    this.water.count = nWater
    this.roads.count = nRoad
    this.plazas.count = nPlaza
    this.dashes.count = nDash
    for (const m of [this.ground, this.cliff, this.water, this.roads, this.plazas, this.dashes]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }

    /* ── 建筑与设施 ── */
    const recs = new Map<string, Rec[]>()
    const counters = new Map<string, number>()
    for (const d of this.dynamics) d.d.group.removeFromParent()
    this.dynamics = []

    for (const p of state.placed) {
      const def = BUILDING_MAP[p.type]
      if (!def) continue
      if (DYNAMIC_TYPES.has(p.type)) {
        const f = DYNAMIC_FACTORIES[p.type]
        if (!f) continue
        const d = f(p.seed)
        // 动态设施也要走和静态建筑同一套 birth 矩阵（位置 + 朝向 + 缩放）。
        // 原来只取 position，漏掉了 buildMatrix 里 (1-birth) 的下沉量 ——
        // 刚放下时它会沉到地下 1.2，而 growing 又只更新静态批次，于是永远浮不上来。
        this.buildMatrix(p, def).decompose(d.group.position, d.group.quaternion, d.group.scale)
        this.islandRoot.add(d.group)
        this.dynamics.push({ d, uid: p.uid })
        continue
      }
      if (!this.batches.has(p.type)) continue
      const idx = counters.get(p.type) ?? 0
      counters.set(p.type, idx + 1)
      const n = VARIANTS[p.type] ?? 1
      if (!recs.has(p.type)) recs.set(p.type, [])
      recs.get(p.type)!.push({
        uid: p.uid,
        variant: idx % n,
        matrix: this.buildMatrix(p, def),
        color: colorOf(p.seed),
      })
    }
    for (const [type, b] of this.batches) b.setAll(recs.get(type) ?? [])

    const roadCells: { col: number; row: number }[] = []
    for (const i of roadSet) roadCells.push({ col: i % COLS, row: (i / COLS) | 0 })
    this.crowd.setRoads(roadCells)
    if (this.dirtyGroundColor) this.refreshGroundColor()
    this.sun.shadow.needsUpdate = true
  }

  private buildMatrix(
    p: { col: number; row: number; rot: number; birth: number },
    def: BuildingDef,
  ) {
    const swap = p.rot % 2 === 1
    const w = swap ? def.h : def.w
    const h = swap ? def.w : def.h
    const cx = (p.col + w / 2) * TILE - WORLD_W / 2
    const cz = (p.row + h / 2) * TILE - WORLD_H / 2
    const t = getTerrain()
    let lift = 0
    let cnt = 0
    for (let r = 0; r < def.h; r++) {
      for (let c = 0; c < def.w; c++) {
        const tile = t.at(p.col + c, p.row + r)
        if (tile) {
          lift += tile.lift
          cnt++
        }
      }
    }
    lift = cnt ? lift / cnt : 0
    const y = def.surface === 'water' ? WATER_Y : lift
    _e.set(0, (p.rot * Math.PI) / 2, 0)
    _q.setFromEuler(_e)
    const b = Math.min(1, p.birth)
    const k = b >= 1 ? 1 : Math.max(0.001, easeOutBack(b))
    _v.set(cx, y - (1 - b) * 1.2, cz)
    _s.set(k, k, k)
    const out = new THREE.Matrix4().compose(_v, _q, _s)
    _s.set(1, 1, 1)
    return out
  }

  private refreshGroundColor() {
    const preset = SEASON_MAP[state.season]
    const base = new THREE.Color(preset.grass)
    const t = getTerrain()
    let n = 0
    for (let i = 0; i < COLS * ROWS; i++) {
      const tile = t.tiles[i]
      if (!tile || tile.kind !== 'land') continue
      _c.copy(base).multiplyScalar(this.seedTint[i])
      if (tile.skin === 'sand') _c.lerp(this._sand, 0.6)
      this.ground.setColorAt(n++, _c)
    }
    if (this.ground.instanceColor) this.ground.instanceColor.needsUpdate = true
    this.dirtyGroundColor = false
  }

  /* ───────────────────────── 四季 ───────────────────────── */

  applySeason(id: SeasonId, force = false) {
    const p = SEASON_MAP[id]
    applySkyDome(this.skyDome, p)
    this.scene.background = new THREE.Color(p.paper)
    applySeasonToLights(p, this.sun, this.hemi, this.amb)
    U.gSnow.value = p.snow
    U.gFoliage.value.set(p.foliage)
    U.gPine.value.set(p.pine)
    U.gLeaf.value = p.leaf
    U.gWind.value = p.id === 'summer' ? 0.75 : p.id === 'winter' ? 1.25 : 1
    this.field.setPreset(p, this.renderer.getPixelRatio())
    this.dirtyGroundColor = true
    // 喷泉水面用程序化天空的 PMREM 真反光（每种季节只算一次）
    let env = this.pmremCache.get(id)
    if (!env) {
      env = buildSkyPMREM(this.renderer, p)
      this.pmremCache.set(id, env)
    }
    matFountain.envMap = env
    matFountain.needsUpdate = true
    this.updateCamera()
    if (force) this.sync()
    else {
      this.refreshGroundColor()
      this.sun.shadow.needsUpdate = true
    }
  }

  /* ───────────────────────── 交互 ───────────────────────── */

  setHover(cell: { col: number; row: number } | null, ok: boolean, def: BuildingDef | null, rot: number) {
    if (!cell || !def || !def.solid) {
      this.hoverRing.visible = false
      if (this.ghost) this.ghost.visible = false
      return
    }
    const swap = rot % 2 === 1
    const w = swap ? def.h : def.w
    const h = swap ? def.w : def.h
    const cx = (cell.col + w / 2) * TILE - WORLD_W / 2
    const cz = (cell.row + h / 2) * TILE - WORLD_H / 2
    const tile = getTerrain().at(cell.col, cell.row)
    const y = (def.surface === 'water' ? WATER_Y : tile?.lift ?? 0) + 0.06
    this.hoverRing.scale.set(w * TILE, h * TILE, 1)
    this.hoverRing.position.set(cx, y, cz)
    this.hoverRing.material = ok ? matGhostOk : matGhostBad
    this.hoverRing.visible = true

    if (DYNAMIC_TYPES.has(def.id)) {
      if (this.ghost) this.ghost.visible = false
      return
    }
    if (this.ghostType !== def.id) {
      const b = this.batches.get(def.id)
      if (!b) return
      if (this.ghost) {
        this.scene.remove(this.ghost)
        this.ghost = null
      }
      this.ghost = new THREE.Mesh(b.firstGeometry, matGhostOk)
      this.ghost.renderOrder = 5
      this.scene.add(this.ghost)
      this.ghostType = def.id
    }
    if (this.ghost) {
      this.ghost.visible = true
      this.ghost.material = ok ? matGhostOk : matGhostBad
      this.ghost.position.set(cx, y - 0.06, cz)
      this.ghost.rotation.y = (rot * Math.PI) / 2
    }
  }

  setSelected(p: { col: number; row: number; type: string; rot: number } | null) {
    if (!p) {
      this.selRing.visible = false
      return
    }
    const def = BUILDING_MAP[p.type]
    const swap = p.rot % 2 === 1
    const w = swap ? def.h : def.w
    const h = swap ? def.w : def.h
    const tile = getTerrain().at(p.col, p.row)
    this.selRing.scale.set(w * TILE, h * TILE, 1)
    this.selRing.position.set(
      (p.col + w / 2) * TILE - WORLD_W / 2,
      (tile?.lift ?? 0) + 0.07,
      (p.row + h / 2) * TILE - WORLD_H / 2,
    )
    this.selRing.visible = true
  }

  pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.ndc, this.camera)
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return null
    const col = Math.floor((this.hit.x + WORLD_W / 2) / TILE)
    const row = Math.floor((this.hit.z + WORLD_H / 2) / TILE)
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null
    return { col, row }
  }

  /* ───────────────────────── 相机 ───────────────────────── */

  /** 按下：开始「拨地球」，顺手清掉上一次残留的惯性 */
  orbitBegin() {
    this.orbitActive = true
    this.yawVel = 0
    this.pitchVel = 0
    this.lastOrbitAt = performance.now()
  }

  /** 拖动：水平转方位（自由角度），垂直调俯仰 */
  orbit(dxPx: number, dyPx: number) {
    const now = performance.now()
    const dt = Math.min(0.05, Math.max(0.004, (now - this.lastOrbitAt) / 1000))
    this.lastOrbitAt = now
    const dYaw = dxPx * ORBIT_K
    const dPitch = dyPx * ORBIT_K
    this.yaw += dYaw
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch + dPitch))
    // 指数滑动平均得到角速度，松手后按这个速度继续转一会儿
    this.yawVel = clampV(this.yawVel * 0.55 + (dYaw / dt) * 0.45)
    this.pitchVel = clampV(this.pitchVel * 0.55 + (dPitch / dt) * 0.45)
    this.updateCamera()
  }

  orbitEnd() {
    this.orbitActive = false
  }

  /** 平移：把屏幕位移反解到地面上的世界位移 */
  pan(dxPx: number, dyPx: number) {
    const k = this.viewSize / (this.canvas.clientHeight || 1)
    const s = Math.sin(this.yaw)
    const c = Math.cos(this.yaw)
    // 屏幕右方向 = (sin yaw, 0, -cos yaw)；屏幕「上」在地面的投影 = (-cos yaw, 0, -sin yaw)。
    // 俯仰越低，屏幕上同样一像素对应的地面距离越远，所以要乘 1/sin(pitch)。
    const vk = (dyPx * k) / Math.max(0.3, Math.sin(this.pitch))
    this.target.x -= dxPx * k * s + vk * c
    this.target.z += dxPx * k * c - vk * s
    const lim = WORLD_W * 0.66
    this.target.x = Math.max(-lim, Math.min(lim, this.target.x))
    this.target.z = Math.max(-lim, Math.min(lim, this.target.z))
    this.updateCamera()
  }

  zoom(delta: number) {
    this.viewSize = Math.max(10, Math.min(130, this.viewSize * (1 + delta * 0.0012)))
    this.resize()
    this.updateCamera()
  }

  /** 按钮 / Q E：精确转 45°，并清掉惯性 */
  rotate(dir: number) {
    this.yaw += (dir * Math.PI) / 4
    this.yawVel = 0
    this.pitchVel = 0
    this.updateCamera()
  }

  resetView() {
    this.yaw = CAM_YAW_BASE
    this.pitch = ISO_ELEV
    this.yawVel = 0
    this.pitchVel = 0
    this.fitIsland()
  }

  /** 自动取景：把整座岛投影到当前视锥里，反解出需要的 viewSize */
  fitIsland(margin = 1.12) {
    this.target.set(0, 0, 0)
    this.viewSize = 44
    this.resize()
    this.updateCamera()
    this.camera.updateMatrixWorld(true)
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert()
    const t = getTerrain()
    let mx = 0.001
    let my = 0.001
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = t.tiles[r * COLS + c]
        if (!tile || tile.kind === 'void') continue
        _v.set(tileCX(c), 0, tileCZ(r)).project(this.camera)
        mx = Math.max(mx, Math.abs(_v.x))
        my = Math.max(my, Math.abs(_v.y))
      }
    }
    this.viewSize = Math.min(110, this.viewSize * Math.max(mx, my) * margin)
    this.resize()
    this.updateCamera()
  }

  updateCamera() {
    const p = SEASON_MAP[state.season]
    const ce = Math.cos(this.pitch)
    const se = Math.sin(this.pitch)
    _v.set(Math.cos(this.yaw) * ce, se, Math.sin(this.yaw) * ce).multiplyScalar(130)
    this.camera.position.copy(this.target).add(_v)
    this.camera.lookAt(this.target)
    this.skyDome.position.copy(this.camera.position)
    // 平行光跟着视野走，阴影视锥始终罩住可见区域
    const se2 = Math.sin(p.sun.elevation * 0.6 + 0.35)
    const ce2 = Math.cos(p.sun.elevation * 0.6 + 0.35)
    _v.set(Math.cos(p.sun.azimuth) * ce2, se2, Math.sin(p.sun.azimuth) * ce2).multiplyScalar(72)
    this.sun.position.copy(this.target).add(_v)
    this.sun.target.position.copy(this.target)
    this.sun.target.updateMatrixWorld()
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const aspect = w / h
    this.camera.left = (-this.viewSize * aspect) / 2
    this.camera.right = (this.viewSize * aspect) / 2
    this.camera.top = this.viewSize / 2
    this.camera.bottom = -this.viewSize / 2
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  /* ───────────────────────── 每帧 ───────────────────────── */

  tick(dtReal: number, dtGame: number, paused: boolean) {
    if (state.rev !== this.rev) {
      this.rev = state.rev
      this.sync()
    }
    // 松手后的惯性：像拨过一颗地球那样慢慢停住（相机不属于游戏时间，暂停时也照转）
    if (!this.orbitActive) {
      if (Math.abs(this.yawVel) > 0.002 || Math.abs(this.pitchVel) > 0.002) {
        this.yaw += this.yawVel * dtReal
        const np = this.pitch + this.pitchVel * dtReal
        this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, np))
        if (this.pitch !== np) this.pitchVel = 0
        const damp = Math.pow(ORBIT_DAMP, dtReal)
        this.yawVel *= damp
        this.pitchVel *= damp
        this.updateCamera()
      } else {
        this.yawVel = 0
        this.pitchVel = 0
      }
    }
    this.time += dtGame
    U.gTime.value = this.time
    this.field.update(this.time)
    texWater.offset.y -= dtGame * 0.012
    texWater.offset.x += dtGame * 0.004
    this.crowd.update(this.time, paused ? 0 : Math.min(dtGame, 0.05))
    if (!paused) for (const d of this.dynamics) d.d.update(this.time, dtGame)

    if (growing.length) {
      let allDone = true
      for (const uid of growing) {
        const p = getByUid(uid)
        if (!p) continue
        p.birth = Math.min(1, p.birth + dtReal / GROW_TIME)
        if (p.birth < 1) allDone = false
        const b = this.batches.get(p.type)
        if (b) b.updateSlot(uid, this.buildMatrix(p, BUILDING_MAP[p.type]))
      }
      // 动态设施（摩天轮 / 水轮 / 过山车…）不参与批次，得单独驱动，
      // 否则它会一直卡在刚放下时那个「沉下去 + 缩到 0」的初始矩阵上。
      for (const dyn of this.dynamics) {
        const p = getByUid(dyn.uid)
        if (!p || p.birth >= 1) continue
        this.buildMatrix(p, BUILDING_MAP[p.type]).decompose(
          dyn.d.group.position,
          dyn.d.group.quaternion,
          dyn.d.group.scale,
        )
      }
      if (allDone) {
        growing.length = 0
        for (const b of this.batches.values()) if (b.needsOutline) b.rebuildOutline()
      } else {
        this.outlineAcc += dtReal
        if (this.outlineAcc > 0.1) {
          this.outlineAcc = 0
          for (const b of this.batches.values()) if (b.needsOutline) b.rebuildOutline()
        }
      }
    }

    // 阴影节流：静态场景没必要每帧重算阴影贴图
    this.shadowAcc += dtReal
    if (this.shadowAcc > (paused ? 1.2 : 0.09)) {
      this.shadowAcc = 0
      this.sun.shadow.needsUpdate = true
    }

    this.renderer.render(this.scene, this.camera)

    this.fpsAcc += dtReal
    this.fpsN++
    this.statAcc += dtReal
    if (this.fpsAcc > 0.5) {
      this.fps = this.fpsN / this.fpsAcc
      this.fpsAcc = 0
      this.fpsN = 0
    }
    if (this.statAcc > 0.45 && this.onStats) {
      this.statAcc = 0
      this.onStats({
        fps: this.fps,
        calls: this.renderer.info.render.calls,
        tris: this.renderer.info.render.triangles,
        geoms: this.renderer.info.memory.geometries,
        props: state.placed.length,
      })
    }
  }

  dispose() {
    this.renderer.dispose()
  }
}

function colorOf(seed: number) {
  const a = ((seed * 9301 + 49297) % 233280) / 233280
  const b = ((seed * 4523 + 1213) % 199999) / 199999
  const c = ((seed * 7717 + 331) % 177777) / 177777
  return new THREE.Color(0.94 + a * 0.09, 0.93 + b * 0.09, 0.92 + c * 0.09)
}

function easeOutBack(x: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  const t = Math.min(1, Math.max(0, x))
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
