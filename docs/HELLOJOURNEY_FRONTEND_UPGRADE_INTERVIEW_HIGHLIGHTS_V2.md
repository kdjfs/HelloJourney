# HelloJourney 前端升级：面试难点与亮点（V2 背诵版）

> 本文只记录 `test/hello-journey-v3-upgrade` 分支本轮前端升级，不替代原有发布说明，也不声称修改了后端 Java 代码。
>
> 建议先背“30 秒版本”和“2 分钟版本”，再按面试官追问进入专题。

## 一、30 秒版本

我把 HelloJourney 从“能展示 AI 行程结果”升级成了一个可交互、可降级、可国际化的旅行工作区。核心包括：高德地图真实道路路线和三级降级、中英日 i18n、含地图的攻略长图导出、编辑后地图/图谱/预算实时联动、预约提醒和只读安全设置页。

工程上我重点解决了 React StrictMode 下第三方地图生命周期、WebGL 地图截图、编辑后派生数据失效、跨组件语言同步，以及 ECharts 包体积过大。最终前端测试从 12 个增加到 25 个，知识图谱 chunk 从 1,142.47 kB 降到 532.74 kB，gzip 从 379.59 kB 降到 179.54 kB，所有功能提交均通过 typecheck、lint、test、build。

## 二、2 分钟版本

这次升级我没有复制 TripStar 的 Vue 代码，而是把它的产品能力翻译成 React 19 的状态与生命周期模型。

第一，地图采用受控 `TripPlan`，通过 `useEffect` 初始化和销毁高德实例。景点按“天-序号”编号，路线按 Driving → Walking → Polyline 逐级降级；无 Key、无坐标或 SDK 失败都有确定性占位，不会白屏。卡片点击会定位并高亮 Marker，编辑与撤销后地图自动重建并 `setFitView`。

第二，i18n 以 i18next 为单一语言状态源，同时驱动 React 文案、Ant Design locale、Day.js locale 和 `document.lang`。语言写入 `localStorage`，生成请求携带当前语言；已生成的后端内容不做伪翻译，而是提示用户重新生成。

第三，图片导出采用两阶段截图：先单独捕获地图，再构建纯净导出 DOM，最后生成 PNG。地图截图失败只降级地图部分，不影响整份攻略。DOM 截图边界可注入 mock，长行程按像素预算动态控制 scale，避免大图内存峰值。

第四，编辑工作区仍以 reducer 的 `present` 为事实源。地图直接消费最新计划；后端图谱只在计划未修改时使用，一旦编辑就切换为前端基于最新计划推导的图谱，撤销回原始版本后再恢复后端图谱。预算采用“后端基准 + 明细差量”更新，既实时响应景点/酒店/餐饮编辑，又保留无法从明细拆出的交通估算。

最后，设置页只调用 GET 接口展示 configured 状态，不提供 Secret 输入框或写接口；ECharts 改用 core + GraphChart + Tooltip + CanvasRenderer 的模块化注册，知识图谱包体积下降约 53%。

## 三、项目结果与量化证据

| 指标 | 升级前/基线 | 升级后 |
| --- | ---: | ---: |
| 前端测试 | 6 files / 12 tests | 13 files / 25 tests |
| KnowledgeGraph chunk | 1,142.47 kB | 532.74 kB |
| KnowledgeGraph gzip | 379.59 kB | 179.54 kB |
| 600 kB 构建警告 | 存在 | 消失 |
| 语言 | 中文硬编码 | 中文 / English / 日本語 |
| 地图失败体验 | 无地图总览 | Key/坐标/SDK 三类确定性降级 |
| 导出 | JSON、打印/PDF | 增加含地图 PNG 长图及地图失败降级 |
| 设置安全边界 | 无 Web 展示页 | 只读状态页，不回传或回填 Secret |

本轮前端代码共 8 个实现提交、54 个前端文件，约 `+4104 / -479` 行。实现提交如下：

1. `4328450 feat(ui): add resilient itinerary map overview`
2. `e28e048 feat(ui): add multilingual travel experience`
3. `93a5175 feat(ui): export itinerary as map-aware image`
4. `29b6148 feat(ui): synchronize itinerary workspace views`
5. `ea9e4ef feat(ui): highlight reservation-required attractions`
6. `1ac2324 feat(ui): add secure runtime settings overview`
7. `aa5fc6c perf(ui): shrink knowledge graph bundle`
8. `6bd237e fix(ui): add AI assistant result tab`

## 四、专题 1：第三方地图如何在 React 中稳定运行

### 难点

- 高德 SDK 是命令式 API，React 是声明式 UI，两者生命周期不一致。
- React StrictMode 在开发环境会执行额外的 setup → cleanup → setup，用来暴露副作用问题。
- 路线服务可能超时、无数据或 Key 配置错误，但地图区域不能白屏。
- 行程编辑会改变 Marker、路线与适配范围，旧实例和事件不能残留。

### 我的做法

1. `TripMap` 只接收受控 `plan` 与 `selectedAttraction`，不复制业务状态。
2. `useMemo` 从计划提取有效坐标；`useEffect` 负责 SDK 加载、地图创建、标记和路线构建。
3. cleanup 中逐一解绑 Marker 事件、移除 DOM 键盘事件、关闭 InfoWindow、清空绑定并执行 `map.destroy()`。
4. Marker 先渲染，再异步请求路线，避免慢路线阻塞整张地图。
5. 单段路线设置超时并依次尝试 Driving、Walking、直线 Polyline。
6. 初始化与每次路线重建后都执行 `setFitView`。
7. 无 Web JS Key、无有效坐标、SDK 加载失败分别展示明确占位卡。

### 面试回答关键词

`受控 props`、`命令式 SDK 适配层`、`effect 对称 cleanup`、`StrictMode-safe`、`progressive fallback`、`never blank`。

### 常见追问：为什么不把地图实例放 state？

地图实例不会直接参与 React 渲染，而且对象可变、体积大。放入 state 会制造无意义重渲染，也容易让命令式实例与虚拟 DOM 更新相互干扰。因此用 `useRef` 保存实例，用 state 只保存 `loading / ready / error` 这类真正影响 UI 的阶段。

## 五、专题 2：高德安全密钥为什么要构建期注入

### 设计

- Web JS Key 通过 `VITE_AMAP_WEB_JS_KEY` 在运行时代码读取。
- Security JS Code 不写进 TS 常量；`index.html` 只保留模板占位符。
- Vite `transformIndexHtml` 在构建时替换占位符，未配置时写空串，构建产物不残留占位符原文。
- `.env.example` 只放空值模板，真实 `.env` 由 gitignore 排除。

### 关键认知

前端地图 Key 本身不是后端 Secret，仍需配合平台的域名白名单与安全配置。真正的服务端凭据不能通过“前端混淆”获得安全性，必须留在后端或 Secret Manager。

## 六、专题 3：两阶段长图导出如何保证可用性

### 数据流

```text
地图 DOM ──截图成功──> mapDataUrl ─┐
   └────截图失败────> 空地图数据 ───┤
                                  v
TripPlan ──> 纯净导出 DOM ──> html2canvas ──> PNG Blob ──> 下载
```

### 为什么分两次截图

高德地图含 WebGL Canvas、覆盖物和控制组件，直接截整个结果页容易得到黑块或白块。先单独捕获地图，可以只对地图失败做隔离；第二阶段仍能输出摘要、预算和逐日行程。

### 工程细节

- 地图初始化开启 `WebGLParams.preserveDrawingBuffer: true`。
- 导出 DOM 全部用 `textContent` 和 DOM API 构建，不把后端文案拼成 `innerHTML`，降低注入风险。
- `captureElement` 与 `downloadCanvas` 是可注入边界，单测不依赖真实 Canvas。
- `html2canvas` 动态加载，不进入结果页首包。
- scale 不是固定 2：在保证至少 1 倍的前提下，根据 3,600 万像素预算计算上限，避免 30 天长图占用数百 MB 内存。
- 文件名会清理 Windows 非法字符，格式为 `HelloJourney-{city}-{start_date}.png`。

### 取舍

html2canvas 是 DOM 重绘而不是浏览器原生截屏，跨域图片、WebGL 和极端 CSS 仍可能不完全一致。因此产品承诺是“地图失败可降级”，不是“任何浏览器都百分之百还原地图”。

## 七、专题 4：编辑后如何让地图、图谱、预算保持一致

### 问题本质

最容易犯的错是：编辑器更新了自己的局部 state，但地图继续读初始计划、图谱继续读后端旧 `graph_data`、预算继续读初始总额。页面看起来每个组件都正常，数据却已经互相矛盾。

### 单一事实源

```text
workspaceReducer.present
          |
          v onPlanChange
   Result.tripPlan
     |       |        |
     v       v        v
  TripMap  Graph   Live Budget
```

- `EditableTripDays` 每次编辑、undo、redo 都把最新 `present` 交给 Result。
- `TripMap` 与 `KnowledgeGraph` 都是受控组件。
- 图谱有“服务器版本有效期”：当前计划签名等于原始计划时优先使用后端图谱；发生编辑后，后端图谱视为过期，改用 `buildFallbackGraphData(currentPlan)`；撤销到原始版本会自动恢复后端图谱。
- 预算不直接把后端总额丢掉，而是计算：`新分类预算 = 后端基准分类 + 当前明细合计 - 原始明细合计`。这样景点门票、酒店、餐饮会实时变化，交通等无法从现有 DTO 拆分的估算仍保留。

### 为什么用计划签名而不是一个 dirty 布尔值

dirty 布尔值只能表示“改过”，无法知道用户是否通过 undo 回到了原始状态。对计划做确定性签名比较后，回到原始内容时 dirty 会自然归零，后端图谱也能重新启用。

## 八、专题 5：i18n 如何避免四套语言状态互相打架

### 单一语言源

i18next 是唯一语言状态，其他系统都是派生状态：

```text
i18next.language
  ├─ React t()
  ├─ Ant Design zhCN / enUS / jaJP
  ├─ Day.js zh-cn / en / ja
  ├─ document.documentElement.lang
  └─ TripFormData.language
```

### 关键设计

- 默认中文，支持 `zh / en / ja`，统一做 language-only 归一化。
- `hj.locale` 写入 localStorage，首屏初始化时恢复。
- 三份 JSON 的 key 做数量和差异校验，本轮均为 345 个 key。
- 类组件错误边界用 `Translation` render prop，不为了 i18n 强行重写组件生命周期。
- 已生成的行程是后端业务数据，不在前端做机器式替换；切换 UI 语言后提示“重新生成可获得目标语言行程”。

### 为什么不把中文业务值也改成英文枚举

现有后端契约仍以“公共交通、经济型酒店、历史文化”等值接收。此次只翻译展示标签，提交值保持兼容；请求中的 `language` 单独告诉后端目标输出语言。这样没有偷偷改变后端协议。

## 九、专题 6：设置页如何体现安全意识

### 做了什么

- 只调用现有 `GET /api/settings`。
- 展示激活 Provider、各 Provider 的 `configured / active`，以及腾讯、Google、小红书配置状态。
- 未配置时展示服务端申请与部署指引。
- 页面没有 textbox、password input、保存按钮或写接口。

### 为什么不照抄 TripStar 的 Key 编辑页

浏览器表单会让 Secret 进入前端状态、DevTools、日志或网络请求，和 HelloJourney 后端“生产默认禁写、响应脱敏”的安全模型冲突。正确边界是：前端告诉管理员“缺什么、去哪里申请、配置后如何确认”，真正的值由部署环境或 Secret Manager 注入。

## 十、专题 7：如何把知识图谱包体积降低约 53%

### 证据

- 优化前：`1,142.47 kB / gzip 379.59 kB`。
- 优化后：`532.74 kB / gzip 179.54 kB`。
- 原有大于 600 kB 构建警告消失。

### 原因与修复

原实现虽然对 KnowledgeGraph 做了路由内懒加载，但 `echarts-for-react` 默认入口仍导入完整 ECharts。优化后改用 `echarts-for-react/lib/core`，并按 ECharts 官方 tree-shaking API 只注册：

- `GraphChart`
- `TooltipComponent`
- `CanvasRenderer`

这说明“做了 lazy”不等于“包已经小”；仍要看懒加载 chunk 内部是否全量引入依赖。

## 十一、专题 8：测试与质量门禁

每个功能完成后都执行：

```bash
npm run typecheck
npm run lint
npm run test -- --pool=threads --maxWorkers=1
npm run build
```

测试重点不是只看快照，而是覆盖风险边界：

- 地图：无 Key、无坐标、Driving → Walking、Walking → 直线。
- i18n：即时切换与 localStorage 持久化。
- 导出：安全文件名、版本化 JSON、地图失败降级、临时 DOM 清理、像素预算。
- 工作区：新增后数据源变化、undo 恢复、预算差量和计划签名。
- 预约：角标显示、Tooltip 内容。
- 设置：状态渲染且不存在 Secret 输入框。

## 十二、Vue 到 React 的翻译思路

| Vue 3 | React 19 实现 | 本项目例子 |
| --- | --- | --- |
| `onMounted / onBeforeUnmount` | `useEffect` + cleanup | 地图创建、事件解绑、`destroy()` |
| `ref / reactive` | `useState / useRef` | UI phase 与地图实例分离 |
| `computed` | `useMemo` 或纯派生函数 | 有效坐标、图谱与预算 |
| `watch` | effect 依赖或受控 props | 行程变更后重建地图 |
| `v-if / v-for` | 条件渲染 / `map` | 降级卡、服务状态列表 |
| Vue message | Ant Design `message` | 导出成功、失败与降级提示 |

真正的迁移不是语法替换，而是重新确定“谁拥有状态、谁管理副作用、何时清理资源”。

## 十三、高频面试问答

### Q1：这次最难的问题是什么？

最难的不是把地图显示出来，而是保证它在 StrictMode、编辑刷新、路线失败和截图场景下都稳定。我的解法是把业务数据保持声明式，第三方实例隔离在 effect 内；先渲染 Marker，再异步补路线；所有外部资源都有对称 cleanup；失败按 Driving、Walking、直线、占位卡逐级收敛。

### Q2：为什么地图路线要分三级？

Driving 更符合跨景点出行，但步行景点或数据缺失时可能无结果；Walking 能覆盖一部分；直线虽然不代表真实道路，却保证用户至少能看到访问顺序和空间关系。降级目标不是“结果完全等价”，而是“核心信息持续可用”。

### Q3：如何证明联动不是偶然生效？

编辑器只向外输出 reducer 的 `present`，Result 是统一上层状态；地图、图谱、预算全部从它派生。测试会观察新增景点后 `onPlanChange` 收到两项景点，undo 后最后一次输出恢复为一项；预算和计划签名另有纯函数测试。

### Q4：为什么不用全局状态库？

当前跨组件共享范围只在 Result 页面，父组件提升状态已经足够，增加全局库会引入更多同步与持久化边界。工作区复杂历史仍由 reducer 管理；如果未来跨路由协作、多人编辑或服务端缓存增多，再引入 Zustand/Redux Query 更合理。

### Q5：图片导出为什么不直接截图整个页面？

页面包含交互控件、深色主题、隐藏页签和 WebGL 地图，直接截会把无关 UI 和浏览器兼容问题一起带入。纯净导出 DOM 能稳定控制版式，两阶段地图截图能独立降级，也便于单测。

### Q6：有哪些安全细节？

安全密钥不进入 TS 常量；构建模板未配置时写空串；导出 DOM 用 textContent；知识图谱 Tooltip 对外部内容做 HTML 转义；设置页不提供 Secret 输入和写接口；所有提交做敏感模式扫描，`.env.example` 只有占位。

### Q7：还有什么没做？

本轮本机没有真实高德 Web JS Key，因此真实暗色底图、道路路线和含地图 PNG 仍需在配置 Key 的浏览器环境做最终视觉复核。后端返回的行程正文不会随 UI 切换自动翻译，这是明确的产品取舍；另外可继续把 bundle budget 和 Lighthouse 门禁加入 CI。

## 十四、STAR 叙述模板

### 地图稳定性

- **S**：需要把 Vue 项目的地图能力迁移到 React，且 StrictMode 下不能双实例或黑屏。
- **T**：实现真实路线、卡片联动、编辑刷新、截图支持和失败降级。
- **A**：建立 AMap 适配层；effect 对称清理；Marker 先行；Driving/Walking/Polyline 三级降级；WebGL 保留缓冲区。
- **R**：地图无 Key、无坐标和路线失败均可预测，相关适配层与降级测试通过，地图 chunk 仍保持懒加载。

### 数据联动

- **S**：可编辑行程上线后，地图、图谱和预算可能显示旧数据。
- **T**：让增删改、跨天移动、酒店修改、undo/redo 都实时一致。
- **A**：以 reducer.present 为唯一事实源；后端图谱增加有效期判断；预算使用后端基准与明细差量。
- **R**：切页签后仍读取最新计划，undo 到原始计划时图谱和预算自动恢复原始语义。

### 性能优化

- **S**：构建报告显示知识图谱 chunk 超过 1.14 MB。
- **T**：在不删功能的前提下降低首次进入图谱的下载和解析成本。
- **A**：保留懒加载，进一步将 ECharts 改为 core 模块化注册，只引入 Graph、Tooltip、Canvas。
- **R**：chunk 原始体积和 gzip 均下降约 53%，构建警告消失，25 个测试全部通过。

## 十五、面试时不要夸大的边界

- 不要说“地图永远是真实道路路线”；应说“优先真实道路，失败会降级并明确展示”。
- 不要说“前端保存 Key 也安全”；应说“Web Key 配合域名限制，服务端 Secret 永不进入浏览器”。
- 不要说“切换语言会翻译已有 AI 内容”；应说“UI 即时切换，重新生成时后端按目标语言输出”。
- 不要说“所有浏览器截图完全一致”；应说明 html2canvas 和 WebGL 的兼容边界。
- 不要把本轮改动说成后端改造；本轮只修改了前端与这份新增文档。

## 十六、最终记忆卡

1. **地图**：受控计划、StrictMode cleanup、真实路线三级降级、永不白屏。
2. **i18n**：i18next 单源，AntD/Day.js/document/request 五端同步。
3. **导出**：地图先截、正文后截、失败只降级地图、像素预算控内存。
4. **联动**：workspace.present → Result → 地图/图谱/预算；签名让 undo 真正恢复。
5. **安全**：模板注入、textContent、Tooltip 转义、Settings 只读。
6. **性能**：不要只做 lazy，要测 lazy chunk 内部；ECharts 模块化下降约 53%。
7. **质量**：每项 typecheck + lint + 单 worker test + build，25 tests。
