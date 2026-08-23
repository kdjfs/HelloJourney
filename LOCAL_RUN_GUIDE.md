# HelloJourney V3 本地验收 / 运行指南

> 分支：`test/hello-journey-v3-upgrade`
> 编写日期：2026-08-20
> 用途：让维护者在本地第一次真实跑起来并看到 V3 效果（含真实 DeepSeek 调用）。

---

## 0. 本次验收结论（先看这个）

本地已真实跑通，DeepSeek 是**真实调用**，不是 Mock：

| 项目 | 结果 |
|---|---|
| Docker Compose 校验 | `docker compose config --quiet` 通过 |
| 服务启动 | backend + frontend 两个容器均 `healthy` |
| 真实 DeepSeek 调用 | ✅ 成功（HTTP 200，`provider=deepseek model=deepseek-v4-pro`） |
| 旅行规划 Agent 主链路 | ✅ `POST /api/trip/plan` 202 → `completed`，Agent Loop 真实走了 3 轮 tool calls |
| Swagger | ✅ `/swagger-ui.html` 与 `/v3/api-docs` 均 200 |
| mysql / redis | ⚠️ 本项目**不使用**，见 §3 |

V3 的关键点（原生 Tool Calling、Structured Output、Review Agent、可验证来源标签）在本次本地运行中均已真实触发，日志和返回值都能看到证据。

---

## 1. Docker Compose 配置

配置文件只有一个：`docker-compose.dev.yml`（仓库根目录）。

它只定义 **两个服务**：

| 服务 | 端口映射 | 说明 |
|---|---|---|
| `backend` | `8000:8000` | Spring Boot，`SPRING_PROFILES_ACTIVE=dev`，挂载 `./data:/app/data` 持久化任务文件 |
| `frontend` | `5173:80` | Nginx，构建参数 `VITE_USE_MOCK=false`、`VITE_API_BASE_URL=""` |

关键环境变量（都在 `docker-compose.dev.yml` 的 `backend.environment`）：

- `LLM_ACTIVE_PROVIDER: deepseek`
- `LLM_DEEPSEEK_API_KEY: ${LLM_DEEPSEEK_API_KEY:-}` ← key 从本地 `.env` 注入
- `LLM_DEEPSEEK_BASE_URL: https://api.deepseek.com`（默认值已正确）
- `LLM_DEEPSEEK_MODEL: deepseek-v4-pro`（默认值已正确）
- `SETTINGS_ALLOW_SECRET_UPDATES: "false"`
- `TRIP_TASK_DATA_DIR: /app/data/trip_tasks`

> `frontend` 依赖 `backend` 的健康检查（`service_healthy`）通过后才启动；Nginx 把 `/api/*` 和 `/api/trip/ws/*` 反向代理到 `backend:8000`，所以前端和 API 是同源访问。

---

## 2. 启动全部服务

```bash
# 在仓库根目录执行
docker compose -f docker-compose.dev.yml up -d --build
```

首次会构建镜像（后端 Maven、前端 npm），已缓存后再次启动会很快。

常用命令：

```bash
docker compose -f docker-compose.dev.yml ps          # 看容器状态
docker compose -f docker-compose.dev.yml logs -f     # 看日志
docker compose -f docker-compose.dev.yml down        # 停止并删除容器（数据目录 ./data 保留）
```

---

## 3. 检查 frontend / backend / mysql / redis 状态

### frontend / backend

```bash
docker compose -f docker-compose.dev.yml ps
```

本次实测结果：

```
NAME                      IMAGE                   STATUS                        PORTS
hellojourney-backend-1    hellojourney-backend    Up (healthy)   0.0.0.0:8000->8000/tcp
hellojourney-frontend-1   hellojourney-frontend   Up (healthy)   0.0.0.0:5173->80/tcp
```

健康检查：

```bash
curl http://localhost:8000/health        # backend -> {"status":"healthy",...}
curl http://localhost:5173/healthz       # frontend(Nginx) -> ok
curl http://localhost:5173/api/trip/health   # 走 Nginx 反代到后端 -> {"status":"healthy"}
```

### mysql / redis

**本项目不包含 mysql 或 redis。** `docker-compose.dev.yml` 里没有这两个服务，后端也没有 JDBC/Redis 依赖。当前状态与持久化使用：

- 任务文件：本地 JSON，目录 `./data/trip_tasks`（容器内 `/app/data/trip_tasks`）
- 任务运行态：后端内存（单实例）
- 前端草稿：浏览器 localStorage

> 本机里看到的 `lfw-space-mysql-1` / `lfw-space-redis-1` 等容器属于**另一个项目**（`lfw-space`），与本项目无关，且已 Exited。不要把它们当成 HelloJourney 的依赖。

生产环境若要支持多实例，才需要引入 PostgreSQL/Redis + 任务队列（见升级报告 §12），这是后续阶段，不是本地验收范围。

---

## 4. 访问地址

| 入口 | 地址 |
|---|---|
| 前端（Web） | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| 后端系统信息 | http://localhost:8000/ （返回 `name/version/status/docs`） |

前端 Docker 构建时 `VITE_USE_MOCK=false`，因此打开 http://localhost:5173 后走的是**真实后端 + 真实 DeepSeek**，不是 MSW Mock。

> 说明：本地想用 Mock 演示时，不要在 Docker 里跑，直接用 `cd frontend && npm run dev`（开发态默认 Mock，`vite.config.ts` 会把 `/api` 代理到 `localhost:8000`）。

---

## 5. Swagger 地址

| 地址 | 说明 |
|---|---|
| http://localhost:8000/swagger-ui.html | Swagger UI（会 302 到下面的地址） |
| http://localhost:8000/swagger-ui/index.html | Swagger UI 实际页面 |
| http://localhost:8000/v3/api-docs | OpenAPI JSON（机器可读） |

实测均返回 200。

---

## 6. AI 接口位置

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/trip/plan` | POST | 提交旅行规划任务（异步，返回 `task_id` + `ws_url`）——V3 主链路 |
| `/api/trip/status/{taskId}` | GET | 轮询任务状态 / 拿结果 |
| `/api/trip/ws/{taskId}` | WebSocket | 实时进度推送 |
| `/api/trip/plans/{planId}/replan` | POST | 局部重新规划（返回需用户确认的 Change Set） |
| `/api/chat/ask` | POST | 基于行程上下文 AI 问答 |
| `/api/settings/llm-providers` | GET | 各 LLM Provider 是否已配置（只回布尔，不泄漏 key） |
| `/api/map/poi`、`/api/map/weather`、`/api/map/route` | GET/POST | 地图/天气/路线（需地图 key，否则降级） |

后端源码位置：

- `backend/src/main/java/com/hellojourney/controller/TripController.java`
- `backend/src/main/java/com/hellojourney/controller/ChatController.java`
- `backend/src/main/java/com/hellojourney/controller/PartialReplanController.java`
- `backend/src/main/java/com/hellojourney/service/LlmService.java`（真实 DeepSeek 客户端）
- `backend/src/main/java/com/hellojourney/agent/`（Agent Loop / Tool Registry / Review）

---

## 7. DeepSeek key 应该配置在哪里

**配置位置：仓库根目录的 `.env` 文件**（与 `docker-compose.dev.yml` 同级）。

`.env` 内容：

```bash
LLM_ACTIVE_PROVIDER=deepseek
LLM_DEEPSEEK_API_KEY=你的_sk_开头的_key
LLM_DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_DEEPSEEK_MODEL=deepseek-v4-pro
```

要点：

1. 该文件已被 `.gitignore` 忽略（`git status --ignored` 会显示 `!! .env`），**不会被提交**，所以 key 是安全的。
2. Docker Compose 会自动读取同目录的 `.env`，再通过 `${LLM_DEEPSEEK_API_KEY:-}` 注入后端环境变量。
3. 后端在 `application.yml` 里映射为 `app.llm.providers.deepseek.api-key`。
4. `base-url` 和 `model` 的默认值已经是正确的（`https://api.deepseek.com` + `deepseek-v4-pro`），**只填 key 就够**。
5. 你的 key（`sk-...`）同一个 key 既能走 OpenAI 兼容端点（本项目用的 `https://api.deepseek.com`），也能走 Anthropic 兼容端点（`https://api.deepseek.com/anthropic`）；本项目走的是前者。

其它（可选）注入方式：

- 直接在 shell 里 `export LLM_DEEPSEEK_API_KEY=...` 再 `docker compose up -d`。
- 用 `docker compose --env-file /path/.env ...` 指定别处文件。

> ⚠️ 本地这套 compose 里 `SETTINGS_ALLOW_SECRET_UPDATES=false`，所以**不能**通过 `/api/settings` 接口在运行时改 key；必须用 `.env` 注入。生产默认也不允许匿名写 Secret。

**验证 key 是否已生效**（不会泄漏 key 值）：

```bash
curl http://localhost:8000/api/settings/llm-providers
```

返回里 `deepseek` 那一项应为 `"configured": true, "active": true`。

---

## 7.1 高德 Key（景点真实图片）

景点图片走独立的可信链路：结果页按 `景点名 + 城市 + poiId` 调用 `GET /api/poi/photo`，后端用高德 POI 2.0 搜索验证"城市一致 + 官方名称/别名匹配"后才返回照片。

在 `.env` 增加（Key 从 [高德开放平台](https://console.amap.com/) 申请，服务平台选 **「Web服务」**）：

```bash
AMAP_API_KEY=你的高德web服务key
AMAP_API_BASE_URL=https://restapi.amap.com
```

- 不配置 Key 时，所有景点显示确定性的"景点名 + 城市 + 等待图片补充"占位卡，绝不显示随机图。
- 配置后重启容器即可生效：`docker compose -f docker-compose.dev.yml up -d --build`。
- 验证：`curl "http://localhost:5173/api/poi/photo?name=广州塔&city=广州"`，`data.verified` 应为 `true` 且 `imageUrl` 是 `https://store.is.autonavi.com/...` 或 `https://*.amap.com/...` 图片。

---

## 8. 本地真实调用 DeepSeek 的步骤

### 前置

- 已按 §7 配好 `.env`，并 `docker compose -f docker-compose.dev.yml up -d --build`。
- 确认 `curl http://localhost:8000/api/settings/llm-providers` 里 deepseek `configured=true`。

### 方式 A：最简单——AI 问答（约 20 秒，验证 key 通不通）

```bash
curl -X POST http://localhost:5173/api/chat/ask \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @- <<'JSON'
{
  "message": "请用一句话介绍北京故宫，并推荐一个最佳参观时间",
  "trip_plan": { "city": "北京", "days": [ { "day": 1, "attractions": ["故宫"] } ] }
}
JSON
```

预期：返回 `{"success":true,"reply":"..."}`，且是 DeepSeek 生成的中文回答。

> Windows Git Bash 里如果直接把中文 JSON 写在 `-d '...'` 里会出现 `Invalid UTF-8 middle byte` 报错，这是 shell 编码问题，不是后端问题；用 `--data-binary @文件`（文件存成 UTF-8）即可。

### 方式 B：V3 主链路——真实 Agent 旅行规划（约 1~2 分钟）

1）提交任务：

```bash
curl -X POST http://localhost:5173/api/trip/plan \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @- <<'JSON'
{
  "city": "杭州",
  "start_date": "2026-09-01",
  "end_date": "2026-09-02",
  "travel_days": 2,
  "transportation": "公共交通",
  "accommodation": "经济型酒店",
  "travelers": 2,
  "budget_limit": 3000,
  "preferences": ["自然风光", "美食"],
  "language": "zh"
}
JSON
```

返回 202，含 `task_id` 和 `ws_url`。

2）轮询状态（把 `TASK_ID` 换成上一步返回值）：

```bash
curl http://localhost:5173/api/trip/status/TASK_ID
```

- `processing` → 还没好，稍等再查。
- `completed` → 结果在 `result.data` 里（含 `days`、`hotel`、预算、来源标签等）。

3）（可选）实时进度：`ws_url` 是 `/api/trip/ws/{taskId}`，前端页面已经帮你订阅，浏览器打开 http://localhost:5173 提交一次行程即可看到实时进度条。

### 实测证据（本次）

- 方式 A：HTTP 200，17.1s，返回了关于故宫的中文介绍，并注明“行程中未提供该信息，以下是建议”。
- 方式 B：`POST /api/trip/plan` 返回 202，随后轮询到 `completed`。后端日志显示 Agent Loop 真实运行：`iterations=3 toolCalls=2 totalTokens=2273`，多次 `llm_call_succeeded provider=deepseek model=deepseek-v4-pro status=200`。
- 结果里景点/酒店带 `source: ai / provider: deepseek / verification_status: ai_suggested` 标签——这是 V3 的“来源可验证”机制（未配地图 key 时的降级表现）。

---

## 9. 一个需要你知道的边界

- 本次**没有配置地图 key**（`TENCENT_MAPS_KEY` / `GOOGLE_MAPS_API_KEY` 为空），所以天气/POI 工具会降级：日志出现“无法解析城市坐标”，最终结果里这些数据标注为 `ai_suggested`（AI 生成），而不是 `verified`（真实 Provider 数据）。
- 想让天气/路线/POI 变成“真实可验证”，在 `.env` 里补 `TENCENT_MAPS_KEY=...`（国内）或 `GOOGLE_MAPS_API_KEY=...`（海外）后重启即可。这是可选增强，不影响 DeepSeek 主链路。

---

## 10. 约束确认

- 未修改任何业务代码（只新增了本指南文档，和 gitignored 的 `.env`）。
- 未提交任何代码（`git status` 工作区干净，`.env` 被忽略）。
- 未改动 `main` 分支。
- 本指南不含任何 Secret 明文，key 只以变量名 `LLM_DEEPSEEK_API_KEY` 形式出现。
