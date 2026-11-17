# 把「智途星旅」部署到 liufengwei.com

> 目标：在 `https://journey.liufengwei.com` 上跑这个项目，和你现有的博客、游戏作品集互不影响。
>
> 为什么用子域名而不是 `liufengwei.com/journey/`：这个项目是完整的单页应用（前端 + Java 后端 + WebSocket），
> 放子路径要同时改前端 `base`、路由 basename、nginx alias、后端 context-path，任何一处没对齐就白屏或接口 404。
> 子域名是零改动、互不干扰的做法。

## 0. 先说清楚结构

这个项目**不是纯静态站**，它有两块：

| 部分 | 技术 | 部署形态 |
|---|---|---|
| 前端 | React + Vite，构建成 `dist/` 静态文件 | nginx 托管 |
| 后端 | Spring Boot (Java 17)，监听 8000 | 常驻进程（Docker 或 systemd） |

所以你现有的"上传静态文件"流程只管得了前端那一半，后端必须有个常驻服务。
**同源部署**是关键：前端请求 `/api/...`，由 nginx 转发给后端，这样不用配 CORS、Cookie 也正常。

```
浏览器 → https://journey.liufengwei.com
              │
       宿主机 nginx（443，证书）
              ├── /            → 前端静态文件
              └── /api/        → 后端 :8000（容器内网或 127.0.0.1）
```

## 1. 前置检查（在服务器上跑）

```bash
# 系统与资源：后端建议 ≥1GB 可用内存
uname -a && free -h && df -h /

# nginx 在不在（你现在应该就是它）
nginx -v

# 有没有 Docker
docker --version && docker compose version
```

- **有 Docker** → 走 [方案 A](#方案-adocker推荐)，最省事。
- **没有 Docker，也不想装** → 走 [方案 B](#方案-b无-dockernginx--systemd)，需要服务器有 Java 17。

顺便确认外网只开了 80/443：

```bash
sudo ss -tlnp | grep -E ':80|:443'
```

## 2. DNS：加一条子域名解析

在 liufengwei.com 的 DNS 服务商那里加：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `journey` | 你服务器的公网 IP | 600 |

验证（等 1~5 分钟）：

```bash
dig +short journey.liufengwei.com
# 应该输出你的服务器 IP
```

## 3. ⚠️ 高德 Key 加域名白名单（最容易翻车的一步）

地图底图和景点图片都依赖高德。打开 [高德控制台 → 应用管理 → 我的应用](https://console.amap.com/dev/key/app)：

1. 找到你现在用的 **Web 端 (JS API)** Key，点"设置"；
2. 在**域名白名单**里加上：`journey.liufengwei.com`；
3. 保存（生效约 1 分钟）。

不加白名单的典型症状：页面能打开，但地图区域一片空白，控制台报 `INVALID_USER_DOMAIN`。
**后端那把 `AMAP_API_KEY`（Web 服务 Key）不受域名限制，不用改。**

## 方案 A：Docker（推荐）

### A1. 拉代码并准备密钥

```bash
# 放到哪都行，这里用 /opt/hellojourney
sudo mkdir -p /opt/hellojourney && sudo chown $USER /opt/hellojourney
cd /opt/hellojourney
git clone https://github.com/kdjfs/HelloJourney.git .
# 之后更新就是 git pull

cp deploy/env.production.example deploy/env.production
nano deploy/env.production     # 按下面清单填
chmod 600 deploy/env.production
```

`deploy/env.production` 必填项：

| 变量 | 填什么 |
|---|---|
| `LLM_SILICONFLOW_API_KEY` | 你的硅基流动 Key（`sk-...`） |
| `LLM_SILICONFLOW_MODEL` | 建议 `deepseek-ai/DeepSeek-V3`（小模型会反复修复到超时） |
| `AMAP_API_KEY` | 高德 **Web 服务** Key（后端取图用） |
| `VITE_AMAP_WEB_JS_KEY` | 高德 **Web 端(JS API)** Key（前端底图，和上面不是同一把） |
| `VITE_AMAP_SECURITY_JS_CODE` | 与上一把配套的安全密钥 |
| `PUBLIC_ORIGIN` | `https://journey.liufengwei.com` |
| `SETTINGS_ALLOW_SECRET_UPDATES` | **保持 `false`**，否则知道管理令牌的人能改你的密钥 |

> `VITE_*` 是构建期变量：**改完必须重建前端镜像**（`--build`），重启容器没用。

### A2. 构建并启动

```bash
cd /opt/hellojourney
docker compose --env-file deploy/env.production up -d --build
docker compose ps                 # 两个服务都该是 running / healthy
```

首次构建要拉 Maven、Node 镜像，5~15 分钟属正常。

> 本地想验证"生产包"的话：`frontend/.env.production.local` 里写 `VITE_API_BASE_URL=`（已被 gitignore），
> `npm run build` 后 `node deploy/preview-server.mjs`，它就等价于容器内 nginx（静态 + /api 反代）。

### A3. 在服务器上先自测

```bash
curl -s http://127.0.0.1:8080/healthz          # ok
curl -s http://127.0.0.1:8080/api/settings | head -c 300
```

`/api/settings` 应该返回 `amap_maps_configured:true`、`llm_active_provider:"siliconflow"`。

### A4. 挂上 nginx + HTTPS

```bash
sudo cp deploy/nginx-journey.liufengwei.com.conf /etc/nginx/sites-available/journey.liufengwei.com.conf
sudo ln -sf /etc/nginx/sites-available/journey.liufengwei.com.conf /etc/nginx/sites-enabled/journey.liufengwei.com.conf

# 先用 HTTP 把 certbot 校验跑通（此时 443 段还没证书会报错，先只放 80）
sudo certbot --nginx -d journey.liufengwei.com

sudo nginx -t && sudo systemctl reload nginx
```

访问 <https://journey.liufengwei.com> 即可。之后更新：

```bash
cd /opt/hellojourney && git pull
docker compose --env-file deploy/env.production up -d --build
```

## 方案 B：无 Docker（nginx + systemd）

前提：服务器有 **Java 17**（`java -version`）。没有就装：

```bash
sudo apt update && sudo apt install -y openjdk-17-jre-headless nginx
```

### B1. 放文件

```bash
sudo mkdir -p /var/www/journey /opt/hellojourney/data /etc/hellojourney

# 前端：本地或服务器上构建后上传 dist 的内容
#   本地：cd frontend && VITE_API_BASE_URL= npm run build
#   然后：rsync -av frontend/dist/ user@server:/var/www/journey/
sudo chown -R www-data:www-data /var/www/journey

# 后端：jar 传到 /opt/hellojourney/app.jar（maven 打包：mvn -DskipTests package）
sudo chown -R www-data:www-data /opt/hellojourney
```

### B2. 环境变量

```bash
sudo cp deploy/env.production.example /etc/hellojourney/env
sudo nano /etc/hellojourney/env        # 同上表填好
sudo chown root:www-data /etc/hellojourney/env && sudo chmod 640 /etc/hellojourney/env
```

### B3. systemd 常驻

```bash
sudo cp deploy/hellojourney-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hellojourney-backend
systemctl status hellojourney-backend --no-pager
curl -s http://127.0.0.1:8000/health
```

### B4. nginx

```bash
sudo cp deploy/nginx-journey-static.liufengwei.com.conf /etc/nginx/sites-available/journey.liufengwei.com.conf
sudo ln -sf /etc/nginx/sites-available/journey.liufengwei.com.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d journey.liufengwei.com
sudo nginx -t && sudo systemctl reload nginx
```

## 方案 C：主域名子路径（不需要动 DNS，已实际采用）

如果不想加子域名记录，可以直接挂到 `https://liufengwei.com/hellojourney/`。前端支持 `VITE_BASE_PATH`，路由 basename 会自动跟随。

```bash
# 1) 构建（API 走同源根路径 /api，由 nginx 反代）
cd frontend
VITE_BASE_PATH=/hellojourney/ VITE_API_BASE_URL= npm run build

# 2) 上传到主站目录（它的 root 是 /var/www/youxi）
rsync -av dist/ user@server:/var/www/youxi/hellojourney/

# 3) nginx：在 443 的 liufengwei.com server 块里加两段
#    location /hellojourney/ { try_files $uri $uri/ /hellojourney/index.html; }
#    location /api/          { proxy_pass http://127.0.0.1:8000; ... 620s ... }
```

要点：

- `try_files` 必须回落到 `/hellojourney/index.html`，否则刷新深链（`/hellojourney/result`）会 404；
- `/api/` 要单独加 `location`，并把 `Upgrade` 头透传，否则任务进度 WebSocket 连不上；
- 前端产物里 **不能出现** `127.0.0.1:8001`，构建前确认 `VITE_API_BASE_URL` 为空；
- 后端建议 `SERVER_ADDRESS=127.0.0.1`，只留 nginx 做公网入口。

## 3.5 小红书能力（可选，需要签名边车）

小红书搜索结果已不再由 SSR 页面下发（`feeds` 恒为空），必须调用带 `x-s` 签名的
`/api/sns/web/v1/search/notes`。签名是混淆 JS，所以在后端旁边跑一个只监听
`127.0.0.1:8010` 的 Python 边车：

```
浏览器 → nginx → Java(8000) → 签名边车(8010) → 小红书签名接口
```

- 代码与部署说明见 [`deploy/xhs-service/README.md`](../deploy/xhs-service/README.md)；
- 两个变量：`XHS_COOKIE`（必须含 `web_session`）、`XHS_SERVICE_URL=http://127.0.0.1:8010`；
- 没配 `XHS_SERVICE_URL` 时后端自动退回旧的 SSR 抓取（功能降级但不会报错）；
- 服务器需要 **Node 18+**（node 12 会让签名包报 `window.mnsv2 is not a function`）。

## 4. 上线后的验收清单

按顺序点一遍，每一条都对应一个真实故障：

1. 打开首页 → 能看到"你的专属 AI 旅行规划师"，说明静态资源 + SPA 路由正常；
2. 打开设置页 → "高德地图服务"显示**已配置**，说明后端读到了 `AMAP_API_KEY`；
3. 生成一份 2 天行程（**耐心等 3~6 分钟**，页面会显示"已用时"）→ 能跳结果页；
4. 概览景点卡有真实照片（说明后端取图链路通）；
5. 概览地图有底图（说明前端 `VITE_AMAP_*` + 域名白名单都对）；
6. 知识图谱能拖节点、刷新后位置还在（说明 localStorage 正常）；
7. 顶栏「导入手机」→ 手机扫二维码能打开同一份行程。**注意**：二维码里是当前浏览器地址，
   手机上打开需要解析到同一台服务器，所以用**域名**访问时扫码才有效（用 IP 访问也行）。

## 5. 常见故障对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面白屏，控制台 404 `/assets/xxx.js` | nginx 没配 `try_files`，或 dist 上传到了错的目录 | 检查 `root /var/www/journey` 与 `try_files $uri $uri/ /index.html` |
| 地图区域空白，控制台 `INVALID_USER_DOMAIN` | 高德 JS Key 没加域名白名单 | 见第 3 节 |
| 接口全部 404 | 前端产物里 `VITE_API_BASE_URL` 被写成了 `http://127.0.0.1:8001` | 构建时留空（同源），然后重新构建镜像/重传 dist |
| 生成行程时 504 Gateway Timeout | 网关超时太短（默认 60s），生成要 3~6 分钟 | 本项目配置里已改成 620s；自己加过的 vhost 也要改 |
| 点击生成后一直转圈最后报"任务超时" | 后端没连上大模型 | 看 `docker compose logs backend` 里的 `llm_call_failed` |
| 设置页显示密钥未配置 | `LLM_SILICONFLOW_API_KEY` 没填，或填到了错的变量名 | 对照第 A1 节表格 |
| 景点图片全是插画 | 后端进程没读到 `AMAP_API_KEY` | `docker compose exec backend env | grep AMAP` |
| 手机上二维码打不开 | 二维码里是 `localhost` | 用域名访问本站再扫码 |

## 6. 资源与成本

- 后端 JVM 建议限制在 `-XX:MaxRAMPercentage=75`（Dockerfile / systemd 已带）；
- 1 核 1G 的小机器能跑，但生成行程时 CPU 会占满几秒，**建议 2G 内存**；
- 磁盘：镜像约 500MB（后端）+ 60MB（前端），行程数据 `./data` 增长很慢；
- 大模型费用按 token 计，一份 3 天行程大约 1~2 万 token。

## 7. 我自己验证过什么

在本地用与生产一致的方式跑过一遍（不是"应该能行"）：

```bash
cd frontend && npm run build          # 产物里确认没有硬编码 localhost:8001
node deploy/preview-server.mjs        # 静态托管 dist + /api 反代，等价于容器内 nginx
#  GET /                 → 200，页面完整渲染
#  GET /api/settings     → amap=true, relay=siliconflow, model=deepseek-ai/DeepSeek-V3
#  GET /result           → 200 且返回 index.html（SPA 深链）
#  GET /api/poi/photo    → verified=true, provider=amap
```

容器编排（`docker-compose.yml`）与两份 nginx 配置未能在本机实跑，因为这台 Windows 只装了 Docker CLI、没有引擎；
上服务器后按 A3/B3 的 `curl` 自测即可确认。
