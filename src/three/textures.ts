import * as THREE from 'three'

function paint(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d')!
  draw(ctx, size)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

/** 伪随机（贴图专用，固定种子保证每次一致） */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296
    return a / 4294967296
  }
}

/**
 * 草地：接近白的高频噪点，真正的颜色交给 instanceColor，
 * 这样同一个 InstancedMesh 能随季节换色而不用重建。
 */
export const texGrass = paint(64, (ctx, s) => {
  ctx.fillStyle = '#f4f6ef'
  ctx.fillRect(0, 0, s, s)
  const R = rng(9)
  for (let i = 0; i < 900; i++) {
    const x = R() * s
    const y = R() * s
    const v = 0.86 + R() * 0.16
    ctx.fillStyle = `rgba(${Math.round(90 * v)},${Math.round(110 * v)},${Math.round(70 * v)},0.10)`
    ctx.fillRect(x, y, 1, R() > 0.6 ? 2 : 1)
  }
})

/** 青砖铺装 / 广场 */
export const texPaving = paint(128, (ctx, s) => {
  ctx.fillStyle = '#f2f1ec'
  ctx.fillRect(0, 0, s, s)
  const cell = s / 4
  const R = rng(21)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = 0.94 + R() * 0.09
      ctx.fillStyle = `rgba(${Math.round(150 * v)},${Math.round(148 * v)},${Math.round(140 * v)},0.5)`
      ctx.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2)
    }
  }
  ctx.strokeStyle = 'rgba(120,118,110,0.30)'
  ctx.lineWidth = 1.5
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, s)
    ctx.moveTo(0, i * cell)
    ctx.lineTo(s, i * cell)
    ctx.stroke()
  }
})

/** 石板路：中间一道分行缝 */
export const texRoad = paint(128, (ctx, s) => {
  ctx.fillStyle = '#eceded'
  ctx.fillRect(0, 0, s, s)
  const R = rng(33)
  for (let i = 0; i < 1600; i++) {
    const v = 0.9 + R() * 0.12
    ctx.fillStyle = `rgba(${Math.round(130 * v)},${Math.round(132 * v)},${Math.round(134 * v)},0.14)`
    ctx.fillRect(R() * s, R() * s, 1, 1)
  }
  ctx.strokeStyle = 'rgba(140,142,148,0.42)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(s / 2, 0)
  ctx.lineTo(s / 2, s)
  ctx.stroke()
})

/** 水面：柔和的横向水纹，靠 uv 偏移滚动 */
export const texWater = paint(128, (ctx, s) => {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, s, s)
  const R = rng(57)
  ctx.lineCap = 'round'
  for (let i = 0; i < 34; i++) {
    const y = R() * s
    const x = R() * s
    const w = 14 + R() * 46
    ctx.strokeStyle = `rgba(120,170,205,${0.05 + R() * 0.09})`
    ctx.lineWidth = 1.5 + R() * 2.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + w * 0.3, y - 3, x + w * 0.7, y + 3, x + w, y)
    ctx.stroke()
  }
})

/** 沙盘底下的柔和投影 */
export const texBlobShadow = paint(256, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.16, s / 2, s / 2, s * 0.5)
  g.addColorStop(0, 'rgba(60,66,74,0.30)')
  g.addColorStop(0.55, 'rgba(60,66,74,0.14)')
  g.addColorStop(1, 'rgba(60,66,74,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
})

/** 粒子贴图：一个柔边圆点 */
export const texDot = paint(32, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
})

export const disposeTexture = (t: THREE.Texture) => t.dispose()
