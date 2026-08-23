# HelloJourney V3 升级基线

> 采集日期：2026-08-20（Asia/Shanghai）
> 当前分支：`test/hello-journey-v3-upgrade`
> 当前提交：`a479cba80b981450e1c1fe89e292baca0ca31b5d`
> 基线原则：本文件只记录现状和根因，不包含修复。

## 1. Git 与审计报告状态

- 基线开始时工作区干净，当前分支符合升级要求，不在 `main`。
- `frontend/public/mockServiceWorker.js` 当前内容与 `HEAD` 哈希一致。后续仍将其视为受保护文件，不做无关覆盖。
- 当前工作树及 `codex/hello-journey-audit-2026-08-20` 分支均无法通过 Git 读取 `HELLOJOURNEY_AUDIT.md`；该报告此前未进入可读取的 Git 对象。本基线依据上一轮已确认的 56/100 审计结论，并用本轮命令重新验证关键事实。
- 本轮禁止 merge/rebase/force push；所有 V3 改动只留在目标分支。

## 2. 工具链

| 工具 | 当前状态 | 影响 |
| --- | --- | --- |
| Node.js | `v22.19.0` | 可运行 Web/UniApp |
| npm | `8.19.4` | 可安装，但仓库忽略 lockfile，安装不可复现 |
| 默认 Java | `1.8.0_501` | 不满足项目 Java 17 要求 |
| Java 17 | `C:\Java\jdk-17`，实际运行 `17.0.18` | 本轮 Maven 验证显式使用该 JDK |
| Maven | PATH 中不存在 | 基线临时使用 Maven 3.9.11；应补 Maven Wrapper |

## 3. Frontend 基线

目录：`frontend/`

| 检查 | 结果 | 证据/备注 |
| --- | --- | --- |
| `npm install` | PASS | 303 packages；5 vulnerabilities（1 moderate、4 high） |
| `npx tsc -b --pretty false` | PASS | exit 0，无类型错误 |
| `npm run lint` | PASS with warning | 0 error、1 warning；`public/mockServiceWorker.js` 顶部 unused eslint-disable |
| `npm run build` | PASS | Vite 生产构建完成 |

主要构建产物：

- 主入口 JS：1,510,181 bytes。
- MSW browser chunk：427,685 bytes。
- 主 CSS：29,097 bytes。

基线问题：

- 没有独立 `typecheck`、`test` 脚本和前端自动化测试。
- `package-lock.json` 被 `.gitignore` 忽略。
- 直接依赖中存在已报告的高危版本区间，升级前需要逐项验证可达性和兼容性。
- Result/Landing 页面体积大，状态、API 契约和错误恢复仍与审计结论一致。

## 4. Backend 基线

目录：`backend/`

| 检查 | 结果 | 证据/备注 |
| --- | --- | --- |
| `mvn test` | FAIL | 117 tests / 1 failure / 3 errors / 0 skipped |
| `mvn package` | FAIL | 编译成功，但被同一组测试失败阻断 |
| `spring-boot:run` + dev Profile | PASS | Spring Boot 3.2.5、Java 17、端口 8000，约 3.9 秒启动 |
| `GET /health` | PASS | HTTP 200，`status=healthy` |
| `GET /actuator/health` | PASS | HTTP 200 |
| Swagger UI | PASS | `/swagger-ui/index.html` HTTP 200 |

### 4.1 失败测试与根因

全部失败集中于 `TripTaskWebSocketHandlerTest`：

1. `afterConnectionEstablished_taskNotFound_sendsErrorAndCloses`：Mockito `UnnecessaryStubbingException`。共享 setup stub 了 `session.getAttributes()`，该提前返回路径不使用它。
2. `afterConnectionEstablished_completedTask_sendsSnapshotAndCloses`：Mockito `UnnecessaryStubbingException`。共享 setup 和测试本身包含未使用 stub。
3. `afterConnectionClosed_removesSubscriber`：Mockito `UnnecessaryStubbingException`。该方法不读取 URI，共享 setup 仍 stub 了 `getUri()`。
4. `afterConnectionEstablished_processingTask_addsSubscriber`：订阅队列断言失败。测试把 `session.isOpen()` 设为 false，Handler 新建的后台线程立刻进入 `finally` 并删除队列，主测试线程与后台线程产生确定性不足的竞态。

测试问题背后对应真实实现风险：

- 每个 WebSocket 连接直接 `new Thread()`，没有 Spring 管理的有界线程池。
- `TaskState.subscribers` 是 `ArrayList`，被请求线程、规划线程和连接线程并发访问。
- 队列无界，发送异常被空 catch 吞掉。
- 订阅注册、快照、关闭和清理没有单一生命周期所有者。

### 4.2 其他后端基线

- `TripController.planTrip()` 在同一个 Bean 内直接调用自己的 `@Async runTripPlanningAsync()`。Spring 代理模式下 self-invocation 不触发异步 advice，当前接口不具备可信的真正异步语义。
- Surefire 启动警告 classpath 同时包含 `org.json` 与 Vaadin `android-json` 的 `JSONObject`。
- Maven 控制台中文在当前 Windows 编码下出现乱码，不影响测试判断，但影响 CI/问题诊断。
- 没有数据库和 Redis；活动任务在内存，历史/结果写本地 JSON。

## 5. UniApp 基线

目录：`uniapp/`

| 检查 | 结果 | 证据/备注 |
| --- | --- | --- |
| `npm install` | PASS with warnings | 767 packages；41 vulnerabilities（9 low、10 moderate、22 high）；Vue Router peer dependency 警告 |
| `npm run build:mp-weixin` | PASS with warnings | 微信小程序构建完成；Dart Sass legacy JS API 弃用警告 |

基线问题：

- `package-lock.json` 被忽略。
- `pages/result/result.vue` 请求后端不存在的 `/api/trip/plan/{planId}`。
- 真机默认 `http://127.0.0.1:8000` 指向设备本身，只适合本机模拟。
- 设置页面仍允许录入服务器 Secret，与生产安全边界冲突。

## 6. 安全基线

### 6.1 信任边界

```text
普通 Web/UniApp 客户端
  -> 匿名 /api/settings
  -> RuntimeSettingsManager
  -> 明文 runtime_settings.json / AppSettings
  -> DeepSeek、其他 LLM、地图与小红书外部服务
```

当前风险：

- `GET /api/settings` 和 `/api/settings/llm-providers` 返回 Provider `api_key`，同时返回地图 Key、Cookie 和签名类配置。
- `PUT /api/settings` 匿名可用，能修改 Provider Key、base URL、模型和地图/小红书凭证。
- 错误响应把 `e.getMessage()` 拼回客户端。
- `runtime_settings.json` 已在 `backend/.gitignore` 中，但内容明文写盘；文件不存在时不代表设计安全。
- WebSocket Origin 为 `*`；HTTP CORS 允许全部 method/header。
- 没有 Spring Security、管理员身份或资源所有权。

### 6.2 Git 历史 Secret 扫描

对全部 28 个可见提交的配置路径执行了高可信模式扫描，没有打印任何 Secret 值。结果：

- 检出 1 个唯一、非占位形态的 OpenAI-style Secret。
- 它在 `application.yml` 的 14 个历史提交中可见。
- **必须由用户在对应 Provider 控制台立即 revoke/rotate。** 仅删除当前文件或改写本地 Git 历史不能替代轮换。
- 本轮不擅自改写远程历史，不在报告中提供该值或指纹。

## 7. DeepSeek 当前状态

- 活跃 Provider：`deepseek`。
- 当前模型：`deepseek-chat`。
- 当前 Base URL 配置含 `/v1`；`LlmService` 再拼接 `/chat/completions`。
- 当前 Client 只发送基础 messages/temperature/max_tokens，未建模 tool calls、structured output、reasoning content、usage、request ID 和稳定错误类型。
- DeepSeek 官方文档已确认 `deepseek-chat` 于 2026-07-24 停用；V4 Pro 模型名为 `deepseek-v4-pro`，OpenAI 格式 Base URL 为 `https://api.deepseek.com`，支持 JSON Output 与 Tool Calls。来源：
  - https://api-docs.deepseek.com/quick_start/pricing-details-cny/
  - https://api-docs.deepseek.com/api/create-chat-completion/

当前没有真实 DeepSeek Key 验证条件；最终状态必须表述为 integration ready / credential required，不能伪造真实调用成功。

## 8. Agent 当前状态

- `TripPlannerAgent` 串行获取各城市景点、天气、酒店信息，再用一个大 Prompt 生成 TripPlan。
- 天气与酒店角色要求模型返回 `[TOOL_CALL:...]` 文本，但 Java 端没有解析并执行该协议的工具循环。
- 行程结构依赖从 Markdown/文本中正则抓取 JSON、多轮本地修补和 LLM 补全；这不是 Structured Output 合约。
- 用户输入与外部小红书内容直接进入 Prompt，缺少 untrusted data 边界。
- 没有 max iterations、工具 allowlist、schema 参数校验、重复调用保护、取消、Agent trace 或 Review Agent。
- 前端进度只消费 status/stage/progress/message，尚未形成安全的 Agent Event Timeline。

## 9. Phase 0 结论

V3 升级可以继续，但顺序不能调整：

1. 先封闭 Settings/Secret 边界并要求历史凭证轮换。
2. 再修异步任务和 WebSocket 的正确性，使后端测试全绿。
3. 然后迁移 DeepSeek V4 Pro Client，先完成无凭证 Mock 契约测试。
4. 在稳定 Client 上实现受限 Tool Calling、Structured TripPlan 和 Review。
5. 最后建立 Travel Workspace 与部署基线。
