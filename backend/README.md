# HelloJourney Backend

基于 Spring Boot 3.2.5 的 AI 旅行规划后端服务，提供 LLM 多智能体行程规划、小红书内容抓取、地图服务集成、知识图谱生成等核心能力。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Java | 17 | 运行环境 |
| Spring Boot | 3.2.5 | Web 框架 |
| Spring WebSocket | - | 实时推送 |
| OkHttp | 3 | HTTP 客户端 |
| GraalVM JS | 23.0.1 | JavaScript 引擎（JSON 修复） |
| SpringDoc OpenAPI | 2.5.0 | API 文档 |
| Lombok | - | 代码简化 |
| JaCoCo | 0.8.12 | 测试覆盖率 |
| JUnit 5 + Mockito | - | 测试框架 |

## 项目结构

```
src/main/java/com/hellojourney/
├── HelloJourneyApplication.java     # 应用入口
├── agent/
│   └── TripPlannerAgent.java        # AI 行程规划 Agent
├── config/
│   ├── AppSettings.java             # 应用配置属性
│   ├── AsyncConfig.java             # 异步任务配置
│   ├── CorsConfig.java              # 跨域配置
│   ├── OpenApiConfig.java           # Swagger 文档配置
│   ├── RuntimeSettingsManager.java  # 运行时配置管理
│   └── WebSocketConfig.java         # WebSocket 配置
├── controller/
│   ├── ChatController.java          # AI 对话
│   ├── MapController.java           # 地图服务
│   ├── PoiController.java           # POI 查询
│   ├── RootController.java          # 根路径/健康检查
│   ├── SettingsController.java      # 运行时配置
│   └── TripController.java          # 行程规划
├── model/
│   ├── dto/                         # 数据传输对象
│   ├── entity/                      # 实体模型
│   └── vo/                          # 视图对象
├── service/
│   ├── ChatService.java             # AI 对话服务
│   ├── GoogleMapService.java        # Google Maps 服务
│   ├── KnowledgeGraphService.java   # 知识图谱服务
│   ├── LlmService.java              # LLM 调用服务
│   ├── MapDispatcher.java           # 多地图服务调度
│   ├── TencentMapService.java       # 腾讯地图服务
│   └── XhsService.java             # 小红书内容抓取
└── websocket/
    └── TripTaskWebSocketHandler.java # 行程任务 WebSocket 推送
```

## 快速开始

### 环境要求

- JDK 17+
- Maven 3.8+

### 启动

```bash
# 编译并运行（dev 环境）
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 或指定 prod 环境
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

服务默认运行在 `http://localhost:8000`。

### 配置

配置文件位于 `src/main/resources/application.yml`，支持 `dev`/`test`/`prod` 三个 Profile。

核心配置项：

```yaml
app:
  llm:
    active-provider: deepseek       # 当前 LLM 供应商
    providers:
      deepseek:
        api-key: ${LLM_DEEPSEEK_API_KEY:}
        base-url: https://api.deepseek.com
        model: deepseek-v4-pro

  xhs:
    cookie: "你的小红书Cookie"       # 小红书内容抓取

  tencent-maps:
    key: "你的腾讯地图KEY"           # 腾讯地图服务

  google-maps:
    api-key: ""                     # Google Maps（可选）
    proxy: ""                       # 代理地址（可选）
```

也可通过环境变量配置，参考 `.env.example`。

### 运行时配置

配置 API 默认只公开非敏感状态：

- `GET /api/settings` — 获取当前配置
- `PUT /api/settings` — 生产默认关闭；仅在显式开启并携带管理令牌时可用
- `GET /api/settings/llm-providers` — 获取 LLM 供应商列表

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
| `/api/poi/search` | GET | POI 搜索 |
| `/api/poi/detail/{poiId}` | GET | POI 详情 |
| `/api/poi/photo` | GET | 获取景点图片 |
| `/api/map/poi` | GET | 地图 POI 搜索 |
| `/api/map/weather` | GET | 天气查询 |
| `/api/map/route` | POST | 路线规划 |
| `/api/settings` | GET/PUT | 运行时配置管理 |
| `/api/settings/llm-providers` | GET | LLM 供应商列表 |

API 文档：启动后访问 `http://localhost:8000/swagger-ui.html`

## 支持的 LLM 供应商

| 供应商 | 模型 | 说明 |
|--------|------|------|
| DeepSeek | deepseek-v4-pro | 默认推荐 |
| OpenAI | gpt-4 | 需代理 |
| GLM (智谱) | glm-4 | |
| 豆包 (字节) | doubao-pro-4k | |
| Kimi (Moonshot) | moonshot-v1-8k | |
| Grok (xAI) | grok-2 | 需代理 |
| MiniMax | MiniMax-Text-01 | |
| 阿里百炼 | qwen-turbo | |
| 硅基流动 | Qwen2.5-7B-Instruct | |

## 测试

```bash
# 运行全部测试（使用 test profile）
mvn test

# 查看测试覆盖率报告
# 报告生成在 target/site/jacoco/index.html
```

## 构建

```bash
# 打包（跳过测试）
mvn clean package -DskipTests

# 运行 jar
java -jar target/HelloJourney-backend-2.0.0.jar --spring.profiles.active=prod
```
