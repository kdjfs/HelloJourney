# AGENTS.md — AI 编码代理的项目记忆

> 这是给 **Codex / Claude Code / Cursor** 等编码代理看的"项目记忆"。接手本仓库前先读完本文件。
>
> **最后核对：2026-11-18。当前状态：站点已全部下线（用户明确要求），域名仍保留但已无 DNS 记录。**
> 不要试图"修复"或"恢复"线上站点，除非用户明确要求。

---

## 1. 当前状态（先看这一节）

| 事项 | 状态 |
|---|---|
| 线上站点 | **已下线**。2026-11-18 用户要求删除网站内容，服务器文件、systemd 服务、DNS 记录均已移除 |
| `liufengwei.com` 解析 | **无 A 记录**（`@` / `www` / `blog` 都被删了），全网无法解析，访问不到任何东西 |
| 域名注册 | **仍在用户名下**（NS `dns29/30.hichina.com`，SOA 正常），到期日见证书/控制台，用户未删除域名 |
| 服务器 | 仍在运行，只剩 nginx（停车配置，所有请求 `410 Gone`）+ 与本站无关的 1panel/astrbot |
| 项目代码 | 完整保留在 GitHub `kdjfs/HelloJourney`，本地 `D:\lfw-code\HelloJourney` |
| 本仓库的用途 | **纯代码仓库**：继续开发、跑测试、本地预览都可以；不要擅自部署或恢复域名 |

> 也就是说：这个项目现在是"归档/暂停上线"状态，不是"线上故障"。看到站点打不开是预期行为。

---

## 2. 项目是什么

HelloJourney（智途星旅）——AI 旅行规划 Web 应用，前后端分离：

| 部分 | 技术 | 本地端口 |
|---|---|---|
| 前端 | React 19 + TypeScript + Vite 8 + antd 6 + ECharts | 5173 |
| 后端 | Spring Boot 3.2.5 (Java 17) + OkHttp | 8001 |
| 小红书边车（仅线上曾用） | Python 3 + PyExecJS + Node（签名） | 8010 |

核心链路：生成行程 → `TripPlannerAgent`（并行拉 POI/天气/酒店/小红书笔记）→ `StructuredTripPlanService`（LLM 一次性输出整份 JSON + 校验修复）→ 结果页（地图/图片/知识图谱/编辑/AI 助手）。

---

## 3. 本地开发（现在唯一常用的部分）

```bash
# 后端（8001，自动加载仓库根 .env）
backend\run-backend-dev.cmd

# 前端（5173）
cd frontend && npm run dev
```

校验顺序：

- 前端：`npx tsc -b` → `npx eslint src` → `npx vitest run`（19 文件 / 82 用例）→ `npx vite build`
- 后端：`mvn -o test`（175 个用例；Windows 上 `JAVA_HOME` 要指向 IntelliJ 的 JBR，不是 `C:\Java\jdk-17`）

提交信息用 `feat(scope): ...` / `fix(scope): ...` / `chore(scope): ...`（英文正文）。

---

## 4. 服务器（仍然存在，但已无本站内容）

| 项 | 值 |
|---|---|
| 类型 | 阿里云 ECS `iZ2ze5cnizkduzc7pf0j5aZ`，公网 `39.96.195.78` |
| 系统 / 规格 | Ubuntu 22.04.5，1 核 / 1.7 GB / 40 GB |
| 登录 | `ssh astrbot-server`（本机 `~/.ssh/config` 已配好，root + 密钥） |
| nginx | 唯一站点配置 `/etc/nginx/sites-available/parked`：80/443 一律 `return 410`，只留 `/.well-known/acme-challenge/`（`root /var/www/acme`） |
| 证书 | `liufengwei.com` 与 `www`/`blog` 的 Let's Encrypt 证书仍在 `/etc/letsencrypt/live/liufengwei.com/`（到 2027-02-15）；**没有 DNS 就无法自动续期** |
| 已删除 | `/var/www/blog`（145 MB 博客）、`/var/www/youxi`（个人主页 + 本项目前端）、`/opt/hellojourney`（jar + data）、`/opt/xhs-sign`（边车）、两个 systemd 服务单元 |

**不要**在这台机器上重新创建站点、不要动 `/etc/nginx/sites-available/parked`、不要动 1panel/astrbot 相关目录（与本项目无关，属于用户其他用途）。

---

## 5. 历史部署方式（已下线，仅供将来恢复时参考）

当时为了和用户的博客/作品集共用域名，采用了**子路径**方案：

```
https://liufengwei.com/                    个人主页（单文件 index.html）
https://liufengwei.com/hellojourney/       本项目前端（/var/www/youxi/hellojourney）
https://liufengwei.com/api/                反代到 127.0.0.1:8000
https://blog.liufengwei.com/               个人博客
```

关键经验（恢复时仍然适用）：

1. **前端构建必须** `VITE_BASE_PATH=/hellojourney/ VITE_API_BASE_URL= npm run build`，否则产物里是根路径、挂子路径必然白屏；
2. 反代超时 **≥ 620s**（生成一份行程 3~6 分钟，默认 60s 会 504）；
3. 后端/边车**只绑 127.0.0.1**；
4. 高德 Web 服务 Key 必须**关闭数字签名**；前端 JS Key 要把域名加进**白名单**；
5. 小红书搜索已不再 SSR，必须走签名边车，且 cookie 必须含 `web_session`、服务器需要 Node 18+；
6. 完整手册：[`docs/DEPLOY-JOURNEY.md`](docs/DEPLOY-JOURNEY.md)；边车说明：[`deploy/xhs-service/README.md`](deploy/xhs-service/README.md)；
7. 个人主页源码：[`deploy/landing-page/index.html`](deploy/landing-page/index.html)（已不再线上，但保留）。

### 若要重新上线（必须由用户先决定）

1. 用户在阿里云控制台**加回 DNS**：`A @ → 39.96.195.78`、`A www → 同`、`A blog → 同`；
2. 再按 `docs/DEPLOY-JOURNEY.md` 的"方案 C（子路径）"重新上传前端、部署后端；
3. 重新创建 systemd 服务（单元文件模板在 `deploy/` 下）；
4. 恢复后把本文件第 1 节改回"已上线"。

> 域名注册、DNS、ICP 备案都只能用户本人在阿里云控制台操作，代理没有权限也不应该代劳。

---

## 6. 环境变量（恢复上线时才需要，当前服务器上已无这些配置）

| 变量 | 作用 | 注意 |
|---|---|---|
| `LLM_ACTIVE_PROVIDER=siliconflow` | 大模型供应商 | — |
| `LLM_SILICONFLOW_API_KEY` | 硅基流动 Key | 只放服务器/本地 `.env`，**不进仓库** |
| `LLM_SILICONFLOW_MODEL` | 建议 `deepseek-ai/DeepSeek-V3` | 4B/7B 小模型会反复修复到超时 |
| `LLM_TIMEOUT` / `AGENT_STRUCTURED_TIMEOUT_SECONDS` | 单次调用 / 整份 JSON 的超时（240） | 两者分开设置 |
| `AMAP_API_KEY` | 高德 **Web 服务** Key | 必须关闭「数字签名」，否则 `infoCode=10007` |
| `VITE_AMAP_WEB_JS_KEY` + `VITE_AMAP_SECURITY_JS_CODE` | 前端地图（构建期注入） | 域名要进白名单 |
| `XHS_COOKIE` / `XHS_SERVICE_URL` | 小红书登录态 / 签名边车地址 | cookie 必须含 `web_session` |
| `SETTINGS_ALLOW_SECRET_UPDATES=false` | 禁止网页改密钥 | 生产必须 false |
| `SERVER_ADDRESS=127.0.0.1` | 后端只绑回环 | — |

---

## 7. 硬性约束

1. **不要恢复线上站点、不要加回 DNS 相关操作、不要重建 `/var/www` 或 `/opt/hellojourney`**，除非用户明确要求。
2. 不要动 `/etc/nginx/sites-available/parked` 与 `/var/www/acme`；不要碰 1panel / astrbot 目录。
3. **不要把真实密钥写进仓库**（`.env`、`.env.*`、`deploy/env.production`、`frontend/.env.production.local` 均已 gitignore）。
4. 前端构建若要挂子路径，**必须**带 `VITE_BASE_PATH`；根路径部署则留空。
5. 服务器只有 **1.7 GB 内存**：Docker 构建（Maven+Node）在这台机器上会 OOM，构建放本地；JVM 用 `-Xmx512m`。
6. PowerShell 改文本会破坏 UTF-8（历史上踩过两次），请用编辑器 / `write` 工具。

---

## 8. 已知问题（工程层面，与上线无关）

1. **2 天以上的行程，结构化生成可能跑很久**（实测 > 10 分钟未返回）；任务超时（600s）不会打断正在进行的 LLM 调用。优化方向：减少参与规划的小红书笔记数量/正文长度、下调 `LLM_TIMEOUT`。
2. 小红书 cookie 会过期（`code=300011`），需要重新登录复制含 `web_session` 的 Cookie。
3. 小红书搜索不再 SSR（`feeds` 恒为空），必须走签名边车；node 12 会报 `window.mnsv2 is not a function`。
4. 高德图片只覆盖有 POI 照片的景点，长尾景点靠小红书实拍兜底，再失败才显示插画。
5. `mockServiceWorker.js` 会被打进 `dist`（无害但多余），清理时确认生产不注册 MSW。

---

## 9. 如何验证"记忆是否过期"

```bash
ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
```

期望结果（当前是"已下线"状态，不是上线状态）：

- `liufengwei.com` **无法解析**；
- 服务器上 nginx `active`，且 `curl -H 'Host: liufengwei.com' http://127.0.0.1/` 返回 `410`；
- `/var/www` 下**没有** `blog` / `youxi`，`/opt` 下**没有** `hellojourney` / `xhs-sign`；
- 8000 / 8010 **没有监听**。

任何一项不符 → 说明线上被改动过，先更新本文件再动代码。

---

## 10. 相关文档

- [`docs/INFRA.md`](docs/INFRA.md)：基础设施细节（历史拓扑、排障表、备份/回滚）
- [`docs/DEPLOY-JOURNEY.md`](docs/DEPLOY-JOURNEY.md)：从零部署手册（Docker / systemd / 子路径三种方案）
- [`deploy/xhs-service/README.md`](deploy/xhs-service/README.md)：小红书签名边车
- [`deploy/landing-page/index.html`](deploy/landing-page/index.html)：已下线的个人主页源码
- [`deploy/verify-prod.sh`](deploy/verify-prod.sh)：一条命令核对当前（下线）状态
