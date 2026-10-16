import * as THREE from 'three'
import { PALETTE } from '../game/constants'
import { texGrass, texPaving, texRoad, texWater, texBlobShadow } from './textures'

/**
 * 全局季节标量。所有材质共用同一批 uniform 持有对象 ——
 * 换季只需要改这 7 个 value，绝不重建任何几何 / 材质。
 */
export const U = {
  /** 积雪覆盖 0..1 */
  gSnow: { value: 0 },
  gTime: { value: 0 },
  /** 风摆强度 0..1.4 */
  gWind: { value: 1 },
  /** 阔叶树留叶比例 0 = 光枝 */
  gLeaf: { value: 1 },
  gFoliage: { value: new THREE.Color('#a8d49a') },
  gPine: { value: new THREE.Color('#6ea58a') },
}

const COMMON_ATTRS = `
attribute float aTag;
attribute float aFlex;
attribute float aLeaf;
uniform float gTime;
uniform float gWind;
uniform float gLeaf;
varying float vTag;
varying vec3 vWNorm;
`

const VERT_BODY = `
  vTag = aTag;
  // 冬季落叶：只对阔叶树冠生效，朝树冠锚点收缩
  float leafCanopy = aLeaf * step(0.5, aTag) * (1.0 - step(1.5, aTag));
  float shrink = mix(1.0, 0.12, (1.0 - gLeaf) * leafCanopy);
  transformed = mix(vec3(0.0, 1.15, 0.0), transformed, shrink);
  // 风摆：位置相位随机，越高的枝叶摆幅越大（aFlex 已按高度烘好）
  vec3 gInst = vec3(0.0);
  #ifdef USE_INSTANCING
    gInst = instanceMatrix[3].xyz;
  #endif
  float ph = (gInst.x + gInst.z) * 0.42 + gTime * 1.15;
  float sw = aFlex * gWind;
  transformed.x += sin(ph) * sw;
  transformed.z += sin(ph * 0.77 + 1.3) * sw * 0.72;
  transformed.y += sin(ph * 1.61) * sw * 0.16;
  // 世界法线的朝上分量 → 积雪只堆在朝上的面
  vec3 gN = normal;
  #ifdef USE_INSTANCING
    gN = mat3(instanceMatrix) * gN;
  #endif
  vWNorm = normalize(mat3(modelMatrix) * gN);
`

const FRAG_HEAD = `
uniform float gSnow;
uniform vec3 gFoliage;
uniform vec3 gPine;
uniform float gSnowScale;
varying float vTag;
varying vec3 vWNorm;
`

const FRAG_BODY = `
  // 树冠随季节换色：阔叶用 gFoliage，针叶用 gPine，都乘实例色做个体差异
  float gIsPine = step(1.5, vTag) * (1.0 - step(2.5, vTag));
  float gIsFoliage = step(0.5, vTag) * (1.0 - step(2.5, vTag));
  vec3 gFoli = mix(gFoliage, gPine, gIsPine);
  diffuseColor.rgb = mix(diffuseColor.rgb, gFoli * vColor.rgb, gIsFoliage);
  // 朝上的面冬天积雪
  float gUp = clamp(vWNorm.y, 0.0, 1.0);
  float gSnowMask = smoothstep(0.40, 0.93, gUp) * gSnow * gSnowScale;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.958, 0.975, 0.998), gSnowMask);
`

export interface SeasonalOpts {
  /** 积雪强度倍率：屋顶 1.0 / 地面 0.45 / 水面 0.3 */
  snowScale?: number
  shading?: 'flat' | 'smooth'
}

/** 给任意 three 内建材质挂上「四季 + 风摆 + 积雪」的顶点/片元补丁 */
export function patchSeasonal<T extends THREE.Material>(mat: T, opts: SeasonalOpts = {}): T {
  const snowScale = { value: opts.snowScale ?? 1 }
  const flat = (opts.shading ?? 'flat') === 'flat'
  ;(mat as unknown as THREE.MeshLambertMaterial).flatShading = flat
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.gSnow = U.gSnow
    sh.uniforms.gTime = U.gTime
    sh.uniforms.gWind = U.gWind
    sh.uniforms.gLeaf = U.gLeaf
    sh.uniforms.gFoliage = U.gFoliage
    sh.uniforms.gPine = U.gPine
    sh.uniforms.gSnowScale = snowScale
    sh.vertexShader =
      COMMON_ATTRS +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_BODY)
  }
  mat.customProgramCacheKey = () => 'seasonal'
  return mat
}

/* ─────────────────── 材质表 ───────────────────
 * 注意：three 里 instanceColor 只有在 material.vertexColors 为 true 时才进片元，
 * 且此时几何体必须带 color 属性（否则读到常量 0 → 全黑）。
 * 因此下面所有材质一律 vertexColors:true，几何体统一用 withWhiteColor() 补白。
 */

/** 建筑 / 道具 / 树木：顶点色 + 平涂 + 四季补丁，全场共用 */
export const matSolid = patchSeasonal(
  new THREE.MeshLambertMaterial({ vertexColors: true }),
  { snowScale: 1 },
)

/** 地表砖：积雪弱一些，免得冬天整块地变成白饼 */
export const matGround = patchSeasonal(
  new THREE.MeshLambertMaterial({ map: texGrass, vertexColors: true }),
  { snowScale: 0.42 },
)

/** 铺装 / 广场 —— 用青砖贴图 */
export const matPaving = patchSeasonal(
  new THREE.MeshLambertMaterial({ map: texPaving, vertexColors: true }),
  { snowScale: 0.5, shading: 'smooth' },
)

/** 石板路 */
export const matRoad = patchSeasonal(
  new THREE.MeshLambertMaterial({ map: texRoad, vertexColors: true }),
  { snowScale: 0.62, shading: 'smooth' },
)

/** 水面：贴图 uv 缓慢滚动做出流动感。基色必须显式给，
 *  否则 vColor 只有几何体的纯白，整片水会渲染成白板。 */
export const matWater = patchSeasonal(
  new THREE.MeshLambertMaterial({
    color: new THREE.Color(PALETTE.water),
    map: texWater,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  }),
  { snowScale: 0.28, shading: 'smooth' },
)
texWater.repeat.set(6, 6)
texPaving.repeat.set(1, 1)
texRoad.repeat.set(1, 1)
texGrass.repeat.set(1, 1)

/** 灯笼 / 灯罩 / 彩灯：不受光，恒定明亮 */
export const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true })

/** 喷泉水面：唯一用得上程序化天空 PMREM 的地方，让它真的反光 */
export const matFountain = new THREE.MeshStandardMaterial({
  color: 0xbfe3f5,
  roughness: 0.12,
  metalness: 0.06,
  transparent: true,
  opacity: 0.86,
})

/** 建筑描线：全部实例合并成一次画完 */
export const matOutline = new THREE.LineBasicMaterial({
  color: new THREE.Color(PALETTE.outline),
  transparent: true,
  opacity: 0.34,
})

/** 沙盘底部的柔和投影 */
export const matBlob = new THREE.MeshBasicMaterial({
  map: texBlobShadow,
  transparent: true,
  depthWrite: false,
  color: 0x6b727b,
})

/** 悬停/落位指示 */
export const matGhostOk = new THREE.MeshBasicMaterial({
  color: 0x4fd18b,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  side: THREE.DoubleSide,
})
export const matGhostBad = new THREE.MeshBasicMaterial({
  color: 0xe2685f,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  side: THREE.DoubleSide,
})

/** 选中建筑的地面光环 */
export const matSelectRing = new THREE.MeshBasicMaterial({
  color: 0xf0b23c,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  side: THREE.DoubleSide,
})

export const allSeasonalMaterials = [matSolid, matGround, matPaving, matRoad, matWater]
