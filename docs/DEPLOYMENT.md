# HelloJourney V3 部署指南

本文描述 V3 的部署基线。它用于本地联调、测试环境和小规模单实例生产部署，不代表系统已经具备多租户、跨区域容灾或无限水平扩展能力。

## 1. 运行链路

```text
Browser / UniApp
       │ HTTPS / WSS
       ▼
Frontend Nginx :80
  ├─ 静态 React 文件
  ├─ /api/* ───────────────┐
  └─ /api/trip/ws/* (WS) ──┤
                            ▼
                    Spring Boot :8000
                    ├─ Agent Loop
                    ├─ Review Agent
                    ├─ 本地任务文件 /app/data
                    ├─ DeepSeek / OpenAI-compatible API
                    └─ 腾讯地图 / Google Maps / 可选小红书适配器
```

浏览器不持有任何模型、地图服务端或内容平台 Secret。前端与后端同源部署时，`VITE_API_BASE_URL` 保持为空，由 Nginx 转发 API 和 WebSocket。

## 2. 前置条件

- Docker Engine 24+ 与 Docker Compose v2；或 JDK 17、Maven 3.8+、Node.js 22。
- 至少一个可用的 LLM Provider Key。默认是 DeepSeek V4 Pro。
- 至少一个地图 Provider Key。国内部署优先腾讯地图。
- 生产域名、TLS 证书和一个不会进入 Git 的 Secret 管理方式。

没有真实 LLM Key 时仍可用 `VITE_USE_MOCK=true` 演示前端完整主流程，但不能声称真实 AI 集成成功。

## 3. 环境变量

复制 [`.env.production.example`](../.env.production.example) 到仓库外的安全位置，或把同名变量写入云厂商 Secret Manager、Kubernetes Secret、CI Secret。不要把填充后的文件提交。

| 变量 | 必需 | 说明 |
|---|---:|---|
| `LLM_ACTIVE_PROVIDER` | 是 | 默认 `deepseek`，也可选已配置的 OpenAI-compatible Provider |
| `LLM_DEEPSEEK_API_KEY` | 条件必需 | DeepSeek 服务端 Key |
| `LLM_DEEPSEEK_BASE_URL` | 是 | 默认 `https://api.deepseek.com` |
| `LLM_DEEPSEEK_MODEL` | 是 | 默认 `deepseek-v4-pro` |
| `LLM_SILICONFLOW_API_KEY` | 可选 | 选择 SiliconFlow 时配置 |
| `TENCENT_MAPS_KEY` | 建议 | POI、地理编码、天气、路线工具 |
| `GOOGLE_MAPS_API_KEY` | 可选 | Google Maps 服务端 Provider（POI / 地理编码 / 路线 / 天气） |
| `VITE_GOOGLE_MAPS_JS_KEY` | 可选 | Google 地图**底图**的浏览器 Key（构建时内联，按 HTTP 来源限制）。与上一行不是同一把钥匙，详见 [Google 地图接入指南](./GOOGLE_MAPS_INTEGRATION.md) |
| `CORS_ALLOWED_ORIGINS` | 生产必需 | 逗号分隔的明确 HTTPS Origin，不允许 `*` |
| `TRIP_TASK_DATA_DIR` | 是 | 单实例任务数据目录，容器默认 `/app/data/trip_tasks` |
| `SETTINGS_ALLOW_SECRET_UPDATES` | 是 | 生产必须保持 `false`；临时管理也应使用独立后台而非公开 Web UI |
| `SETTINGS_ADMIN_TOKEN` | 可选 | 仅在受控环境临时开启写接口时使用 |
| `XHS_COOKIE` 等 | 可选 | 不稳定内容适配器；缺失或过期不会阻断地图核心流程 |

Key 应按最小权限创建，限制可调用 API、来源 IP/域名和预算额度，并建立 60–90 天轮换计划。日志和错误响应不得记录 Key、Cookie 或完整 Prompt。

## 4. Docker Compose 联调

在仓库根目录的当前升级分支执行：

```bash
docker compose --env-file /secure/path/hellojourney.env \
  -f docker-compose.dev.yml up --build
```

Windows PowerShell：

```powershell
docker compose --env-file D:\secure\hellojourney.env `
  -f docker-compose.dev.yml up --build
```

入口：

- Web：`http://localhost:5173`
- Backend：`http://localhost:8000`
- 健康检查：`http://localhost:8000/health`
- Swagger：`http://localhost:8000/swagger-ui/index.html`

停止服务不会删除任务数据：

```bash
docker compose -f docker-compose.dev.yml down
```

只有明确决定丢弃本地任务历史时才能额外删除 `data/` 或 volume。

## 5. 非容器启动

后端：

```bash
cd backend
mvn -Pprod clean package
java -jar target/HelloJourney-backend-2.0.0.jar --spring.profiles.active=prod
```

前端：

```bash
cd frontend
npm ci
VITE_USE_MOCK=false VITE_API_BASE_URL=https://api.example.com npm run build
```

将 `frontend/dist/` 部署到静态托管或 Nginx。Vite 环境变量会在构建时固化；Secret 永远不能使用 `VITE_` 前缀。

## 6. 反向代理与 WebSocket

仓库的 [`frontend/nginx.conf`](../frontend/nginx.conf) 已包含同源 API、SPA fallback、静态缓存和 WebSocket Upgrade。若外层还有网关，必须继续透传：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 360s;
```

生产必须在最外层启用 HTTPS/WSS、HSTS 和自动续期证书。只有真正处于 HTTPS 后才能添加 HSTS，避免在本地 HTTP 环境误锁域名。

## 7. 健康检查与可观测性

部署后至少监控：

- `/health` 可用率、HTTP 5xx、429 和 P50/P95/P99 延迟；
- Agent 任务完成、失败、取消、超时率，以及执行时长；
- LLM Provider 延迟、token 使用量、错误码与重试次数（不记录请求正文）；
- Tool 调用成功率、超时率和 Provider 降级次数；
- WebSocket 断开/重连、轮询降级次数；
- 容器 CPU、内存、磁盘空间和任务目录增长。

日志采集系统需要对 Authorization、Cookie、`*_API_KEY` 和 admin token 做二次脱敏。

## 8. 发布与回滚

推荐顺序：开发分支 → CI → staging → 人工 Mock/真实凭证冒烟 → 生产小流量 → 全量。当前系统没有完整用户与灰度平台，因此不要在未增加网关鉴权和观测之前公开暴露 Secret 管理接口。

发布前：

1. 记录当前镜像 digest 和 Git commit。
2. 运行前后端与 UniApp 构建、测试、依赖审计。
3. 在 staging 验证 health、Swagger、Mock/Stub AI、tool call、trip generation、WebSocket。
4. 备份 `TRIP_TASK_DATA_DIR`。

触发回滚的最低条件：新错误类型、错误率超过基线 2 倍、P95 增加 50%、任务数据损坏或任何 Secret 泄漏。

回滚：

1. 将前端和后端镜像同时切回上一个已验证 digest。
2. 本次 V3 没有数据库 schema migration，保留任务目录即可；不要自动删除新任务文件。
3. 验证 `/health`、WebSocket 和一条 Mock 行程。
4. 若疑似 Secret 泄漏，先禁用/轮换 Provider Key，再恢复流量。

## 9. 当前扩展边界

- 任务状态使用内存与本地 JSON 文件，适合单实例；多实例部署前需要 PostgreSQL/Redis 和共享任务队列。
- 目前没有终端用户认证、配额与公网 API rate limit。对公网发布前应在网关增加认证、限流和 WAF。
- XHS adapter 受 Cookie 与上游变化影响，仅作为可选增强，不能成为 SLA 依赖。
- `docker-compose.dev.yml` 是联调基线，不替代生产编排、备份、监控和灾难恢复方案。

## 小红书 Cookie 的日常运维（v3.1 起）

小红书只作为「景点攻略 / 配图」的数据源，链路失败不会阻断行程生成，但会退化为地图 POI 数据。

### 首次配置

1. 后端环境（或 `runtime_settings.json`）设置 `XHS_COOKIE`：浏览器登录 xiaohongshu.com 后，F12 → Network → 任一 `api/sns/web` 请求 → Request Headers → 复制整段 `Cookie`。必须包含 `web_session=0400...`（40 位），游客态的 `web_session=0300...`（32 位）一定失败。
2. 若希望在网页里直接维护 Cookie，开启运行时写入：
   ```
   SETTINGS_ALLOW_SECRET_UPDATES=true
   SETTINGS_ADMIN_TOKEN=<一段足够长的随机串>
   ```
3. 打开 `/settings` → 「小红书 Cookie 管理」→ 粘贴 Cookie + 管理员令牌 → 先「校验 Cookie」再「保存并生效」。
   - 令牌只放在 `X-HelloJourney-Admin-Token` 请求头里，不写浏览器存储；关闭 `allow-secret-updates` 后该面板必定被拒。

### 常见现象

| 现象 | 含义 | 处理 |
|---|---|---|
| 校验返回「Cookie 缺少 web_session」 | 复制的是游客态 Cookie | 确认已登录后重新复制请求头 |
| 校验返回「页面跳转到了登录页」 | 会话已失效 | 重新登录并替换 Cookie |
| 生成行程正常但景点是地图 POI | 小红书抓取失败（网络/页面结构） | 看后端日志 `xhs_attraction_adapter_failed` |
| 同一城市反复生成很慢 | 首次抓取无缓存 | 已内置 6 小时缓存，同城同关键词第二次起走缓存 |

### 已知边界

- 当前实现是 SSR 页面抓取（非签名直连接口），页面结构大改时需要更新 `XhsService.extractInitialState`。
- 景点配图仍走高德图片服务；小红书图片代理（防盗链 + 磁盘缓存）尚未接入，见 TODO。

## 景点图片：高德 + 小红书双层取图（v3.2）

结果页的景点图现在有两级来源：

1. `AmapAttractionImageProvider`（@Order(10)）：高德 POI 图片，身份可校验，命中即返回。
2. `XhsAttractionImageProvider`（@Order(20)）：仅在高德解析不出图片时启用，取小红书笔记首图。

小红书图片**不直出直链**（直链带 Referer 校验、分钟级失效，非 localhost 部署会 403 / 破图），而是返回本服务的代理路由：

```
GET /api/poi/xhs-image?name=<景点名>&city=<城市>
```

代理逻辑（`XhsImageProxyService`）：
- 按景点名实时解析小红书首图直链，只允许 `*.xhscdn.com` / `*.xiaohongshu.com` 域名（避免变成开放代理）
- 带 `Referer: https://www.xiaohongshu.com/` 与浏览器 UA 下载，`8MB` 上限、`callTimeout 25s`
- 字节流内存缓存 6 小时（LRU 200 条），响应带 `Cache-Control: max-age=6h`
- 解析结果（直链）单独缓存 20 分钟，避免"校验存在性"和"图片加载"各抓一次小红书

排查：图片 404 且日志有 `xhs_image_resolve_failed` → Cookie 失效或该景点没有可用笔记图，属正常降级（高德也没图）。

## 降级提示如何呈现

小红书 Cookie 失效/抓取失败时，`TripPlanResponse.warnings` 会带上一条中文提示，前端结果页顶部以黄色提示条展示：
「小红书 Cookie 已失效或未配置，本次「杭州」的景点数据已降级为地图 POI，请到「设置 → 小红书 Cookie 管理」更新后重新生成。」

该字段为空表示链路数据源全部正常。生成过程中 warnings 也会同步写入 `sessionStorage.tripWarnings`，刷新结果页仍可见。
