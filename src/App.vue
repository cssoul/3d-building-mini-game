<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import InfoPanel from './components/InfoPanel.vue'
import ToolBar from './components/ToolBar.vue'
import TopBar from './components/TopBar.vue'
import { BUILDING_MAP, CATEGORIES, SEED_DEFAULT } from './game/constants'
import { key } from './game/island'
import {
  canPlace,
  getByUid,
  getOwner,
  getTerrain,
  place,
  removeAt,
  seedTown,
  setSeason,
  state,
  tick,
  toast,
} from './game/store'
import { clearAll } from './game/store'
import { attachControls } from './three/controls'
import { TownScene, type SceneStats } from './three/scene'

const cv = ref<HTMLCanvasElement | null>(null)
const stats = ref<SceneStats | null>(null)
const infoOpen = ref(true)
const ready = ref(false)
const stage = ref<HTMLDivElement | null>(null)

let scene: TownScene | null = null
let detach: (() => void) | null = null
let ro: ResizeObserver | null = null
let raf = 0
let last = performance.now()
let booted = false

/* ────────────── 悬停与拾取 ────────────── */

function syncHover(cell: { col: number; row: number } | null) {
  if (!cell || !scene) {
    state.hover = null
    scene?.setHover(null, false, null, 0)
    return
  }
  const owner = getOwner()
  const i = key(cell.col, cell.row)
  if (state.tool === 'select' || state.tool === 'bulldoze') {
    const uid = owner[i]
    const p = uid ? getByUid(uid) : null
    state.hover = { col: cell.col, row: cell.row, ok: !!p }
    if (p) scene.setHover({ col: p.col, row: p.row }, state.tool === 'bulldoze', BUILDING_MAP[p.type], p.rot)
    else scene.setHover(null, false, null, 0)
    return
  }
  const def = BUILDING_MAP[state.tool]
  if (!def) return
  const ok = canPlace(state.tool, cell.col, cell.row, state.rot) && state.coins >= def.cost
  state.hover = { col: cell.col, row: cell.row, ok }
  scene.setHover(cell, ok, def, state.rot)
}

function act(cell: { col: number; row: number }) {
  if (!scene) return
  const owner = getOwner()
  const idx = key(cell.col, cell.row)
  if (state.tool === 'select') {
    const uid = owner[idx]
    state.selected = uid || null
    const p = uid ? getByUid(uid) : null
    scene.setSelected(p ? { col: p.col, row: p.row, type: p.type, rot: p.rot } : null)
    return
  }
  if (state.tool === 'bulldoze') {
    if (removeAt(cell.col, cell.row)) {
      state.selected = null
      scene.setSelected(null)
      syncHover(cell)
    }
    return
  }
  const ok = place(state.tool, cell.col, cell.row, state.rot)
  if (ok) {
    state.selected = null
    scene.setSelected(null)
    syncHover(cell)
  }
}

function drag(cell: { col: number; row: number }) {
  const def = BUILDING_MAP[state.tool]
  const continuous =
    state.tool === 'bulldoze' || state.tool === 'road' || state.tool === 'plaza' || (!!def && def.w === 1 && def.h === 1)
  if (continuous) act(cell)
}

/* ────────────── 快捷键 ────────────── */

function removeUid(uid: number) {
  const p = getByUid(uid)
  if (!p) return
  removeAt(p.col, p.row)
  state.selected = null
  scene?.setSelected(null)
}

function onRotate() {
  state.rot = (state.rot + 1) % 4
}

function onReset() {
  scene?.resetView()
}

function onKeyDown(e: KeyboardEvent) {
  if (!scene) return
  const k = e.key.toLowerCase()
  if (k === 'escape') state.tool = 'select'
  else if (k === 'delete' || k === 'backspace') state.tool = 'bulldoze'
  else if (k === 'r') state.rot = (state.rot + 1) % 4
  else if (k === 'q') scene.rotate(-1)
  else if (k === 'e') scene.rotate(1)
  else if (k === 'p') state.speed = state.speed === 0 ? 1 : 0
  else if (k === '[' || k === ']') {
    const i = CATEGORIES.findIndex((c) => c.id === state.cat)
    const n = (i + (k === ']' ? 1 : CATEGORIES.length - 1)) % CATEGORIES.length
    state.cat = CATEGORIES[n].id as never
    state.tool = CATEGORIES[n].items[0]
  } else if (/^[1-9]$/.test(k)) {
    const items = CATEGORIES.find((c) => c.id === state.cat)?.items ?? []
    const t = items[Number(k) - 1]
    if (t) state.tool = t
  }
}

/* ────────────── 生命周期 ────────────── */

function boot() {
  if (!cv.value || booted) return
  booted = true
  scene = new TownScene(cv.value)
  scene.onStats = (s) => (stats.value = s)
  scene.resize()
  seedTown(SEED_DEFAULT)
  setSeason(state.season)
  detach = attachControls(cv.value, scene, {
    onHover: syncHover,
    onTap: (c) => {
      act(c)
      syncHover(c)
    },
    onDrag: drag,
    onPan: (dx, dy) => scene?.pan(dx, dy),
    onZoom: (d) => scene?.zoom(d),
    onOrbitBegin: () => scene?.orbitBegin(),
    onOrbit: (dx, dy) => scene?.orbit(dx, dy),
    onOrbitEnd: () => scene?.orbitEnd(),
  })
  ro = new ResizeObserver(() => scene?.resize())
  ro.observe(stage.value ?? document.body)

  if (import.meta.env.DEV) {
    // 调试钩子（与 TownScene 的 window.__town 配套），方便脚本化验证四季与建造
    ;(window as unknown as Record<string, unknown>).__game = {
      state,
      setSeason,
      seedTown,
      clearAll,
      place,
      removeAt,
      scene,
      getTerrain,
      get stats() {
        return stats.value
      },
    }
  }

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dtReal = Math.min(0.06, (now - last) / 1000)
    last = now
    const dtGame = dtReal * state.speed
    tick(dtGame)
    scene?.tick(dtReal, dtGame, state.speed === 0)
    if (!ready.value) ready.value = true
  }
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  boot()
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  detach?.()
  ro?.disconnect()
  scene?.dispose()
})

watch(
  () => state.tool,
  () => syncHover(state.hover ? { col: state.hover.col, row: state.hover.row } : null),
)

/**
 * 换季的唯一出口：无论来自四季按钮还是 tick() 里的自动轮转，
 * 都必须把季节点写进 3D 场景（只改 uniform / 天穹 / 灯光，不重建几何）。
 */
watch(
  () => state.season,
  (id) => scene?.applySeason(id),
)

const toastVisible = ref(true)
watch(
  () => state.toast?.at,
  () => {
    toastVisible.value = true
    window.setTimeout(() => (toastVisible.value = false), 3200)
  },
)
</script>

<template>
  <div class="stage" ref="stage">
    <canvas ref="cv" class="scene" />

    <TopBar />
    <InfoPanel v-model:open="infoOpen" :stats="stats" @remove="removeUid" @newTown="seedTown()" @clear="clearAll" />

    <ToolBar @rotate="onRotate" @reset="onReset" />

    <transition name="pop">
      <div v-if="state.toast && toastVisible" class="toast panel" :class="state.toast.kind">
        {{ state.toast.text }}
      </div>
    </transition>

    <div v-if="!ready" class="boot">
      <div class="boottxt">正在营建云溪镇…</div>
    </div>

    <!-- <div class="brand">
      <b>四季小镇 · 云溪</b>
      <span class="muted">全部几何由代码生成 · 无任何外部模型与贴图</span>
    </div> -->
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.toast {
  position: absolute;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  font-size: 12.5px;
  border-radius: 999px;
  background: #333a44;
  color: #fff;
  border-color: transparent;
  box-shadow: 0 10px 30px rgba(40, 46, 54, 0.28);
  white-space: nowrap;
}
.toast.warn {
  background: #b8524a;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.3s cubic-bezier(0.3, 0.8, 0.3, 1);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
.boot {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--paper);
  font-size: 13px;
  color: var(--ink-2);
  letter-spacing: 2px;
}
.brand {
  position: absolute;
  right: 16px;
  bottom: 92px;
  text-align: right;
  font-size: 10.5px;
  line-height: 1.7;
  pointer-events: none;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
}
.brand b {
  display: block;
  font-size: 12.5px;
  letter-spacing: 1.5px;
}
@media (max-width: 900px) {
  .brand {
    display: none;
  }
}
</style>
