# LINGJING - AI Travel Planner

> 你的专属 AI 旅行规划师，输入目的地即可智能生成完整旅行方案。

## 技术栈

- **React 19** + **TypeScript**
- **Vite 8** 构建
- **Ant Design 6** UI 组件库
- **ECharts 6** 知识图谱可视化
- **MSW** (Mock Service Worker) API Mock
- **Axios** HTTP 客户端

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（默认启用 Mock）
npm run dev

# 生产构建
npm run build
```

## Mock 模式

本地开发环境**默认启用 Mock**，无需启动后端即可完整体验所有功能。

Mock 模式下拦截的 API：
- `POST /api/trip/plan` - 提交旅行计划
- `GET /api/trip/status/:taskId` - 查询任务状态
- `GET /api/trip/history` - 历史记录
- `GET /api/poi/photo` - 景点图片
- `POST /api/chat/ask` - AI 对话
- `GET /api/settings` - 获取配置
- `PUT /api/settings` - 更新配置

## 关闭 Mock 连接真实后端

1. 编辑 `.env.development`（或创建 `.env.local`）：

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000
```

2. 启动后端服务：

```bash
cd TripStar-main/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

3. 重启前端 `npm run dev`

## Network Error 常见原因

在关闭 Mock 后遇到 `Network Error`，请检查：

1. 后端服务是否已启动：`http://localhost:8000/health`
2. `VITE_API_BASE_URL` 是否填写正确
3. 浏览器控制台：Mock 是否成功关闭（`[APP] Mock 未启用，将请求真实后端`）
4. 如仍失败，可在终端查看 `[API] 网络请求失败` 的详细日志

## 项目结构

```
src/
├── components/          # 通用组件
│   ├── AIChat/          # AI 浮动聊天面板
│   ├── BudgetPanel/     # 预算面板
│   ├── KnowledgeGraph/  # ECharts 知识图谱
│   ├── NavBar/          # 顶部导航栏
│   ├── OverviewAttractionCard/  # 景点概览卡片
│   └── TripDayCard/     # 每日行程卡片
├── mocks/               # MSW Mock 配置
│   ├── browser.ts       # 浏览器 Worker
│   ├── handlers.ts      # API Handler
│   └── mockData.ts      # Mock 数据
├── pages/
│   ├── Landing/         # 首页（表单 + 历史 + 进度动画）
│   └── Result/          # 结果页（概览/预算/天气/行程/知识图谱）
├── router/              # 路由配置
├── services/            # API 层
│   ├── apiClient.ts     # Axios 实例 + 拦截器
│   ├── tripApi.ts       # 行程相关 API + WebSocket
│   ├── poiApi.ts        # POI 相关 API
│   └── settingsApi.ts   # 配置相关 API
├── types/               # TypeScript 类型定义
│   └── api.ts
├── utils/               # 工具函数
│   └── env.ts           # 环境/模式判断
├── styles/              # 全局样式
├── App.tsx
└── main.tsx
```

## 与原 Vue 项目对齐

| 模块 | 对齐状态 |
|------|----------|
| Landing 首页 | ✅ Hero/Fixed BG Header/表单/偏好/进度动画/历史记录/响应式 |
| Result 结果页 | ✅ 概览/预算/天气/每日行程/知识图谱/ECharts/景点图片 |
| NavBar 导航栏 | ✅ 透明渐变/品牌 Logo/导航链接 |
| AIChat AI 对话 | ✅ 猫头鹰面板/快捷问题/多条对话/加载动画 |
| OverviewAttractionCard | ✅ hover 展开详情/跳转对应 Day |
| TripDayCard | ✅ 景点列表/餐饮/酒店/注意事项 |
| BudgetPanel | ✅ 分类预算/总计/进度条 |

## 尚未实现

- 地图集成（高德 JS API）
- WebSocket 实时推送（代码已就绪，需启动后端）
- 国际化 (i18n)
- html2canvas 行程导出
- POI 详情弹窗