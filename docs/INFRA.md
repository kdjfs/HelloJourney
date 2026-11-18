# 线上基础设施说明（INFRA）

> ⚠️ **当前状态：已全部下线（2026-11-18）。** 本文件前半部分是"现在的事实"，后半部分是**历史记录**，
> 仅在需要恢复时参考。给 AI 代理看的精简版在仓库根 [`AGENTS.md`](../AGENTS.md)。
> 最后核对：2026-11-18。

## 1. 现在的事实

| 事项 | 状态 |
|---|---|
| `liufengwei.com` / `www` / `blog` 解析 | **无 A 记录**（公共 DNS 已确认），全网访问不到 |
| 域名注册 | 仍在用户名下（NS `dns29/30.hichina.com`），用户未删除域名 |
| 网站内容 | 已删除：`/var/www/blog`（145 MB）、`/var/www/youxi`（个人主页 + 本项目前端） |
| 后端与边车 | 已删除：`/opt/hellojourney`（jar + data）、`/opt/xhs-sign`；systemd 单元已移除，8000/8010 无监听 |
| nginx | 仍在运行，唯一站点配置 `/etc/nginx/sites-available/parked`：80/443 一律 `return 410`，只保留 `/.well-known/acme-challenge/`（`root /var/www/acme`） |
| 证书 | `/etc/letsencrypt/live/liufengwei.com/` 仍在（到期 2027-02-15）。**没有 DNS 就无法自动续期**，将来恢复上线要先加回解析再续 |
| 服务器 | 阿里云 ECS `39.96.195.78`，Ubuntu 22.04，1 核 / 1.7 GB / 40 GB；还跑着与本项目无关的 1panel / astrbot |

验证一条命令：

```bash
ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
# 期望：三域名均无 A 记录、HTTP/HTTPS 均 410、站点目录与 systemd 单元不存在、8000/8010 无监听
```

## 2. 如果要恢复上线（用户先决定，代理不要擅自做）

1. **用户本人**在阿里云控制台加回解析：`A @ → 39.96.195.78`、`A www → 39.96.195.78`、`A blog → 39.96.195.78`；
2. 按 [`DEPLOY-JOURNEY.md`](DEPLOY-JOURNEY.md) 的"方案 C（主域名子路径）"重新构建并上传前端、部署后端；
3. 重建 systemd 服务（单元模板在 [`deploy/`](../deploy/)，边车见 [`deploy/xhs-service/README.md`](../deploy/xhs-service/README.md)）；
4. 恢复后把本文件第 1 节与 `AGENTS.md` 第 1 节改回"已上线"。

---

# 历史记录（2026-11-18 之前的拓扑）

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
