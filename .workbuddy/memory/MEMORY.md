# 四季小镇 · 云溪 —— 项目长期笔记

等距（正交感）中式「小镇 + 乐园」建造小游戏。栈：Vue 3 + TypeScript + Three.js + Vite。
**硬约束：所有 3D 模型、材质、道路、树、街灯、建筑、人物及特效全部代码生成，
不依赖任何外部 GLB/GLTF/FBX/OBJ/HDR/纹理图片。** 场景需支持一年四季。

## 目录约定

- `src/game/` —— 纯逻辑，不 import three。`constants.ts`（PALETTE / SEASONS / BUILDINGS / 尺寸常量）、
  `island.ts`（程序化地形）、`store.ts`（reactive 单例 + tick + 布镇）、`types.ts`。
- `src/three/` —— 命令式渲染层。`scene.ts` 是总装；`materials.ts` 是材质表 + 季节补丁；
  `geo.ts` 是几何构造器 `Geo` 与 `withWhiteColor`；`buildings.ts` 是 26 种建筑工厂；
  `textures.ts` 是 CanvasTexture；`sky.ts` 天穹与 PMREM；`particles.ts` / `crowd.ts` / `dynamics.ts`。
- `src/components/` —— TopBar / ToolBar / InfoPanel 三个浮层面板，只读 `state`。

## 必须遵守的工程铁律（踩过坑的）

0. **绝不修改任何 skill**（`~/.workbuddy/skills/**` 与插件缓存里的 skill，含其文档/starter/脚本）。
   引用 `threejs-modern-architecture` 等 skill 时一律只读；本项目自己的结论写在本目录 memory 里。
   （用户 2026-10-13 明确要求，跨项目通用。）
1. **`vertexColors: true` 的材质，其几何体必须带 `color` 属性**。
   否则 three 的 `#ifdef USE_COLOR` 会让 `vColor *= color` 乘上缺省常量 0 → 整块纯黑。
   统一走 `geo.ts` 的 `withWhiteColor()`；scene.ts 里还有 `ensureInstanceAttrs()` 兜底。
   **绝不要给这类材质配内联裸 `BoxGeometry`。**
2. **`matWater` 必须显式给 `color`**，并在 `sync()` 里写 `instanceColor`；
   只靠几何体的白色会渲染成白板（不是水色）。
3. **换季只有一个出口**：`App.vue` 的 `watch(() => state.season)` → `scene.applySeason(id)`。
   任何新增的换季入口都要走这条，不要绕开。
4. **换季只改 uniform / 天穹色 / 灯光 / PMREM，绝不重建几何或材质**。
   全局标量在 `materials.ts` 的 `U`（gSnow/gTime/gWind/gLeaf/gFoliage/gPine）。
5. **合批**：同一种建筑 → 每个变体 1 个 `InstancedMesh`；描线在 CPU 侧把各实例边表变换后
   拼成一条 `LineSegments`。实测 307 物件 = 60 draw calls，不必为了性能牺牲表现力。
6. GLSL ES 3.0：`smoothstep` 的边 0 必须小于边 1（写 `1.0 - smoothstep(a, b, x)`）；
   `discard` 要在赋值前判断。正交相机下 `gl_PointSize` 不能用 `1/-mv.z`，要用常量式。
7. 平涂风格：`renderer.toneMapping = NoToneMapping` + `MeshLambertMaterial` + 顶点色 + 逐三角面亮度 jitter。

## 验证闭环（不要只用 `npm run build` 判断对错）

暂停 / seek → 截图 → 读 `renderer.info` → 过滤 console。
- DEV 钩子：`window.__town`（TownScene 实例）、
  `window.__game`（`state / setSeason / seedTown / clearAll / place / removeAt / scene / stats`）。
- **测 FPS 必须开 `--use-angle=metal`**；swiftshader 软渲染会低 3 倍以上（17 vs 60），数字无意义。
- 环境坑：Bash 的 `grep` 不可靠（用 Grep 工具）；zsh 下 `^` 会被当 glob；
  vite 8 需 Node ≥ 22.12（用 `~/.workbuddy/binaries/node/versions/22.22.2-6/bin/node`）。
