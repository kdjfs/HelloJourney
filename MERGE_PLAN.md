# HelloJourney V3 合并计划（MERGE_PLAN）

> 状态：**等待人工确认。** 未执行 `git merge`、未 `git push`、未切换/修改 `main`。
> 配套文档：`docs/HELLOJOURNEY_V3_RELEASE_NOTES.md`（详细升级记录）。

## 1. 当前分支变化

| 项 | 值 |
| --- | --- |
| 来源分支 | `test/hello-journey-v3-upgrade` |
| 来源分支 HEAD | `bceae82680ee44b04b228c66f734a020f9c8d27a` |
| 目标分支 | `main`（`a479cba80b981450e1c1fe89e292baca0ca31b5d`） |
| 分支关系 | main 是来源分支的祖先；main 无独有提交 → **可 fast-forward，当前无冲突** |
| 保护标签 | `v2-before-v3-upgrade` → `a479cba`（已创建并核验，勿删除） |
| 差异规模 | 42 个提交（V3 后端 Agent 化 + 前端工作区 + 图片真实性 + codex 前端升级 + 配置接线/发布文档） |
| 远程 | https://github.com/kdjfs/HelloJourney.git |

变化摘要：

1. **后端**：原生 Tool Calling、Structured Output、Review Agent、异步任务状态机、局部重规划、Secret 安全边界、高德 POI 图片 Provider。
2. **前端**：可编辑工作区（undo/redo、草稿、局部重规划）、预算/天气/图谱/AI 助手、图片灯箱与确定性占位。
3. **codex 前端升级**：3D 景点地图、中英日 i18n、含地图 PNG 导出、编辑实时联动、预约提醒、`/settings` 只读配置页、ECharts 模块化（KG chunk -53%）、AI 助手正式页签。
4. **工程化**：CI、Docker/Nginx/Compose、测试体系、部署/升级/发布文档。

## 2. 合并风险

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| main 在确认前新增提交 | 中 | 合并前重新 `git fetch` 核验 `origin/main` 与 merge-base；只允许 `--ff-only` |
| `GET /api/poi/photo` 协议变更（city 必填、响应结构变化） | 高 | Web/UniApp 已同步；上线前跑契约冒烟；发布说明已标注 Breaking Change |
| Settings 写入收紧（生产禁写 Secret） | 中 | 用环境变量/Secret Manager；保持 `SETTINGS_ALLOW_SECRET_UPDATES=false` |
| 前端地图构建期变量缺失 | 中 | CI 用空 Key 验证降级；Staging 配 Key + 域名白名单后视觉验收 |
| 高德 JS Key 进入前端 bundle | 低（设计预期） | JS Key 是客户端公开凭证：必须启用安全密钥、域名白名单、配额告警；**服务端 Key 不入 bundle** |
| 小红书 Cookie 失效/风控 | 中 | Adapter 降级，非 SLA；Cookie 不提交 Git |
| 单实例任务持久化 | 高（公网） | V3 只声明单实例 ready；多实例前引入 DB/Redis/队列 |
| 无认证/所有权/限流 | 高（公网） | 合并不等于公网生产就绪；开放前补齐 |
| localStorage 草稿无迁移/TTL | 中 | 下一版本加 schema version |
| PNG 导出跨域/WebGL 差异 | 中 | 两阶段截图 + 无地图降级；真实 Key 下视觉复核 |
| 历史疑似 Secret | 高 | 仓库所有者必须在 Provider 控制台 revoke/rotate（见升级报告 §6） |

## 3. 冲突可能位置

当前 main 无新增提交，**理论上零冲突**。若 main 在合并前发生变化，优先关注：

- `frontend/src/pages/Result/index.tsx|css`（地图/AI 页签、联动、i18n）
- `frontend/src/pages/Landing/index.tsx|css`（日期/城市/i18n）
- `frontend/src/main.tsx`、`components/AppProviders/`（Provider 层）
- `frontend/src/router/index.tsx`、`components/NavBar/`（`/settings`）
- `frontend/src/features/export/*`（JSON/PDF + PNG 导出）
- `frontend/src/features/trip-workspace/*`（reducer、derivedPlan）
- `frontend/package.json|lock`、`vite.config.ts`
- `backend/src/main/resources/application*.yml`、`.env*.example`、`docker-compose.dev.yml`
- `frontend/src/types/api.ts` 与 `uniapp/src/types/api.ts`
- `.gitignore`、根目录文档

冲突处理原则：不在 main 上手工修；出现冲突则回来源分支处理、重跑门禁后再 `--ff-only`；不 force push、不 rebase、不删保护标签。

## 4. 合并后验证步骤（人工确认后执行）

### A. Git

```bash
git status --short
git log --oneline --decorate -20
git diff --exit-code test/hello-journey-v3-upgrade..main
git rev-parse v2-before-v3-upgrade^{commit}   # 必须 = a479cba...
```

### B. Frontend

```bash
cd frontend && npm ci
npm run typecheck && npm run lint
npm run test -- --pool=threads --maxWorkers=1
npm run build && npm audit --omit=dev
```

基线：typecheck PASS、lint PASS、tests 0 失败、build PASS、audit 0。

### C. Backend

```bash
cd backend && mvn test && mvn package
```

基线：152 tests / 0 failure / 0 error。

### D. Docker / HTTP 冒烟

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

- 前端 `/healthz` 200；后端 `/health` 200；Nginx `/api/trip/health` 200
- `/settings` 200；`/api/settings` 只返回状态不返回 Secret
- 真实 Key 下 `/api/poi/photo` → `verified=true`

### E. 浏览器全流程（用真实 Key）

1. Landing：中文日历、日期限制、途经城市回显、路线预览
2. 中/英/日切换：UI/AntD/Day.js/请求语言同步，`hj.locale` 刷新后保持
3. 生成单城 + 多城行程：WS 进度 → completed → Result
4. Result 各页签：概览/地图/预算/天气/每日行程/知识图谱/AI 助手
5. 地图：暗色 3D、编号 Marker、InfoWindow、路线降级、卡片定位；无 Key fallback
6. 编辑：增删改/排序/跨天移动/酒店修改；undo/redo 后地图/图谱/预算实时一致
7. 图片：真实已验证图片、点击放大/前后切换；无匹配确定性占位
8. 预约提醒角标/Tooltip + Tag
9. PNG 导出：含地图版本 + 地图失败无地图版本
10. Settings 只读页无 Secret 表单
11. `/api/chat/ask` 与局部重规划 Apply/Reject
12. 390×844 无水平溢出；桌面无回归

### F. 安全

- `main..HEAD` 差异与当前树扫描：无真实 Secret（sk-*、服务端 Key、Cookie、私钥）
- `.env`、运行时设置、任务数据、本地反馈目录未被跟踪
- 历史疑似 Secret 已在控制台失效/轮换

## 5. 建议合并命令（仅人工确认后）

```bash
git fetch origin --prune --tags
git switch test/hello-journey-v3-upgrade
git status --short            # 干净
git merge-base --is-ancestor main test/hello-journey-v3-upgrade
git switch main
git merge --ff-only test/hello-journey-v3-upgrade
# 本地验证全部通过后再 git push；推送时保留标签 v2-before-v3-upgrade
```

## 6. 回滚

- 未 push：`git reset --hard v2-before-v3-upgrade`（仅负责人批准）。
- 已 push：不改写历史，对 V3 提交区间做 revert PR，保留保护标签作审计锚点。

## 7. 当前状态

- [x] 版本关系审查（fast-forward 可行，无冲突）
- [x] `docs/HELLOJOURNEY_V3_RELEASE_NOTES.md` 更新至 `bceae82`
- [x] 保护标签 `v2-before-v3-upgrade` 创建并核验
- [x] 本 MERGE_PLAN.md
- [x] 运行时配置验证（AMap 服务端/JS、XHS、Tencent、DeepSeek）
- [ ] 最终全量门禁复跑（合并前一次）
- [ ] 人工确认

**当前禁止：`git merge`、`git push`、修改 main。**
