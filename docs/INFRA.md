# 线上基础设施说明（INFRA）

> **当前状态：已恢复上线（2026-11-25）。** 剩下唯一待办：`liufengwei.com` 的 `@` / `www` / `blog`
> 三条 **A 记录需要用户在阿里云控制台加回**（`A → 39.96.195.78`），加回后公网即可访问。
> 给 AI 代理看的精简版在仓库根 [`AGENTS.md`](../AGENTS.md)。最后核对：2026-11-25。

## 1. 现在的事实

| 事项 | 状态 |
|---|---|
| 网站内容 | 已恢复：`/var/www/youxi/`（个人主页 + `hellojourney/` 前端，2.6 MB）、`/var/www/blog/`（Astro 博客，28 MB） |
| 后端与边车 | 已恢复：`/opt/hellojourney`（jar + data）、`/opt/xhs-sign`；`hellojourney-backend`、`hellojourney-xhs` 两个 systemd 服务 enabled + active |
| 端口 | 80/443 nginx；8000（后端）、8010（边车）**只绑回环**；8080 默认站（历史遗留） |
| nginx | 唯一配置 `/etc/nginx/sites-available/liufengwei.com`（源码 `deploy/nginx-liufengwei.conf`）：`/hellojourney/` 静态、`/api/` 与 `/api/trip/ws/` 反代（620s）、`blog.liufengwei.com` 独立 server 块、80 跳 https + ACME 目录 |
| 公网 DNS | ⚠️ **`@`/`www`/`blog` 三条 A 记录仍缺失**（2026-11-18 被删）。服务器侧全部就绪，加回解析即可公网访问 |
| 证书 | `/etc/letsencrypt/live/liufengwei.com/`（到期 2027-02-15）。DNS 缺失期间无法自动续期；加回解析后 `certbot renew` 正常 |
| 游戏作品集 | **已彻底删除且不再恢复**（2026-11-18，用户明确要求，无副本） |
| 服务器 | 阿里云 ECS `39.96.195.78`，Ubuntu 22.04，1 核 / 1.7 GB / 40 GB，nginx **1.18**；另有与本项目无关的 1panel / astrbot |

验证一条命令（用 `--resolve` 直连本机，不依赖 DNS）：

```bash
ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
# 期望：三个服务 active、站点与接口 200、amap/xhs=true、边车 ok；DNS 缺失只报 WARN
```

## 2. 仍需用户本人操作（代理做不了）

在阿里云「云解析 DNS → liufengwei.com → 解析设置」添加三条记录（TTL 默认 10 分钟）：

| 主机记录 | 类型 | 记录值 |
|---|---|---|
| `@` | A | `39.96.195.78` |
| `www` | A | `39.96.195.78` |
| `blog` | A | `39.96.195.78` |

> 2026-11-18 删掉的就是这三条。加回后约 1~10 分钟生效；
> 然后 `ssh astrbot-server 'certbot renew --dry-run'` 确认证书续期链路恢复。

---

# 附：拓扑细节与排障（与上线状态无关的常青内容）

## 3. 三个站点共用一个域名

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

nginx 配置全部在 `/etc/nginx/sites-available/youxi`（六个 server 块：8080 默认站、80 跳转 ×2、
443 主站、443 博客、443 www 跳转）。

## 4. 为什么用子路径而不是子域名

- 域名解析在阿里云，当时只有 `@` / `www` / `blog` 三条 A 记录，**没有泛解析**；
- 加 `journey.liufengwei.com` 要动 DNS + 单独签证书，而子路径只需改 nginx 一次并复用现有证书；
- 代价：前端必须 `VITE_BASE_PATH=/hellojourney/` 构建，路由 basename 跟随 `BASE_URL`。

## 5. 历史端口分配

| 端口 | 谁 | 绑定 |
|---|---|---|
| 80 / 443 | nginx | `0.0.0.0` |
| 8080 | nginx 默认站（遗留） | `0.0.0.0` |
| 8000 | Java 后端 | **127.0.0.1** |
| 8010 | 小红书签名边车 | **127.0.0.1** |

## 6. 历史排障对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| 子路径白屏、`/assets/*` 404 | 构建漏了 `VITE_BASE_PATH=/hellojourney/` | 重新构建 |
| 接口全 404 | 产物里硬编码了 `http://127.0.0.1:8001` | 构建时 `VITE_API_BASE_URL=` 留空 |
| 刷新深链 404 | 缺 `try_files … /hellojourney/index.html` | 补 location |
| 地图空白 + `INVALID_USER_DOMAIN` | 前端 JS Key 未把域名加白名单 | 高德控制台加白名单 |
| 景点图全变插画 + `infoCode=10007` | 后端 Key 开了「数字签名」 | 关掉（无需重启） |
| 生成时 504 | 反代超时 < 620s | 调 `proxy_read_timeout/send_timeout` |
| 生成一直"已用时…" | 大模型单次调用过慢（2 天以上行程） | 减少小红书笔记长度、下调超时 |
| 小红书图片消失 + `code=300011` | cookie 被风控 | 重新登录复制含 `web_session` 的 cookie → 重启边车 |
| 边车 `window.mnsv2 is not a function` | node < 18 | 升级 node |
| 验证脚本报 `000` | 服务器无 IPv6 路由 | 所有 `curl` 加 `-4` |

## 7. 历史备份习惯（恢复时照做）

| 对象 | 命令 |
|---|---|
| nginx 配置 | `cp /etc/nginx/sites-available/youxi /root/vhost-backup-$(date +%F-%H%M).conf`（改之前） |
| 后端数据 | `tar czf /root/hj-data-$(date +%F).tgz -C /opt/hellojourney data` |
| 上一版 jar | `cp /opt/hellojourney/app.jar /opt/hellojourney/app.jar.bak` |
| 上一版前端 | `mv /var/www/youxi/hellojourney /var/www/youxi/hellojourney.bak` |

> 2026-11-18 的删除是在用户明确要求下做的：站点内容、后端、边车、以及**服务器上仅存的两份游戏备份**
> 全部删除，**没有保留任何副本**（博客源码在用户本地 git 仓库、HelloJourney 在 GitHub）。
