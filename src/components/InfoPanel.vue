<script setup lang="ts">
import { computed } from 'vue'
import { BUILDING_MAP, SEASON_MAP } from '../game/constants'
import { getByUid, state } from '../game/store'
import type { SceneStats } from '../three/scene'

const props = defineProps<{ stats: SceneStats | null }>()
const emit = defineEmits<{
  (e: 'remove', uid: number): void
  (e: 'newTown'): void
  (e: 'clear'): void
}>()

const sel = computed(() => (state.selected ? getByUid(state.selected) : null))
const selDef = computed(() => (sel.value ? BUILDING_MAP[sel.value.type] : null))
const season = computed(() => SEASON_MAP[state.season])
const rate = computed(() => season.value.rate)
const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <div class="panel info" :class="{ collapsed: !open }">
    <button class="toggle" @click="open = !open" :title="open ? '收起' : '展开'">
      {{ open ? '‹' : '›' }}
    </button>

    <template v-if="sel && selDef">
      <div class="head">
        <span class="bg">{{ selDef.glyph }}</span>
        <div>
          <div class="title">{{ selDef.name }}</div>
          <div class="sub muted">{{ selDef.cat === 'park' ? '乐园' : selDef.cat === 'garden' ? '田园' : selDef.cat === 'infra' ? '营造' : '市井' }} · 第 {{ sel.col + 1 }} 列 {{ sel.row + 1 }} 行</div>
        </div>
      </div>
      <p class="desc">{{ selDef.desc }}</p>
      <div class="kv">
        <span v-if="selDef.pop">可住 <b class="num">{{ selDef.pop }}</b></span>
        <span v-if="selDef.jobs">岗位 <b class="num">{{ selDef.jobs }}</b></span>
        <span v-if="selDef.income">产出 <b class="num">{{ selDef.income }}</b>/分</span>
        <span v-if="selDef.approval">民心 <b class="num">+{{ selDef.approval }}</b></span>
        <span v-if="selDef.green">绿化 <b class="num">{{ selDef.green }}</b></span>
      </div>
      <button class="danger" @click="emit('remove', sel!.uid)">拆除 · 返还 {{ Math.round(selDef.cost * 0.4) }}</button>
      <div class="hr" />
    </template>

    <div class="head small">
      <span class="bg season">{{ season.glyph }}</span>
      <div>
        <div class="title">{{ season.term }} · {{ season.note }}</div>
        <div class="sub muted">当季系数 农林 ×{{ rate.farm }} · 乐园 ×{{ rate.park }} · 市井 ×{{ rate.town }}</div>
      </div>
    </div>

    <div class="grid">
      <div><span class="muted">产出</span><b class="num">{{ Math.round(state.gross) }}</b></div>
      <div><span class="muted">维护</span><b class="num">{{ Math.round(state.upkeep) }}</b></div>
      <div><span class="muted">净收</span><b class="num acc">{{ Math.round(state.gross - state.upkeep) }}</b></div>
      <div><span class="muted">居民</span><b class="num">{{ Math.floor(state.pop) }}<em class="muted">/{{ state.popCap }}</em></b></div>
      <div><span class="muted">岗位</span><b class="num">{{ state.jobs }}</b></div>
      <div><span class="muted">民心</span><b class="num">{{ state.approval }}</b></div>
      <div><span class="muted">绿化</span><b class="num">{{ Math.round(state.greenery * 100) }}%</b></div>
      <div><span class="muted">营造</span><b class="num">{{ state.placed.length }}</b></div>
    </div>

    <div class="hr" />
    <div class="perf num">
      <span :class="props.stats && props.stats.fps >= 55 ? 'acc' : 'warn'">{{ props.stats ? Math.round(props.stats.fps) : '--' }} FPS</span>
      <span class="muted">{{ props.stats?.calls ?? '--' }} draw calls</span>
      <span class="muted">{{ props.stats ? (props.stats.tris / 1000).toFixed(0) + 'k' : '--' }} 三角面</span>
      <span class="muted">{{ props.stats?.geoms ?? '--' }} 几何</span>
    </div>

    <div class="acts">
      <button class="ghost" @click="emit('newTown')">另择新镇</button>
      <button class="ghost" @click="emit('clear')">推平重来</button>
    </div>
  </div>
</template>

<style scoped>
.info {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 252px;
  padding: 13px 14px 12px;
  transition: transform 0.28s cubic-bezier(0.3, 0.8, 0.3, 1), opacity 0.28s;
}
.info.collapsed {
  transform: translate(-260px, -50%);
  opacity: 0;
  pointer-events: none;
}
.toggle {
  position: absolute;
  right: -13px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 44px;
  border-radius: 0 9px 9px 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 0;
  box-shadow: var(--shadow);
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1;
}
.head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.bg {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(150deg, #b9c4cf, #8b98a5);
  flex: none;
}
.bg.season {
  background: linear-gradient(150deg, #8fc6a8, #4f9d80);
}
.title {
  font-size: 13.5px;
  font-weight: 600;
}
.sub {
  font-size: 10.5px;
}
.desc {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-2);
  margin: 8px 0 7px;
}
.kv {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 11.5px;
  color: var(--ink-2);
  margin-bottom: 9px;
}
.kv b {
  color: var(--ink);
}
.danger {
  width: 100%;
  height: 30px;
  border-radius: 8px;
  font-size: 12px;
  background: rgba(216, 105, 94, 0.12);
  color: var(--warn);
  border: 1px solid rgba(216, 105, 94, 0.25);
}
.danger:hover {
  background: rgba(216, 105, 94, 0.2);
}
.hr {
  height: 1px;
  background: var(--line);
  margin: 11px 0 9px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px 10px;
  font-size: 11.5px;
}
.grid > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.grid b {
  font-size: 12.5px;
}
.acc {
  color: var(--accent);
}
.warn {
  color: var(--warn);
}
em {
  font-style: normal;
  font-size: 10px;
}
.perf {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 9px;
  font-size: 10.5px;
}
.acts {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.ghost {
  flex: 1;
  height: 28px;
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--ink-2);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--line);
}
.ghost:hover {
  background: #fff;
  color: var(--ink);
}
@media (max-width: 900px) {
  .info {
    display: none;
  }
}
</style>
