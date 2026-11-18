# AGENTS.md — AI 编码代理的项目记忆

> 这是给 **Codex / Claude Code / Cursor** 等编码代理看的"项目记忆"。接手本仓库前先读完本文件；
> **任何改变部署形态、端口、域名、服务名的操作，完成后必须回来更新本文件**（以及 `docs/INFRA.md`）。
>
> 最后核对时间：2026-11-18，核对方式见文末「如何验证记忆是否过期」。

---

## 1. 这是什么项目

HelloJourney（中文名"智途星旅"）——AI 旅行规划 Web 应用，前后端分离：

| 部分 | 技术 | 本地端口 |
|---|---|---|
| 前端 | React 19 + TypeScript + Vite 8 + antd 6 + ECharts | 5173 |
| 后端 | Spring Boot 3.2.5 (Java 17) + OkHttp | 8001（本地）/ 8000（线上） |
| 小红书边车 | Python 3 + PyExecJS + Node（签名） | 8010（仅线上） |

核心链路：生成行程 → `TripPlannerAgent`（并行拉 POI/天气/酒店/小红书笔记）→ `StructuredTripPlanService`（LLM 一次性输出整份 JSON + 校验修复）→ 结果页（地图/图片/知识图谱/编辑/AI 助手）。

---

## 2. 线上拓扑：**同一个域名下有三个站点**（最容易搞混的地方）

域名 `liufengwei.com` 是**用户自己的个人主页 + 博客 + 本项目**共用，三者互不干扰（原游戏作品集已于 2026-11-18 删除）：

| 访问地址 | 是什么 | 文件在哪 | 由哪个 nginx server 块服务 |
|---|---|---|---|
| `https://liufengwei.com/` | 个人主页（单文件 `index.html`，含"AI 旅行规划 / 博客"入口；**已无任何游戏内容**） | `/var/www/youxi/index.html` + `robots.txt` | 443 `server_name liufengwei.com` |
| ~~`/games/…`、`/assets/…`~~ | **已全部删除**（2026-11-18：13 个游戏、13 图标、13 封面、游戏 README 与部署示例） | 备份见下方 | — |
| `https://blog.liufengwei.com/` | 个人博客 | `/var/www/blog/` | 443 `server_name blog.liufengwei.com` |
| **`https://liufengwei.com/hellojourney/`** | **本项目前端** | `/var/www/youxi/hellojourney/` | 同上（`location /hellojourney/`） |
| **`https://liufengwei.com/api/`** | **本项目后端 API** | 反代到 `127.0.0.1:8000` | 同上（`location /api/`） |

> 游戏库是在用户明确要求下**彻底删除**的（两轮：先删 `games/`，再清掉首页游戏文案与全部图标/封面/资产）。
> `/var/www/youxi` 现在只有 `index.html`、`robots.txt`、`hellojourney/` 三项。
>
> 备份（重要，唯一副本）：
> - `/root/youxi-site-backup-20261118-182928.tgz`（8 MB，**含全部 13 个游戏与原始首页**）
> - `/root/youxi-site-backup-20261118-183131.tgz`（2 MB，含图标/封面/README，首页为"作品整理中"版本）
>
> 恢复：`cd /var/www && tar xzf /root/youxi-site-backup-20261118-182928.tgz`。
> **除非用户明确要求，不要恢复游戏内容，也不要往首页加回游戏入口。**

**为什么本项目用子路径而不是子域名**：域名解析在阿里云，只有 `@` / `www` / `blog` 三条 A 记录，
**没有泛解析**，加子域名要动 DNS；而用子路径只需改 nginx 一次，且复用现有证书。
证书只覆盖 `liufengwei.com` + `www` + `blog`，**没有 wildcard**。

> 8080 端口还有一个 nginx `server_name _`（默认站，root 也是 `/var/www/youxi`），是历史遗留，
> **不要删除**，也不要占用 8080。

---

## 3. 服务器

| 项 | 值 |
|---|---|
| 类型 | 阿里云 ECS，`iZ2ze5cnizkduzc7pf0j5aZ` |
| 公网 IP | `39.96.195.78` |
| 系统 | Ubuntu 22.04.5 LTS，kernel 5.15 |
| 规格 | **1 核 / 1.7 GB 内存 / 40 GB 磁盘（别跑重内存服务）** |
| 登录 | `ssh astrbot-server`（本机 `~/.ssh/config` 已配好，root + 密钥） |
| DNS | 阿里云 hichina（`dns29/30.hichina.com`） |
| TLS | Let's Encrypt，`certbot --nginx` 签发，证书路径 `/etc/letsencrypt/live/liufengwei.com/` |

---

## 4. 关键路径与端口（写死的事实，别猜）

| 路径 / 端口 | 用途 |
|---|---|
| `/opt/hellojourney/app.jar` | 后端 jar（约 92 MB） |
| `/opt/hellojourney/data/` | 行程任务与运行时配置落盘（**不要清空**） |
| `/etc/hellojourney/env` | 两个服务共用的环境变量，权限 `640 root:www-data`（**含密钥，不进仓库**） |
| `/opt/xhs-sign/` | 小红书签名边车：`xhs_api.py` + `sign_util.py` + 4 个签名 JS |
| `/var/www/youxi/hellojourney/` | 本项目前端静态文件（`dist` 的内容） |
| `/etc/nginx/sites-available/youxi` | 唯一的站点配置（三站点都在这一个文件里） |
| `80` / `443` | nginx |
| `8080` | nginx 默认站（遗留，勿动） |
| `8000` | 后端，**只监听 127.0.0.1** |
| `8010` | 小红书边车，**只监听 127.0.0.1** |

systemd 服务（都是 `enabled` 开机自启）：

| 服务 | 作用 | 日志 |
|---|---|---|
| `hellojourney-backend` | Java 后端（`-Xmx512m`，约 240 MB RSS） | `journalctl -u hellojourney-backend` |
| `hellojourney-xhs` | 小红书签名边车（Python，约 30 MB RSS） | `journalctl -u hellojourney-xhs` |
| `nginx` | 三站点入口 | `/var/log/nginx/` |

---

## 5. 部署命令（照抄即可）

### 5.1 后端

```bash
# 本地（Windows）：JAVA_HOME 必须指向 IntelliJ 的 JBR，不是 C:\Java\jdk-17
cd backend && mvn -o -DskipTests package
scp target/HelloJourney-backend-2.0.0.jar astrbot-server:/tmp/app.jar
ssh astrbot-server 'systemctl stop hellojourney-backend \
  && cp /tmp/app.jar /opt/hellojourney/app.jar \
  && chown www-data:www-data /opt/hellojourney/app.jar \
  && systemctl start hellojourney-backend'
```

> 传 jar 前**必须先停后端**，否则 Windows 侧 `package` 会因文件被占用失败；
> 服务器侧也要先 stop 再覆盖（运行中的 jar 会被锁）。

### 5.2 前端（**必须带 base**）

```bash
cd frontend
VITE_BASE_PATH=/hellojourney/ VITE_API_BASE_URL= npm run build
scp -r dist astrbot-server:/tmp/hj-dist
ssh astrbot-server 'rm -rf /var/www/youxi/hellojourney/* \
  && cp -r /tmp/hj-dist/. /var/www/youxi/hellojourney/ \
  && rm -rf /tmp/hj-dist'
```

- `VITE_BASE_PATH=/hellojourney/` 会被打进产物（`/hellojourney/assets/...`），**漏了线上必然白屏/404**；
- `VITE_API_BASE_URL=` 必须为空 → 前端请求同源 `/api`，由 nginx 反代；
- 产物里**不允许出现** `127.0.0.1:8001`，构建后请 `grep` 确认。

### 5.3 小红书边车

```bash
scp deploy/xhs-service/xhs_api.py astrbot-server:/opt/xhs-sign/
ssh astrbot-server 'systemctl restart hellojourney-xhs'
```

### 5.4 改 nginx（先备份！）

```bash
ssh astrbot-server 'cp /etc/nginx/sites-available/youxi /root/vhost-backup-$(date +%Y%m%d-%H%M%S).conf'
# 编辑 /etc/nginx/sites-available/youxi 后
ssh astrbot-server 'nginx -t && systemctl reload nginx'
```

---

## 6. 环境变量（只记名字与规则，值一律在服务器上）

| 变量 | 作用 | 注意 |
|---|---|---|
| `LLM_ACTIVE_PROVIDER=siliconflow` | 大模型供应商 | 生产别用 `relay`（那是本地运行时配置项） |
| `LLM_SILICONFLOW_API_KEY` | 硅基流动 Key | — |
| `LLM_SILICONFLOW_MODEL` | 建议 `deepseek-ai/DeepSeek-V3` | 4B/7B 小模型会反复修复到超时 |
| `LLM_TIMEOUT` | 单次调用超时（240） | 中转站慢模型单次可达 100s+ |
| `AGENT_STRUCTURED_TIMEOUT_SECONDS` | 整份行程 JSON 的单独超时（240） | 别和 `LLM_TIMEOUT` 用同一个值 |
| `AMAP_API_KEY` | 高德 **Web 服务** Key（后端取图/POI） | **必须关闭「数字签名」**，否则 `infoCode=10007`，图片全变插画 |
| `VITE_AMAP_WEB_JS_KEY` + `VITE_AMAP_SECURITY_JS_CODE` | 前端地图（构建期注入） | 控制台里必须把 `liufengwei.com` 加进**域名白名单**，否则 `INVALID_USER_DOMAIN`、地图空白 |
| `XHS_COOKIE` | 小红书登录态 | **必须含 `web_session`**，否则只是游客（302 跳登录） |
| `XHS_SERVICE_URL=http://127.0.0.1:8010` | 让后端走签名边车 | 留空则退回旧 SSR 抓取（搜索结果已为空，等于关闭该能力） |
| `SETTINGS_ALLOW_SECRET_UPDATES=false` | 禁止网页改密钥 | 生产必须 false |
| `SERVER_ADDRESS=127.0.0.1` | 后端只绑回环 | 公网入口只留 nginx |

---

## 7. 硬性约束（代理必须遵守，违反会弄坏别人的站点）

1. **不要动** `/var/www/blog/`（博客），也**不要重写** `/var/www/youxi/index.html`（个人主页，除非用户明确要求）。游戏内容已于 2026-11-18 按要求彻底删除，**不要恢复**。
2. 改 `/etc/nginx/sites-available/youxi` 前**必须先备份**到 `/root/vhost-backup-*`；改完 `nginx -t` 通过再 reload。
3. **不要把真实密钥写进仓库**。`.env`、`,env.*`、`deploy/env.production`、`frontend/.env.production.local` 均已 gitignore；只提交 `.example` 模板。
4. 后端/边车**只监听 `127.0.0.1`**；不要让它们占 80/443/8080。
5. 反代超时**必须 ≥ 620s**（生成一份行程要 3~6 分钟，默认 60s 会 504）。
6. 前端构建**必须** `VITE_BASE_PATH=/hellojourney/`；路由 basename 由 `import.meta.env.BASE_URL` 自动跟随。
7. 服务器只有 **1.7 GB 内存**：JVM 固定 `-Xmx512m`，不要引入新的常驻内存服务；Docker 构建（Maven+Node）**在这台机器上会 OOM**，构建放本地。
8. `mockServiceWorker.js` 目前会被打进 `dist`（无害但多余），如果清理请同步确认生产不注册 MSW。
9. PowerShell 编辑源码会破坏 UTF-8（历史上踩过两次），改文本请用编辑器/`write` 工具。

---

## 8. 本地开发

```bash
# 后端（8001，会自动加载仓库根 .env）
backend\run-backend-dev.cmd

# 前端（5173）
cd frontend && npm run dev
```

校验顺序：`npx tsc -b` → `npx eslint src` → `npx vitest run` → `npx vite build`（前端）；
`mvn -o test`（后端，175 个测试）。提交信息用 `feat(scope): ...` / `fix(scope): ...` 英文格式。

---

## 9. 已知问题（改之前先看一眼）

1. **2 天以上的行程，结构化生成可能跑很久**（实测 > 10 分钟未返回）；任务超时（600s）不会打断正在进行的 LLM 调用，前端会一直显示"已用时"。优化方向：减少参与规划的小红书笔记数量/正文长度、下调 `LLM_TIMEOUT`。
2. **小红书 cookie 会过期**：日志出现 `code=300011` 即风控/退出登录，需要重新登录复制 Cookie（含 `web_session`），然后只重启 `hellojourney-xhs`。
3. **小红书搜索已不再 SSR**：`/search_result` 的 `feeds` 恒为空，必须走签名边车；边车依赖 **Node 18+**（node 12 会报 `window.mnsv2 is not a function`）。
4. 高德图片只对"有 POI 照片"的景点有效，长尾景点靠小红书实拍兜底，再失败才显示插画。

---

## 10. 如何验证"记忆是否过期"

在服务器执行，或 `ssh astrbot-server 'bash -s' < deploy/verify-prod.sh`：

```bash
systemctl is-active hellojourney-backend hellojourney-xhs nginx
ss -tlnp | grep -E ':80 |:443 |:8000 |:8010 '
curl -s -o /dev/null -w '%{http_code}\n' https://liufengwei.com/hellojourney/
curl -s https://liufengwei.com/api/settings | head -c 200
curl -s http://127.0.0.1:8010/health
```

期望：三个服务 `active`；8000/8010 只出现在 `127.0.0.1`；站点 200；`settings` 里 `amap_maps_configured:true`；边车 `{"ok":true,"cookieConfigured":true}`。

任何一项不符 → 说明线上被改过，**先更新本文件再改代码**。

---

## 11. 相关文档

- [`docs/INFRA.md`](docs/INFRA.md)：同一套事实的详细版（含排障表）
- [`docs/DEPLOY-JOURNEY.md`](docs/DEPLOY-JOURNEY.md)：从零部署的完整手册（Docker / systemd / 子路径三种方案）
- [`deploy/xhs-service/README.md`](deploy/xhs-service/README.md)：小红书签名边车
- [`deploy/verify-prod.sh`](deploy/verify-prod.sh)：一条命令核对线上状态
