# 给 HelloJourney 接入 Google 地图

> 目标：用户能在「设置 → 地图底图」里自己选高德或 Google，行程地图随选择立刻切换。
>
> 这份文档按「你可能踩到的坑」的顺序写，不是按代码顺序。跟着做即可。

---

## 0. 先搞清楚你的项目已经走到了哪一步

很多人一开始就把「接入 Google 地图」当成一件事，实际上是**两件互相独立的事**：

| | 做什么 | 谁发起请求 | 用哪把 Key | 现状 |
|---|---|---|---|---|
| **服务端数据** | POI 搜索、地理编码、路线规划、天气 | 你的 Spring Boot 后端 | `GOOGLE_MAPS_API_KEY`（IP 限制） | **已经写好了**，只差配 Key |
| **浏览器底图** | 那张可以拖动缩放的图、编号标记、路线折线 | 用户的浏览器直连 Google | `VITE_GOOGLE_MAPS_JS_KEY`（来源限制） | 本次新增 |

也就是说：

- 后端 `GoogleMapService` + `MapDispatcher` 早就接好了 Google，你**不需要写 Java**。
- 前端原来只有高德一个渲染器（`TripMap` 直接调 AMap JSAPI），所以「选择底图」这件事做不了。
  这次把渲染器抽象成 `MapRenderer` 接口，加了 Google 的实现，并把选择权交给用户。

> 一句话总结：**服务端数据早就通了，这次补的是浏览器底图的选择能力。**

---

## 1. 两把钥匙千万别混

这是最容易出错的地方。Google 要求两种凭据，**它们不能互换**：

| | 浏览器 Key（底图） | 服务端 Key（数据） |
|---|---|---|
| 环境变量 | `VITE_GOOGLE_MAPS_JS_KEY` | `GOOGLE_MAPS_API_KEY` |
| 配在哪 | `frontend/.env.local`（构建时内联进 JS） | 仓库根目录 `.env` / 后端 Secret |
| 限制方式 | **HTTP 来源（referrer）**，如 `https://your-domain.com/*` | **IP 地址**，如你的服务器出口 IP |
| 会泄露吗 | 会，任何人打开开发者工具都能看到 | 不会，只在服务器上 |
| 泄露了怎么办 | 因为限制了来源域名，别人拿去也用不了 | — |

所以：**浏览器 Key 一定要设来源限制**，别嫌麻烦。不设限制的 Key 被发现后会被人拿去刷你的账单。

---

## 2. Google Cloud Console 配置（约 15 分钟）

### 2.1 建项目

1. 打开 <https://console.cloud.google.com/>
2. 顶部项目下拉框 →「新建项目」→ 名字随便，例如 `hellojourney-maps`
3. 建好后确认顶部项目已经切到它

### 2.2 启用 API

左侧菜单「API 和服务」→「库」，逐个搜索并点「启用」：

| API | 必需性 | 用在哪 |
|---|---|---|
| **Maps JavaScript API** | 必需 | 底图本体（`google.maps.Map`） |
| **Directions API** | 建议 | 地图上的驾车/步行路线（`DirectionsService`） |
| **Places API (New)** | 后端需要 | 后端的 POI 搜索（`places.googleapis.com/v1`） |
| **Geocoding API** | 后端需要 | 后端把地址转经纬度 |
| **Weather API** | 可选 | 后端天气（配不到就自动降级腾讯/高德） |

> 只想要底图、不打算让后端用 Google 数据？那只启用 **Maps JavaScript API** 和 **Directions API** 就够了，
> 后端的 `GOOGLE_MAPS_API_KEY` 留空即可（见第 6 节，这一点很重要）。

### 2.3 开结算

「结算」→ 绑定信用卡，开一个结算账号。

> Google Maps Platform 每月有免费额度，超出才收费。但仍然**必须绑卡**，否则
> 底图会直接报 `BillingNotEnabledMapError`，地图一片空白。

建议顺手设个预算提醒：「结算」→「预算和提醒」→ 新建预算，金额设小一点（比如 $10）。

### 2.4 建「浏览器 Key」（底图用）

「API 和服务」→「凭据」→「创建凭据」→「API 密钥」，得到一串 `AIza...`。

建好后**立刻点「修改」**做两项限制：

1. **应用限制** → 选「网站」，添加：

   ```
   http://localhost:5173/*
   https://你的正式域名.com/*
   ```

   > 开发时 Vite 跑在 5173；Docker 里前端映射到 5173；`vite preview` 是 4173。
   > 都加进去最省事。端口不对会报 `RefererNotAllowedMapError`。

2. **API 限制** → 选「限制密钥」→ 勾选 `Maps JavaScript API`（底图用的路线功能也走这个 Key，如果出现路线失败，把 `Directions API` 也勾上）

### 2.5 建「服务端 Key」（数据用，可选）

再建一把，限制方式选「IP 地址」，填你服务器的出口 IP；API 限制勾选 `Places API (New)`、`Geocoding API`、`Directions API`、`Weather API`。

> 本地开发的话 IP 不好固定，可以先不加 IP 限制，但**上线前一定要加**。

### 2.6 （可选）建 Map ID，用于自定义底图配色

「地图管理」→「地图样式」→「创建地图 ID」，记下那串 ID。

- 不建也能用：代码会回落到 Google 官方的占位值 `DEMO_MAP_ID`，功能、标记都正常，只是不能用云端配色。
- 建了就在 `VITE_GOOGLE_MAPS_MAP_ID` 里填上。

> 注意：用了 Map ID 之后，传统的 `styles` 内联样式会被忽略，配色只能走 Cloud 控制台。

---

## 3. 前端配置（3 步，1 分钟）

### 第 1 步：写进 `frontend/.env.local`

```dotenv
VITE_GOOGLE_MAPS_JS_KEY=AIzaSy...你的浏览器Key
VITE_GOOGLE_MAPS_MAP_ID=
```

这个文件已被 `.gitignore` 忽略，不会被提交。

### 第 2 步：重启 dev server

```powershell
cd frontend
npm run dev
```

> ⚠️ **必须重启**。`VITE_*` 是构建时内联的，热更新改不到已经打进 JS 里的 Key。
> 用 Docker 的话要 `docker compose -f docker-compose.dev.yml up --build` 重新构建。

### 第 3 步：打开设置页切换

浏览器打开 <http://localhost:5173/settings>，找到「**地图底图**」这一节：

- 「高德地图」和「Google 地图」两张卡片，右边的小标签表示这把 Key 有没有配好
- 点 Google → 卡片高亮，选择已保存
- 回到行程结果页，地图就是 Google 底图了

选择存在 `localStorage` 的 `hj.map.provider` 里，**只影响你这一台浏览器**，不会影响别人，也不需要管理员令牌。

---

## 4. 想确认真的接上了？看这几个地方

| 检查点 | 期望结果 |
|---|---|
| 浏览器 DevTools → Network | 有 `maps.googleapis.com/maps/api/js?...` 的请求，200 |
| DevTools → Console | 没有 `Google Maps JavaScript API error: ...` |
| 地图右下角 | 有 Google 的 `Google` logo 和版权信息 |
| 标记 | 圆形编号标记（`1-1`、`1-2`…），悬停弹信息窗 |
| 路线 | 蓝色实线（驾车）/ 绿色虚线（步行）/ 橙色虚线（直线兜底） |

控制台报错对照表：

| 控制台报错 | 原因 | 处理 |
|---|---|---|
| `RefererNotAllowedMapError` | 当前页面的域名/端口不在来源白名单 | 回 2.4 加 `http://localhost:5173/*` |
| `ApiNotActivatedMapError` | 没启用 Maps JavaScript API | 回 2.2 启用 |
| `ApiTargetBlockedMapError` | Key 的「API 限制」里没勾 Maps JavaScript API | 回 2.4 第 2 项补勾 |
| `InvalidKeyMapError` | Key 打错、或把服务端 Key 填到了前端 | 检查 `VITE_GOOGLE_MAPS_JS_KEY` |
| `BillingNotEnabledMapError` | 没绑结算账号，**或结算账号还没关联到当前项目** | 回 2.3；关联步骤见下 |
| `This site can't be reached` / 请求超时 | 网络到不了 Google | 见第 7 节 |

> **结算账号 ≠ 结算已启用。** 建好结算账号只是第一步，还必须把它**关联到拥有这些 Key 的那个项目**，
> 否则 API 会一直报 `You must enable Billing on the Google Cloud Project`。
> 关联入口：结算 → 概览 →「我的项目」标签 → 找到项目 → `⋮` → 更改结算账号；
> 或从项目侧：左侧「结算」→「关联结算账号」。关联后通常 1–2 分钟生效。

本项目自己的兜底提示（不走浏览器控制台，直接显示在地图位置）：

- 「尚未配置 Google Maps Web JS Key」→ 前端环境变量没配或没重启 dev server
- 「Google 地图暂时无法加载」→ Key 白名单、API 未启用，或网络不通

### 4.1 不开浏览器也能自检 Key（很有用）

在动手排查前，先用命令行确认「Key 本身」的状态，能省掉一半来回。

**① Key 有效吗、结算开了吗、API 启用了吗**

```powershell
# 换成你自己的 Key
$k = 'AIza...'
Invoke-WebRequest -UseBasicParsing `
  "https://maps.googleapis.com/maps/api/geocode/json?address=Beijing&key=$k" | Select-Object -Expand Content
```

返回里的 `error_message` 直接告诉你卡在哪一层：

| `error_message` | 含义 | 处理 |
|---|---|---|
| （没有，`status: OK`） | 一切正常 | 可以用了 |
| `You must enable Billing...` | **项目没开结算** | 去「结算」绑卡，这是最常见的一步 |
| `This API is not activated...` | Geocoding API 没启用 | 去「API 和服务 → 库」启用 |
| `The provided API key is invalid` | Key 抄错了 | 重新复制 |

**② 来源白名单里有你现在的地址吗**

```powershell
$k = 'AIza...'
Invoke-WebRequest -UseBasicParsing -Method POST `
  -Uri 'https://places.googleapis.com/v1/places:searchText' `
  -Headers @{ 'X-Goog-Api-Key'=$k; 'X-Goog-FieldMask'='places.id'; 'Referer'='http://localhost:5173/' } `
  -ContentType 'application/json' -Body '{"textQuery":"故宫"}'
```

看返回里的 `reason`：

- `API_KEY_HTTP_REFERRER_BLOCKED` → **这个来源没在白名单里**，回 2.4 补上
- `API_KEY_SERVICE_BLOCKED` / `SERVICE_DISABLED` → 来源**已经通过**了，卡的是 API 限制/启用状态

> 换成你要测的地址再跑一次。这一步能直接区分「白名单问题」和「API 启用问题」，
> 比在浏览器里看 `RefererNotAllowedMapError` 猜要快得多。

---

## 5. 代码是怎么接的（想读源码时看这里）

### 5.1 文件分工

| 文件 | 职责 |
|---|---|
| [`features/map-provider/model/mapProvider.ts`](../frontend/src/features/map-provider/model/mapProvider.ts) | 「用户选了哪家」的存储与订阅（`localStorage` + `useMapProvider`） |
| [`components/TripMap/mapRenderer.ts`](../frontend/src/components/TripMap/mapRenderer.ts) | 两个渲染器共同遵守的接口 `MapRenderer` |
| [`components/TripMap/mapGeometry.ts`](../frontend/src/components/TripMap/mapGeometry.ts) | 与 SDK 无关的几何计算：取点、按天分段、酒店→景点→回酒店 |
| [`components/TripMap/amapRenderer.ts`](../frontend/src/components/TripMap/amapRenderer.ts) | 高德实现（原有逻辑搬进来） |
| [`components/TripMap/googleRenderer.ts`](../frontend/src/components/TripMap/googleRenderer.ts) | **Google 实现（本次新增）** |
| [`components/TripMap/index.tsx`](../frontend/src/components/TripMap/index.tsx) | 壳：标题/图例/全屏/兜底 + 按 provider 二选一 |
| [`utils/env.ts`](../frontend/src/utils/env.ts) | 读 `VITE_GOOGLE_MAPS_JS_KEY` / `VITE_GOOGLE_MAPS_MAP_ID` |
| [`frontend/nginx.conf`](../frontend/nginx.conf) | CSP 放行 Google 的脚本/接口/字体域名 |

### 5.2 调用链

```
Settings「地图底图」点击
  └─ writeMapProvider('google')          // 写 localStorage + 通知订阅者
       └─ useMapProvider() 重新求值       // resolveMapProvider()
            └─ TripMap 的 effect 依赖变了 → 销毁旧渲染器、建新的
                 └─ createRenderer('google', ctx)
                      └─ createGoogleRenderer()
                           ├─ loadGoogleMaps(key)        // 注入 <script>，只注入一次
                           ├─ new google.maps.Map(...)   // mapId 必需
                           ├─ AdvancedMarkerElement ×N   // 复用 mapDom 的编号圆点
                           ├─ fitTo(...)                 // 缩放到刚好装下所有点
                           └─ drawRoutes()               // 逐段查路网，慢，放后台
```

### 5.3 为什么标记能长得和高德一模一样

两家 SDK 的标记 API 完全不同，但 `mapDom.ts` 里那两个函数产出的就是**普通 DOM 节点**：

- 高德：`new AMap.Marker({ content: 节点 })`
- Google：`new AdvancedMarkerElement({ content: 节点 })`

所以编号圆点、悬停动效、`is-active` 高亮、信息窗排版这些 CSS 全部复用，两份渲染器不需要各写一套样式。

### 5.4 想再加一家（比如腾讯底图）要动哪里

这就是抽象 `MapRenderer` 的收益：

1. 新建 `tencentRenderer.ts`，实现同一个 `MapRenderer` 接口
2. `MAP_PROVIDERS` 里加 `'tencent'`
3. `createRenderer()` 里加一个分支
4. 补 i18n 文案

页面其余部分（`index.tsx`、图例、全屏、兜底卡片、设置页选择器）**一行都不用改**。

---

## 6. 部署注意（三条，都很关键）

### 6.1 构建参数要透传

`VITE_*` 在前端**构建时**就要有值，否则打出来的 JS 里是空的。

- `frontend/Dockerfile` 已加 `ARG VITE_GOOGLE_MAPS_JS_KEY` / `VITE_GOOGLE_MAPS_MAP_ID`
- `docker-compose.dev.yml` 已把它们作为 build args 透传

自己写 compose / CI 的话，记得在 `build.args` 里带上。

### 6.2 CSP 必须放行 Google

`frontend/nginx.conf` 里的 Content-Security-Policy 已经加好：

```
script-src  ... https://maps.googleapis.com https://maps.gstatic.com
connect-src ... https://maps.googleapis.com https://maps.gstatic.com
font-src    ... https://fonts.gstatic.com
```

**漏了会怎样**：底图完全不显示，而且浏览器控制台只报 `Refused to load...`，
很容易被误判成「Key 没配对」。`deploymentContract.test.ts` 里有专门的用例锁住这几条，别删。

> `img-src` 里本来就有 `https:`，所以 Google 的瓦片图不用单独加。

### 6.3 配了 `GOOGLE_MAPS_API_KEY` 会改变后端取数来源

这是**最容易忽略的副作用**。看 `MapDispatcher.getMapProvider()` 的逻辑：

```java
// 只要配了 Google 的服务端 Key，服务端所有 POI/路线/天气就走 Google
if (appSettings.getGoogleMapsApiKey() != null && !appSettings.getGoogleMapsApiKey().isEmpty()) {
    return "google";
}
```

所以：

- **只想换底图** → 只配 `VITE_GOOGLE_MAPS_JS_KEY`，**不要**配后端的 `GOOGLE_MAPS_API_KEY`。
  此时：底图是 Google，但 POI/路线数据仍来自高德/腾讯，稳。
- **想让数据也走 Google** → 再配 `GOOGLE_MAPS_API_KEY`。注意国内地址的覆盖度不如高德/腾讯，
  而且一旦 Google 调用失败，`MapDispatcher` 会把 `googleFailed` 置为 `true`，
  **进程内后续请求全部降级到腾讯**，直到重启或调 `reset()`。

---

## 7. 已知限制（提前知道，少走弯路）

### 7.1 中国大陆访问不了 Google Maps

`maps.googleapis.com` 在境内基本不可直连。所以：

- 本地开发如果没开代理，会一直转圈最后显示「Google 地图暂时无法加载」
- 面向国内用户的部署**不要把 Google 设成默认底图**（默认仍是高德，这点已保证）

这恰恰就是「让用户自己选」而不是「全局切换」的原因：境外用户选 Google，境内用户留高德。

### 7.2 坐标系不一致，会出现几百米偏移

| 底图来源 | 中国大陆用的坐标系 |
|---|---|
| 高德 / 腾讯 | GCJ-02（火星坐标） |
| Google（境外区域） | WGS-84 |

行程里的经纬度是**后端**存下来的，用的是哪家数据源就用哪家的坐标系：

- 后端用高德/腾讯 → GCJ-02
- 后端用 Google → WGS-84

**混用就会偏**：比如坐标来自高德（GCJ-02），却画在 Google 的境外底图上，会看到几百米偏移。
这不是 bug，是国内地图行业的历史遗留问题。

实践建议：

- 国内行程 → 底图用高德，后端也用高德/腾讯（当前默认，最一致）
- 纯境外行程 → 底图用 Google，后端也配 `GOOGLE_MAPS_API_KEY`（坐标同源，不偏）

### 7.3 其他

- **底图语言**：不传 `language`，跟随浏览器语言。SDK 一旦加载就不会再换语言，切界面语言后底图标注仍是原来的。
- **路线是二次查询**：底图先显示标记（快），路线随后补（每段最多等 6 秒，逐段串行）。路线查不到就退化成虚线直线，不影响地图本身。
- **计费**：Maps JavaScript API 按「地图加载次数」计费，Directions 按请求数计费。开发时把 `localhost` 加白名单即可，正式上线留意预算提醒。

---

## 8. 想撤掉它？

改动都是增量的，撤起来很轻：

1. `frontend/.env.local` 里把 `VITE_GOOGLE_MAPS_JS_KEY` 置空
2. 设置页切回「高德地图」

底图会立刻回到高德；Google 的分支因为没 Key 不会被触发，代码留着也不影响。
真要删代码，把 `googleRenderer.ts`、`map-provider/`、Settings 里的 `MapBasemapPanel` 去掉即可
（`TripMap/index.tsx` 里把 `createRenderer` 固定成 AMap）。
