import { COLS, ROWS } from './constants'
import type { Tile } from './types'

export interface Terrain {
  seed: number
  tiles: Tile[]
  /** 陆地格数 */
  landCount: number
  at(col: number, row: number): Tile | null
  isLand(col: number, row: number): boolean
  isWater(col: number, row: number): boolean
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * 岛屿半径（归一化到 ±1 的网格坐标里，1.0 正好是网格半宽 16 格）。
 * 形状用超椭圆 |x|^p + |z|^p = R^p：p 取 2 是正圆、趋近无穷是方岛。
 * p = 2.8 时对角线只比正轴远 10%，看上去就是一颗圆星球，
 * 但角部比正圆多留出 ~90 格 —— 乐园那块 11×11 的场地正好靠它才放得下。
 */
export const ISLAND_R = 0.985
const ISLAND_P = 2.4

/**
 * 程序化生成「云溪镇」所在的浮空沙盘：
 * **圆盘岛**（像一颗浮在空中的小星球，低俯角绕行时才立得住）+ 一湖一河一湾 + 水岸沙地。
 * 全部是整数格，岛缘天然形成锯齿状阶梯边。
 */
export function makeTerrain(seed = 7): Terrain {
  const tiles: Tile[] = new Array(COLS * ROWS)
  let landCount = 0
  const s = seed * 0.37

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const nx = ((c + 0.5) / COLS) * 2 - 1
      const nz = ((r + 0.5) / ROWS) * 2 - 1
      // 圆盘（超椭圆）：半径略小于网格半宽，四边都不顶到画布外
      const d =
        Math.pow(Math.pow(Math.abs(nx), ISLAND_P) + Math.pow(Math.abs(nz), ISLAND_P), 1 / ISLAND_P) /
        ISLAND_R
      // 噪声压得比原来小：这是颗「星球」，圆周要立得住，
      // 只留一点点起伏做有机的边缘，别让轮廓变成一团不规则的多边形。
      const n =
        0.038 * Math.sin(c * 0.83 + s) +
        0.032 * Math.cos(r * 0.71 + s * 1.7) +
        0.023 * Math.sin((c + r) * 0.41 + s * 0.6) +
        0.019 * Math.cos((c - r) * 0.63 + s * 2.3)

      let kind: Tile['kind'] = d + n < 1.0 ? 'land' : 'void'

      // 湖：西南一块不规则的塘（留在内陆，离岸还差一圈）
      const ld = Math.hypot((c - 9.4) * 0.95, (r - 23.0) * 1.25)
      if (kind === 'land' && ld < 2.25 + 0.7 * Math.sin(c * 0.9 + r * 1.3 + s)) kind = 'water'
      // 河：东北侧一条蜿蜒水道，南北两头通向海岸
      const riverX = 23.4 + 1.5 * Math.sin(r * 0.42 + s * 2.1)
      if (kind === 'land' && Math.abs(c - riverX) < 1.15) kind = 'water'
      // 西北一个小湾，啃在海岸线上
      const bd = Math.hypot((c - 8.6) * 1.1, (r - 3.6) * 0.95)
      if (kind === 'land' && bd < 1.5 + 0.55 * Math.cos(c * 1.1 - s)) kind = 'water'

      tiles[r * COLS + c] = {
        kind,
        skin: 'grass',
        lift: (hash(c * 31 + r * 17 + seed) - 0.5) * 0.09,
      }
      if (kind === 'land') landCount++
    }
  }

  // 水岸两步内是沙地，第三步是深一点的草 —— 自然的水陆过渡
  const distToWater = (c: number, r: number) => {
    for (let rad = 1; rad <= 2; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const nc = c + dc
          const nr = r + dr
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue
          if (tiles[nr * COLS + nc].kind === 'water') return rad
        }
      }
    }
    return 9
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = tiles[r * COLS + c]
      if (t.kind !== 'land') continue
      const d = distToWater(c, r)
      if (d === 1) t.skin = 'sand'
      else if (d === 2 && hash(c * 13 + r * 7 + seed * 3) > 0.45) t.skin = 'sand'
      t.lift += d === 1 ? -0.11 : d >= 3 ? 0.05 : 0
    }
  }

  return {
    seed,
    tiles,
    landCount,
    at(col, row) {
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null
      return tiles[row * COLS + col]
    },
    isLand(col, row) {
      const t = tiles[row * COLS + col] as Tile | undefined
      return !!t && t.kind === 'land'
    },
    isWater(col, row) {
      const t = tiles[row * COLS + col] as Tile | undefined
      return !!t && t.kind === 'water'
    },
  }
}

export const key = (col: number, row: number) => row * COLS + col
