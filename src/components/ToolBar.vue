<script setup lang="ts">
import { computed, ref } from 'vue'
import { BUILDING_MAP, CATEGORIES, SEASONS } from '../game/constants'
import { setSeason, state } from '../game/store'
import type { Category } from '../game/types'

const emit = defineEmits<{ (e: 'rotate', d: number): void; (e: 'reset'): void }>()

const cats = CATEGORIES
const items = computed(() => cats.find((c) => c.id === state.cat)?.items ?? [])
const hovered = ref<string | null>(null)
const hoverDef = computed(() => (hovered.value ? BUILDING_MAP[hovered.value] : null))

function pickCat(id: string) {
  state.cat = id as Category
  const first = cats.find((c) => c.id === id)?.items[0]
  if (first && state.tool !== 'select' && state.tool !== 'bulldoze') state.tool = first
}
</script>

<template>
  <div class="bottom">
    <div class="panel bar">
      <div class="seg">
        <button class="ibtn" :class="{ on: state.tool === 'select' }" @click="state.tool = 'select'" title="选择查看（Esc）">
          <span class="g">择</span><span class="n">查看</span>
        </button>
        <button class="ibtn" :class="{ on: state.tool === 'bulldoze' }" @click="state.tool = 'bulldoze'" title="拆除（X）">
          <span class="g">拆</span><span class="n">拆除</span>
        </button>
      </div>

      <div class="divider" />

      <div class="tabs">
        <button
          v-for="c in cats"
          :key="c.id"
          class="tab"
          :class="{ on: state.cat === c.id }"
          @click="pickCat(c.id)"
        >
          {{ c.name }}
        </button>
      </div>

      <div class="divider" />

      <div class="items" @mouseleave="hovered = null">
        <button
          v-for="id in items"
          :key="id"
          class="ibtn item"
          :class="{ on: state.tool === id, poor: state.coins < (BUILDING_MAP[id]?.cost ?? 0) }"
          :title="`${BUILDING_MAP[id]?.name} · ${BUILDING_MAP[id]?.cost} 铜钱 — ${BUILDING_MAP[id]?.desc}`"
          @mouseenter="hovered = id"
          @click="state.tool = id"
        >
          <span class="g">{{ BUILDING_MAP[id]?.glyph }}</span>
          <span class="n">{{ BUILDING_MAP[id]?.name }}</span>
          <span class="c num">{{ BUILDING_MAP[id]?.cost }}</span>
        </button>
      </div>

      <div class="spacer" />

      <button class="ibtn sm" title="把待建建筑旋转 90°（R）" @click="emit('rotate', 1)">
        <span class="g">↻</span><span class="n">旋转</span>
      </button>
      <button class="ibtn sm" title="回到全景视角" @click="emit('reset')">
        <span class="g">⤢</span><span class="n">全景</span>
      </button>

      <div class="divider" />

      <div class="seasons">
        <button
          v-for="s in SEASONS"
          :key="s.id"
          class="sbtn"
          :class="{ on: state.season === s.id }"
          :title="`切到${s.name}季 · ${s.note}`"
          @click="setSeason(s.id)"
        >
          {{ s.glyph }}
        </button>
      </div>

      <div class="seg speeds">
        <button :class="{ on: state.speed === 0 }" title="暂停" @click="state.speed = 0">❙❙</button>
        <button :class="{ on: state.speed === 1 }" @click="state.speed = 1">1×</button>
        <button :class="{ on: state.speed === 2 }" @click="state.speed = 2">2×</button>
        <button :class="{ on: state.speed === 4 }" @click="state.speed = 4">4×</button>
      </div>
    </div>

    <div class="hintline">
      <span v-if="hoverDef" class="hd">
        <b>{{ hoverDef.name }}</b> · {{ hoverDef.cost }} 铜钱<template v-if="hoverDef.pop"> · 住 {{ hoverDef.pop }}</template
        ><template v-if="hoverDef.jobs"> · 岗位 {{ hoverDef.jobs }}</template
        ><template v-if="hoverDef.income"> · 产出 {{ hoverDef.income }}/分</template
        ><template v-if="hoverDef.approval"> · 民心 +{{ hoverDef.approval }}</template>
        <em class="muted"> — {{ hoverDef.desc }}</em>
      </span>
      <span v-else class="muted">
        <b>左键点击</b>建造 · <b>左键拖拽</b>转动小镇（松手有惯性）· <b>Shift+左键拖拽</b>连续铺设 · 右键拖拽平移 ·
        滚轮缩放 · <b>Q E</b> 转 45° · <b>R</b> 旋转建筑 · 快捷键 <b>1–9</b> 选工具
      </span>
    </div>
  </div>
</template>

<style scoped>
.bottom {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
.bottom > * {
  pointer-events: auto;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  overflow-x: auto;
  scrollbar-width: none;
}
.bar::-webkit-scrollbar {
  display: none;
}
.divider {
  width: 1px;
  align-self: stretch;
  background: var(--line);
  margin: 2px 5px;
  flex: none;
}
.seg {
  display: flex;
  gap: 3px;
  flex: none;
}
.seg button {
  height: 44px;
  min-width: 40px;
  padding: 0 8px;
  border-radius: 9px;
  font-size: 12.5px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--line);
  transition: all 0.14s ease;
}
.seg button:hover {
  background: #fff;
  transform: translateY(-1px);
}
.seg button.on {
  background: #333a44;
  border-color: #333a44;
  color: #fff;
}
.ibtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 52px;
  height: 50px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
  transition: all 0.14s ease;
  flex: none;
}
.ibtn:hover {
  background: #fff;
  transform: translateY(-1px);
}
.ibtn.on {
  background: #333a44;
  border-color: #333a44;
  color: #fff;
}
.ibtn.poor .c {
  color: var(--warn);
}
.ibtn.on .c,
.ibtn.on .n {
  color: rgba(255, 255, 255, 0.75);
}
.ibtn .g {
  font-size: 15px;
  line-height: 1;
  font-weight: 600;
}
.ibtn .n {
  font-size: 10px;
  color: var(--ink-2);
  line-height: 1.1;
}
.ibtn .c {
  font-size: 9.5px;
  color: var(--ink-3);
  line-height: 1;
}
.item {
  width: 55px;
}
.tabs {
  display: flex;
  gap: 3px;
  flex: none;
}
.tab {
  height: 50px;
  padding: 0 12px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1px;
  color: var(--ink-2);
  transition: all 0.14s ease;
}
.tab:hover {
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink);
}
.tab.on {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.items {
  display: flex;
  gap: 4px;
  flex: none;
}
.spacer {
  flex: 1;
  min-width: 8px;
}
.sm {
  width: 46px;
}
.seasons {
  display: flex;
  gap: 3px;
  flex: none;
}
.sbtn {
  width: 36px;
  height: 44px;
  border-radius: 9px;
  font-size: 15px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--line);
  transition: all 0.14s ease;
}
.sbtn:hover {
  background: #fff;
  transform: translateY(-1px);
}
.sbtn.on {
  background: linear-gradient(150deg, #8fc6a8, #4f9d80);
  border-color: transparent;
  color: #fff;
}
.speeds button {
  min-width: 34px;
  font-size: 11.5px;
}
.hintline {
  padding: 0 4px 2px;
  font-size: 11.5px;
  color: var(--ink-2);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hd b {
  color: var(--ink);
}
.hd em {
  font-style: normal;
}
@media (max-width: 900px) {
  .ibtn .n,
  .cd {
    display: none;
  }
  .ibtn {
    width: 44px;
    height: 44px;
  }
  .hintline {
    display: none;
  }
}
</style>
