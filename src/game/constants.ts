import type { BuildingDef, SeasonPreset, SeasonId } from './types'

/** 默认城镇的随机种子：保证每次打开看到的是同一个「云溪镇」 */
export const SEED_DEFAULT = 20261013

/** 单格边长（世界单位）。1 格 = 2 单位 → 一间民居 2×2 单位 */
export const TILE = 2
export const COLS = 32
export const ROWS = 32
/** 岛屿底面下沉深度（悬崖厚度） */
export const BASE_DEPTH = 3.2
/** 地表砖厚度 */
export const TILE_H = 0.7

export const WORLD_W = COLS * TILE
export const WORLD_H = ROWS * TILE

/** 等距相机的仰角（真等距 = atan(1/√2) ≈ 35.264°） */
export const ISO_ELEV = Math.atan(1 / Math.SQRT2)
/** 相机环绕的四个方位（45° / 135° / 225° / 315°），逐个转 90° */
export const CAM_YAW_BASE = Math.PI / 4

/** 调色板：低多边形粉彩 + 细描线，向截图靠 */
export const PALETTE = {
  paper: '#eceef1',
  outline: '#5b6169',
  grass: '#cfe0bd',
  grassAlt: '#c4d8b2',
  sand: '#ecdfc2',
  stone: '#dcdcd8',
  plaza: '#e3e0d6',
  water: '#a9d7ee',
  waterDeep: '#8cc6e6',
  cliff: '#e2d9c6',
  cliffDark: '#cfc3ab',
  road: '#d9dade',
  roadLine: '#fbfbfb',

  wall: '#fbfaf7',
  wallWarm: '#f6efe3',
  wallCool: '#eef0f2',
  roofPink: '#f0bfc4',
  roofMint: '#b6d9c6',
  roofBlue: '#bcd3e8',
  roofCream: '#f2e0b8',
  roofSlate: '#b9bec7',
  roofRed: '#dfa08f',
  wood: '#c99a6b',
  woodDark: '#9c7150',
  tileGrey: '#8e939c',
  gold: '#e8c069',
  window: '#7fa6bd',
  windowLit: '#ffd98a',
  trunk: '#b08b63',
  lantern: '#e2685f',

  'spring-leaf': '#a8d49a',
  'summer-leaf': '#7cc06b',
  'autumn-leaf': '#e6a44e',
  'winter-leaf': '#8aa89a',
  'spring-bloom': '#f7c6d9',
  'pine': '#6ea58a',
} as const

export const SEASONS: SeasonPreset[] = [
  {
    id: 'spring',
    name: '春',
    term: '春分',
    glyph: '春',
    paper: '#eef2ec',
    sky: { top: '#bcdcf0', mid: '#dbeaf3', horizon: '#f6f5ea', bottom: '#e7ead9' },
    sun: { color: '#fff3dd', intensity: 2.15, azimuth: 0.62, elevation: 0.82 },
    hemi: { skyColor: '#dceeff', groundColor: '#e8efd8', intensity: 0.5 },
    ambient: { color: '#ffffff', intensity: 0.34 },
    foliage: '#a8d49a',
    pine: '#6ea58a',
    grass: '#d3e4bf',
    leaf: 1,
    snow: 0,
    particles: { mode: 'petal', color: '#ffd4e4', count: 520, speed: 1.5, size: 7, swirl: 1.25 },
    rate: { farm: 1.5, park: 1.05, town: 1 },
    note: '桃李初绽，水暖三分',
  },
  {
    id: 'summer',
    name: '夏',
    term: '夏至',
    glyph: '夏',
    paper: '#e9f1f7',
    sky: { top: '#8dc4ea', mid: '#c8e3f5', horizon: '#f2f7f4', bottom: '#dceadf' },
    sun: { color: '#fff8e8', intensity: 2.55, azimuth: 0.32, elevation: 1.05 },
    hemi: { skyColor: '#d4ecff', groundColor: '#dfeccf', intensity: 0.55 },
    ambient: { color: '#ffffff', intensity: 0.32 },
    foliage: '#7cc06b',
    pine: '#5f9a7d',
    grass: '#c9dfae',
    leaf: 1,
    snow: 0,
    particles: { mode: 'pollen', color: '#fdf6d8', count: 300, speed: 0.8, size: 5, swirl: 0.6 },
    rate: { farm: 1.1, park: 1.4, town: 1 },
    note: '蝉声满树，蒲扇摇风',
  },
  {
    id: 'autumn',
    name: '秋',
    term: '秋分',
    glyph: '秋',
    paper: '#f5efe2',
    sky: { top: '#a9c6e4', mid: '#e2e3e6', horizon: '#f8ecd4', bottom: '#eadfc4' },
    sun: { color: '#ffe0ab', intensity: 2.1, azimuth: 0.95, elevation: 0.66 },
    hemi: { skyColor: '#e6ecf6', groundColor: '#efe2c6', intensity: 0.5 },
    ambient: { color: '#fff6e6', intensity: 0.34 },
    foliage: '#e6a44e',
    pine: '#6b9b80',
    grass: '#dcdfae',
    leaf: 1,
    snow: 0,
    particles: { mode: 'leaf', color: '#e8b76a', count: 620, speed: 1.35, size: 9, swirl: 1.6 },
    rate: { farm: 1.9, park: 0.95, town: 1.05 },
    note: '稻熟归仓，枫红满山',
  },
  {
    id: 'winter',
    name: '冬',
    term: '冬至',
    glyph: '冬',
    paper: '#eef1f5',
    sky: { top: '#b9c9d9', mid: '#dbe4ec', horizon: '#f4f6f8', bottom: '#e6ebee' },
    sun: { color: '#eaf2ff', intensity: 1.7, azimuth: 1.35, elevation: 0.5 },
    hemi: { skyColor: '#dfeaf5', groundColor: '#eef1f2', intensity: 0.58 },
    ambient: { color: '#f2f7ff', intensity: 0.42 },
    foliage: '#9db3ab',
    pine: '#6a8f7e',
    grass: '#e4e9e4',
    leaf: 0,
    snow: 1,
    particles: { mode: 'snow', color: '#ffffff', count: 720, speed: 0.95, size: 7, swirl: 0.9 },
    rate: { farm: 0.35, park: 0.55, town: 0.9 },
    note: '檐角挂冰，围炉煮茶',
  },
]

export const SEASON_ORDER: SeasonId[] = ['spring', 'summer', 'autumn', 'winter']
export const SEASON_MAP = Object.fromEntries(SEASONS.map((s) => [s.id, s])) as Record<SeasonId, SeasonPreset>

/** 一个节气持续的现实秒数（1x 速度下） */
export const SEASON_SECONDS = 108

const B = (d: BuildingDef) => d

export const BUILDINGS: BuildingDef[] = [
  // ───────── 城镇 ─────────
  B({
    id: 'house', glyph: '居', name: '民居', cat: 'town', cost: 120, w: 1, h: 1,
    surface: 'land', pop: 4, approval: 0, green: 0, solid: true,
    desc: '一进青瓦小院，可住四口人。',
  }),
  B({
    id: 'courtyard', glyph: '院', name: '合院', cat: 'town', cost: 460, w: 2, h: 2,
    surface: 'land', pop: 14, approval: 1.5, green: 1, solid: true,
    desc: '三间两耳，天井里种着一株石榴。',
  }),
  B({
    id: 'shop', glyph: '铺', name: '杂货铺', cat: 'town', cost: 220, w: 1, h: 1,
    surface: 'land', jobs: 2, income: 42, yield: 'town', approval: 0.4, solid: true,
    desc: '油盐酱醋、针头线脑，街坊离不得。',
  }),
  B({
    id: 'teahouse', glyph: '茶', name: '茶楼', cat: 'town', cost: 380, w: 2, h: 2,
    surface: 'land', jobs: 4, income: 64, yield: 'town', approval: 1.2, solid: true,
    desc: '两层木楼，说书人午后开嗓。',
  }),
  B({
    id: 'tavern', glyph: '酒', name: '酒肆', cat: 'town', cost: 300, w: 2, h: 1,
    surface: 'land', jobs: 3, income: 56, yield: 'town', approval: 0.8, solid: true,
    desc: '门口挑着酒旗，风一吹就晃。',
  }),
  B({
    id: 'mill', glyph: '磨', name: '水磨坊', cat: 'town', cost: 520, w: 2, h: 2,
    surface: 'water', jobs: 3, income: 78, yield: 'town', approval: 0.6, solid: true,
    desc: '临水而建，水轮终日吱呀转个不停。',
  }),
  B({
    id: 'academy', glyph: '书', name: '书院', cat: 'town', cost: 900, w: 3, h: 2,
    surface: 'land', jobs: 5, income: 44, yield: 'town', approval: 4, green: 1, solid: true,
    desc: '朗朗书声，民心大悦。',
  }),
  B({
    id: 'pagoda', glyph: '塔', name: '宝塔', cat: 'town', cost: 1400, w: 2, h: 2,
    surface: 'land', income: 30, yield: 'town', approval: 5, solid: true,
    desc: '七级浮屠，登临可望全镇。',
  }),
  B({
    id: 'paifang', glyph: '坊', name: '牌坊', cat: 'town', cost: 280, w: 1, h: 1,
    surface: 'land', approval: 2, solid: true,
    desc: '镇口石坊，过路的人都要抬头看。',
  }),
  B({
    id: 'dock', glyph: '舟', name: '渔码头', cat: 'town', cost: 340, w: 2, h: 2,
    surface: 'water', jobs: 2, income: 52, yield: 'town', approval: 0.5, solid: true,
    desc: '木栈桥泊着三条小船。',
  }),

  // ───────── 田园 ─────────
  B({
    id: 'farm', glyph: '田', name: '水田', cat: 'garden', cost: 90, w: 2, h: 2,
    surface: 'land', income: 34, yield: 'farm', approval: 0.3, green: 1, solid: true,
    desc: '春种秋收，随季节起伏极大。',
  }),
  B({
    id: 'orchard', glyph: '果', name: '果园', cat: 'garden', cost: 150, w: 2, h: 2,
    surface: 'land', income: 46, yield: 'farm', approval: 0.5, green: 2, solid: true,
    desc: '一园桃李，花开时最好看。',
  }),
  B({
    id: 'pine', glyph: '松', name: '苍松', cat: 'garden', cost: 30, w: 1, h: 1,
    surface: 'land', approval: 0.3, green: 1, solid: true,
    desc: '冬天也不落叶。',
  }),
  B({
    id: 'blossom', glyph: '花', name: '花树', cat: 'garden', cost: 45, w: 1, h: 1,
    surface: 'land', approval: 0.4, green: 1, solid: true,
    desc: '春来一树粉白，秋来满地金黄。',
  }),
  B({
    id: 'bamboo', glyph: '竹', name: '竹林', cat: 'garden', cost: 35, w: 1, h: 1,
    surface: 'land', approval: 0.3, green: 1, solid: true,
    desc: '风过时沙沙作响。',
  }),
  B({
    id: 'flowerbed', glyph: '卉', name: '花坛', cat: 'garden', cost: 60, w: 1, h: 1,
    surface: 'land', approval: 0.6, green: 1, solid: true,
    desc: '街心的四时花圃。',
  }),
  B({
    id: 'lamp', glyph: '灯', name: '街灯', cat: 'garden', cost: 70, w: 1, h: 1,
    surface: 'land', approval: 0.5, green: 0, solid: true,
    desc: '夜里点亮，走夜路的人心里踏实。',
  }),
  B({
    id: 'lantern', glyph: '笼', name: '灯笼柱', cat: 'garden', cost: 55, w: 1, h: 1,
    surface: 'land', approval: 0.5, green: 0, solid: true,
    desc: '红灯笼一挂，就有过节的意思。',
  }),
  B({
    id: 'pavilion', glyph: '亭', name: '凉亭', cat: 'garden', cost: 240, w: 1, h: 1,
    surface: 'land', approval: 2, green: 1, solid: true,
    desc: '八角攒尖，老人在这儿下棋。',
  }),

  // ───────── 乐园 ─────────
  B({
    id: 'gate', glyph: '门', name: '乐园门楼', cat: 'park', cost: 800, w: 2, h: 1,
    surface: 'land', income: 30, yield: 'park', approval: 5, solid: true,
    desc: '彩楼高耸，门票从这里卖起。',
  }),
  B({
    id: 'carousel', glyph: '马', name: '旋转木马', cat: 'park', cost: 1200, w: 2, h: 2,
    surface: 'land', jobs: 2, income: 96, yield: 'park', approval: 4, solid: true,
    desc: '八匹彩马，绕着一盏灯上下起伏。',
  }),
  B({
    id: 'teacup', glyph: '盅', name: '转转茶盅', cat: 'park', cost: 900, w: 2, h: 2,
    surface: 'land', jobs: 2, income: 72, yield: 'park', approval: 3, solid: true,
    desc: '六只大茶盅转得人发晕。',
  }),
  B({
    id: 'fountain', glyph: '泉', name: '喷泉', cat: 'park', cost: 620, w: 2, h: 2,
    surface: 'land', income: 22, yield: 'park', approval: 3, green: 1, solid: true,
    desc: '水柱随乐声起落。',
  }),
  B({
    id: 'ferris', glyph: '轮', name: '摩天轮', cat: 'park', cost: 2400, w: 3, h: 3,
    surface: 'land', jobs: 4, income: 196, yield: 'park', approval: 6, solid: true,
    desc: '全镇最高的地方，能看见远处的山。',
  }),
  B({
    id: 'coaster', glyph: '车', name: '过山车', cat: 'park', cost: 3600, w: 4, h: 4,
    surface: 'land', jobs: 5, income: 268, yield: 'park', approval: 7, solid: true,
    desc: '木架轨道，笛声一响心先飞起来。',
  }),

  // ───────── 基建 ─────────
  B({
    id: 'road', glyph: '路', name: '石板路', cat: 'infra', cost: 12, w: 1, h: 1,
    surface: 'any', solid: false,
    desc: '水面上自动架桥。',
  }),
  B({
    id: 'plaza', glyph: '场', name: '铺装广场', cat: 'infra', cost: 30, w: 1, h: 1,
    surface: 'land', approval: 0.2, green: 0, solid: false,
    desc: '青砖漫地，摆摊儿的地方。',
  }),
]

export const BUILDING_MAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, BuildingDef>

export const CATEGORIES: { id: string; name: string; items: string[] }[] = [
  { id: 'infra', name: '营造', items: ['road', 'plaza', 'paifang', 'bridge'] },
  { id: 'town', name: '市井', items: ['house', 'courtyard', 'shop', 'teahouse', 'tavern', 'academy', 'pagoda', 'mill', 'dock'] },
  { id: 'garden', name: '田园', items: ['farm', 'orchard', 'pine', 'blossom', 'bamboo', 'flowerbed', 'lamp', 'lantern', 'pavilion'] },
  { id: 'park', name: '乐园', items: ['gate', 'carousel', 'teacup', 'fountain', 'ferris', 'coaster'] },
]
