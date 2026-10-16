<script setup lang="ts">
import { computed } from 'vue'
import { SEASON_MAP, SEASON_SECONDS } from '../game/constants'
import { netIncome, state } from '../game/store'

const season = computed(() => SEASON_MAP[state.season])
const net = computed(() => netIncome())
const left = computed(() => (1 - state.seasonT) * (SEASON_SECONDS / Math.max(1, state.speed)))
const mmss = (s: number) => {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
const coins = computed(() => Math.floor(state.coins).toLocaleString('en-US'))
</script>

<template>
  <div class="topbar">
    <div class="panel block season-block">
      <div class="glyph">{{ season.glyph }}</div>
      <div class="col">
        <div class="row1">
          <span class="year">第 {{ state.year }} 年 · {{ season.term }}</span>
          <span class="cd num muted">还剩 {{ mmss(left) }}</span>
        </div>
        <div class="bar">
          <i :style="{ width: state.seasonT * 100 + '%' }" />
        </div>
        <div class="note">{{ season.note }}</div>
      </div>
    </div>

    <div class="panel block coin-block">
      <div class="coin">
        <span class="sym">◍</span>
        <span class="num big">{{ coins }}</span>
      </div>
      <div class="rate num" :class="{ neg: net < 0 }">
        {{ net >= 0 ? '+' : '' }}{{ Math.round(net) }}/分
      </div>
    </div>

    <div class="spacer" />

    <div class="panel chips">
      <span class="chip"><b class="k">民心</b>
        <span class="num" :class="state.approval >= 60 ? 'good' : state.approval >= 45 ? '' : 'bad'">
          {{ state.approval }}
        </span>
      </span>
      <span class="chip"><b class="k">人口</b><span class="num">{{ Math.floor(state.pop) }}</span>
        <em class="muted num">/{{ state.popCap }}</em>
      </span>
      <span class="chip"><b class="k">岗位</b><span class="num">{{ state.jobs }}</span></span>
      <span class="chip"><b class="k">绿化</b><span class="num">{{ Math.round(state.greenery * 100) }}%</span></span>
      <span class="chip"><b class="k">产业</b>
        <span class="num">{{ state.townN }}·{{ state.farmN }}·{{ state.parkN }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.topbar {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  pointer-events: none;
}
.topbar > * {
  pointer-events: auto;
}
.block {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 13px;
}
.season-block .glyph {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 19px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(150deg, #8fc6a8, #4f9d80);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.08);
}
.col {
  min-width: 176px;
}
.row1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.year {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.cd {
  font-size: 11px;
}
.bar {
  height: 3px;
  border-radius: 2px;
  background: rgba(60, 66, 74, 0.12);
  margin: 6px 0 4px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #f0c060, #e2766a);
  transition: width 0.25s linear;
}
.note {
  font-size: 11px;
  color: var(--ink-2);
}
.coin-block {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.coin {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sym {
  font-size: 15px;
  color: var(--gold);
}
.big {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.4px;
}
.rate {
  font-size: 11.5px;
  color: var(--accent);
  padding-left: 21px;
}
.rate.neg {
  color: var(--warn);
}
.spacer {
  flex: 1;
}
.chips {
  display: flex;
  gap: 6px;
  padding: 7px 9px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 60vw;
}
.chip b.k {
  font-weight: 500;
  color: var(--ink-2);
}
.good {
  color: var(--accent);
  font-weight: 600;
}
.bad {
  color: var(--warn);
  font-weight: 600;
}
em {
  font-style: normal;
}
@media (max-width: 860px) {
  .topbar {
    top: 10px;
    left: 10px;
    right: 10px;
    gap: 6px;
  }
  .chips {
    display: none;
  }
}
</style>
