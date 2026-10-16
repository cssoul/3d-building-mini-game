import { reactive } from 'vue'
import { BUILDINGS, BUILDING_MAP, COLS, ROWS, SEASON_MAP, SEASON_ORDER, SEASON_SECONDS } from './constants'
import { key, makeTerrain, type Terrain } from './island'
import type { Category, Placed, SeasonId } from './types'

export interface GameState {
  seed: number
  coins: number
  season: SeasonId
  /** 当前节气进度 0..1 */
  seasonT: number
  year: number
  /** 0=暂停 1/2/4=倍速 */
  speed: number
  /** 当前工具：select | bulldoze | 建筑 id */
  tool: string
  /** 分类页签 */
  cat: Category
  /** 待放置建筑的旋转 */
  rot: number
  hover: { col: number; row: number; ok: boolean } | null
  selected: number | null
  placed: Placed[]
  /** 场景版本号，任何几何改动 +1，渲染层据此增量重建 */
  rev: number
  pop: number
  popCap: number
  jobs: number
  approval: number
  greenery: number
  gross: number
  upkeep: number
  farmN: number
  parkN: number
  townN: number
  toast: { text: string; kind: 'ok' | 'warn'; at: number } | null
}

export const state = reactive<GameState>({
  seed: 20261013,
  coins: 9000,
  season: 'spring',
  seasonT: 0.42,
  year: 1,
  speed: 1,
  tool: 'select',
  cat: 'town',
  rot: 0,
  hover: null,
  selected: null,
  placed: [],
  rev: 0,
  pop: 0,
  popCap: 0,
  jobs: 0,
  approval: 60,
  greenery: 0,
  gross: 0,
  upkeep: 0,
  farmN: 0,
  parkN: 0,
  townN: 0,
  toast: null,
})

let terrain: Terrain = makeTerrain(state.seed)
/** 每格的占用者 uid（0 = 空） */
let owner = new Int32Array(COLS * ROWS)
let uidSeq = 1
const byUid = new Map<number, Placed>()
/** 建造成长动画：最近落成的 uid 列表 */
export const growing: number[] = []

export const getTerrain = () => terrain
export const getOwner = () => owner
export const getByUid = (uid: number) => byUid.get(uid)

export function toast(text: string, kind: 'ok' | 'warn' = 'ok') {
  state.toast = { text, kind, at: performance.now() }
}

/* ───────────────────────────── 放置规则 ───────────────────────────── */

export function tilesOf(type: string, col: number, row: number, rot: number) {
  const def = BUILDING_MAP[type]
  if (!def) return []
  const swap = rot % 2 === 1
  const w = swap ? def.h : def.w
  const h = swap ? def.w : def.h
  const out: { col: number; row: number }[] = []
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out.push({ col: col + c, row: row + r })
  return out
}

export function canPlace(type: string, col: number, row: number, rot: number): boolean {
  const def = BUILDING_MAP[type]
  if (!def) return false
  for (const t of tilesOf(type, col, row, rot)) {
    if (t.col < 0 || t.row < 0 || t.col >= COLS || t.row >= ROWS) return false
    const i = key(t.col, t.row)
    const tile = terrain.tiles[i]
    if (!tile || tile.kind === 'void') return false
    if (owner[i] !== 0) return false
    if (def.surface === 'land' && tile.kind !== 'land') return false
    if (def.surface === 'water' && tile.kind !== 'water') return false
  }
  return true
}

export function place(type: string, col: number, row: number, rot: number, opts: { free?: boolean } = {}) {
  const def = BUILDING_MAP[type]
  if (!def) return false
  if (!canPlace(type, col, row, rot)) return false
  if (!opts.free && state.coins < def.cost) {
    toast('铜钱不够了，先修几条路通商吧', 'warn')
    return false
  }
  if (!opts.free) state.coins -= def.cost

  const uid = uidSeq++
  const p: Placed = {
    uid,
    type,
    col,
    row,
    rot: ((rot % 4) + 4) % 4,
    seed: Math.floor(Math.random() * 100000),
    birth: opts.free ? 1 : 0,
  }
  for (const t of tilesOf(type, col, row, rot)) owner[key(t.col, t.row)] = uid
  byUid.set(uid, p)
  state.placed.push(p)
  if (p.birth < 1) growing.push(uid)
  recompute()
  return true
}

export function removeAt(col: number, row: number) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false
  const uid = owner[key(col, row)]
  if (!uid) return false
  const p = byUid.get(uid)
  if (!p) return false
  const def = BUILDING_MAP[p.type]
  for (const t of tilesOf(p.type, p.col, p.row, p.rot)) owner[key(t.col, t.row)] = 0
  byUid.delete(uid)
  state.placed.splice(state.placed.indexOf(p), 1)
  state.coins += Math.round((def?.cost ?? 0) * 0.4)
  recompute()
  return true
}

export function clearAll() {
  owner = new Int32Array(COLS * ROWS)
  byUid.clear()
  state.placed.length = 0
  growing.length = 0
  recompute()
}

/* ───────────────────────────── 统计与经济 ───────────────────────────── */

export function recompute() {
  let popCap = 0
  let jobs = 0
  let green = 0
  let appr = 0
  let gross = 0
  let upkeep = 0
  let farmN = 0
  let parkN = 0
  let townN = 0
  const rate = SEASON_MAP[state.season].rate

  for (const p of state.placed) {
    const d = BUILDING_MAP[p.type]
    if (!d) continue
    popCap += d.pop ?? 0
    jobs += d.jobs ?? 0
    green += d.green ?? 0
    appr += d.approval ?? 0
    upkeep += d.cost * 0.008
    if (d.income) {
      const m = d.yield ? rate[d.yield] : 1
      gross += d.income * m
      if (d.yield === 'farm') farmN++
      else if (d.yield === 'park') parkN++
      else townN++
    }
  }
  // 民心 ≈ 基础 + 建筑加成 + 绿化率 − 住房压力 − 岗位缺口
  const greenRatio = terrain.landCount ? green / terrain.landCount : 0
  let a = 44 + Math.min(28, appr) + Math.min(26, greenRatio * 150)
  if (popCap > 0 && state.pop / popCap > 0.96) a -= 11
  if (state.pop > 0 && jobs < state.pop * 0.5) a -= 8
  if (state.pop === 0) a = 42
  const approval = Math.max(6, Math.min(99, a))

  state.popCap = popCap
  state.jobs = jobs
  state.greenery = greenRatio
  state.approval = Math.round(approval)
  // 产出随民心浮动：民心 50% 时打八折，满民心时满额
  state.gross = gross * (0.6 + approval / 100 * 0.5)
  state.upkeep = upkeep
  state.farmN = farmN
  state.parkN = parkN
  state.townN = townN
  state.rev++
}

export const netIncome = () => state.gross - state.upkeep

/** 推进一次逻辑；dtGame 已按倍速折算过（0 = 暂停） */
export function tick(dt: number) {
  if (dt <= 0) return

  state.coins += (netIncome() / 60) * dt

  state.seasonT += dt / SEASON_SECONDS
  if (state.seasonT >= 1) {
    state.seasonT -= 1
    const i = SEASON_ORDER.indexOf(state.season)
    const next = SEASON_ORDER[(i + 1) % 4]
    state.season = next
    if (next === 'spring') state.year++
    recompute()
    toast(`${state.year} 年 · ${SEASON_MAP[next].term} · ${SEASON_MAP[next].note}`)
  }

  // 人口向容量缓慢爬升 / 回落
  if (state.popCap > 0) {
    const target = Math.floor(state.popCap * Math.max(0, Math.min(1, (state.approval - 34) / 46)))
    const speed = state.approval > 55 ? 0.6 : state.approval < 45 ? 0.5 : 0.12
    const dv = target - state.pop
    if (Math.abs(dv) > 0.02) state.pop += Math.sign(dv) * Math.min(Math.abs(dv), speed * dt)
  } else {
    state.pop = Math.max(0, state.pop - dt)
  }
  state.pop = Math.round(state.pop * 100) / 100
}

export function setSeason(id: SeasonId) {
  state.season = id
  state.seasonT = 0
  recompute()
}

/* ───────────────────────────── 默认布镇 ───────────────────────────── */

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rnd: () => number, items: [T, number][]): T {
  let total = 0
  for (const [, w] of items) total += w
  let x = rnd() * total
  for (const [v, w] of items) {
    x -= w
    if (x <= 0) return v
  }
  return items[items.length - 1][0]
}

export interface Window {
  col: number
  row: number
  ratio: number
}

/**
 * 找干净的空地：不要求 100% 全陆地（岛屿边缘本就参差），
 * 而是按「陆地占比」打分，再叠加「离岛心近」或「离镇上远」的偏好。
 * 返回按分数排序的前 `limit` 个候选 —— 只取第一名是不保险的，
 * 大件设施（过山车 4×4、摩天轮 3×3）未必恰好落在最空的那一块里。
 */
function windowList(
  rnd: () => number,
  w: number,
  h: number,
  opts: { near?: { col: number; row: number }; minDist?: number; minRatio?: number; limit?: number } = {},
): Window[] {
  const out: (Window & { score: number })[] = []
  const minRatio = opts.minRatio ?? 0.86
  for (let r = 1; r + h < ROWS - 1; r++) {
    for (let c = 1; c + w < COLS - 1; c++) {
      const cx = c + w / 2
      const cy = r + h / 2
      let dist = 0
      if (opts.near) {
        dist = Math.max(Math.abs(cx - opts.near.col), Math.abs(cy - opts.near.row))
        if (opts.minDist !== undefined && dist < opts.minDist) continue
      }
      let blocked = 0
      for (let rr = r - 1; rr < r + h + 1; rr++) {
        for (let cc = c - 1; cc < c + w + 1; cc++) {
          const t = terrain.tiles[rr * COLS + cc]
          if (!t || t.kind === 'void') blocked++
        }
      }
      let landInner = 0
      for (let rr = r; rr < r + h; rr++) {
        for (let cc = c; cc < c + w; cc++) {
          const i = rr * COLS + cc
          const t = terrain.tiles[i]
          if (t && t.kind === 'land' && owner[i] === 0) landInner++
        }
      }
      const ratio = landInner / (w * h)
      if (ratio < minRatio) continue
      const dc = Math.hypot(cx - COLS / 2, cy - ROWS / 2)
      out.push({
        col: c,
        row: r,
        ratio,
        score: ratio * 120 - dc * 0.5 - blocked * 0.6 + dist * 1.5 + rnd() * 0.6,
      })
    }
  }
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, opts.limit ?? 1).map(({ col, row, ratio }) => ({ col, row, ratio }))
}

const bestWindow = (
  rnd: () => number,
  w: number,
  h: number,
  opts: { near?: { col: number; row: number }; minDist?: number; minRatio?: number } = {},
): Window | null => windowList(rnd, w, h, { ...opts, limit: 1 })[0] ?? null

const put = (type: string, col: number, row: number, rot = 0) => {
  if (canPlace(type, col, row, rot)) {
    place(type, col, row, rot, { free: true })
    return true
  }
  return false
}

/** 铺一条路（会在地基上自动架桥） */
function road(col: number, row: number) {
  put('road', col, row)
}

export function seedTown(seed = Math.floor(Math.random() * 1e6)) {
  clearAll()
  terrain = makeTerrain(seed)
  state.seed = seed
  const rnd = mulberry32(seed)

  /* ── 1. 镇：外环 + 十字街，围出四个街区 ── */
  const townSite = bestWindow(rnd, 15, 13)
  let townC = Math.floor(COLS / 2) - 7
  let townR = Math.floor(ROWS / 2) - 6
  if (townSite) {
    townC = townSite.col
    townR = townSite.row
    const W = 15
    const H = 13
    for (let c = townC; c < townC + W; c++) {
      road(c, townR)
      road(c, townR + H - 1)
    }
    for (let r = townR; r < townR + H; r++) {
      road(townC, r)
      road(townC + W - 1, r)
    }
    // 十字内街
    for (let c = townC + 1; c < townC + W - 1; c++) road(c, townR + 6)
    for (let r = townR + 1; r < townR + H - 1; r++) road(townC + 7, r)
    // 街角铺装
    for (let c = townC + 1; c < townC + W - 1; c++) {
      for (let r = townR + 1; r < townR + H - 1; r++) {
        if ((c - townC) % 4 === 2 && (r - townR) % 4 === 2) put('plaza', c, r)
      }
    }

    /* ── 2. 先占地标，再填街区 ──
       地标必须抢在民宅前面落位，否则 2×2 / 3×2 的位置早被随机填满，
       宝塔和书院就永远生成不出来了。 */
    put('pagoda', townC + 2, townR + 3, 0)
    put('academy', townC + 9, townR + 3, 0)
    put('paifang', townC - 1, townR + 6, 1)

    const weights: [string, number][] = [
      ['house', 32],
      ['courtyard', 14],
      ['shop', 11],
      ['teahouse', 8],
      ['tavern', 6],
      ['orchard', 5],
      ['farm', 4],
      ['bamboo', 5],
      ['blossom', 4],
      ['pine', 3],
      ['lantern', 3],
      ['lamp', 3],
    ]
    const blocks: [number, number, number, number][] = [
      [townC + 1, townR + 1, 6, 5],
      [townC + 8, townR + 1, 6, 5],
      [townC + 1, townR + 7, 6, 5],
      [townC + 8, townR + 7, 6, 5],
    ]
    for (const [bc, br, bw, bh] of blocks) {
      for (let r = br; r < br + bh; r++) {
        for (let c = bc; c < bc + bw; c++) {
          if (rnd() > 0.74) continue
          const type = pick(rnd, weights)
          if (!BUILDING_MAP[type]) continue
          put(type, c, r, Math.floor(rnd() * 4))
        }
      }
    }
  }

  /* ── 3. 乐园：绕开镇子找一块地，规整布置 ── */
  const townCenter = { col: townC + 7, row: townR + 6 }
  /* 圆盘岛比原来的圆角方岛少了四角余量，乐园这块 11×11 得多给几级兜底；
   * 而且要逐个候选校验设施真的落得下 —— 只挑「最空的一块」，
   * 过山车和摩天轮照样会被挤到岛外去。 */
  // 9×9 就够摆下六件设施；原来的 11×11 在圆盘岛上太奢侈，
  // 一旦窗口贴到岛缘，过山车（4×4）和摩天轮（3×3）就双双落空。
  const PARK = 9
  const ridesFor = (pc: number, pr: number): [string, number, number][] => [
    ['coaster', pc, pr],
    ['ferris', pc + 5, pr],
    ['carousel', pc, pr + 5],
    ['teacup', pc + 2, pr + 5],
    ['fountain', pc + 5, pr + 5],
    ['gate', pc + 2, pr + PARK - 1],
  ]
  const parkCandidates: Window[] = [
    ...windowList(rnd, PARK, PARK, { near: townCenter, minDist: 12, limit: 12 }),
    ...windowList(rnd, PARK, PARK, { near: townCenter, minDist: 9, minRatio: 0.85, limit: 12 }),
    ...windowList(rnd, PARK, PARK, { near: townCenter, minDist: 6, minRatio: 0.78, limit: 12 }),
    ...windowList(rnd, PARK, PARK, { minRatio: 0.6, limit: 20 }),
  ]
  const tried = new Set<string>()
  let parkSite: Window | null = null
  for (const s of parkCandidates) {
    const k = `${s.col},${s.row}`
    if (tried.has(k)) continue
    tried.add(k)
    if (ridesFor(s.col, s.row).every(([t, c, r]) => canPlace(t, c, r, 0))) {
      parkSite = s
      break
    }
  }
  if (!parkSite) parkSite = parkCandidates[0] ?? null
  if (parkSite) {
    const pc = parkSite.col
    const pr = parkSite.row
    /* 先摆设施，再补铺装 —— 反过来的话广场会把位置占掉 */
    for (const [t, c, r] of ridesFor(pc, pr)) put(t, c, r)
    // 外圈 + 内部补铺装
    for (let i = 0; i < PARK; i++) {
      put('plaza', pc + i, pr)
      put('plaza', pc + i, pr + PARK - 1)
      put('plaza', pc, pr + i)
      put('plaza', pc + PARK - 1, pr + i)
    }
    for (let r = pr + 1; r < pr + PARK - 1; r++) {
      for (let c = pc + 1; c < pc + PARK - 1; c++) put('plaza', c, r)
    }
    // 乐园门口到镇子的引路
    const link = pc + 2
    const outTo = Math.min(ROWS - 2, pr + PARK + 6)
    for (let r = pr + PARK; r <= outTo; r++) road(link, r)
    for (let c = Math.min(link, townC + 7); c <= Math.max(link, townC + 7); c++) road(c, outTo)
    for (let r = townR + 13; r <= outTo; r++) road(townC + 7, r)
  }

  /* ── 4. 水岸与街边的绿化，把岛围起来 ── */
  const isRoad = (col: number, row: number) => {
    const i = row * COLS + col
    const uid = owner[i]
    if (!uid) return false
    const p = byUid.get(uid)
    return !!p && p.type === 'road'
  }
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      const i = r * COLS + c
      if (owner[i] !== 0) continue
      const t = terrain.tiles[i]
      if (t.kind !== 'land') continue
      let nearWater = 0
      let nearRoad = 0
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = terrain.at(c + dc, r + dr)
        if (n?.kind === 'water') nearWater++
        if (isRoad(c + dc, r + dr)) nearRoad++
      }
      if (nearWater >= 1 && rnd() < 0.46) {
        put(pick(rnd, [['pine', 6], ['blossom', 4], ['bamboo', 3]] as [string, number][]), c, r)
      } else if (nearRoad >= 2 && rnd() < 0.34) {
        put(pick(rnd, [['blossom', 5], ['pine', 3], ['flowerbed', 2], ['lamp', 2]] as [string, number][]), c, r)
      } else if (rnd() < 0.16) {
        put(pick(rnd, [['pine', 5], ['bamboo', 3], ['blossom', 2]] as [string, number][]), c, r)
      }
    }
  }

  state.placed.forEach((p) => (p.birth = 1))
  growing.length = 0
  state.pop = 0
  state.coins = 9000
  state.year = 1
  state.seasonT = 0.42
  state.season = 'spring'
  state.selected = null
  recompute()
  state.pop = Math.floor(state.popCap * 0.8)
}

export const ALL_BUILDINGS = BUILDINGS
