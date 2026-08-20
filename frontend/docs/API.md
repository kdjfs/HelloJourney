# HelloJourney API 接口文档

本项目兼容原 TripStar 后端 API�?
> **基础 URL**：`http://localhost:8000`（开发）/ 同源部署（Docker 生产�?> **最后更�?*�?026-05-23（基于后端源码重新生成）
> **数据格式**：请求体 `application/json`，响应体 `application/json`

---

## 目录

1. [通用约定](#0-通用约定)
2. [GET /health](#1-get-health)
3. [POST /api/trip/plan](#2-post-apitripplan)
4. [WebSocket /api/trip/ws/{task_id}](#3-websocket-apitripwstask_id)
5. [GET /api/trip/status/{task_id}](#4-get-apitripstatustask_id)
6. [GET /api/trip/history](#5-get-apitriphistory)
7. [GET /api/trip/health](#6-get-apitriphealth)
8. [GET /api/poi/photo](#7-get-apipoiphoto)
9. [GET /api/poi/search](#8-get-apipoisearch)
10. [GET /api/poi/detail/{poi_id}](#9-get-apipoidetailpoi_id)
11. [GET /api/map/poi](#10-get-apimappoi)
12. [GET /api/map/weather](#11-get-apimapweather)
13. [POST /api/map/route](#12-post-apimaproute)
14. [GET /api/map/health](#13-get-apimaphealth)
15. [POST /api/chat/ask](#14-post-apichatask)
16. [GET /api/settings](#15-get-apisettings)
17. [PUT /api/settings](#16-put-apisettings)
18. [共享数据类型](#共享数据类型)
19. `backend/app/api/main.py`

### 请求参数
�?
### 响应�?
**TypeScript Interface**�?
```ts
interface HealthResponse {
  status: 'healthy'
  service: string
  version: string
}
```

**JSON 响应示例**�?
```json
{
  "status": "healthy",
  "service": "HelloAgents智能旅行助手",
  "version": "2.0.0"
}
```

---

## 2. POST /api/trip/plan

**用�?*：提交旅行规划任务（异步），立即返回 `task_id`。后续通过 WebSocket 或轮询接口获取规划结果�?
**后端源码**：`backend/app/api/routes/trip.py` `plan_trip`

### 路径参数
�?
### 请求�?
**TypeScript Interface**�?
```ts
interface TripRequest {
  city: string          // 目的地城市，必填，如 "北京"
  start_date: string    // 开始日期，必填，格�?YYYY-MM-DD
  end_date: string      // 结束日期，必填，格式 YYYY-MM-DD
  travel_days: number   // 旅行天数，必填，范围 1-30
  transportation: string // 交通方式，必填，如 "公共交�?
  accommodation: string  // 住宿偏好，必填，�?"经济型酒�?
  preferences: string[]  // 旅行偏好标签，如 ["历史文化", "美食"]
  free_text_input?: string // 额外要求，如 "希望多安排一些博物馆"
  language?: string      // 输出语言，默�?"zh"，可�?"en"/"ja"
}
```

> 对应后端 Pydantic 模型：`TripRequest` (`backend/app/models/schemas.py`)

**JSON 请求示例**�?
```json
{
  "city": "北京",
  "start_date": "2025-06-01",
  "end_date": "2025-06-03",
  "travel_days": 3,
  "transportation": "公共交�?,
  "accommodation": "经济型酒�?,
  "preferences": ["历史文化", "美食"],
  "free_text_input": "希望多安排博物馆",
  "language": "zh"
}
```

### 响应体（提交成功立即返回�?
**TypeScript Interface**�?
```ts
interface PlanSubmitResponse {
  task_id: string    // 任务 ID
  plan_id: string    // 计划 ID（与 task_id 相同�?  status: 'processing' // 初始状�?  ws_url: string     // WebSocket 订阅地址
  message: string    // 提示消息
}
```

**JSON 响应示例**�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "processing",
  "ws_url": "/api/trip/ws/a1b2c3d4",
  "message": "任务已提交，可通过 WebSocket /api/trip/ws/a1b2c3d4 实时订阅状�?
}
```

### 后端执行流程

```
POST /api/trip/plan
  �?生成 task_id（uuid4[:8]�?  �?初始化任务状态（status: processing, progress: 0�?  �?返回 task_id + ws_url
  �?后台 asyncio.create_task�?      progress: 10%  �?获取 Agent 实例
      progress: ...  �?景点搜索 �?天气查询 �?酒店搜索 �?规划生成
      progress: 95%  �?构建知识图谱
      progress: 100% �?完成（返�?TripPlanResponse�?      （失败则 status: failed, 返回 error 信息�?```

---

## 3. WebSocket /api/trip/ws/{task_id}

**用�?*：实时订阅旅行规划任务的执行进度和结果�?
**后端源码**：`backend/app/api/routes/trip.py` `trip_task_ws`

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| task_id | string | 任务 ID，由 POST /api/trip/plan 返回 |

### 连接流程

1. 客户端发�?`ws://localhost:8000/api/trip/ws/{task_id}`
2. 服务端立即发送当前任务快�?3. 如果任务已终结（`completed` / `failed`），发送快照后关闭连接
4. 否则持续推送进度事件，直到任务完成，然后关�?
### 推送事件格�?
**TypeScript Interface**�?
```ts
interface TripTaskEvent {
  task_id: string
  plan_id: string
  status: 'processing' | 'completed' | 'failed'
  stage: string         // 当前阶段名称
  progress: number      // 0-100
  message: string       // 人可读进度描�?  error?: string        // �?status=failed 时存�?  request_payload?: object // �?status=failed 时存在（原始请求体，供重试用�?  result?: TripPlanResponse // �?status=completed 时存在（详见共享数据类型�?}
```

**TaskStage 枚举**�?
```ts
type TripTaskStage =
  | 'submitted'       // 任务已提�?  | 'initializing'    // 正在初始�?  | 'graph_building'  // 正在构建知识图谱
  | 'completed'       // 已完�?  | 'failed'          // 失败
```

> 实际阶段可能包含 `attraction_search`、`weather_search`、`hotel_search`、`planning` 等（�?Agent 内部回调决定），前端应做兼容处理�?
**JSON 推送示例（进行中）**�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "processing",
  "stage": "initializing",
  "progress": 10,
  "message": "正在获取多智能体系统实例..."
}
```

**JSON 推送示例（完成�?*�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "completed",
  "stage": "completed",
  "progress": 100,
  "message": "旅行计划生成成功",
  "result": {
    "success": true,
    "message": "旅行计划生成成功",
    "plan_id": "a1b2c3d4",
    "data": { /* TripPlan 对象 */ },
    "graph_data": { /* KnowledgeGraphData 对象 */ }
  }
}
```

**JSON 推送示例（失败�?*�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "failed",
  "stage": "failed",
  "progress": 100,
  "message": "小红�?Cookie 已过�?,
  "error": "小红�?Cookie 已过�?,
  "request_payload": { /* 原始请求�?*/ }
}
```

### 特殊说明

- **服务重启�?*：内存中的未完成任务会被标记�?`failed`，`error` �?"服务已重�?..请重新生�?
- **任务不存�?*：返�?`failed` 快照后关闭连接（close code 1008�?- **持久�?*：所有任务状态会持久化到 `data/trip_tasks/{task_id}.json`

---

## 4. GET /api/trip/status/{task_id}

**用�?*：轮询查询任务执行状态（兼容旧客户端，建议优先使�?WebSocket）�?
**后端源码**：`backend/app/api/routes/trip.py` `get_task_status`

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| task_id | string | 任务 ID |

### 响应�?
**根据任务状态不同，响应结构不同�?*

**进行�?(status=processing)**�?
**TypeScript Interface**�?
```ts
interface TaskStatusProcessing {
  task_id: string
  plan_id: string
  status: 'processing'
  stage: string
  progress: number
  progress_text: string
}
```

**JSON 响应示例**�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "processing",
  "stage": "planning",
  "progress": 55,
  "progress_text": "正在生成旅行计划..."
}
```

**已完�?(status=completed)**�?
```ts
interface TaskStatusCompleted {
  task_id: string
  plan_id: string
  status: 'completed'
  result: TripPlanResponse // 嵌套的完整结果（详见共享数据类型�?}
```

**JSON 响应示例**�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "completed",
  "result": {
    "success": true,
    "message": "旅行计划生成成功",
    "plan_id": "a1b2c3d4",
    "data": { /* TripPlan */ },
    "graph_data": { /* KnowledgeGraphData */ }
  }
}
```

**失败 (status=failed)**�?
```ts
interface TaskStatusFailed {
  task_id: string
  plan_id: string
  status: 'failed'
  error: string
  request_payload?: object // 原始请求体，可用于重�?}
```

**JSON 响应示例**�?
```json
{
  "task_id": "a1b2c3d4",
  "plan_id": "a1b2c3d4",
  "status": "failed",
  "error": "API Key 无效",
  "request_payload": { /* 原始 TripRequest */ }
}
```

### 错误�?
| HTTP 状态码 | 含义 |
|-------------|------|
| 404 | 任务不存�?|

---

## 5. GET /api/trip/history

**用�?*：获取最近成功生成的历史旅行计划摘要，供首页快速找回�?
**后端源码**：`backend/app/api/routes/trip.py` `get_trip_history`

### Query 参数

| 参数 | 类型 | 默认�?| 范围 | 说明 |
|------|------|--------|------|------|
| limit | number | 10 | 1-50 | 返回条数上限 |

### 响应�?
**TypeScript Interface**�?
```ts
interface TripHistoryResponse {
  items: TripHistoryItem[]
}

interface TripHistoryItem {
  plan_id: string
  task_id: string
  city: string
  start_date: string
  end_date: string
  travel_days: number
  updated_at: string          // ISO 8601 格式
  overall_suggestions: string // 总体建议摘要
}
```

**JSON 响应示例**�?
```json
{
  "items": [
    {
      "plan_id": "a1b2c3d4",
      "task_id": "a1b2c3d4",
      "city": "北京",
      "start_date": "2025-06-01",
      "end_date": "2025-06-03",
      "travel_days": 3,
      "updated_at": "2025-05-20T14:30:00",
      "overall_suggestions": "建议提前预约故宫、国家博物馆等热门景�?
    }
  ]
}
```

### 特殊说明

- 仅返�?`status=completed` 的任�?- 按文件修改时间倒序排列
- 数据来源：磁盘持久化�?`data/trip_tasks/*.json`

---

## 6. GET /api/trip/health

**用�?*：检查旅行规�?Agent 服务健康状态�?
**后端源码**：`backend/app/api/routes/trip.py` `health_check`

### 请求参数
�?
### 响应�?
**TypeScript Interface**�?
```ts
interface TripHealthResponse {
  status: 'healthy'
  service: 'trip-planner'
  agent_name: string
  tools_count: number
}
```

**JSON 响应示例**�?
```json
{
  "status": "healthy",
  "service": "trip-planner",
  "agent_name": "trip_planning",
  "tools_count": 18
}
```

### 错误�?
| HTTP 状态码 | 含义 |
|-------------|------|
| 503 | 旅行规划服务不可�?|

---

## 7. GET /api/poi/photo

**用途**：根据城市、景点名称和可选 POI ID，解析经过身份校验的真实景点图片。

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 景点名称，如“广州塔” |
| city | string | 是 | 所在城市，如“广州” |
| poiId | string | 否 | 行程中已有的 POI ID，用于同名候选排序 |

### 响应

```ts
interface AttractionImageResult {
  imageUrl: string
  provider: string
  matchedName: string
  matchedPoiId: string
  confidence: number
  verified: boolean
}
```

```json
{
  "success": true,
  "message": "获取图片成功",
  "data": {
    "imageUrl": "https://aos-cdn-image.amap.com/example.jpg",
    "provider": "amap",
    "matchedName": "广州塔",
    "matchedPoiId": "B00140TY2A",
    "confidence": 1.0,
    "verified": true
  }
}
```

未找到准确匹配时，接口返回 `verified=false` 和空 `imageUrl`。前端必须展示带景点名称和城市的确定性占位卡。Mock 模式同样不提供随机图片。

---

## 8. GET /api/poi/search

**用�?*：根据关键词搜索 POI（兴趣点）�?
**后端源码**：`backend/app/api/routes/poi.py` `search_poi`

### Query 参数

| 参数 | 类型 | 必填 | 默认�?| 说明 |
|------|------|------|--------|------|
| keywords | string | �?| �?| 搜索关键�?|
| city | string | �?| "北京" | 城市名称 |

### 响应�?
**TypeScript Interface**�?
```ts
interface PoiSearchResponse {
  success: boolean
  message: string
  data: object[]  // 高德地图 API 返回的原�?POI 数据
}
```

> 注意：此接口�?`data` 字段�?*高德地图原始返回**，不�?`/api/map/poi` 使用标准化的 `POIInfo` 模型。详见[字段不一致风险](#101-poi-搜索接口返回值不统一)�?
**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "搜索成功",
  "data": [
    {
      "id": "B000A8U8U0",
      "name": "故宫博物�?,
      "type": "风景名胜;国家级景�?,
      "address": "北京市东城区景山前街4�?,
      "location": "116.397026,39.918058",
      "pname": "北京�?,
      "cityname": "北京�?,
      "adname": "东城�?,
      "photos": [...]
    }
  ]
}
```

---

## 9. GET /api/poi/detail/{poi_id}

**用�?*：根�?POI ID 获取详细信息（含图片）�?
**后端源码**：`backend/app/api/routes/poi.py` `get_poi_detail`

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| poi_id | string | 高德 POI ID |

### 响应�?
**TypeScript Interface**�?
```ts
interface PoiDetailResponse {
  success: boolean
  message: string
  data: object | null  // 高德 POI 详情原始数据
}
```

**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "获取POI详情成功",
  "data": {
    "id": "B000A8U8U0",
    "name": "故宫博物�?,
    "type": "风景名胜",
    "address": "北京市东城区景山前街4�?,
    "location": "116.397026,39.918058",
    "photos": [
      { "url": "https://...", "title": "..." }
    ],
    "business_area": [],
    "tel": "010-85007420"
  }
}
```

---

## 10. GET /api/map/poi

**用�?*：根据关键词搜索 POI（标准化格式）�?
**后端源码**：`backend/app/api/routes/map.py` `search_poi`

### Query 参数

| 参数 | 类型 | 必填 | 默认�?| 说明 |
|------|------|------|--------|------|
| keywords | string | �?| �?| 搜索关键�?|
| city | string | �?| �?| 城市名称 |
| citylimit | boolean | �?| true | 是否限制在城市范围内 |

### 响应�?
**TypeScript Interface**�?
```ts
interface MapPoiSearchResponse {
  success: boolean
  message: string
  data: POIInfo[]
}

interface POIInfo {
  id: string
  name: string
  type: string
  address: string
  location: {
    longitude: number
    latitude: number
  }
  tel?: string
}
```

**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "POI搜索成功",
  "data": [
    {
      "id": "B000A8U8U0",
      "name": "故宫博物�?,
      "type": "风景名胜",
      "address": "北京市东城区景山前街4�?,
      "location": { "longitude": 116.397026, "latitude": 39.918058 },
      "tel": "010-85007420"
    }
  ]
}
```

---

## 11. GET /api/map/weather

**用�?*：查询指定城市的天气信息�?
**后端源码**：`backend/app/api/routes/map.py` `get_weather`

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| city | string | �?| 城市名称，如 "北京" |

### 响应�?
**TypeScript Interface**�?
```ts
interface MapWeatherResponse {
  success: boolean
  message: string
  data: WeatherInfo[]
}

interface WeatherInfo {
  date: string           // 日期 YYYY-MM-DD
  day_weather: string    // 白天天气
  night_weather: string  // 夜间天气
  day_temp: number | string   // 白天温度（°C 已去除）
  night_temp: number | string // 夜间温度（°C 已去除）
  wind_direction: string // 风向
  wind_power: string     // 风力
}
```

> 后端 `backend/app/models/schemas.py` 模型内置 `@field_validator` 会自动移除温度值中�?`°C`、`℃`、`°` 符号

**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "天气查询成功",
  "data": [
    {
      "date": "2025-06-01",
      "day_weather": "�?,
      "night_weather": "多云",
      "day_temp": 30,
      "night_temp": 21,
      "wind_direction": "东南�?,
      "wind_power": "3�?
    },
    {
      "date": "2025-06-02",
      "day_weather": "多云",
      "night_weather": "�?,
      "day_temp": 28,
      "night_temp": 20,
      "wind_direction": "南风",
      "wind_power": "2�?
    }
  ]
}
```

---

## 12. POST /api/map/route

**用�?*：规划两点之间的路线�?
**后端源码**：`backend/app/api/routes/map.py` `plan_route`

### 路径参数
�?
### 请求�?
**TypeScript Interface**�?
```ts
interface RouteRequest {
  origin_address: string        // 起点地址，必�?  destination_address: string   // 终点地址，必�?  origin_city?: string          // 起点城市
  destination_city?: string     // 终点城市
  route_type: string            // 路线类型，默�?"walking"
  // 可选�? "walking" | "driving" | "transit"
}
```

**JSON 请求示例**�?
```json
{
  "origin_address": "北京市朝阳区阜通东大街6�?,
  "destination_address": "北京市海淀区上地十�?0�?,
  "route_type": "driving"
}
```

### 响应�?
**TypeScript Interface**�?
```ts
interface RouteResponse {
  success: boolean
  message: string
  data: RouteInfo | null
}

interface RouteInfo {
  distance: number    // 距离（米�?  duration: number    // 时间（秒�?  route_type: string  // 路线类型
  description: string // 路线描述
}
```

**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "路线规划成功",
  "data": {
    "distance": 18500.5,
    "duration": 2400,
    "route_type": "driving",
    "description": "经北四环，全程约18.5公里，预�?4分钟"
  }
}
```

---

## 13. GET /api/map/health

**用�?*：检查地图服务健康状态�?
**后端源码**：`backend/app/api/routes/map.py` `health_check`

### 请求参数
�?
### 响应�?
**TypeScript Interface**�?
```ts
interface MapHealthResponse {
  status: 'healthy'
  service: 'map-service'
  mcp_tools_count: number
}
```

**JSON 响应示例**�?
```json
{
  "status": "healthy",
  "service": "map-service",
  "mcp_tools_count": 5
}
```

### 错误�?
| HTTP 状态码 | 含义 |
|-------------|------|
| 503 | 地图服务不可�?|

---

## 14. POST /api/chat/ask

**用�?*：AI 行程智能问答。根据当前旅行计划上下文 + 历史对话，回答用户关于行程的问题�?
**后端源码**：`backend/app/api/routes/chat.py` `ask_about_trip`

### 路径参数
�?
### 请求�?
**TypeScript Interface**�?
```ts
interface TripChatRequest {
  message: string                // 用户提问内容，必�?  trip_plan: Record<string, unknown>  // 当前旅行计划（完�?JSON 对象），必填
  history: ChatMessage[]         // 历史对话记录，默�?[]
}

interface ChatMessage {
  role: 'user' | 'assistant' | string
  content: string
}
```

> **注意**：`trip_plan` 在后�?Pydantic 模型中定义为 `dict`（泛型字典），前端需传入完整�?`TripPlan` JSON 对象�?
**JSON 请求示例**�?
```json
{
  "message": "这个行程适合带老人去吗�?,
  "trip_plan": {
    "city": "北京",
    "start_date": "2025-06-01",
    "end_date": "2025-06-03",
    "days": [ /* ... */ ],
    "weather_info": [ /* ... */ ],
    "overall_suggestions": "..."
  },
  "history": [
    { "role": "user", "content": "这个行程总共多少钱？" },
    { "role": "assistant", "content": "总体预算�?850元�? }
  ]
}
```

### 响应�?
**TypeScript Interface**�?
```ts
interface TripChatResponse {
  success: boolean  // 默认 true
  reply: string     // AI回复内容
}
```

**JSON 响应示例**�?
```json
{
  "success": true,
  "reply": "这个行程整体节奏适中，大部分景点都有地铁直达，非常适合带老人出行。建议在故宫和颐和园游览时适当放慢速度，多安排休息时间�?
}
```

---

## 15. GET /api/settings

**用�?*：获取当前运行时配置�?
**后端源码**：`backend/app/api/routes/settings.py` `get_settings`

### 请求参数
�?
### 响应�?
**TypeScript Interface**�?
```ts
interface SettingsResponse {
  success: boolean
  message: string           // 固定 "ok"
  data: RuntimeSettingsPayload
}

interface RuntimeSettingsPayload {
  vite_amap_web_key: string      // 高德 Web 服务 Key
  vite_amap_web_js_key: string   // 高德 JS SDK Key
  google_maps_api_key: string    // Google Maps API Key
  xhs_cookie: string             // 小红�?Cookie（前端不展示明文�?  openai_api_key: string         // LLM API Key（前端不展示明文�?  openai_base_url: string        // LLM Base URL
  openai_model: string           // LLM 模型�?}
```

**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "ok",
  "data": {
    "vite_amap_web_key": "",
    "vite_amap_web_js_key": "",
    "google_maps_api_key": "",
    "xhs_cookie": "***",
    "openai_api_key": "***",
    "openai_base_url": "https://api.openai.com/v1",
    "openai_model": "gpt-4o"
  }
}
```

### 特殊说明

- 敏感字段（`xhs_cookie`、`openai_api_key`）的后端返回处理取决�?`config.py` 的实�?- 所有字段默认值为空字符串

---

## 16. PUT /api/settings

**用�?*：保存运行时配置并立即生效（重置所有单例服务）�?
**后端源码**：`backend/app/api/routes/settings.py` `save_settings`

### 路径参数
�?
### 请求�?
**TypeScript Interface**�?
```ts
// 请求体类型同 RuntimeSettingsPayload，所有字段可选（部分更新�?interface UpdateSettingsRequest {
  vite_amap_web_key?: string
  vite_amap_web_js_key?: string
  google_maps_api_key?: string
  xhs_cookie?: string
  openai_api_key?: string
  openai_base_url?: string
  openai_model?: string
}
```

**JSON 请求示例**�?
```json
{
  "openai_api_key": "sk-new-key-123456",
  "openai_base_url": "https://api.openai.com/v1",
  "openai_model": "gpt-4o"
}
```

### 响应�?
**TypeScript Interface**�?
```ts
interface UpdateSettingsResponse {
  success: boolean
  message: string   // "配置已保存并立即生效"
  data: RuntimeSettingsPayload  // 更新后的全量配置
}
```

**JSON 响应示例**�?
```json
{
  "success": true,
  "message": "配置已保存并立即生效",
  "data": {
    "vite_amap_web_key": "abc123",
    "vite_amap_web_js_key": "",
    "google_maps_api_key": "",
    "xhs_cookie": "***",
    "openai_api_key": "sk-new-key-123456",
    "openai_base_url": "https://api.openai.com/v1",
    "openai_model": "gpt-4o"
  }
}
```

### 副作�?
保存配置后，后端会立即执行以下重置操作：

- `reset_llm()` �?重建 LLM 服务实例
- `reset_amap_service()` �?重建高德地图服务
- `reset_google_map_service()` �?重建 Google Maps 服务
- `reset_trip_planner_agent()` �?重建旅行规划 Agent

---

## 共享数据类型

以下类型在多个接口中复用，定义在后端 `backend/app/models/schemas.py` 中�?
### TripPlanResponse �?旅规划完整结�?
```ts
interface TripPlanResponse {
  success: boolean
  message: string
  plan_id?: string
  data?: TripPlan
  graph_data?: KnowledgeGraphData
}
```

### TripPlan �?旅行计划

```ts
interface TripPlan {
  city: string
  start_date: string       // YYYY-MM-DD
  end_date: string         // YYYY-MM-DD
  days: DayPlan[]
  weather_info: WeatherInfo[]
  overall_suggestions: string
  budget?: Budget
}
```

### DayPlan �?单日行程

```ts
interface DayPlan {
  date: string             // YYYY-MM-DD
  day_index: number        // �?0 开�?  description: string      // 当日描述
  transportation: string   // 交通方�?  accommodation: string    // 住宿类型
  hotel?: Hotel
  attractions: Attraction[]
  meals: Meal[]
}
```

### Attraction �?景点

```ts
interface Attraction {
  name: string
  address: string
  location: { longitude: number; latitude: number }
  visit_duration: number    // 建议游览时间（分钟）
  description: string
  category?: string         // 默认 "景点"
  rating?: number           // 评分
  photos?: string[]         // 图片 URL 列表
  poi_id?: string           // 高德 POI ID
  image_url?: string        // 主图 URL
  ticket_price: number      // 门票价格（元），默认 0
  reservation_required?: boolean // 默认 false
  reservation_tips?: string // 预约提示
}
```

### Hotel �?酒店

```ts
interface Hotel {
  name: string
  address: string           // 默认 ""
  location?: { longitude: number; latitude: number }
  price_range: string       // 默认 ""
  rating: string            // 默认 ""
  distance: string          // 距景点距离，默认 ""
  type: string              // 酒店类型，默�?""
  estimated_cost: number    // 预估费用（元/晚），默�?0
}
```

### Meal �?餐饮

```ts
interface Meal {
  type: string              // breakfast | lunch | dinner | snack
  name: string
  address?: string
  location?: { longitude: number; latitude: number }
  description?: string
  estimated_cost: number    // 预估费用（元），默认 0
}
```

### Budget �?预算

```ts
interface Budget {
  total_attractions: number     // 景点门票总费�?  total_hotels: number          // 酒店总费�?  total_meals: number           // 餐饮总费�?  total_transportation: number  // 交通总费�?  total: number                 // 总费�?}
```

### WeatherInfo �?天气

```ts
interface WeatherInfo {
  date: string
  day_weather: string
  night_weather: string
  day_temp: number | string    // 后端 validator 会去�?°C 符号
  night_temp: number | string
  wind_direction: string
  wind_power: string
}
```

### KnowledgeGraphData �?知识图谱

```ts
interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  categories: GraphCategory[]
}

interface GraphNode {
  id: string
  name: string
  category: number        // categories 数组索引
  symbolSize: number      // 默认 30
  itemStyle?: object      // 节点样式
  value?: string          // 附加信息
}

interface GraphEdge {
  source: string          // 源节�?ID
  target: string          // 目标节点 ID
  label?: string          // 关系标签，默�?""
}

interface GraphCategory {
  name: string
}
```

---

## 字段不一致风�?
以下风险基于 **后端 Pydantic 模型** vs **前端 TypeScript 类型** 的逐字段对比�?
### 🔴 高风险（可能导致运行时错误）

| # | 问题 | 后端定义 | 前端定义 | 影响 |
|---|------|---------|---------|------|
| 1 | **Settings 缺少 `google_maps_proxy` 字段** | `RuntimeSettingsPayload` 中无此字�?| `BackendRuntimeSettings` 中包�?`google_maps_proxy: string` | 前端声明的字段后端不会返回；MSW mock 中返�?`google_maps_proxy: ''`，但真实后端返回的数据中不存在此字段 |

### 🟡 中风险（可能导致类型不一致）

| # | 问题 | 后端定义 | 前端定义 | 影响 |
|---|------|---------|---------|------|
| 2 | **`trip_plan` 类型不兼�?* | `dict`（泛�?Python dict�?| `Record<string, unknown>` | 后端接受任意 dict，前端使�?`Record<string, unknown>` 作为泛型约束。在 AIChat 组件中直接传 `TripPlan` 会导�?TS2322 错误（`TripPlan` 缺少索引签名），已通过 `as unknown as Record<string, unknown>` 绕过 |
| 3 | **POI 搜索接口返回结构不统一** | `/api/poi/search` 返回高德原始数据；`/api/map/poi` 返回标准�?`POIInfo[]` | 前端仅定义了 `POIInfo` 类型 | 前端调用 `/api/poi/search` 时拿到的数据结构�?`POIInfo` 不一致（�?`location` 在高德原始数据中可能是字符串 `"116.397,39.918"`�?|

### 🟢 低风险（宽松/严格不一致，但暂不影响运行）

| # | 问题 | 后端定义 | 前端定义 | 影响 |
|---|------|---------|---------|------|
| 4 | **`ticket_price` 可选性不一�?* | `int = Field(default=0)`（必返回，默�?�?| `ticket_price?: number`（可选） | 前端标注为可选，但后端永远返回此字段（至少为 0），逻辑上无影响 |
| 5 | **`estimated_cost` 可选性不一�?* | `Hotel.estimated_cost: int = 0` / `Meal.estimated_cost: int = 0`（必返回，默�?�?| `estimated_cost?: number`（可选） | 同上，后端打印日志意为必返回，前端标注为可�?|
| 6 | **`ChatMessage.role` 类型放宽** | `str`（Pydantic Field 无枚举约束） | `'user' \| 'assistant' \| string` | 前端宽泛约束兼容后端，无影响 |
| 7 | **`overall_suggestions` 在历史接口中** | `_build_history_item` 中从 `plan.get("overall_suggestions")` �?`result.get("message")` fallback，总是返回�?| `TripHistoryItem.overall_suggestions?: string`（可选） | 后端总是返回，前端标记可选，无影�?|
| 8 | **MSW Mock 缺少 `overall_suggestions` �?Result �?* | MSW �?`GET /api/trip/status/:taskId` 只返�?`result: mockTripPlanResponse`，其�?`data.overall_suggestions` 存在 | Result 页面�?`sessionStorage` 读取，写入路径位�?Landing �?| Landing 页通过 WebSocket/TaskStatus 拿到 `result.data` 后写�?sessionStorage，链路完�?|

### 建议

1. **立即修复 #1**：前�?`BackendRuntimeSettings` 中的 `google_maps_proxy` 字段在后�?API 中不存在，建议前端将其标记为 `optional`，或�?`BackendRuntimeSettings` 移除，改为本�?前端环境变量管理�?
2. **考虑修复 #2**：建议后端将 `trip_plan: dict` 改为泛型 `Any` 或显式添�?JSON Schema 约束；或前端�?`TripChatRequest.trip_plan` 改为 `unknown`，使用时手动断言�?
3. **考虑修复 #3**：建议统一 POI 搜索接口返回格式。`/api/poi/search` 应使�?`POISearchResponse` 模型（与 `/api/map/poi` 一致），或废弃 `/api/poi/search` 仅保�?`/api/map/poi`�?
---

> 本文档基于后端源码完整生成，涵盖了所有已注册路由。如需更新，请在修改后端后重新生成
