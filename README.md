# HelloJourney - AI 智能旅行助手

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://adoptium.net/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.2.5-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6.svg)](https://www.typescriptlang.org/)

**HelloJourney（HelloAgents 智能旅行助手）** 是一款基于大语言模型（LLM）的 AI 旅行规划平台。输入目的地、偏好和预算，系统自动利用小红书真实游记数据、地图服务和知识图谱，生成完整的个性化旅行方案。

## 功能特性

### 已实现功能

| 功能 | 完成度 | 说明 |
|------|--------|------|
| AI 行程规划 | ✅ 完成 | 基于 LLM 多智能体协作，自动生成包含景点、酒店、餐饮、交通的完整旅行计划，支持多城市行程 |
| 小红书内容集成 | ✅ 完成 | SSR 爬取小红书热门游记，LLM 提纯为结构化景点推荐，含地理编码和预约信息 |
| 腾讯地图服务 | ✅ 完成 | POI 搜索、天气查询、路线规划、地理编码、POI 详情五大功能齐全 |
| Google Maps 服务 | ✅ 完成 | Places API 搜索、Geocoding、Directions 路线规划、Weather API 天气查询 |
| 知识图谱可视化 | ✅ 完成 | ECharts 力导向图，节点可拖拽/缩放/高亮，支持中/英/日三语国际化 |
| 天气预报集成 | ✅ 完成 | 行程自动关联目的地天气，前端含 6 种 CSS 动画天气图标 |
| 多语言支持 | ✅ 完成 | 支持中文、英文、日文、韩文、法文、德文、西班牙文等多语言输出 |
| 多 LLM 供应商 | ✅ 完成 | 支持 DeepSeek、OpenAI、GLM、豆包、Kimi、Grok、MiniMax、阿里百炼、硅基流动等 9 种模型 |
| AI 上下文对话 | ✅ 完成 | 基于旅行计划上下文的智能问答，浮动聊天面板 + 快捷问题按钮 |
| WebSocket 实时推送 | ✅ 完成 | 任务进度实时推送，支持 BlockingQueue 订阅和自动重连 |
| 运行时配置管理 | ✅ 完成 | 前后端动态配置 API Key、供应商切换，持久化到 `runtime_settings.json` |
| 异步任务系统 | ✅ 完成 | 旅行规划异步执行，支持状态轮询和 WebSocket 双模式获取进度 |
| 多重 JSON 容错 | ✅ 完成 | LLM 输出 JSON 自动修复：去注释、修标点、补括号、修引号、LLM 修复兜底 |
| 历史记录 | ✅ 完成 | 展示最近 8 条历史计划，支持刷新和跳转查看 |
| 预算面板 | ✅ 完成 | 总额 + 景点/酒店/餐饮/交通四项分类展示 |
| 暗色主题 UI | ✅ 完成 | 全站暗色毛玻璃风格，Hero 视差滚动 + 云层/雾气动画 |
| Mock 开发环境 | ✅ 完成 | MSW 完整 Mock 7 个 API 端点，支持 `VITE_USE_MOCK=true` 开关 |
| 后端单元测试 | ✅ 完成 | JUnit 5 + Mockito 覆盖 Controller/Service/Agent/WebSocket 各层 |

### 部分实现 / 待完善

| 功能 | 完成度 | 说明 |
|------|--------|------|
| MapDispatcher 统一调度 | 🔧 部分 | 仅地理编码实现了统一调度，POI/天气/路线仍硬编码调用腾讯地图 |
| AI 聊天辅助功能 | 🔧 部分 | 附件/图片/语言 3 个按钮已预留但 disabled，不支持 Markdown 渲染 |
| 预算可视化 | 🔧 部分 | 仅数字展示，未使用 ECharts 制作饼图/柱状图 |
| 景点图片加载 | 🔧 部分 | 通过小红书 API 异步加载，fallback 使用随机图片 |

### 未来规划

| # | 功能 | 说明 |
|---|------|------|
| 1 | 🗺️ 交互式地图展示 | 在行程结果页嵌入地图组件，标注景点/酒店/餐饮位置，展示每日路线轨迹 |
| 2 | 💾 数据库持久化 | 引入数据库（如 PostgreSQL/MongoDB）替代文件系统存储，支持计划永久保存和高效查询 |
| 3 | 🔐 用户认证与授权 | 实现用户注册/登录、OAuth 第三方登录，支持个人行程管理和隐私保护 |
| 4 | 📤 行程分享与导出 | 支持生成分享链接、导出 PDF/图片行程单，方便离线查看和社交分享 |
| 5 | ⚙️ 前端设置页面 | 实现 API Key、LLM 供应商、地图服务等配置的 UI 管理界面（后端 API 已就绪） |
| 6 | 🔗 真正的工具调用（Tool Use） | 实现标准 Function Calling 协议，让 LLM 真正调用天气/酒店/POI API 获取实时数据，而非依赖 LLM 编造 |
| 7 | 🌐 Google Maps 代理支持 | 完善 GoogleMapService 的代理配置，使中国大陆用户可正常访问 Google API |
| 8 | 📱 移动端适配优化 | 完善响应式布局，实现汉堡菜单、触屏手势、PWA 离线支持 |
| 9 | 🤖 多 Agent 协作增强 | 拆分为景点 Agent、酒店 Agent、美食 Agent 等专业子 Agent，支持并行执行和结果融合 |
| 10 | 💬 AI 聊天增强 | 支持 Markdown 渲染、流式输出（SSE）、多轮对话记忆、图片/语音输入 |

## 技术栈

### 后端
| 技术 | 说明 |
|------|------|
| Java 17 | 运行环境 |
| Spring Boot 3.2.5 | Web 框架 |
| OkHttp 3 | HTTP 客户端 |
| Jackson | JSON 序列化 |
| Lombok | 代码简化 |
| JUnit 5 + Mockito | 测试框架 |

### 前端
| 技术 | 说明 |
|------|------|
| React 19 | UI 框架 |
| TypeScript 6 | 类型安全 |
| Vite 8 | 构建工具 |
| Ant Design 6 | 组件库 |
| ECharts 6 | 知识图谱可视化 |
| Axios | HTTP 请求 |
| React Router 7 | 路由管理 |
| MSW | Mock Service Worker |

## 快速开始

### 环境要求

- **JDK 17+**
- **Maven 3.8+**
- **Node.js 20+**
- **npm 10+**

### 1. 克隆项目

```bash
git clone https://github.com/your-org/HelloJourney.git
cd HelloJourney
```

### 2. 启动后端

```bash
cd backend

# 编译并运行
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

后端默认运行在 `http://localhost:8000`。

### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端默认运行在 `http://localhost:5173`。

### 4. 配置

后端配置位于 `backend/src/main/resources/application.yml`，核心配置项：

```yaml
app:
  xhs:
    cookie: "你的小红书Cookie"          # 用于抓取小红书内容

  llm:
    active-provider: deepseek           # 当前使用的 LLM
    providers:
      deepseek:
        name: DeepSeek
        api-key: "sk-xxxxxxxxxxxxx"
        base-url: https://api.deepseek.com/v1
        model: deepseek-chat

  tencent-maps:
    key: "你的腾讯地图KEY"              # 腾讯地图服务

  google-maps:
    api-key: "你的GoogleMaps API KEY"  # Google Maps 服务（可选）
```

也可以通过前端的「设置」页面动态配置，配置会持久化到 `runtime_settings.json`。

## 项目结构

```
HelloJourney/
├── backend/                          # Spring Boot 后端
│   ├── src/main/java/com/hellojourney/
│   │   ├── agent/                    # AI Agent 行程规划
│   │   ├── config/                   # 应用配置
│   │   ├── controller/               # REST API 控制器
│   │   ├── model/
│   │   │   ├── dto/                  # 数据传输对象
│   │   │   ├── entity/               # 实体模型
│   │   │   └── vo/                   # 视图对象
│   │   ├── service/                  # 业务逻辑层
│   │   │   ├── LlmService.java       # LLM 调用服务
│   │   │   ├── XhsService.java       # 小红书内容抓取
│   │   │   ├── TencentMapService.java
│   │   │   ├── GoogleMapService.java
│   │   │   ├── MapDispatcher.java    # 多地图服务调度
│   │   │   └── KnowledgeGraphService.java
│   │   └── websocket/               # WebSocket 实时推送
│   ├── src/main/resources/
│   │   └── application.yml           # 主配置文件
│   └── pom.xml
├── frontend/                         # React 前端
│   ├── src/
│   │   ├── components/               # UI 组件
│   │   │   ├── AIChat/               # AI 对话面板
│   │   │   ├── BudgetPanel/          # 预算面板
│   │   │   ├── KnowledgeGraph/       # 知识图谱可视化
│   │   │   ├── TripDayCard/          # 行程日卡片
│   │   │   └── NavBar/               # 导航栏
│   │   ├── pages/
│   │   │   ├── Landing/              # 首页 / 行程输入
│   │   │   └── Result/               # 行程结果展示
│   │   ├── services/                 # API 调用层
│   │   ├── types/                    # TypeScript 类型定义
│   │   └── mocks/                    # MSW Mock 数据
│   └── package.json
├── data/                             # 运行时数据（.gitignore）
├── .gitignore
├── LICENSE                           # GPL v2
└── README.md
```

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 系统基本信息 |
| `/health` | GET | 健康检查 |
| `/api/chat/ask` | POST | AI 上下文对话 |
| `/api/trip/plan` | POST | 提交异步旅行规划任务 |
| `/api/trip/status/{taskId}` | GET | 查询任务状态 |
| `/api/trip/history` | GET | 获取历史记录 |
| `/api/trip/ws/{taskId}` | WebSocket | 任务进度实时推送 |
| `/api/poi/search` | GET | POI 搜索（腾讯地图） |
| `/api/poi/detail/{poiId}` | GET | POI 详情 |
| `/api/poi/photo` | GET | 获取景点图片（小红书） |
| `/api/map/poi` | GET | 地图 POI 搜索 |
| `/api/map/weather` | GET | 天气查询 |
| `/api/map/route` | POST | 路线规划 |
| `/api/settings` | GET | 获取运行时配置 |
| `/api/settings` | PUT | 更新运行时配置 |
| `/api/settings/llm-providers` | GET | 获取 LLM 供应商列表 |

## 许可证

本项目基于 [GNU General Public License v2.0](LICENSE) 开源。

## 作者

| 角色 | 作者 | 邮箱 |
|------|------|------|
| 前端 | lfw | lfw2663040734@qq.com |
| 后端 | linyi | jingshuihuayue@qq.com |

## 致谢

本项目参考和灵感来源：[TripStar](https://github.com/1sdv/TripStar)

## 贡献

欢迎提交 Issue 和 Pull Request。贡献前请阅读现有代码风格，保持一致性。