#!/usr/bin/env python3
"""小红书内容服务（本地边车）

为什么需要它：小红书的搜索结果已经不由 SSR 页面下发，必须调用
/api/sns/web/v1/search/notes 这个**签名接口**（x-s / x-t / x-s-common）。
签名算法是混淆过的 JS，只能靠 Node 执行，所以用这个 Python 服务包一层，
监听 127.0.0.1:8010，只给本机的 Java 后端用。

依赖：node（>=18）、PyExecJS、requests，以及同目录下的 sign_util.py 与签名 JS。

接口：
  GET /health
  GET /search?keyword=故宫&page=1&size=20
      -> {"success":true,"items":[{"id","title","desc","cover","xsecToken","likes","noteType"}]}
  GET /note?id=<noteId>&token=<xsecToken>
      -> {"success":true,"title":"...","images":["https://...","..."]}
"""
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests  # noqa: E402
from sign_util import generate_request_params, generate_x_b3_traceid  # noqa: E402

BASE_URL = "https://edith.xiaohongshu.com"
SEARCH_API = "/api/sns/web/v1/search/notes"
FEED_API = "/api/sns/web/v1/feed"
PORT = int(os.environ.get("XHS_SERVICE_PORT", "8010"))

_session = requests.Session()
_session.trust_env = False


def cookie_string() -> str:
    """每次请求都从环境变量读，便于换 cookie 后只重启服务即可。"""
    raw = os.environ.get("XHS_COOKIE", "") or ""
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "'\"":
        raw = raw[1:-1].strip()
    return raw


def call_api(api: str, payload: dict, cookie: str) -> dict:
    headers, cookies, body = generate_request_params(cookie, api, payload, "POST")
    response = _session.post(
        BASE_URL + api,
        headers=headers,
        data=body.encode("utf-8"),
        cookies=cookies,
        timeout=20,
    )
    try:
        return response.json()
    except Exception:
        return {"success": False, "code": response.status_code, "msg": response.text[:200]}


def search(keyword: str, page: int, size: int) -> dict:
    cookie = cookie_string()
    if not cookie:
        return {"success": False, "code": "NO_COOKIE", "msg": "XHS_COOKIE 未配置"}
    payload = {
        "keyword": keyword,
        "page": page,
        "page_size": size,
        "search_id": generate_x_b3_traceid(21),
        "sort": "general",
        "note_type": 0,
        "ext_flags": [],
        "filters": [
            {"tags": ["general"], "type": "sort_type"},
            {"tags": ["不限"], "type": "filter_note_type"},
            {"tags": ["不限"], "type": "filter_note_time"},
            {"tags": ["不限"], "type": "filter_note_range"},
            {"tags": ["不限"], "type": "filter_pos_distance"},
        ],
        "geo": "",
        "image_formats": ["jpg", "webp", "avif"],
    }
    result = call_api(SEARCH_API, payload, cookie)
    if not result.get("success"):
        return {"success": False, "code": result.get("code"), "msg": result.get("msg")}

    items = []
    for raw in (result.get("data") or {}).get("items") or []:
        card = raw.get("note_card") or {}
        cover = ((card.get("cover") or {}).get("url_default")
                 or (card.get("cover") or {}).get("url")
                 or ((card.get("image_list") or [{}])[0].get("url_default")))
        items.append({
            "id": raw.get("id") or card.get("note_id") or "",
            "title": (card.get("display_title") or "").strip(),
            "desc": (card.get("desc") or "").strip()[:200],
            "cover": cover or "",
            "xsecToken": raw.get("xsec_token") or "",
            "likes": (card.get("interact_info") or {}).get("liked_count") or "",
            "noteType": card.get("type") or "",
        })
    return {"success": True, "items": items}


def note_detail(note_id: str, xsec_token: str) -> dict:
    cookie = cookie_string()
    if not cookie:
        return {"success": False, "code": "NO_COOKIE", "msg": "XHS_COOKIE 未配置"}
    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_search",
        "xsec_token": xsec_token,
    }
    result = call_api(FEED_API, payload, cookie)
    if not result.get("success"):
        return {"success": False, "code": result.get("code"), "msg": result.get("msg")}

    items = (result.get("data") or {}).get("items") or []
    images = []
    title = ""
    if items:
        card = items[0].get("note_card") or {}
        title = (card.get("title") or card.get("desc") or "").strip()[:80]
        for image in card.get("image_list") or []:
            url = image.get("url_default") or image.get("url") or ""
            if url:
                images.append(url)
    return {"success": True, "title": title, "images": images}


def search_raw(keyword: str, page: int) -> dict:
    """原样返回小红书 /search/notes 的响应，供 Java 侧沿用既有解析逻辑。"""
    cookie = cookie_string()
    if not cookie:
        return {"success": False, "code": "NO_COOKIE", "msg": "XHS_COOKIE 未配置"}
    payload = {
        "keyword": keyword,
        "page": page,
        "page_size": 20,  # 小红书只认 20，其他值返回空列表
        "search_id": generate_x_b3_traceid(21),
        "sort": "general",
        "note_type": 0,
        "ext_flags": [],
        "filters": [
            {"tags": ["general"], "type": "sort_type"},
            {"tags": ["不限"], "type": "filter_note_type"},
            {"tags": ["不限"], "type": "filter_note_time"},
            {"tags": ["不限"], "type": "filter_note_range"},
            {"tags": ["不限"], "type": "filter_pos_distance"},
        ],
        "geo": "",
        "image_formats": ["jpg", "webp", "avif"],
    }
    return call_api(SEARCH_API, payload, cookie)


def note_raw(note_id: str, xsec_token: str) -> dict:
    """原样返回小红书 /feed 的响应。"""
    cookie = cookie_string()
    if not cookie:
        return {"success": False, "code": "NO_COOKIE", "msg": "XHS_COOKIE 未配置"}
    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_search",
        "xsec_token": xsec_token,
    }
    return call_api(FEED_API, payload, cookie)


class Handler(BaseHTTPRequestHandler):
    server_version = "XhsService/1.0"

    def log_message(self, fmt, *args):  # 简化日志
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == "/health":
                self._json(200, {"ok": True, "cookieConfigured": bool(cookie_string())})
            elif parsed.path == "/search":
                keyword = (query.get("keyword") or [""])[0].strip()
                if not keyword:
                    self._json(400, {"success": False, "msg": "keyword 必填"})
                    return
                page = int((query.get("page") or ["1"])[0])
                size = int((query.get("size") or ["20"])[0])
                self._json(200, search(keyword, page, size))
            elif parsed.path == "/raw/search":
                keyword = (query.get("keyword") or [""])[0].strip()
                if not keyword:
                    self._json(400, {"success": False, "msg": "keyword 必填"})
                    return
                page = int((query.get("page") or ["1"])[0])
                self._json(200, search_raw(keyword, page))
            elif parsed.path == "/raw/note":
                note_id = (query.get("id") or [""])[0].strip()
                token = (query.get("token") or [""])[0].strip()
                if not note_id:
                    self._json(400, {"success": False, "msg": "id 必填"})
                    return
                self._json(200, note_raw(note_id, token))
            elif parsed.path == "/note":
                note_id = (query.get("id") or [""])[0].strip()
                token = (query.get("token") or [""])[0].strip()
                if not note_id:
                    self._json(400, {"success": False, "msg": "id 必填"})
                    return
                self._json(200, note_detail(note_id, token))
            else:
                self._json(404, {"success": False, "msg": "not found"})
        except Exception as error:  # 签名器异常也要给出可读信息
            self._json(500, {"success": False, "msg": "%s: %s" % (type(error).__name__, error)})


if __name__ == "__main__":
    sys.stderr.write("xhs-service listening on 127.0.0.1:%d\n" % PORT)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
