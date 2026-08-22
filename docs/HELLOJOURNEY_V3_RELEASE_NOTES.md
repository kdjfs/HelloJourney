# HelloJourney V3 发布说明（Release Notes）

> 本文档为 `test/hello-journey-v3-upgrade` → `main` 合并前的发布记录。
> 合并动作尚未执行：本文档、版本保护标签与 `MERGE_PLAN.md` 均待人工确认。

## 版本信息

| 项 | 值 |
| --- | --- |
| 版本 | **HelloJourney V3**（含 V3.1 景点图片真实性升级与 UI 打磨） |
| 日期 | 2026-08-21 |
| 来源分支 | `test/hello-journey-v3-upgrade` |
| 目标分支 | `main` |
| 来源分支 HEAD | `6131112` fix(ui): force dark hotel text on white card for readability |
| main HEAD（合并基线） | `a479cba` docs: 补充了 HelloJourney 项目三个子模块的完整说明文档（2026-05-23） |
| 版本关系 | main 是来源分支的祖先（`git merge-base` = `a479cba`），main 无独有提交 → 合并为干净 fast-forward，预期无冲突 |
| 差异规模 | 31 个提交，153 个文件，+18,462 / -2,110 行 |
| 远程仓库 | https://github.com/kdjfs/HelloJourney.git |

---

## 新增功能

### 1. AI 旅行规划能力升级（Agent 化）

- 原生 **Tool Calling** 协议（不再是 `[TOOL_CALL:xxx]` 文本）：`AgentLoop` + `ToolRegistry` + `ToolExecutor`，8 次迭代上限、超时、重试、重复调用去重、取消与 trace ID。
- 白名单工具：`get_weather`、`search_poi`、`search_hotel`、`search_restaurant`、`geocode`、`route_plan`；模型只能调用白名单工具，不能触碰任意 Java 方法。
- **Structured Output**：TripPlan 经 JSON Schema（`backend/src/main/resources/schemas/trip-plan-v3.schema.json`）+ Java DTO + 手工业务校验；严重错误进入有限修复流程，不会作为成功计划返回。
- **Review Agent**：校验日期、城市、坐标、时间冲突、预算复算、用户预算上限、酒店、路线提示、天气日期与虚假 verified 声明，输出 `pass / warnings / errors`。
- **Partial Replan（局部重规划）**：`POST /api/trip/plans/{planId}/replan` 只返回白名单 Change Set，前端展示 Before/After，由用户 Apply 或 Reject；AI 不能直接覆盖用户行程。
- 异步任务体系：独立 `TripPlanningJobService`、有界线程池、任务状态机（processing/completed/failed/cancelled/timeout）、幂等键、取消、本地 JSON 任务持久化、WebSocket 实时进度（断线重连 2 次后轮询收敛）。

### 2. 行程工作区（Travel Workspace）

- Landing 支持：单城市/多城市（途经城市 + 路线回显）、日期区间（中文日历、自动校验）、人数、预算、交通、住宿、兴趣偏好、自然语言补充说明。
- Result 六大页签：概览、预算、天气、每日行程、知识图谱、AI 助手 + Agent 执行动态。
- **每日行程可编辑**：新增/编辑/删除/排序景点、调整时间与停留时长、跨天移动、修改酒店。
- **Undo/Redo**：纯 reducer 管理，最多 50 个历史快照；草稿按 Plan ID 存浏览器 localStorage。
- 版本化 JSON 导出与浏览器打印/PDF。

### 3. 景点图片真实性系统（V3.1）

- 新接口 `GET /api/poi/photo`（name + city 必填，poiId 可选），返回 `imageUrl / provider / matchedName / matchedPoiId / confidence / verified`。
- **高德 POI 2.0（v5/place/text）图片 Provider**：强制"城市一致 + 官方名称/官方别名精确匹配"才返回照片；支持口语后缀变体（如 长隆野生动物园 ↔ 官方"长隆野生动物世界"、华南植物园 ↔ "华南国家植物园"，置信度 0.95）；高德 CDN 的 http 图片自动升级为 https；进程内 1000 条 LRU 正负缓存（24h / 10min TTL）。
- 前端只展示已验证图片；无 Key / 无匹配 / 加载失败一律显示确定性的"景点名 + 城市 + 等待图片补充"占位卡；Picsum 与随机图片逻辑全部移除。
- 真实高德 Key 联调验收：广州塔、长隆野生动物园、陈家祠、北京路步行街、白云山、越秀公园、华南植物园、海珠湖公园 8/8 返回 `verified=true` 真实照片。

### 4. AI 聊天助手

- 结果页悬浮按钮（DeepSeek 官方 Logo），对话基于当前行程上下文，快捷问题 + 自由输入。
- 知识图谱页内嵌「AI 图谱解读」：快捷问题 + 自由提问，复用后端 `/api/chat/ask`（DeepSeek 经后端调用，前端不持有密钥）。

### 5. 预算 Dashboard

- 总价 + 五个分类（景点门票/酒店住宿/餐饮美食/市内交通/跨城交通）彩色占比条；深色主题重设计。

### 6. 天气建议

- 每日天气面板（天气图例、温度、降水/湿度/风力推算展示），数据带 `source/provider/verification_status` 来源标签。

### 7. 知识图谱优化

- 全量 ECharts 渲染（力导向图）；节点点击显示详情面板；后端无 graph_data 时前端按行程数据兜底生成图谱；深色主题节点/边标签修正；渲染失败降级提示。

### 8. 工程化与部署

- GitHub Actions CI（Frontend lint/typecheck/test/build、Backend verify、UniApp build）。
- 前后端多阶段 Dockerfile、Nginx 同源反向代理（含 WebSocket、CSP 等安全响应头）、healthcheck、`docker-compose.dev.yml`。
- `package-lock.json` 提交、Vitest + Testing Library、ESLint 配置。
- 安全边界：Settings 接口不返回 Secret、生产默认禁写 Secret（Admin Token 可选）、错误响应与日志脱敏、CORS/WebSocket Origin 显式配置。

---

## 修改文件清单

> 类型：A=新增，M=修改，D=删除。共 153 个文件（A 88 / M 65 / D 0）。

### 文档与部署（仓库根 / docs / .github）

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `.env.production.example` | A | 生产环境变量模板（含 AMAP/Tencent/Google/LLM/XHS 占位） |
| `.github/workflows/ci.yml` | A | CI：前端 lint/typecheck/test/build、后端 verify、UniApp build |
| `.gitignore` | M | 忽略 .env、运行时设置、任务数据、本地反馈目录（含明文密钥的文件） |
| `HELLOJOURNEY_V3_1_IMAGE_UPGRADE.md` | A | V3.1 图片真实性升级报告（含真实 Key 联调修复章节） |
| `HELLOJOURNEY_V3_UPGRADE_REPORT.md` | A | V3 升级交付报告（架构、安全、评分、验收矩阵） |
| `LOCAL_RUN_GUIDE.md` | A | 本地 Docker 运行与 DeepSeek/高德 Key 配置指南 |
| `README.md` | M | 补充 V3 能力、接口与运行说明 |
| `docker-compose.dev.yml` | A | 本地前后端容器编排（含 AMAP_API_KEY 注入、healthcheck、数据卷） |
| `docs/DEPLOYMENT.md` | A | 生产部署步骤、Secret 管理、监控、回滚 |
| `docs/V3_BASELINE.md` | A | V3 升级前基线审计记录 |
| `docs/adr/0001-native-tool-calling.md` | A | ADR：原生 Tool Calling 架构决策 |
| `docs/adr/0002-structured-trip-plan-and-review.md` | A | ADR：结构化计划与 Review Agent 决策 |

### 后端：Agent 与规划

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `agent/TripPlannerAgent.java` | M | 编排研究/规划/审查流程，接入 Tool Calling 与 Review |
| `agent/planning/SchemaViolation.java` | A | Schema 违规描述模型 |
| `agent/planning/StructuredPlanException.java` | A | 结构化计划异常类型 |
| `agent/planning/StructuredTripPlanResult.java` | A | 结构化计划结果封装 |
| `agent/planning/StructuredTripPlanService.java` | A | 结构化输出生成、修复与阻断 |
| `agent/planning/TripPlanJsonSchemaValidator.java` | A | TripPlan JSON Schema 校验 |
| `agent/planning/TripReviewAgent.java` | A | 业务审查 Agent（预算/时间/来源标签） |
| `agent/tool/AgentEvent.java` | A | 安全 Agent 事件流 |
| `agent/tool/AgentEventType.java` | A | Agent 事件类型枚举 |
| `agent/tool/AgentLoop.java` | A | 原生 Tool Calling 循环（迭代上限/去重/取消） |
| `agent/tool/AgentLoopException.java` | A | Agent 循环异常 |
| `agent/tool/AgentRunResult.java` | A | Agent 运行结果封装 |
| `agent/tool/JsonSchemaArgumentValidator.java` | A | 工具参数 JSON Schema 校验 |
| `agent/tool/ToolAction.java` | A | 工具动作模型 |
| `agent/tool/ToolCall.java` | A | 工具调用模型 |
| `agent/tool/ToolDefinition.java` | A | 工具定义（name/schema/描述） |
| `agent/tool/ToolExecutor.java` | A | 工具执行器（超时/重试/失败映射） |
| `agent/tool/ToolRegistry.java` | A | 白名单工具注册表 |
| `agent/tool/ToolResult.java` | A | 工具结果模型 |

### 后端：配置 / 控制器 / 模型 / 服务

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `config/AppSettings.java` | M | 增加高德图片配置、Agent 配置、Secret 安全开关 |
| `config/AsyncExecutionConfig.java` | A | 有界异步线程池（消除 @Async self-invocation） |
| `config/CorsConfig.java` | M | CORS 显式来源与白名单头 |
| `config/RuntimeSettingsManager.java` | M | 运行时设置脱敏与持久化边界 |
| `config/WebSocketConfig.java` | M | WebSocket Origin 校验 |
| `controller/PartialReplanController.java` | A | 局部重规划接口（白名单 Change Set） |
| `controller/PoiController.java` | M | `/api/poi/photo` 升级为城市必填的新协议 + 边界校验 |
| `controller/SettingsController.java` | M | 设置读写脱敏、Admin Token 授权 |
| `controller/TripController.java` | M | 异步任务、幂等键、取消、历史、状态恢复 |
| `model/dto/TripRequest.java` | M | 支持多城市 CityStay、预算上限等字段 |
| `model/dto/replan/PartialReplanContracts.java` | A | 局部重规划 Change Set 契约 |
| `model/entity/Attraction.java` | M | 增加验证元数据字段（source/provider/verified_at 等） |
| `model/entity/DayPlan.java` | M | 支持跨天转移与验证元数据 |
| `model/entity/Hotel.java` | M | 验证元数据字段 |
| `model/entity/Meal.java` | M | 验证元数据字段 |
| `model/entity/WeatherInfo.java` | M | 天气来源标签与验证状态 |
| `model/llm/LlmApiException.java` | A | LLM API 异常（429/401/5xx 映射） |
| `model/llm/LlmChatRequest.java` | A | Chat Completion 请求 DTO |
| `model/llm/LlmChatResponse.java` | A | Chat Completion 响应 DTO |
| `model/llm/LlmChatResult.java` | A | Chat 结果封装 |
| `model/llm/LlmFunctionCall.java` | A | 函数调用模型 |
| `model/llm/LlmMessage.java` | A | 消息模型（含 tool_calls） |
| `model/llm/LlmToolCall.java` | A | 工具调用模型 |
| `model/llm/LlmToolDefinition.java` | A | 工具定义模型 |
| `model/llm/LlmUsage.java` | A | token 用量模型 |
| `model/vo/AttractionImageResult.java` | A | 景点图片解析结果 VO（verified/confidence 等） |
| `model/vo/TripPlanResponse.java` | M | 增加 graph_data 与 review 结果 |
| `model/vo/review/ReviewIssue.java` | A | 审查问题模型 |
| `model/vo/review/ReviewSeverity.java` | A | 严重级别枚举 |
| `model/vo/review/TripReviewResult.java` | A | 审查结果 VO |
| `service/LlmService.java` | M | DeepSeek/OpenAI-compatible 客户端（超时/重试/日志脱敏） |
| `service/MapDispatcher.java` | M | 地图 Provider 分发与降级 |
| `service/PartialReplanService.java` | A | 局部重规划服务（白名单校验） |
| `service/TripPlanningJobService.java` | A | 异步行程任务服务（图构建 + 进度转发 + 取消） |
| `service/image/AmapAttractionImageProvider.java` | A | 高德 POI 2.0 图片 Provider（城市/名称/别名/HTTPS 校验 + 后缀变体） |
| `service/image/AttractionImageProvider.java` | A | 图片 Provider 稳定接口 |
| `service/image/AttractionImageService.java` | A | Provider 编排 + 1000 条 LRU 正负缓存 |
| `websocket/TripTaskWebSocketHandler.java` | M | WS 快照、订阅、失败后重连语义 |
| `resources/application-dev.yml` | M | 开发配置 |
| `resources/application-prod.yml` | M | 生产配置（优雅关闭/压缩/Actuator/CORS） |
| `resources/application.yml` | M | 新增 amap-maps、agent、llm providers 配置块 |
| `resources/schemas/trip-plan-v3.schema.json` | A | TripPlan JSON Schema（V3） |

### 后端：测试

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `test/.../agent/TripPlannerAgentTest.java` | M | Agent 编排测试扩展 |
| `test/.../agent/planning/PlanningTestData.java` | A | 规划测试数据工厂 |
| `test/.../agent/planning/StructuredTripPlanServiceTest.java` | A | 结构化输出与修复测试 |
| `test/.../agent/planning/TripPlanJsonSchemaValidatorTest.java` | A | Schema 校验测试 |
| `test/.../agent/planning/TripReviewAgentTest.java` | A | 审查 Agent 测试 |
| `test/.../agent/tool/AgentLoopTest.java` | A | Tool Calling 循环测试 |
| `test/.../agent/tool/ToolExecutorTest.java` | A | 工具执行/重试/白名单测试 |
| `test/.../config/AppSettingsTest.java` | M | 配置测试扩展 |
| `test/.../config/AsyncExecutionConfigTest.java` | A | 异步配置测试 |
| `test/.../config/RuntimeSettingsManagerTest.java` | M | 设置脱敏测试 |
| `test/.../controller/PoiControllerTest.java` | M | 新图片协议与参数边界测试 |
| `test/.../controller/SettingsControllerTest.java` | M | 安全设置测试 |
| `test/.../controller/TripControllerTest.java` | A | 异步任务/幂等/错误测试 |
| `test/.../service/LlmServiceTest.java` | M | LLM 客户端测试扩展 |
| `test/.../service/MapDispatcherTest.java` | M | 地图分发降级测试 |
| `test/.../service/PartialReplanServiceTest.java` | A | 局部重规划白名单测试 |
| `test/.../service/TripPlanningJobServiceTest.java` | A | 任务服务测试 |
| `test/.../service/image/AmapAttractionImageProviderTest.java` | A | 高德图片 Provider 测试（9 用例，含真实 Key 联调后新增的 http→https 与后缀变体） |
| `test/.../service/image/AttractionImageServiceTest.java` | A | 缓存与确定性空结果测试 |
| `test/.../websocket/TripTaskWebSocketHandlerTest.java` | M | WS 订阅/快照测试 |

### 前端：基础设施与入口

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `frontend/Dockerfile` | A | 多阶段构建（node build + nginx 运行） |
| `frontend/.dockerignore` | A | 构建上下文裁剪 |
| `frontend/.gitignore` | M | 前端忽略规则 |
| `frontend/README.md` | M | 前端说明更新 |
| `frontend/docs/API.md` | M | 新图片接口协议文档 |
| `frontend/eslint.config.js` | M | ESLint 配置 |
| `frontend/nginx.conf` | A | SPA 反代 + WebSocket + 安全响应头 + healthz |
| `frontend/package-lock.json` | A | 依赖锁定 |
| `frontend/package.json` | M | 依赖与脚本（vitest、testing-library、msw） |
| `frontend/src/main.tsx` | M | ConfigProvider：zhCN 中文 + 深色主题算法 + dayjs 中文 |
| `frontend/src/index.css` | M | 全局样式变量 |
| `frontend/src/styles/global.css` | M | 深色全局底色与基础样式 |
| `frontend/src/router/index.tsx` | M | 路由（Result 带 plan_id 恢复） |
| `frontend/src/types/api.ts` | M | 新协议类型（AttractionImageResult、Review、CityStay 等） |
| `frontend/src/test/setup.ts` | A | Vitest 全局 setup（jest-dom、matchMedia mock） |
| `frontend/tsconfig.app.json` | M | TS 配置 |
| `frontend/vite.config.ts` | M | 测试配置、代理、打包警告阈值 |

### 前端：页面与组件

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `pages/Landing/index.tsx` | M | 日期选择（动态默认值/中文/区间约束）、途经城市回显与路线预览、加载进度 |
| `pages/Landing/index.css` | M | 表单深色样式、路线预览、城市标签、天数芯片 |
| `pages/Result/index.tsx` | M | 图片预览组（Image.PreviewGroup）、图谱兜底数据接入、浅色主题局部配置、Spin 弃用清理 |
| `pages/Result/index.css` | M | 深色主题、白色卡片工作区、预算条、KG 详情/AI 框、聊天面板样式 |
| `components/AIChat/index.tsx` | M | DeepSeek 官方 Logo 悬浮按钮 + 纯色聊天面板（移除模糊遮罩） |
| `components/AppErrorBoundary/index.tsx` | A | 全局错误边界 |
| `components/AsyncState/index.tsx` | A | 异步状态展示 |
| `components/AttractionImage/index.tsx` | A | 统一景点图片组件：antd Image 预览 + 确定性占位卡 + 失败回退 |
| `components/AttractionImage/index.css` | A | 占位卡与预览遮罩样式 |
| `components/AttractionImage/index.test.tsx` | A | 占位与加载失败测试 |
| `components/BudgetPanel/index.tsx` | M | 深色重设计：总价 + 分类占比条（修复深色页面价格不可见） |
| `components/DeepSeekLogo.tsx` | A | DeepSeek 官方 Logo 共享组件（simple-icons，CC0） |
| `components/KnowledgeGraph/index.tsx` | M | 全量 ECharts、节点详情面板、AI 图谱解读（DeepSeek 后端问答）、渲染失败降级 |
| `components/OverviewAttractionCard/index.tsx` | M | 概览卡片（移除跳转箭头，接入预览组） |
| `components/TripDayCard/index.tsx` | M | 每日行程卡片（浅色主题残留清理、卡片类名） |
| `components/VerificationBadge/index.tsx` | A | 数据来源可验证标签（AI 建议/已验证） |

### 前端：features / services / mocks / utils

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `features/export/model/tripExport.ts` | A | 版本化 JSON 导出 |
| `features/export/model/tripExport.test.ts` | A | 导出测试 |
| `features/export/ui/TripExportActions.tsx` | A | 导出/打印操作按钮 |
| `features/trip-workspace/model/useTripWorkspace.ts` | A | 工作区 hook |
| `features/trip-workspace/model/workspaceReducer.ts` | A | 纯 reducer：undo/redo、景点增删改排序 |
| `features/trip-workspace/model/workspaceReducer.test.ts` | A | reducer 测试 |
| `features/trip-workspace/ui/EditableTripDays.tsx` | A | 可编辑每日行程 UI |
| `features/trip-workspace/ui/EditableTripDays.test.tsx` | A | 编辑与撤销测试 |
| `features/trip-workspace/ui/editableTripDays.css` | A | 工作区样式（白色信息卡片、深色文字） |
| `services/otherApi.ts` | M | 新图片协议接入 |
| `services/poiApi.ts` | M | `/api/poi/photo` 客户端 + 缓存键规范化 |
| `services/poiApi.test.ts` | A | 请求参数与缓存键测试 |
| `services/settingsApi.ts` | M | 设置接口类型同步 |
| `services/tripApi.ts` | M | 提交/轮询/WS/历史接口 |
| `mocks/handlers.ts` | M | Mock 改为确定性 verified=false（移除随机图片） |
| `mocks/mockData.ts` | M | Mock 数据清理 |
| `utils/knowledgeGraph.ts` | A | 行程数据兜底生成知识图谱 |
| `utils/knowledgeGraph.test.ts` | A | 兜底图谱生成测试 |

### UniApp

| 文件 | 类型 | 修改目的 |
| --- | --- | --- |
| `uniapp/src/api/poi.ts` | M | 同步新图片接口协议（城市必填） |
| `uniapp/src/api/settings.ts` | M | 设置接口同步 |
| `uniapp/src/pages/settings/settings.vue` | M | 设置页（密钥不再直接写入展示） |
| `uniapp/src/types/api.ts` | M | 类型同步 |

---

## 技术架构变化

### Frontend

- **主题体系**：全局 `ConfigProvider` 深色算法 + zhCN 中文；「每日行程」工作区局部浅色主题（白色信息卡片 + 深色文字）。
- **行程工作区**：从"生成后只读"改为可编辑、可撤销（纯 reducer + localStorage 草稿）、可局部重规划（Change Set 预览 Apply/Reject）。
- **图片链路**：`AttractionImage` 统一组件 + `Image.PreviewGroup` 灯箱（点击放大、左右切换）；失败回退确定性占位卡；删除 Picsum/随机图片。
- **知识图谱**：全量 ECharts 懒加载 chunk；节点点击详情；前端兜底生成图谱；内嵌 DeepSeek 问答（走后端）。
- **工程化**：Vitest + Testing Library + MSW（与真实 API 共用 TypeScript contract）、ESLint、lockfile、多阶段 Docker + Nginx。

### Backend

- **Agent 化**：原生 Tool Calling 循环 + 白名单工具注册表 + 结构化输出 + Review Agent + 有限修复。
- **异步任务**：独立 Job Service + 有界线程池 + 状态机 + 幂等键 + 取消 + 本地 JSON 持久化 + WebSocket 进度。
- **安全边界**：Settings 脱敏、生产禁写 Secret、Admin Token、错误/日志脱敏、CORS/Origin 显式白名单。
- **图片 Provider 端口**：`AttractionImageProvider` 接口 + 高德实现 + LRU 正负缓存，后续可扩展其他图片源。

### AI

- 默认 Provider：DeepSeek（`deepseek-v4-pro`，`https://api.deepseek.com`，OpenAI-compatible）；支持 GLM/MiniMax/豆包/OpenAI/Grok/Kimi/百炼/硅基流动等多 Provider 配置。
- Tool Calling → Structured Output → Review 的受控链路；模型输出经过 Schema + 业务双重校验。
- 所有 LLM 密钥仅存后端环境变量，浏览器与前端 bundle 不含任何 Secret。

### 第三方服务

- **高德开放平台**（新增）：POI 2.0 搜索（景点图片身份验证）。
- **腾讯地图 / Google Maps**（保留）：POI、地理编码、天气、路线（Agent 工具）。
- **小红书**（可选 Adapter，保留）：非 SLA 依赖，失败自动降级。

---

## Breaking Changes

| 项 | 是否破坏 | 说明 |
| --- | --- | --- |
| API：`GET /api/poi/photo` | **是** | 协议变更：`city` 改为必填；响应从旧的 `{name, photo_url}` 改为 `{imageUrl, provider, matchedName, matchedPoiId, confidence, verified}`。旧版前端/UniApp 需同步升级（本分支已同步） |
| API：`POST /api/trip/plan` | 是（扩展兼容） | 新增 `cities[]`（CityStay）与预算上限等字段；旧字段继续有效 |
| API：`POST /api/trip/plans/{planId}/replan` | 新增 | 新接口（无旧行为） |
| API：Settings 写入 | 是（收紧） | 生产默认禁止匿名写 Secret，需 Admin Token（`SETTINGS_ALLOW_SECRET_UPDATES=true` 时才启用） |
| 数据库 | **无** | 项目不使用数据库（无 JDBC 依赖），无迁移 |
| 配置文件 | 是 | 新增 `application.yml` 的 `app.amap-maps`、`app.agent` 配置块；新增 `docker-compose.dev.yml`；`.gitignore` 新增忽略项 |
| 环境变量 | 是 | 新增 `AMAP_API_KEY`、`AMAP_API_BASE_URL`；`LLM_*` Provider 配置扩展；详见下节 |

---

## 配置变化

新增/需关注的环境变量（**不要在任何文件中提交真实 Key**）：

| 环境变量 | 用途 | 必需性 |
| --- | --- | --- |
| `LLM_DEEPSEEK_API_KEY` | DeepSeek V4 Pro（默认 Provider） | 必需（不配则生成链路不可用） |
| `LLM_ACTIVE_PROVIDER` | 激活的 LLM Provider（默认 deepseek） | 可选 |
| `LLM_DEEPSEEK_BASE_URL` / `LLM_DEEPSEEK_MODEL` | DeepSeek 端点与模型 | 可选（有默认值） |
| `AMAP_API_KEY` | 高德 Web 服务 Key（景点图片验证） | 可选（不配则图片显示确定性占位卡） |
| `AMAP_API_BASE_URL` | 高德 API 端点（默认 https://restapi.amap.com） | 可选 |
| `TENCENT_MAPS_KEY` | 国内 POI/天气/路线 | 建议至少一个地图 Provider |
| `GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_PROXY` | Google Maps 备用 | 可选 |
| `XHS_COOKIE` / `XHS_XS` / `XHS_XS_COMMON` / `XHS_XT` | 小红书可选 Adapter | 可选，非 SLA 依赖 |
| `SETTINGS_ALLOW_SECRET_UPDATES` / `SETTINGS_ADMIN_TOKEN` | 受控 Settings 写入 | 生产默认 false |
| `TRIP_TASK_DATA_DIR` | 任务 JSON 持久化目录 | 可选（默认 data/trip_tasks） |
| `CORS_ALLOWED_ORIGINS` | 显式 CORS 白名单 | 生产建议配置 |
| `VITE_USE_MOCK` / `VITE_API_BASE_URL` | 前端 Mock 开关 / API 基址 | 构建期参数，**不得存放 Secret** |

配置方式：仓库根目录 `.env`（已被 .gitignore 忽略，docker compose 自动读取）或 Secret Manager 注入；`.env.example` / `.env.production.example` 为模板。真实 Key 仅存于本机 `.env`，未进入任何提交（已扫描验证）。

---

## 测试记录

### 本会话（2026-08-20 ~ 08-21）实测

| 范围 | 命令/验证 | 结果 |
| --- | --- | --- |
| Frontend | `npm run typecheck` | PASS |
| Frontend | `npm run lint` | PASS，0 error |
| Frontend | `npm test -- --pool=threads --maxWorkers=1` | PASS，**6 files / 12 tests** |
| Frontend | `npm run build`（VITE_USE_MOCK=false） | PASS（KnowledgeGraph 懒加载 chunk 约 1MB，超出 600kB 警告阈值，不阻塞） |
| Backend | `mvn test`（JDK 17 + Maven 3.9.5） | PASS，**152 tests / 0 failure / 0 error** |
| Backend | `mvn package -DskipTests` | PASS |
| Docker | `docker compose -f docker-compose.dev.yml up -d` | PASS，frontend/backend 均 healthy |
| Docker | 离线覆盖镜像构建（旧镜像基底 + 新产物） | PASS（Docker Hub 不可达期间的替代路径） |
| 运行时 | `/healthz`、`/api/trip/health`、`/api/poi/photo` | PASS / HTTP 200 |
| 真实图片 E2E | 8 个白名单景点经 5173 解析 | **8/8 `verified=true`**，图片 URL 抽样 HTTP 200 |
| 真实 DeepSeek E2E | `POST /api/trip/plan`（广州 2 日） | PASS，任务 completed，Agent Loop 真实 tool calls |
| 真实 DeepSeek E2E | `POST /api/chat/ask` | PASS，中文回复正常 |
| 浏览器验收 | 概览/每日行程/预算/天气/知识图谱/AI 助手 | 已按用户反馈多轮修复；**最终视觉确认待用户复核** |

### 历史记录（codex 审计，摘自 `HELLOJOURNEY_V3_UPGRADE_REPORT.md`）

| 范围 | 结果 |
| --- | --- |
| Frontend `npm audit --omit=dev` | 0 vulnerabilities |
| UniApp `npm run build:mp-weixin` | PASS（仅 Sass legacy API 警告） |
| Docker `docker compose config --quiet` | PASS |
| 浏览器 Mock 主流程 | 生成 → Result → 景点新增/undo → Replan 预览/reject → 验证标签 → 移动端 390×844 无溢出 |

### 已知环境备注

- Windows 本机 Maven 未入 PATH，测试使用 IntelliJ 自带 Maven 3.9.5 + JDK 17（`C:\Java\jdk-17`）。
- Vitest 默认并发在 Windows 下无输出，全量测试用单 worker 完成。
- 本机 Docker Hub 连通性不稳定；镜像离线覆盖构建仅用于本地验证，正式环境请用常规 `docker compose up -d --build`。

---

## 发布前待办（合并前人工确认）

1. **历史疑似 Secret**：`HELLOJOURNEY_V3_UPGRADE_REPORT.md` §6 提到 Git 历史中曾发现一个疑似 OpenAI-style Secret（未输出值）。仓库所有者应在对应 Provider 控制台 revoke/rotate。本次对 31 个新提交的差异扫描未发现明文密钥。
2. 确认 `.env` 与 `智途星旅测试反馈/` 目录不被提交（均已 gitignore，已验证）。
3. 公网开放前必须补充：用户认证、Plan 所有权校验、API 限流、审计日志（见报告 §12）。
4. 本分支 UI 改动（日期/城市回显/预算/图谱/白色卡片等）请用户做最终视觉复核。
