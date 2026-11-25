# CLAUDE.md

本仓库的代理说明统一维护在 **[AGENTS.md](AGENTS.md)**，请先完整读取它再动任何代码。

要点速览（完整约束见 AGENTS.md 第 7 节）：

- 线上地址：`https://liufengwei.com/hellojourney/`（同一域名下还有个人主页与博客 `blog.liufengwei.com`，**不要动它们的文件**；游戏作品集已于 2026-11-18 彻底删除且不恢复）
- 前端构建必须：`VITE_BASE_PATH=/hellojourney/ VITE_API_BASE_URL= npm run build`
- 服务器：`ssh astrbot-server`（Ubuntu 22.04，1.7G 内存），后端 8000 / 边车 8010 都只绑 127.0.0.1
- 密钥只放服务器 `/etc/hellojourney/env` 与本地 `.env`，**禁止提交**
- 改完基础设施请同步更新 `AGENTS.md` 与 `docs/INFRA.md`
