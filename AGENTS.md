# AGENTS.md — AI 编码代理的项目记忆

> 这是给 **Codex / Claude Code / Cursor** 等编码代理看的"项目记忆"。接手本仓库前先读完本文件。
>
> **最后核对：2026-11-25。当前状态：已恢复上线。**
> 例外：`liufengwei.com` 的三条 A 记录当时被删过，**需要用户在阿里云控制台加回**才能公网访问；
> 服务器上一切就绪（详见第 1 节）。

---

## 1. 当前状态

| 事项 | 状态 |
|---|---|
| 线上站点 | **已恢复并全部可公网访问**（2026-11-25）。个人主页、HelloJourney、个人博客都在线 |
| 公网 DNS | ✅ 已恢复：`@` / `www` / `blog` 三条 A 记录均指向 `39.96.195.78`（公共 DNS 实测可解析） |
| 服务器 | 已恢复：内容、后端、边车、systemd、nginx 全部就位；仅回环端口 8000/8010 |
| 游戏作品集 | **已彻底删除且不恢复**（用户明确要求，连备份都没有） |
| 项目代码 | GitHub `kdjfs/HelloJourney` + 本地 `D:\lfw-code\HelloJourney` |

> 验证命令：`ssh astrbot-server 'bash -s' < deploy/verify-prod.sh`
> 该脚本用 `--resolve` 直连本机核对（不依赖 DNS），公网 DNS 缺失只报 WARN。
> 实测（2026-11-25）：主页 200、`/hellojourney/` 200、`/api/settings` 200、博客 200，
> 且一次真实的 1 天行程生成在公网链路上 **179 秒完成**（3 个景点）。

---

## 2. 项目是什么

HelloJourney（智途星旅）——AI 旅行规划 Web 应用：

| 部分 | 技术 | 端口 |
|---|---|---|
| 前端 | React 19 + TypeScript + Vite 8 + antd 6 + ECharts | 5173（本地） |
| 后端 | Spring Boot 3.2.5 (Java 17) + OkHttp | 8000（线上，仅回环）/ 8001（本地） |
| 小红书边车 | Python 3 + PyExecJS + Node（签名） | 8010（线上，仅回环） |

核心链路：生成行程 → `TripPlannerAgent`（并行拉 POI/天气/酒店/小红书笔记）→ `StructuredTripPlanService`（LLM 一次性输出整份 JSON + 校验修复）→ 结果页（地图/图片/知识图谱/编辑/AI 助手）。

---

## 3. 线上拓扑（一个域名，三块内容，无游戏）

| 访问地址 | 是什么 | 文件在哪 | nginx server 块 |
|---|---|---|---|
| `https://liufengwei.com/` | 个人主页（单文件，链接博客与项目） | `/var/www/youxi/index.html` | 443 `liufengwei.com` |
| `https://liufengwei.com/hellojourney/` | **本项目前端** | `/var/www/youxi/hellojourney/` | 同上（`location /hellojourney/`） |
| `https://liufengwei.com/api/` | **本项目后端 API**（含 WebSocket） | 反代 `127.0.0.1:8000` | 同上（`location /api/`、`/api/trip/ws/`） |
| `https://blog.liufengwei.com/` | 个人博客（Astro 静态站） | `/var/www/blog/` | 443 `blog.liufengwei.com` |
| ~~`/games/*`~~ | 游戏作品集：**已删除，不再恢复** | 无 | — |

- 唯一 nginx 配置文件：`/etc/nginx/sites-available/liufengwei.com`（源码 `deploy/nginx-liufengwei.conf`）；
- 80 端口：跳 https（保留 ACME 校验目录 `/var/www/acme`）；8080：默认站（历史遗留，直接托管 `/var/www/youxi`）；
- 证书：Let's Encrypt，`/etc/letsencrypt/live/liufengwei.com/`，覆盖 `liufengwei.com` + `www` + `blog`（无 wildcard）。

---

## 4. 服务器

| 项 | 值 |
|---|---|
| 阿里云 ECS | `iZ2ze5cnizkduzc7pf0j5aZ`，公网 `39.96.195.78` |
| 系统 / 规格 | Ubuntu 22.04.5 / 1 核 1.7 GB / 40 GB，nginx **1.18** |
| 登录 | `ssh astrbot-server`（本机 `~/.ssh/config` 已配好，root + 密钥） |
| 证书 | 到期 2027-02-15；无 DNS 时无法自动续期，加回解析后 `certbot renew` 即可 |

**关键路径**

| 路径 | 用途 |
|---|---|
| `/opt/hellojourney/app.jar` | 后端 jar（92 MB） |
| `/opt/hellojourney/data/` | 任务与运行时数据，**不要清空** |
| `/etc/hellojourney/env` | 两个服务共用环境变量，`640 root:www-data`（含密钥） |
| `/opt/xhs-sign/` | 小红书边车：`xhs_api.py` + `sign_util.py` + 4 个签名 JS |
| `/var/www/youxi/` | 个人主页 + `hellojourney/` 前端 |
| `/var/www/blog/` | 博客（Astro dist） |
| `/var/www/acme/` | 证书续期校验目录 |

**服务**：`hellojourney-backend`（java，`-Xmx512m`）、`hellojourney-xhs`（python）、`nginx`，均 enabled。

---

## 5. 部署命令

### 5.1 后端

```bash
cd backend && mvn -o -DskipTests package      # Windows 上 JAVA_HOME 指向 IntelliJ JBR
scp target/HelloJourney-backend-2.0.0.jar astrbot-server:/tmp/app.jar
ssh astrbot-server 'systemctl stop hellojourney-backend \
  && cp /tmp/app.jar /opt/hellojourney/app.jar && chown www-data:www-data /opt/hellojourney/app.jar \
  && systemctl start hellojourney-backend'
```

### 5.2 前端（必须带 base）

```bash
cd frontend
VITE_BASE_PATH=/hellojourney/ VITE_API_BASE_URL= npm run build
scp -r dist astrbot-server:/tmp/hj-dist
ssh astrbot-server 'rm -rf /var/www/youxi/hellojourney/* \
  && cp -r /tmp/hj-dist/. /var/www/youxi/hellojourney/ && rm -rf /tmp/hj-dist'
```

校验：产物里必须是 `/hellojourney/assets/...`，且**不能**出现 `127.0.0.1:8001`。

### 5.3 个人主页

```bash
scp deploy/landing-page/index.html astrbot-server:/var/www/youxi/index.html
```

### 5.4 博客（Astro）

```bash
# ⚠️ 必须带 SITE_URL：仓库默认 site 是 https://liufengwei-personal-blog.vercel.app，
# 不带会把 canonical / og:url / sitemap / rss 全写成 Vercel 域名
cd ../liufengwei-personal-blog-v3
SITE_URL=https://blog.liufengwei.com npm run build   # astro build + pagefind
scp -r dist astrbot-server:/tmp/blog-dist
ssh astrbot-server 'rm -rf /var/www/blog/* && cp -r /tmp/blog-dist/. /var/www/blog/ && rm -rf /tmp/blog-dist'
```

> 如果产物已经上传、才发现 canonical 还指向 vercel.app，可以在服务器上就地修正（注意文件名含空格，必须 `-0`）：
> `grep -rlZ 'liufengwei-personal-blog\.vercel\.app' /var/www/blog | xargs -0 -r sed -i 's|https\?://liufengwei-personal-blog\.vercel\.app|https://blog.liufengwei.com|g'`

### 5.5 小红书边车

```bash
scp deploy/xhs-service/xhs_api.py astrbot-server:/opt/xhs-sign/
ssh astrbot-server 'systemctl restart hellojourney-xhs'
```

### 5.6 nginx（先备份）

```bash
ssh astrbot-server 'cp /etc/nginx/sites-available/liufengwei.com /root/vhost-backup-$(date +%F-%H%M).conf'
scp deploy/nginx-liufengwei.conf astrbot-server:/etc/nginx/sites-available/liufengwei.com
ssh astrbot-server 'nginx -t && systemctl reload nginx'
```

> ⚠️ 这台机器是 **nginx 1.18**：不支持独立的 `http2 on;`，必须写成 `listen 443 ssl http2;`，
> 否则 `nginx -t` 报 `unknown directive "http2"`、reload 失败、站点继续跑旧配置（很容易误判成"改没生效"）。

---

## 6. 环境变量（值只在服务器/本地 `.env`，不进仓库）

| 变量 | 作用 | 注意 |
|---|---|---|
| `LLM_ACTIVE_PROVIDER=siliconflow` | 大模型供应商 | — |
| `LLM_SILICONFLOW_API_KEY` | 硅基流动 Key | — |
| `LLM_SILICONFLOW_MODEL` | `deepseek-ai/DeepSeek-V3` | 4B/7B 小模型会反复修复到超时 |
| `LLM_TIMEOUT` / `AGENT_STRUCTURED_TIMEOUT_SECONDS` | 单次 / 整份 JSON 超时（240） | 分开设置 |
| `AMAP_API_KEY` | 高德 **Web 服务** Key | **必须关闭「数字签名」**，否则 `infoCode=10007`、图片全变插画 |
| `VITE_AMAP_WEB_JS_KEY` + `VITE_AMAP_SECURITY_JS_CODE` | 前端地图（构建期注入） | 域名要进高德白名单，否则 `INVALID_USER_DOMAIN` |
| `XHS_COOKIE` | 小红书登录态 | 必须含 `web_session`；systemd `EnvironmentFile` 里要**整体加单引号** |
| `XHS_SERVICE_URL=http://127.0.0.1:8010` | 走签名边车 | 留空则退回 SSR（已无数据，等于关闭） |
| `SETTINGS_ALLOW_SECRET_UPDATES=false` | 禁止网页改密钥 | 生产必须 false |
| `SERVER_ADDRESS=127.0.0.1` | 后端只绑回环 | 公网入口只留 nginx |

---

## 7. 硬性约束

1. **不要恢复游戏作品集**（2026-11-18 已彻底删除，用户明确要求不再恢复）。
2. 不要动 `/var/www/blog/`（博客内容）与个人主页，除非用户明确要求；改 nginx 前先备份。
3. **不要把真实密钥写进仓库**（`.env`、`.env.*`、`deploy/env.production`、`frontend/.env.production.local` 均已 gitignore）。
4. 后端/边车只绑 `127.0.0.1`；反代超时 ≥ 620s（生成行程 3~6 分钟）。
5. 前端构建必须带 `VITE_BASE_PATH=/hellojourney/`，路由 basename 跟随 `BASE_URL`。
6. 服务器 1.7 GB 内存：JVM `-Xmx512m`，Docker 构建会 OOM（构建放本地）。
7. nginx 1.18：`http2` 只能写在 `listen` 后面（见 5.6 的警告）。
8. 改完 nginx 后如果行为没变，先确认 `nginx -t` 通过、reload 成功——reload 失败时旧配置会一直在跑。

---

## 8. 本地开发

```bash
backend\run-backend-dev.cmd     # 8001，自动加载仓库根 .env
cd frontend && npm run dev      # 5173
```

校验：`npx tsc -b` → `npx eslint src` → `npx vitest run`（19 文件 / 82 用例）→ `npx vite build`；
后端 `mvn -o test`（175 用例）。

---

## 9. 已知问题

1. **2 天以上行程，结构化生成可能跑很久**（实测 > 10 分钟）；任务超时（600s）不会打断正在进行的 LLM 调用。优化方向：减少小红书笔记数量/正文长度、下调 `LLM_TIMEOUT`。
2. 小红书 cookie 会过期（`code=300011`），需重新登录复制含 `web_session` 的 Cookie，只重启 `hellojourney-xhs`。
3. 小红书搜索不再 SSR（`feeds` 恒空），必须走签名边车；node 12 会报 `window.mnsv2 is not a function`。
4. 高德图片只覆盖有 POI 照片的景点，长尾靠小红书实拍兜底，再失败才显插画。
5. `mockServiceWorker.js` 会被打进 `dist`（无害但多余）。

---

## 10. 相关文档

- [`docs/INFRA.md`](docs/INFRA.md)：基础设施细节、排障表、备份/回滚
- [`docs/DEPLOY-JOURNEY.md`](docs/DEPLOY-JOURNEY.md)：从零部署手册
- [`deploy/xhs-service/README.md`](deploy/xhs-service/README.md)：小红书签名边车
- [`deploy/landing-page/index.html`](deploy/landing-page/index.html)：个人主页源码
- [`deploy/nginx-liufengwei.conf`](deploy/nginx-liufengwei.conf)：线上 nginx 配置
- [`deploy/verify-prod.sh`](deploy/verify-prod.sh)：一条命令核对线上状态
