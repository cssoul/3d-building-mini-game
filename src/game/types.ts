/** 全局类型定义 */

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

/** 建筑/道具的分类，对应底栏的分组 */
export type Category = 'town' | 'garden' | 'park' | 'infra'

/** 建筑放置的基面要求 */
export type Surface = 'land' | 'water' | 'any'

export interface BuildingDef {
  id: string
  /** 工具栏里显示的汉字图标 */
  glyph: string
  name: string
  cat: Category
  cost: number
  /** 占地，单位：格 */
  w: number
  h: number
  surface: Surface
  /** 可容纳人口 */
  pop?: number
  /** 提供岗位 */
  jobs?: number
  /** 基础产出（铜钱 / 分钟） */
  income?: number
  /** 产出受哪一类季节系数影响 */
  yield?: 'farm' | 'park' | 'town'
  /** 民心加成（百分点） */
  approval?: number
  /** 绿化值（用于绿化率） */
  green?: number
  desc: string
  /** 是否属于「建筑」（参与轮廓描线、落位动画） */
  solid: boolean
}

/** 网格上的一格 */
export interface Tile {
  kind: 'void' | 'land' | 'water'
  /** 地表变体：草地 / 沙地 / 铺装 */
  skin: 'grass' | 'sand' | 'stone'
  /** 高度偏移（用于微起伏） */
  lift: number
}

export interface Placed {
  uid: number
  type: string
  col: number
  row: number
  /** 绕 Y 轴 90° 的整数倍 */
  rot: number
  /** 每实例随机种子，用于微扰（颜色/朝向/高度） */
  seed: number
  /** 建造动画进度 0..1 */
  birth: number
}

export interface SeasonPreset {
  id: SeasonId
  name: string
  /** 节气名 */
  term: string
  glyph: string
  /** 纸面底色（scene.background）—— 展陈版式的地，不是天空 */
  paper: string
  /** 程序化 equirect 天空的渐变 stop，供 PMREM 当环境光 */
  sky: { top: string; mid: string; horizon: string; bottom: string }
  sun: { color: string; intensity: number; azimuth: number; elevation: number }
  hemi: { skyColor: string; groundColor: string; intensity: number }
  ambient: { color: string; intensity: number }
  /** 阔叶树冠色 */
  foliage: string
  /** 针叶树色 */
  pine: string
  /** 草地实例色乘算 */
  grass: string
  /** 落叶程度：1 = 满叶，0 = 光枝 */
  leaf: number
  /** 积雪系数 0..1 */
  snow: number
  particles: {
    mode: 'petal' | 'pollen' | 'leaf' | 'snow'
    color: string
    count: number
    speed: number
    size: number
    swirl: number
  }
  /** 经济系数 */
  rate: { farm: number; park: number; town: number }
  /** 一句话风物描述 */
  note: string
}

export interface HoverCell {
  col: number
  row: number
  ok: boolean
}
