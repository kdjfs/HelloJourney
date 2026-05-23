# HelloJourney UniApp

基于 UniApp 3.0 + Vue 3 的微信小程序端，提供 AI 旅行规划的移动端体验，支持行程规划、结果查看、历史记录和运行时配置。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| UniApp | 3.0 | 跨平台框架 |
| Vue | 3.4 | UI 框架 |
| TypeScript | 5.5 | 类型安全 |
| Vite | 5.4 | 构建工具 |
| Sass | 1.77 | 样式预处理 |

## 项目结构

```
src/
├── App.vue                          # 应用根组件
├── main.ts                          # 入口文件
├── manifest.json                    # 小程序配置（appid 等）
├── pages.json                       # 页面路由与导航栏配置
├── uni.scss                         # 全局样式变量
├── env.d.ts                         # 类型声明
├── api/
│   ├── chat.ts                      # 聊天 API
│   ├── poi.ts                       # POI API
│   ├── settings.ts                  # 设置 API
│   └── trip.ts                      # 行程 API
├── components/
│   └── AiChat/
│       └── AiChat.vue               # AI 聊天组件
├── pages/
│   ├── index/
│   │   └── index.vue                # 首页 / 行程输入
│   ├── result/
│   │   └── result.vue               # 行程结果展示
│   ├── history/
│   │   └── history.vue              # 历史记录
│   └── settings/
│       └── settings.vue             # 设置页面
├── types/
│   └── api.ts                       # TypeScript 类型定义
└── utils/
    ├── http.ts                      # HTTP 请求封装（uni.request）
    └── websocket.ts                 # WebSocket 封装（uni.connectSocket）
```

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- 微信开发者工具

### 安装与编译

```bash
# 安装依赖
npm install

# 编译为微信小程序（开发模式）
npm run dev:mp-weixin

# 编译为微信小程序（生产模式）
npm run build:mp-weixin
```

### 微信开发者工具预览

1. 打开微信开发者工具
2. 选择「导入项目」
3. 目录选择 `dist/dev/mp-weixin`（开发）或 `dist/build/mp-weixin`（生产）
4. AppID 可在 `src/manifest.json` 中配置

### 后端连接

小程序默认连接 `http://127.0.0.1:8000`，可在「设置」页面修改 API 地址。

地址通过 `uni.setStorageSync('API_BASE_URL', url)` 持久化存储，HTTP 工具自动读取。

## 页面说明

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | pages/index/index | 行程输入表单，填写目的地/日期/偏好/预算 |
| 结果 | pages/result/result | 行程结果展示，每日行程卡片 + 预算面板 |
| 历史 | pages/history/history | 最近历史记录列表，支持跳转查看 |
| 设置 | pages/settings/settings | API 地址 / LLM 供应商 / API Key 配置 |

## 核心封装

### HTTP 请求（utils/http.ts）

基于 `uni.request` 封装，自动读取存储的 API 地址：

```typescript
import { get, post, put } from '@/utils/http'

const data = await get<ResponseType>('/api/trip/history')
const result = await post<ResponseType>('/api/trip/plan', payload)
```

### WebSocket（utils/websocket.ts）

基于 `uni.connectSocket` 封装，自动将 HTTP 地址转换为 WS 地址：

```typescript
import { connectTripTaskWebSocket } from '@/utils/websocket'

connectTripTaskWebSocket(
  taskId,
  (event) => { /* 进度更新 */ },
  (result) => { /* 任务完成 */ },
  (error) => { /* 错误处理 */ }
)
```

## 构建

```bash
# 生产构建
npm run build:mp-weixin
```

产物位于 `dist/build/mp-weixin`，可直接上传至微信小程序后台。
