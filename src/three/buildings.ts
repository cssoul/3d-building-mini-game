import * as THREE from 'three'
import { PALETTE, TILE } from '../game/constants'
import { Geo, TAG, coneGeo, hipRoofGeo, prismGeo, pyramidRoofGeo, sphereGeo, torusGeo, withWhiteColor } from './geo'

const P = PALETTE

/** 按高度给风摆幅度（越高越摆） */
const flexFrom = (from: number, k = 0.055, max = 0.05) => (x: number, y: number, z: number) =>
  Math.min(max, Math.max(0, y - from) * k)

/** 树冠锚点：所有阔叶树都把树冠建在 y≈1.15 之上，冬季落叶就朝这里收缩 */
export const CANOPY_ANCHOR = 1.15

/* ─────────────────────────── 通用零件 ─────────────────────────── */

/** 台基：中式建筑都坐在一块石台子上 */
function podium(g: Geo, w: number, d: number, h = 0.16, color = '#dedad0') {
  g.box(w + 0.16, h, d + 0.16, 0, h / 2, 0, color)
}

/** 硬山顶长屋：墙 + 坡顶 + 檐口 + 正脊 */
function gableHall(
  g: Geo,
  w: number,
  d: number,
  wallH: number,
  x: number,
  z: number,
  colorWall: string,
  colorRoof: string,
  roofH = 0.62,
) {
  g.box(w, wallH, d, x, wallH / 2, z, colorWall)
  const over = 0.16
  g.box(w + over * 2 + 0.1, 0.07, d + over * 2 + 0.1, x, wallH - 0.02, z, P.woodDark)
  g.add(hipRoofGeo(w, d, roofH, over, Math.max(0.08, w / 2 - d / 2)), colorRoof, {
    m: new THREE.Matrix4().makeTranslation(x, wallH + 0.03, z),
  })
  g.box(w - d + 0.26, 0.09, 0.12, x, wallH + roofH + 0.03, z, P.tileGrey)
}

/** 一扇窗（贴在墙面上） */
function win(g: Geo, x: number, y: number, z: number, w = 0.28, h = 0.28, face: 'z' | 'x' = 'z') {
  if (face === 'z') {
    g.box(w, h, 0.045, x, y, z, P.window)
    g.box(w + 0.06, 0.04, 0.06, x, y + h / 2 + 0.02, z, P.woodDark)
    g.box(0.035, h, 0.055, x, y, z, P.woodDark)
  } else {
    g.box(0.045, h, w, x, y, z, P.window)
    g.box(0.06, 0.04, w + 0.06, x, y + h / 2 + 0.02, z, P.woodDark)
    g.box(0.055, h, 0.035, x, y, z, P.woodDark)
  }
}

/** 门：两扇对开 + 门楣 */
function door(g: Geo, x: number, y: number, z: number, w = 0.44, h = 0.55) {
  g.box(w, h, 0.05, x, y + h / 2, z, P.woodDark)
  g.box(w + 0.14, 0.07, 0.08, x, y + h + 0.035, z, P.wood)
  g.box(0.02, h, 0.06, x, y + h / 2, z + 0.005, P.wood)
}

/** 挂一只灯笼（走 matGlow，不受光） */
function lantern(g: Geo, x: number, y: number, z: number, r = 0.11) {
  g.box(0.015, 0.18, 0.015, x, y + 0.09, z, P.woodDark)
  g.add(sphereGeo(r, 8, 6), P.lantern, { m: new THREE.Matrix4().makeTranslation(x, y, z) })
  g.box(0.05, 0.03, 0.05, x, y + r, z, P.gold)
}

/** 一株树冠：阔叶（圆团） */
function roundCanopy(g: Geo, x: number, y: number, z: number, r: number, tag: number, flex: number, leaf: number) {
  g.add(sphereGeo(r, 7, 5), P['spring-leaf'], {
    m: new THREE.Matrix4().makeTranslation(x, y, z),
    tag,
    flex,
    leaf,
    jitter: 0.05,
  })
}

/* ─────────────────────────── 城镇建筑 ─────────────────────────── */

function house(): THREE.BufferGeometry[] {
  const roofs = [P.roofSlate, P.roofCream, P.roofPink, P.roofBlue]
  return roofs.map((roof) => {
    const g = new Geo()
    const W = 1.72
    const D = 1.72
    podium(g, W, D, 0.16)
    g.box(W, 0.84, D, 0, 0.16 + 0.42, 0, P.wall)
    // 墙角木柱
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) g.box(0.1, 0.84, 0.1, (sx * W) / 2, 0.16 + 0.42, (sz * D) / 2, P.wood)
    door(g, 0, 0.16, D / 2 + 0.005)
    win(g, -0.52, 0.72, D / 2 + 0.005)
    win(g, 0.52, 0.72, D / 2 + 0.005)
    win(g, W / 2 + 0.005, 0.72, -0.35, 0.26, 0.26, 'x')
    const top = 0.16 + 0.84
    g.add(hipRoofGeo(W, D, 0.62, 0.2, 0.42), roof, { m: new THREE.Matrix4().makeTranslation(0, top, 0) })
    g.box(W + 0.44, 0.06, D + 0.44, 0, top + 0.01, 0, P.woodDark)
    g.box(0.95, 0.09, 0.13, 0, top + 0.63, 0, P.tileGrey)
    g.box(0.13, 0.42, 0.13, 0.52, top + 0.42, -0.42, P.roofSlate)
    return g.toGeometry()
  })
}

function courtyard(): THREE.BufferGeometry[] {
  return [P.roofCream, P.roofSlate].map((roof) => {
    const g = new Geo()
    const W = 3.7
    podium(g, W, W, 0.18)
    // 院墙
    const t = 0.13
    const h = 0.7
    for (const [x, z, w, d] of [
      [0, -W / 2, W, t],
      [0, W / 2, W, t],
      [-W / 2, 0, t, W],
      [W / 2, 0, t, W],
    ] as number[][]) {
      g.box(w, h, d, x, 0.18 + h / 2, z, P.wallWarm)
      g.box(w + 0.1, 0.08, d + 0.1, x, 0.18 + h + 0.02, z, P.tileGrey)
    }
    // 院门
    g.box(0.16, h + 0.34, 0.16, -0.34, 0.18 + (h + 0.34) / 2, W / 2, P.wood)
    g.box(0.16, h + 0.34, 0.16, 0.34, 0.18 + (h + 0.34) / 2, W / 2, P.wood)
    g.add(pyramidRoofGeo(0.8, 0.44, 0.3, 0.14, 0.09), roof, {
      m: new THREE.Matrix4().makeTranslation(0, 0.18 + h + 0.34, W / 2),
    })
    // 正房（北）
    gableHall(g, 2.5, 1.25, 1.05, 0, -1.1, P.wall, roof, 0.66)
    win(g, -0.6, 0.72, -0.47, 0.3, 0.3)
    win(g, 0.6, 0.72, -0.47, 0.3, 0.3)
    door(g, 0, 0.18, -0.46, 0.44, 0.6)
    // 东西厢房
    for (const sx of [-1, 1]) {
      gableHall(g, 1.05, 2.0, 0.84, sx * 1.2, 0.18, P.wallWarm, roof, 0.52)
      win(g, sx * 0.7, 0.68, 0.5, 0.3, 0.28, 'x')
    }
    // 天井里的石榴树 + 水缸
    g.cyl(0.07, 0.09, 0.72, 0.55, 0.18 + 0.36, 0.75, P.trunk, { seg: 6 })
    roundCanopy(g, 0.55, 1.22, 0.75, 0.42, TAG.LEAF, 0.035, 1)
    g.cyl(0.22, 0.2, 0.34, -0.62, 0.18 + 0.17, 0.78, P.tileGrey, { seg: 8 })
    return g.toGeometry()
  })
}

function shop(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 1.7
  podium(g, W, W, 0.14)
  g.box(W, 0.82, W, 0, 0.14 + 0.41, 0, P.wallWarm)
  // 门面：柜台 + 雨篷
  g.box(W + 0.4, 0.06, 0.62, 0, 0.82, W / 2 + 0.2, P.roofCream, { rx: -0.34 })
  g.box(0.06, 0.5, 0.06, -W / 2 - 0.1, 0.14 + 0.5, W / 2 + 0.4, P.wood)
  g.box(0.06, 0.5, 0.06, W / 2 + 0.1, 0.14 + 0.5, W / 2 + 0.4, P.wood)
  door(g, 0, 0.14, W / 2 + 0.005, 0.5, 0.6)
  win(g, -0.6, 0.66, W / 2 + 0.005)
  // 幌子
  g.cyl(0.03, 0.03, 1.5, W / 2 + 0.24, 0.75, W / 2 + 0.18, P.woodDark, { seg: 5 })
  g.box(0.06, 0.5, 0.04, W / 2 + 0.24, 1.28, W / 2 + 0.36, P.lantern, { flex: flexFrom(1.0, 0.06, 0.045), tag: TAG.FLEX })
  g.box(0.28, 0.06, 0.28, 0.5, 0.14 + 0.03, -0.55, P.wood)
  const top = 0.14 + 0.82
  g.add(hipRoofGeo(W, W, 0.56, 0.22, 0.4), P.roofPink, { m: new THREE.Matrix4().makeTranslation(0, top, 0) })
  g.box(W + 0.5, 0.06, W + 0.5, 0, top + 0.01, 0, P.woodDark)
  g.box(0.9, 0.08, 0.12, 0, top + 0.57, 0, P.tileGrey)
  return [g.toGeometry()]
}

function teahouse(): THREE.BufferGeometry[] {
  return [P.roofMint, P.roofBlue].map((roof) => {
    const g = new Geo()
    const W = 3.6
    const D = 3.6
    podium(g, W, D, 0.2, '#d8d4ca')
    // 一层
    g.box(W, 1.02, D, 0, 0.2 + 0.51, 0, P.wood)
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.box(0.16, 1.02, 0.16, (sx * W) / 2, 0.2 + 0.51, (sz * D) / 2, P.woodDark)
    door(g, 0, 0.2, D / 2 + 0.005, 0.62, 0.72)
    win(g, -1.1, 0.78, D / 2 + 0.005, 0.4, 0.4)
    win(g, 1.1, 0.78, D / 2 + 0.005, 0.4, 0.4)
    win(g, W / 2 + 0.005, 0.78, 0, 0.4, 0.4, 'x')
    win(g, -W / 2 - 0.005, 0.78, 0, 0.4, 0.4, 'x')
    // 二层檐（腰檐）
    g.box(W + 0.62, 0.09, D + 0.62, 0, 0.2 + 1.02, 0, P.woodDark)
    g.add(pyramidRoofGeo(W, D, 0.42, 0.3, 0.16), roof, { m: new THREE.Matrix4().makeTranslation(0, 0.2 + 1.06, 0) })
    // 二层
    const y2 = 0.2 + 1.3
    g.box(W * 0.86, 0.86, D * 0.86, 0, y2 + 0.43, 0, P.wallWarm)
    // 栏杆
    for (const sz of [-1, 1]) {
      g.box(W * 0.88, 0.07, 0.06, 0, y2 + 0.62, (sz * D * 0.86) / 2, P.woodDark)
      for (let i = -2; i <= 2; i++) g.box(0.05, 0.28, 0.05, i * 0.34, y2 + 0.46, (sz * D * 0.86) / 2, P.woodDark)
    }
    for (const sxx of [-1, 1]) for (let i = -1; i <= 1; i++)
      g.box(0.05, 0.28, 0.05, (sxx * W * 0.86) / 2, y2 + 0.46, i * 0.5, P.woodDark)
    win(g, -0.9, y2 + 0.45, (D * 0.86) / 2 + 0.005, 0.36, 0.4)
    win(g, 0.9, y2 + 0.45, (D * 0.86) / 2 + 0.005, 0.36, 0.4)
    lantern(g, -1.3, y2 + 0.05, (D * 0.86) / 2 + 0.1, 0.13)
    lantern(g, 1.3, y2 + 0.05, (D * 0.86) / 2 + 0.1, 0.13)
    const top = y2 + 0.86
    g.add(hipRoofGeo(W * 0.86, D * 0.86, 0.6, 0.26, 0.4), roof, { m: new THREE.Matrix4().makeTranslation(0, top, 0) })
    g.box(W * 0.86 + 0.5, 0.07, D * 0.86 + 0.5, 0, top + 0.01, 0, P.woodDark)
    g.box(W - D + 0.4, 0.1, 0.14, 0, top + 0.61, 0, P.tileGrey)
    // 后门小楼梯
    g.box(0.5, 0.5, 0.16, -1.1, 0.2 + 0.25, -D / 2 - 0.06, P.wood)
    return g.toGeometry()
  })
}

function tavern(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 3.6
  const D = 1.7
  podium(g, W, D, 0.14)
  g.box(W, 0.86, D, 0, 0.14 + 0.43, 0, P.wallWarm)
  for (const sx of [-1, 1]) g.box(0.12, 0.86, 0.12, (sx * W) / 2, 0.14 + 0.43, D / 2, P.wood)
  // 檐廊
  g.box(W + 0.5, 0.07, 0.7, 0, 0.14 + 0.96, D / 2 + 0.24, P.roofCream, { rx: -0.28 })
  g.cyl(0.05, 0.05, 0.9, -W / 2 + 0.1, 0.14 + 0.45, D / 2 + 0.5, P.wood, { seg: 5 })
  g.cyl(0.05, 0.05, 0.9, W / 2 - 0.1, 0.14 + 0.45, D / 2 + 0.5, P.wood, { seg: 5 })
  door(g, -0.7, 0.14, D / 2 + 0.005, 0.56, 0.66)
  win(g, 0.35, 0.7, D / 2 + 0.005, 0.42, 0.4)
  win(g, 1.15, 0.7, D / 2 + 0.005, 0.4, 0.4)
  // 酒旗
  g.cyl(0.035, 0.04, 2.1, W / 2 + 0.3, 0.14 + 1.05, -0.2, P.woodDark, { seg: 5 })
  g.box(0.06, 0.72, 0.5, W / 2 + 0.3, 1.6, 0.12, P.lantern, { flex: flexFrom(1.2, 0.05, 0.05), tag: TAG.FLEX })
  // 门口桌凳
  g.cyl(0.26, 0.26, 0.05, -1.35, 0.14 + 0.52, D / 2 + 0.55, P.wood, { seg: 8 })
  g.cyl(0.05, 0.05, 0.5, -1.35, 0.14 + 0.25, D / 2 + 0.55, P.woodDark, { seg: 5 })
  const top = 0.14 + 0.86
  g.add(hipRoofGeo(W, D, 0.56, 0.2, W / 2 - D / 2 + 0.2), P.roofRed, {
    m: new THREE.Matrix4().makeTranslation(0, top, 0),
  })
  g.box(W + 0.42, 0.06, D + 0.42, 0, top + 0.01, 0, P.woodDark)
  g.box(W - 0.3, 0.09, 0.13, 0, top + 0.57, 0, P.tileGrey)
  return [g.toGeometry()]
}

function academy(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 5.6
  const D = 3.6
  podium(g, W, D, 0.22, '#dcd8ce')
  // 三面院墙
  for (const [x, z, w, d] of [
    [0, -D / 2, W, 0.14],
    [-W / 2, 0, 0.14, D],
    [W / 2, 0, 0.14, D],
  ] as number[][]) {
    g.box(w, 0.74, d, x, 0.22 + 0.37, z, P.wallCool)
    g.box(w + 0.1, 0.08, d + 0.1, x, 0.22 + 0.78, z, P.tileGrey)
  }
  // 讲堂（正殿）
  gableHall(g, 3.4, 1.6, 1.35, 0, -1.0, P.wallCool, P.roofBlue, 0.78)
  g.box(1.5, 0.16, 0.5, 0, 0.22 + 0.08, -0.1, P.stone)
  win(g, -1.0, 0.95, -0.2, 0.34, 0.36)
  win(g, 1.0, 0.95, -0.2, 0.34, 0.36)
  door(g, 0, 0.22, -0.19, 0.62, 0.8)
  // 东西斋房
  for (const sx of [-1, 1]) {
    gableHall(g, 1.2, 1.5, 0.9, sx * 1.8, 0.6, P.wall, P.roofSlate, 0.5)
  }
  // 碑 + 松
  g.box(0.3, 0.9, 0.12, -1.6, 0.22 + 0.45, 1.2, P.tileGrey)
  g.box(0.42, 0.12, 0.2, -1.6, 0.22 + 0.9, 1.2, P.stone)
  g.cyl(0.08, 0.1, 0.85, 1.5, 0.22 + 0.42, 1.25, P.trunk, { seg: 6 })
  for (let i = 0; i < 3; i++) {
    const r = 0.42 - i * 0.1
    g.add(coneGeo(r, 0.45, 7), P.pine, {
      m: new THREE.Matrix4().makeTranslation(1.5, 0.22 + 1.05 + i * 0.3, 1.25),
      tag: TAG.PINE,
      flex: flexFrom(1.2, 0.05, 0.035),
    })
  }
  return [g.toGeometry()]
}

function pagoda(): THREE.BufferGeometry[] {
  const g = new Geo()
  podium(g, 1.9, 1.9, 0.24, '#d6d2c8')
  // 石阶
  g.box(0.9, 0.12, 0.34, 0, 0.24 + 0.06, 1.06, P.stone)
  let y = 0.24
  const N = 5
  for (let i = 0; i < N; i++) {
    const w = 1.62 - i * 0.2
    const bh = i === 0 ? 0.78 : 0.62
    g.box(w, bh, w, 0, y + bh / 2, 0, i % 2 ? P.wallWarm : P.wallCool)
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      g.box(0.11, bh, 0.11, (sx * w) / 2, y + bh / 2, (sz * w) / 2, P.woodDark)
    if (i > 0) {
      win(g, 0, y + bh * 0.55, w / 2 + 0.02, 0.24, 0.3)
      win(g, w / 2 + 0.02, y + bh * 0.55, 0, 0.24, 0.3, 'x')
    } else {
      door(g, 0, y, w / 2 + 0.01, 0.4, 0.55)
    }
    // 每层飞檐
    g.box(w + 0.44, 0.07, w + 0.44, 0, y + bh, 0, P.woodDark)
    g.add(pyramidRoofGeo(w + 0.1, w + 0.1, 0.34, 0.22, 0.16), i % 2 ? P.roofRed : P.roofSlate, {
      m: new THREE.Matrix4().makeTranslation(0, y + bh + 0.03, 0),
    })
    y += bh + 0.3
  }
  // 塔刹
  g.cyl(0.06, 0.06, 0.5, 0, y + 0.25, 0, P.gold, { seg: 6 })
  for (let i = 0; i < 3; i++) {
    g.add(torusGeo(0.12 - i * 0.03, 0.02, 10, 4), P.gold, {
      m: new THREE.Matrix4()
        .makeRotationX(Math.PI / 2)
        .setPosition(0, y + 0.12 + i * 0.14, 0),
    })
  }
  g.add(coneGeo(0.09, 0.22, 6), P.gold, { m: new THREE.Matrix4().makeTranslation(0, y + 0.58, 0) })
  return [g.toGeometry()]
}

function paifang(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 1.7
  g.box(W + 0.3, 0.14, 0.46, 0, 0.07, 0, P.stone)
  for (const sx of [-1, 1]) {
    g.box(0.16, 1.7, 0.16, (sx * (W + 0.1)) / 2, 0.14 + 0.85, 0, '#e6e2d8')
    g.box(0.26, 0.16, 0.26, (sx * (W + 0.1)) / 2, 0.14, 0, P.stone)
    g.box(0.22, 0.14, 0.22, (sx * (W + 0.1)) / 2, 0.14 + 1.7, 0, P.stone)
  }
  // 额枋
  g.box(W + 0.44, 0.2, 0.22, 0, 1.5, 0, P.wallWarm)
  g.box(W + 0.62, 0.14, 0.3, 0, 1.72, 0, P.woodDark)
  g.box(0.5, 0.34, 0.1, 0, 1.5, 0.12, P.lantern)
  // 两顶
  g.add(pyramidRoofGeo(0.9, 0.5, 0.28, 0.16, 0.08), P.roofSlate, {
    m: new THREE.Matrix4().makeTranslation(0, 1.79, 0),
  })
  g.add(pyramidRoofGeo(0.44, 0.44, 0.2, 0.12, 0.06), P.roofRed, {
    m: new THREE.Matrix4().makeTranslation(-(W + 0.1) / 2, 1.84, 0),
  })
  g.add(pyramidRoofGeo(0.44, 0.44, 0.2, 0.12, 0.06), P.roofRed, {
    m: new THREE.Matrix4().makeTranslation((W + 0.1) / 2, 1.84, 0),
  })
  return [g.toGeometry()]
}

function dock(): THREE.BufferGeometry[] {
  // 水面 = 局部 y 0（渔码头的 group 落在 WATER_Y 上）。
  // 原来的甲板放在 y = -0.05，等于整座码头沉在水面以下，只剩甲板上两个箱子漂着。
  const g = new Geo()
  const DECK = 0.54
  const W = 3.5
  const D = 3.5
  // 木桩：水下 1.8 撑到甲板 —— 露出水面的那一截才是「码头」的识别度来源
  for (const x of [-1.55, -0.55, 0.55, 1.55]) {
    for (const z of [-1.55, -0.55, 0.55, 1.55]) {
      g.cyl(0.1, 0.12, 2.4, x, DECK - 1.2, z, P.woodDark, { seg: 6 })
    }
  }
  // 甲板 + 板缝
  g.box(W, 0.18, D, 0, DECK - 0.09, 0, P.wood)
  for (let i = 0; i < 9; i++) g.box(W, 0.03, 0.06, 0, DECK + 0.005, -1.55 + i * 0.3875, P.woodDark)
  // 矮栏：三面围住，朝 +z 的栈桥方向留口
  g.box(W + 0.14, 0.08, 0.1, 0, DECK + 0.54, -1.63, P.wood)
  for (let i = 0; i < 5; i++) g.cyl(0.05, 0.05, 0.54, -1.6 + i * 0.8, DECK + 0.27, -1.63, P.woodDark, { seg: 5 })
  for (const x of [-1.63, 1.63]) {
    g.box(0.1, 0.08, D + 0.14, x, DECK + 0.54, 0, P.wood)
    for (let i = 0; i < 5; i++) g.cyl(0.05, 0.05, 0.54, x, DECK + 0.27, -1.6 + i * 0.8, P.woodDark, { seg: 5 })
  }
  // 栈桥伸向水面
  g.box(1.1, 0.16, 1.9, 0.5, DECK - 0.08, D / 2 + 0.95, P.wood)
  for (const z of [D / 2 + 0.35, D / 2 + 1.45]) {
    for (const x of [0.05, 0.95]) g.cyl(0.09, 0.11, 2.3, x, DECK - 1.15, z, P.woodDark, { seg: 6 })
  }
  for (const z of [D / 2 + 0.4, D / 2 + 1.5]) g.cyl(0.11, 0.13, 0.38, 1.1, DECK + 0.19, z, P.woodDark, { seg: 6 })
  // 两条小船，漂在水面上
  for (const [x, z, rot] of [[-1.25, 2.6, 0.3], [1.62, 3.05, -0.22]] as number[][]) {
    const bx = new Geo()
    bx.box(0.56, 0.3, 1.5, 0, 0.06, 0, P.wood)
    bx.box(0.44, 0.2, 1.2, 0, 0.2, 0, '#e8dfd0')
    bx.box(0.54, 0.06, 1.56, 0, 0.22, 0, P.woodDark)
    bx.box(0.07, 0.86, 0.07, 0, 0.6, -0.36, P.woodDark)
    bx.box(0.03, 0.62, 0.7, 0, 0.74, -0.7, '#f2ece0')
    bx.box(0.46, 0.08, 0.5, 0, 0.2, 0.5, '#e8dfd0')
    g.append(bx, new THREE.Matrix4().makeRotationY(rot).setPosition(x, -0.07, z))
  }
  // 渔棚：让它一眼可辨
  const shed = new Geo()
  shed.box(1.3, 1.05, 1.3, 0, 0.52, 0, P.wallWarm)
  shed.add(hipRoofGeo(1.3, 1.3, 0.42, 0.18, 0.24), P.roofRed, {
    m: new THREE.Matrix4().makeTranslation(0, 1.05, 0),
  })
  shed.box(0.42, 0.6, 0.06, 0, 0.32, 0.66, P.woodDark)
  g.append(shed, new THREE.Matrix4().makeTranslation(-0.72, DECK, -0.72))
  // 灯笼杆
  g.cyl(0.05, 0.06, 1.7, -1.5, DECK + 0.85, 1.5, P.woodDark, { seg: 5 })
  g.box(0.26, 0.32, 0.26, -1.5, DECK + 1.75, 1.5, P.lantern)
  // 渔具：木箱 + 鱼篓 + 晾网架
  g.box(0.62, 0.44, 0.54, 1.25, DECK + 0.24, -1.15, P.woodDark)
  g.cyl(0.3, 0.24, 0.5, 1.15, DECK + 0.27, -0.35, P.tileGrey, { seg: 8 })
  g.cyl(0.26, 0.2, 0.42, 0.68, DECK + 0.23, -0.42, '#c9bda8', { seg: 8 })
  for (const x of [-0.55, 0.4]) g.cyl(0.045, 0.05, 1.1, x, DECK + 0.55, 1.35, P.woodDark, { seg: 5 })
  g.box(1.1, 0.52, 0.03, -0.08, DECK + 0.74, 1.35, '#e6e0d0')
  return [g.toGeometry()]
}

/* ─────────────────────────── 田园 ─────────────────────────── */

function farm(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 3.8
  g.box(W, 0.12, W, 0, 0.02, 0, '#bcd9c6')
  // 田埂
  for (const [x, z, w, d] of [
    [0, 0, W, 0.12],
    [0, 0, 0.12, W],
    [-W / 2 + 0.06, 0, 0.12, W],
    [W / 2 - 0.06, 0, 0.12, W],
    [0, -W / 2 + 0.06, W, 0.12],
    [0, W / 2 - 0.06, W, 0.12],
  ] as number[][])
    g.box(w, 0.18, d, x, 0.09, z, '#a98f6a')
  // 稻苗：错行的小锥，插进水田
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const x = -W / 2 + 0.36 + i * 0.52
      const z = -W / 2 + 0.36 + j * 0.52
      if ((i + j) % 2 === 0) continue
      g.add(coneGeo(0.09, 0.34, 5), '#8fc06d', {
        m: new THREE.Matrix4().makeTranslation(x, 0.24, z),
        tag: TAG.PINE,
        flex: flexFrom(0.2, 0.09, 0.03),
        jitter: 0.1,
      })
    }
  }
  // 稻草人
  g.box(0.05, 0.9, 0.05, 1.5, 0.5, -1.5, P.woodDark)
  g.box(0.5, 0.06, 0.06, 1.5, 0.75, -1.5, P.wood)
  g.add(sphereGeo(0.13, 6, 5), '#ecdfc0', { m: new THREE.Matrix4().makeTranslation(1.5, 1.02, -1.5) })
  return [g.toGeometry()]
}

function orchard(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 3.8
  g.box(W, 0.1, W, 0, 0.02, 0, '#c8dcb0')
  // 篱笆
  for (let i = 0; i < 3; i++) {
    for (const [x, z] of [
      [-W / 2 + 0.1, -W / 2 + 0.1 + i * 1.8],
      [W / 2 - 0.1, -W / 2 + 0.1 + i * 1.8],
    ] as number[][]) {
      g.box(0.09, 0.5, 0.09, x, 0.25, z, P.woodDark)
    }
  }
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as number[][]) {
    const x = sx * 0.95
    const z = sz * 0.95
    g.cyl(0.08, 0.11, 0.9, x, 0.45, z, P.trunk, { seg: 6 })
    roundCanopy(g, x, 1.35, z, 0.68, TAG.LEAF, 0.04, 1)
  }
  return [g.toGeometry()]
}

function pineTree(): THREE.BufferGeometry[] {
  return [0, 1, 2].map((v) => {
    const g = new Geo()
    const hs = 0.9 + v * 0.16
    g.cyl(0.075, 0.12, hs * 0.62, 0, (hs * 0.62) / 2, 0, P.trunk, { seg: 6 })
    for (let i = 0; i < 3; i++) {
      const r = 0.62 - i * 0.15
      g.add(coneGeo(r, 0.72, 7), P.pine, {
        m: new THREE.Matrix4().makeTranslation(0, hs * 0.5 + i * 0.42 + 0.2, 0),
        tag: TAG.PINE,
        flex: flexFrom(0.5 + i * 0.35, 0.055, 0.04),
        jitter: 0.04,
      })
    }
    return g.toGeometry()
  })
}

function blossomTree(): THREE.BufferGeometry[] {
  return [TAG.LEAF, TAG.PINE].map((_, v) => {
    const g = new Geo()
    const h = v === 0 ? 1.15 : 0.95
    g.cyl(0.075, 0.13, h, 0, h / 2, 0, P.trunk, { seg: 6 })
    // 分叉
    g.cyl(0.045, 0.06, 0.5, -0.2, h + 0.2, 0, P.trunk, { seg: 5, rz: 0.5 })
    g.cyl(0.045, 0.06, 0.5, 0.2, h + 0.2, 0, P.trunk, { seg: 5, rz: -0.5 })
    roundCanopy(g, 0, CANOPY_ANCHOR + (v === 0 ? 0.6 : 0.42), 0, v === 0 ? 0.72 : 0.56, TAG.LEAF, 0.05, 1)
    roundCanopy(g, -0.34, CANOPY_ANCHOR + (v === 0 ? 0.34 : 0.2), 0.16, v === 0 ? 0.5 : 0.4, TAG.LEAF, 0.048, 1)
    roundCanopy(g, 0.32, CANOPY_ANCHOR + (v === 0 ? 0.28 : 0.16), -0.2, v === 0 ? 0.46 : 0.38, TAG.LEAF, 0.048, 1)
    return g.toGeometry()
  })
}

function bamboo(): THREE.BufferGeometry[] {
  const g = new Geo()
  const stalks = 9
  for (let i = 0; i < stalks; i++) {
    const a = (i / stalks) * Math.PI * 2 + 0.4
    const r = 0.18 + (i % 3) * 0.24
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = 1.5 + ((i * 7) % 5) * 0.16
    g.cyl(0.035, 0.05, h, x, h / 2, z, '#9fbb72', { seg: 5, flex: flexFrom(0.6, 0.05, 0.05), tag: TAG.FLEX })
    g.cyl(0.042, 0.042, 0.05, x, h * 0.62, z, '#8aa861', { seg: 5 })
    for (let k = 0; k < 3; k++) {
      g.add(coneGeo(0.2, 0.5, 5), '#a9c47c', {
        m: new THREE.Matrix4()
          .makeRotationZ(0.9 + k * 0.5)
          .setPosition(x + (k % 2 ? 0.16 : -0.16), h * 0.66 + k * 0.18, z + (k % 2 ? -0.1 : 0.12)),
        tag: TAG.PINE,
        flex: flexFrom(1.0, 0.05, 0.045),
        jitter: 0.05,
      })
    }
  }
  return [g.toGeometry()]
}

function flowerbed(): THREE.BufferGeometry[] {
  const g = new Geo()
  g.box(1.6, 0.22, 1.6, 0, 0.11, 0, P.stone)
  g.box(1.36, 0.1, 1.36, 0, 0.22, 0, '#6b5a48')
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const r = 0.5 - (i % 4) * 0.1
    g.add(sphereGeo(0.1, 6, 5), i % 3 === 0 ? '#f0c8d8' : i % 3 === 1 ? '#f3e08c' : '#e89a8c', {
      m: new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.34, Math.sin(a) * r),
      tag: TAG.LEAF,
      flex: 0.03,
      leaf: 1,
    })
  }
  return [g.toGeometry()]
}

function streetLamp(): THREE.BufferGeometry[] {
  const g = new Geo()
  g.cyl(0.12, 0.16, 0.14, 0, 0.07, 0, P.stone, { seg: 8 })
  g.cyl(0.055, 0.07, 1.6, 0, 0.86, 0, P.woodDark, { seg: 6 })
  g.box(0.3, 0.05, 0.3, 0, 1.68, 0, P.woodDark)
  g.box(0.24, 0.3, 0.24, 0, 1.53, 0, '#fdf1cd')
  g.add(sphereGeo(0.11, 8, 6), '#fff8e2', { m: new THREE.Matrix4().makeTranslation(0, 1.53, 0) })
  g.box(0.34, 0.06, 0.34, 0, 1.71, 0, P.tileGrey)
  g.add(coneGeo(0.26, 0.16, 8), P.roofSlate, { m: new THREE.Matrix4().makeTranslation(0, 1.79, 0) })
  return [g.toGeometry()]
}

function lanternPole(): THREE.BufferGeometry[] {
  const g = new Geo()
  g.cyl(0.1, 0.13, 0.16, 0, 0.08, 0, P.stone, { seg: 8 })
  g.cyl(0.045, 0.06, 1.9, 0, 0.95, 0, P.woodDark, { seg: 6 })
  g.box(0.5, 0.06, 0.06, 0.2, 1.86, 0, P.woodDark)
  lantern(g, 0.4, 1.6, 0, 0.16)
  return [g.toGeometry()]
}

function pavilion(): THREE.BufferGeometry[] {
  return [P.roofSlate, P.roofRed].map((roof) => {
    const g = new Geo()
    g.box(1.8, 0.18, 1.8, 0, 0.09, 0, '#dbd7cc')
    g.box(1.9, 0.06, 1.9, 0, 0.21, 0, P.stone)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        g.cyl(0.07, 0.08, 1.5, (sx * 1.3) / 2, 1.0, (sz * 1.3) / 2, P.wood, { seg: 6 })
      }
    // 座凳
    for (const sz of [-1, 1]) g.box(1.2, 0.07, 0.24, 0, 0.5, (sz * 1.3) / 2, P.woodDark)
    for (const sx of [-1, 1]) g.box(0.24, 0.07, 1.2, (sx * 1.3) / 2, 0.5, 0, P.woodDark)
    g.box(1.8, 0.08, 1.8, 0, 1.76, 0, P.woodDark)
    g.add(pyramidRoofGeo(1.7, 1.7, 0.62, 0.3, 0.24), roof, { m: new THREE.Matrix4().makeTranslation(0, 1.8, 0) })
    g.add(sphereGeo(0.1, 8, 6), P.gold, { m: new THREE.Matrix4().makeTranslation(0, 2.48, 0) })
    g.add(coneGeo(0.07, 0.2, 6), P.gold, { m: new THREE.Matrix4().makeTranslation(0, 2.6, 0) })
    return g.toGeometry()
  })
}

/* ─────────────────────────── 乐园 ─────────────────────────── */

function parkGate(): THREE.BufferGeometry[] {
  const g = new Geo()
  const W = 3.6
  const D = 1.7
  g.box(W, 0.2, D, 0, 0.1, 0, '#d9d5ca')
  // 两根彩柱
  for (const sx of [-1, 1]) {
    const c = sx < 0 ? '#e2766a' : '#5fa8d3'
    g.cyl(0.2, 0.24, 1.9, (sx * (W - 0.5)) / 2, 1.05, 0, c, { seg: 8 })
    g.add(sphereGeo(0.24, 8, 6), P.gold, { m: new THREE.Matrix4().makeTranslation((sx * (W - 0.5)) / 2, 2.0, 0) })
  }
  // 拱楣：半环（arc = π）正好是一道拱
  g.add(torusGeo(1.45, 0.16, 16, 6, Math.PI), '#f0c060', {
    m: new THREE.Matrix4().makeTranslation(0, 1.9, 0),
  })
  g.box(W - 0.2, 0.3, 0.34, 0, 2.55, 0, '#f4e2b0')
  g.box(1.3, 0.42, 0.1, 0, 2.55, 0.2, '#e2685f')
  // 小旗
  for (let i = -3; i <= 3; i++) {
    g.add(coneGeo(0.1, 0.3, 4), i % 2 ? '#f0c060' : '#7bc8a4', {
      m: new THREE.Matrix4().makeTranslation(i * 0.42, 2.86, 0),
      tag: TAG.FLEX,
      flex: 0.02,
    })
  }
  return [g.toGeometry()]
}

/* ─────────────────────────── 导出 ─────────────────────────── */

type Builder = () => THREE.BufferGeometry[]

export const BUILDERS: Record<string, Builder> = {
  house,
  courtyard,
  shop,
  teahouse,
  tavern,
  academy,
  pagoda,
  paifang,
  dock,
  farm,
  orchard,
  pine: pineTree,
  blossom: blossomTree,
  bamboo,
  flowerbed,
  lamp: streetLamp,
  lantern: lanternPole,
  pavilion,
  gate: parkGate,
}

/** 需要独立节点做动画的类型（摩天轮、木马……），不参与静态合批 */
export const DYNAMIC_TYPES = new Set(['mill', 'carousel', 'teacup', 'ferris', 'coaster', 'fountain'])

/** 1×1 的道路 / 广场 / 地表砖几何。
 *  一律套 withWhiteColor：matGround 等材质开了 vertexColors，
 *  几何缺 color 属性会读到常量 0，整块地会变黑。 */
export function roadTileGeo() {
  return withWhiteColor(new THREE.BoxGeometry(TILE - 0.02, 0.14, TILE - 0.02).translate(0, -0.07, 0))
}

export function plazaTileGeo() {
  return withWhiteColor(new THREE.BoxGeometry(TILE - 0.02, 0.12, TILE - 0.02).translate(0, -0.06, 0))
}

export function waterTileGeo() {
  return withWhiteColor(new THREE.BoxGeometry(TILE, 0.34, TILE).translate(0, -0.17, 0))
}

export function groundTileGeo() {
  return withWhiteColor(new THREE.BoxGeometry(TILE, 0.7, TILE).translate(0, -0.35, 0))
}

export { prismGeo }
