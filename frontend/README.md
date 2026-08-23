# HelloJourney Frontend

基于 React 19 的 AI Travel Workspace，提供多城市输入、Agent 活动时间线、可编辑行程、撤销/重做、局部重规划和来源核验标签。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 6.0 | 类型安全 |
| Vite | 8 | 构建工具 |
| Ant Design | 6 | 组件库 |
| ECharts | 6 | 知识图谱可视化 |
| Axios | - | HTTP 请求 |
| React Router | 7 | 路由管理 |
| MSW | 2 | Mock Service Worker |
| Swiper | 12 | 轮播组件 |

## 项目结构

```
src/
├── App.tsx                          # 应用根组件
├── main.tsx                         # 入口文件
├── App.css                          # 全局样式
├── index.css                        # 基础样式
├── assets/                          # 静态资源
├── components/
│   ├── AIChat/                      # AI 对话面板
│   ├── BudgetPanel/                 # 预算面板
│   ├── KnowledgeGraph/              # 知识图谱可视化
│   ├── NavBar/                      # 导航栏
│   ├── OverviewAttractionCard/      # 景点概览卡片
│   └── TripDayCard/                 # 行程日卡片
├── pages/
│   ├── Landing/                     # 首页 / 行程输入
│   └── Result/                      # 行程结果展示
├── router/
│   └── index.tsx                    # 路由配置
├── services/
│   ├── apiClient.ts                 # Axios 实例
│   ├── chatApi.ts                   # 聊天 API
│   ├── otherApi.ts                  # 其他 API
│   ├── poiApi.ts                    # POI API
│   ├── settingsApi.ts               # 设置 API
│   └── tripApi.ts                   # 行程 API
├── types/
│   └── api.ts                       # TypeScript 类型定义
├── utils/
│   └── env.ts                       # 环境变量工具
├── styles/
│   └── global.css                   # 全局样式
└── mocks/
    ├── browser.ts                   # MSW 浏览器初始化
    ├── handlers.ts                  # Mock 请求处理器
    └── mockData.ts                  # Mock 数据
```

## 快速开始

### 环境要求

- Node.js 20+
- npm 8+（推荐使用仓库锁文件与 `npm ci`）

### 安装与启动

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev
```

前端默认运行在 `http://localhost:5173`。

### 代理配置

开发环境通过 Vite 代理转发 API 请求到后端（`vite.config.ts`）：

- `/api` → `http://localhost:8000`
- `/ws` → `ws://localhost:8000`

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_USE_MOCK` | 是否使用 MSW Mock 数据 | `true` |
| `VITE_API_BASE_URL` | 后端 API 地址 | 空（使用代理） |

```bash
# 连接真实后端
VITE_USE_MOCK=false npm run dev

# 指定后端地址
VITE_API_BASE_URL=http://your-server:8000 npm run dev
```

## 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Landing | 首页，行程输入表单 |
| `/result` | Result | 行程结果展示 |

## 核心组件

| 组件 | 说明 |
|------|------|
| AIChat | 浮动 AI 对话面板，支持上下文问答和快捷问题 |
| BudgetPanel | 预算面板，总额 + 景点/酒店/餐饮/交通分类 |
| KnowledgeGraph | ECharts 力导向知识图谱，支持拖拽/缩放/高亮 |
| TripDayCard | 每日行程卡片，展示景点/酒店/餐饮/天气 |
| OverviewAttractionCard | 景点概览卡片 |
| NavBar | 顶部导航栏 |

## Mock 开发

项目内置 MSW Mock 环境，覆盖 7 个 API 端点，支持独立于后端开发：

- 设置 `VITE_USE_MOCK=true` 启用
- Mock 数据位于 `src/mocks/mockData.ts`
- 请求处理器位于 `src/mocks/handlers.ts`

## 构建

```bash
# 类型检查 + 构建
npm run build

# 独立类型检查与组件测试
npm run typecheck
npm run test

# 预览构建产物
npm run preview

# 代码检查
npm run lint
```
