# 线上基础设施说明（INFRA）

> 面向"人"的详细版；给 AI 代理的精简版在仓库根的 [`AGENTS.md`](../AGENTS.md)。
> 两份必须同时更新。最后核对：2026-11-18。

## 1. 一眼看懂：一个域名，三个站点

```
                    liufengwei.com  (39.96.195.78, 阿里云 ECS, Ubuntu 22.04)
                                   │
                    宿主机 nginx（80/443，Let's Encrypt 证书）
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        │                          │                           │
  https://liufengwei.com/    blog.liufengwei.com        本项目
  个人主页（单文件）           个人博客                  https://liufengwei.com/hellojourney/
  /var/www/youxi/index.html  /var/www/blog             前端：/var/www/youxi/hellojourney
                                                       后端：/api/ → 127.0.0.1:8000
                                                              │
                                                     小红书签名边车 127.0.0.1:8010
```

> **2026-11-18：游戏内容已彻底删除（三轮）。** 删 `/var/www/youxi/games/`（13 个静态包）→
> 删首页游戏文案与 `assets/`（13 图标 + 13 封面 + 预览图 + 游戏目录数据）、`README.md`、`deploy/` →
> 连服务器上的两份备份包一并删除。**“服务器备份勿删”的旧规则作废：现在没有任何副本，无法恢复。**
> 首页已换成单文件个人主页（`index.html`，样式内联，含 `id="contact"` 锚点），源码入库在
> `deploy/landing-page/index.html`。
> `/var/www/youxi` 现在只有：`index.html`、`robots.txt`、`hellojourney/`。

三者的 nginx 配置**都在同一个文件**里：`/etc/nginx/sites-available/youxi`（软链到 `sites-enabled/`）。

| server 块 | 端口 | server_name | root | 说明 |
|---|---|---|---|---|
| #1 | 8080 | `_`（默认站） | `/var/www/youxi` | 历史遗留，供直连 IP:8080 预览 |
| #2 | 80 | `liufengwei.com blog.liufengwei.com` | — | 301 跳 https |
| #3 | 80 | `www.liufengwei.com` | — | 301 跳到主域 |
| #4 | 443 | `liufengwei.com` | `/var/www/youxi` | 主站 + `/hellojourney/` + `/api/` |
| #5 | 443 | `blog.liufengwei.com` | `/var/www/blog` | 博客 |
| #6 | 443 | `www.liufengwei.com` | — | 301 跳到主域 |

### 为什么是子路径而不是子域名

- 域名解析在阿里云（`dns29/30.hichina.com`），只有 `@`、`www`、`blog` 三条 A 记录，**没有泛解析**；
- 加 `journey.liufengwei.com` 需要动 DNS + 单独签证书；
- 子路径只需在 443 主站加两个 `location`，复用现有证书，改动最小。

代价：前端必须用 `VITE_BASE_PATH=/hellojourney/` 构建（资源路径带前缀），路由 basename 跟随 `BASE_URL`。

## 2. 端口分配

| 端口 | 谁 | 绑定 | 说明 |
|---|---|---|---|
| 80 / 443 | nginx | `0.0.0.0` | 公网入口 |
| 8080 | nginx 默认站 | `0.0.0.0` | 遗留，勿删 |
| 8000 | Java 后端 | **127.0.0.1** | 只给 nginx 反代 |
| 8010 | 小红书边车 | **127.0.0.1** | 只给 Java 调 |

## 3. 目录与文件

| 路径 | 内容 | 备注 |
|---|---|---|
| `/var/www/youxi/index.html` | 个人主页（单文件，样式内联） | 只有 `index.html` + `robots.txt` + `hellojourney/` |
| `/var/www/youxi/hellojourney/` | 本项目前端（`dist` 拷贝） | 每次部署整体覆盖 |
| `/var/www/blog/` | 博客 | 独立 server 块 |
| `/opt/hellojourney/app.jar` | 后端 jar | 92 MB |
| `/opt/hellojourney/data/` | 任务/知识图谱落盘 + `runtime_settings.json` | 备份这个目录即可保住数据 |
| `/opt/xhs-sign/` | 边车代码 + 签名 JS（第三方，来自 TripStar） | 约 4.3 MB |
| `/etc/hellojourney/env` | 环境变量 | `640 root:www-data`，**含密钥** |
| `/etc/systemd/system/hellojourney-*.service` | 两个服务单元 | — |
| `/root/vhost-backup-*.conf` | nginx 配置备份 | 每次改动前生成 |

## 4. 常用运维命令

```bash
# 状态
systemctl status hellojourney-backend hellojourney-xhs nginx --no-pager
ss -tlnp | grep -E ':80 |:443 |:8000 |:8010 '

# 日志（实时）
journalctl -u hellojourney-backend -f
journalctl -u hellojourney-xhs -f

# 重启
systemctl restart hellojourney-backend     # 会中断正在生成的行程
systemctl restart hellojourney-xhs         # 换 cookie 后必须重启它

# 改完 nginx
nginx -t && systemctl reload nginx

# 证书续期（certbot 已装，通常自动）
certbot renew --dry-run && certbot certificates
```

## 5. 排障对照表

| 现象 | 最可能的原因 | 处理 |
|---|---|---|
| `/hellojourney/` 白屏、控制台 404 `/assets/...` | 前端构建漏了 `VITE_BASE_PATH=/hellojourney/` | 重新构建并覆盖 |
| 页面能开但接口全 404 | 产物里硬编码了 `http://127.0.0.1:8001` | 构建时 `VITE_API_BASE_URL=` 留空，重建 |
| 刷新深链 404 | 缺 `try_files $uri $uri/ /hellojourney/index.html` | 补 location 并 reload |
| 地图空白，控制台 `INVALID_USER_DOMAIN` | 前端 JS Key 未把 `liufengwei.com` 加进域名白名单 | 高德控制台加白名单 |
| 地图空白，控制台无报错 | 安全密钥 `VITE_AMAP_SECURITY_JS_CODE` 与 JS Key 不配对 | 核对并重建前端 |
| 景点图全变插画，日志 `infoCode=10007` | 后端 Key 开了「数字签名」 | 高德控制台关掉数字签名（无需重启后端） |
| 生成时 504 | 反代超时 < 620s | 调 `proxy_read_timeout/send_timeout` |
| 生成一直"已用时…"不结束 | 大模型单次调用过慢（2 天以上行程常见） | 见 AGENTS.md「已知问题」；可减少小红书笔记长度 |
| 小红书图片没了，日志 `code=300011` | cookie 被风控/退出登录 | 重新登录复制 cookie（含 `web_session`）→ 重启 `hellojourney-xhs` |
| 边车启动报 `window.mnsv2 is not a function` | node 版本太老（12） | 升到 18+ |
| 后端 OOM / 502 | 内存只有 1.7G，堆设太大 | 保持 `-Xmx512m`，别加常驻服务 |

## 6. 备份与回滚

| 要备份什么 | 命令 |
|---|---|
| nginx 配置 | `cp /etc/nginx/sites-available/youxi /root/vhost-backup-$(date +%F-%H%M).conf`（**改之前**） |
| 作品集整站（含游戏） | **已按要求删除，无快照**（如需重建只能从零再写） |
| 后端数据 | `tar czf /root/hj-data-$(date +%F).tgz -C /opt/hellojourney data` |
| 上一版 jar | 覆盖前先 `cp /opt/hellojourney/app.jar /opt/hellojourney/app.jar.bak` |
| 上一版前端 | 覆盖前先 `mv /var/www/youxi/hellojourney /var/www/youxi/hellojourney.bak` |

回滚 = 把 `.bak` 换回去 + `systemctl restart`。

## 7. 验证

```bash
ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
```

输出应全绿（服务 active、端口只绑回环、站点 200、`amap_maps_configured:true`、边车 ok）。
