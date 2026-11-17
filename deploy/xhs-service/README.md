# 小红书内容服务（签名边车）

`https://liufengwei.com/hellojourney/` 的「小红书实拍图」和「规划时的红书笔记调研」都依赖它。

## 为什么需要一个边车

2026-11 起小红书的两处变化：

1. `/search_result` 页面的 SSR 数据里 `feeds` 恒为 `[]`，搜索结果改由前端调用
   `/api/sns/web/v1/search/notes` 异步加载 —— 也就是说**页面抓不到了**，只能调接口。
2. 那个接口需要 `x-s` / `x-t` / `x-s-common` 三个签名头，签名是混淆过的 JS，
   Java 里跑不动（需要 JS 引擎 + 4MB 混淆代码）。

所以把「签名 + 调接口」放在一个只监听 `127.0.0.1:8010` 的 Python 服务里，
Java 后端通过 `XHS_SERVICE_URL` 调它。签名 JS 与 `sign_util.py` 来自用户的
TripStar 项目（`D:\lfw-code\TripStar\backend\app\services\xhs_sign\`），属于第三方
混淆代码，**不进本仓库**，部署时从 TripStar 复制过来。

## 依赖

```bash
apt-get install -y nodejs        # 必须是 node 18+（node 12 会让签名包初始化失败）
pip3 install PyExecJS requests
```

> node 12（Ubuntu 22.04 默认源）会报 `TypeError: window.mnsv2 is not a function`。
> 用 NodeSource 装 20.x：`curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs`

## 部署

```bash
sudo mkdir -p /opt/xhs-sign
# 1) 注册签名相关的第三方文件（来自 TripStar）
sudo cp <TripStar>/backend/app/services/xhs_sign/{xhs_xs_xsc_56.js,xhs_xray.js,xhs_xray_pack1.js,xhs_xray_pack2.js,sign_util.py} /opt/xhs-sign/
# 2) 本仓库的服务
sudo cp deploy/xhs-service/xhs_api.py /opt/xhs-sign/
sudo cp deploy/xhs-service/hellojourney-xhs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hellojourney-xhs
```

## 配置

`/etc/hellojourney/env`（与后端共用，640 root:www-data）：

```ini
XHS_COOKIE='abRequestId=...; web_session=...; a1=...'   # 必须有 web_session
XHS_SERVICE_URL=http://127.0.0.1:8010
```

Cookie 获取：登录小红书后 F12 → Network → 任选 `xiaohongshu.com/api` 请求 →
Request Headers → 复制整行 `Cookie`。**必须包含 `web_session`**，否则只是游客身份。

## 接口

| 路径 | 说明 |
|---|---|
| `GET /health` | `{"ok":true,"cookieConfigured":bool}` |
| `GET /raw/search?keyword=故宫&page=1` | 原样透传小红书 `/search/notes` 响应（Java 直接用） |
| `GET /raw/note?id=&token=` | 原样透传 `/api/sns/web/v1/feed` |
| `GET /search?keyword=&size=20` | 精简版：`items[{id,title,desc,cover,xsecToken,likes}]` |
| `GET /note?id=&token=` | 精简版：`{title,images[]}` |

注意：`page_size` 必须是 **20**，其他值小红书返回空列表（实测 5/10/30 都是空）。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| `/health` 里 `cookieConfigured:false` | env 没写 `XHS_COOKIE` | 补上并 `systemctl restart hellojourney-xhs` |
| `code=300011` | Cookie 被风控/已退出登录 | 重新登录复制 Cookie |
| `window.mnsv2 is not a function` | node 太老 | 升到 18+ |
| 后端日志 `搜索到 0 条笔记` 且没有 `[XHS_PROXY]` | 后端没读到 `XHS_SERVICE_URL` | `systemctl show hellojourney-backend -p Environment` 检查 |
| 图片 403/裂图 | 小红书图片链有 Referer 校验 | 一定要走 `/api/poi/xhs-image` 代理，不要直链 |
