import type { TownScene } from './scene'

export interface ControlHandlers {
  onHover(cell: { col: number; row: number } | null): void
  /** 点一下（没拖动） */
  onTap(cell: { col: number; row: number }): void
  /** 拖动中经过的格子（用于连续铺设，需按住 Shift） */
  onDrag(cell: { col: number; row: number }): void
  onPan(dx: number, dy: number): void
  onZoom(delta: number): void
  /** 开始 / 进行中 / 结束「拨地球」 */
  onOrbitBegin(): void
  onOrbit(dx: number, dy: number): void
  onOrbitEnd(): void
}

/**
 * 等距沙盘的操作：
 * - 裸左键**点击** = 建造 / 选择 / 拆除
 * - 裸左键**拖动** = 拨地球（自由转方位 + 调俯仰，松手带惯性）
 * - Shift + 左键拖动 = 连续铺设（道路、铺装、1×1 小件）
 * - 右键 / 中键 / 空格 + 左键拖动 = 平移
 * - 滚轮 = 缩放，Q / E = 精确转 45°
 */
export function attachControls(canvas: HTMLCanvasElement, scene: TownScene, h: ControlHandlers) {
  let panning = false
  let painting = false
  let orbiting = false
  let orbitLive = false
  let space = false
  let lastX = 0
  let lastY = 0
  let downX = 0
  let downY = 0
  let moved = false
  let lastCell = ''

  const beginPaint = (x: number, y: number) => {
    painting = true
    lastCell = ''
    const cell = scene.pick(x, y)
    if (cell) {
      lastCell = `${cell.col},${cell.row}`
      h.onDrag(cell)
    }
  }

  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    lastX = downX = e.clientX
    lastY = downY = e.clientY
    moved = false
    if (e.button === 2 || e.button === 1 || space) {
      panning = true
      canvas.style.cursor = 'grabbing'
      return
    }
    if (e.button !== 0) return
    if (e.shiftKey) {
      beginPaint(e.clientX, e.clientY)
      return
    }
    // 裸左键：先按兵不动，等位移超过阈值再判定成「拨地球」，否则松手时算一次点击
    orbiting = true
    orbitLive = false
    h.onOrbitBegin()
  }

  const onMove = (e: PointerEvent) => {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true
    if (panning) {
      h.onPan(dx, dy)
      return
    }
    if (orbiting) {
      if (moved) {
        if (!orbitLive) {
          orbitLive = true
          // 转动时不显示悬停幽灵，免得它跟着乱飘
          h.onHover(null)
          canvas.style.cursor = 'grabbing'
        }
        h.onOrbit(dx, dy)
      }
      return
    }
    const cell = scene.pick(e.clientX, e.clientY)
    h.onHover(cell)
    if (painting && cell) {
      const k = `${cell.col},${cell.row}`
      if (k !== lastCell) {
        lastCell = k
        h.onDrag(cell)
      }
    }
  }

  const onUp = (e: PointerEvent) => {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    const wasPan = panning
    const wasOrbit = orbiting
    panning = false
    painting = false
    orbiting = false
    orbitLive = false
    canvas.style.cursor = ''
    if (wasOrbit) h.onOrbitEnd()
    if (e.button === 0 && !moved && !wasPan && !e.shiftKey) {
      const cell = scene.pick(e.clientX, e.clientY)
      if (cell) {
        h.onHover(cell)
        h.onTap(cell)
      }
    }
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    h.onZoom(e.deltaY)
  }
  const onContext = (e: Event) => e.preventDefault()
  const onLeave = () => h.onHover(null)
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') space = e.type === 'keydown'
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContext)
  canvas.addEventListener('pointerleave', onLeave)
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)

  return () => {
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContext)
    canvas.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKey)
  }
}
