#!/bin/bash
# 线上状态核对：项目已于 2026-11-25 恢复上线
#
# 用法：ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
#
# 用 --resolve 直连本机，不依赖公网 DNS（DNS 可能还没加回来）。
# 公网 DNS 的状态单独放在最后一节，缺记录只算 WARN。

FAIL=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }

H="--resolve liufengwei.com:443:127.0.0.1"
B="--resolve blog.liufengwei.com:443:127.0.0.1"

echo "== 1. systemd 服务 =="
for s in hellojourney-backend hellojourney-xhs nginx; do
  state=$(systemctl is-active "$s" 2>/dev/null)
  if [ "$state" = "active" ]; then pass "$s active"; else fail "$s 期望 active，实际 $state"; fi
done

echo "== 2. 端口 =="
LISTEN=$(ss -tln 2>/dev/null)
for p in 80 443; do
  if echo "$LISTEN" | grep -q ":$p "; then pass "端口 $p 有监听"; else fail "端口 $p 没有监听"; fi
done
for p in 8000 8010; do
  lines=$(printf '%s\n' "$LISTEN" | grep -E "[:.]$p ")
  if [ -z "$lines" ]; then
    fail "端口 $p 没有监听（后端或边车未启动）"
  elif printf '%s\n' "$lines" | grep -qvE '127\.0\.0\.1|\[::1\]'; then
    fail "端口 $p 有非回环监听"
  else
    pass "端口 $p 只绑回环"
  fi
done

echo "== 3. 站点可访问性（--resolve 直连本机）=="
probe() {
  local host="$1" path="$2" extra="$3" expect="${4:-200}"
  local code
  code=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 25 -k $extra "https://$host$path")
  if [ "$code" = "$expect" ]; then pass "$host$path → $code"; else fail "$host$path 期望 $expect，实际 $code"; fi
}
sleep 1
probe liufengwei.com / "$H"
probe liufengwei.com /hellojourney/ "$H"
probe liufengwei.com /hellojourney/result "$H"
probe liufengwei.com /api/settings "$H"
probe liufengwei.com /api/settings/llm/models "$H"
probe blog.liufengwei.com / "$B"
probe blog.liufengwei.com /blog/ "$B"

echo "== 4. 后端配置 =="
SETTINGS=$(curl -4 -s --max-time 15 -k $H https://liufengwei.com/api/settings)
for key in amap_maps_configured xhs_configured; do
  if echo "$SETTINGS" | grep -q "\"$key\":true"; then pass "$key = true"; else fail "$key 不是 true"; fi
done
if echo "$SETTINGS" | grep -q '"llm_active_provider":"siliconflow"'; then
  pass "LLM 供应商 = siliconflow"
else
  warn "LLM 供应商：$(echo "$SETTINGS" | grep -o '"llm_active_provider":"[^"]*"')"
fi
if echo "$SETTINGS" | grep -q '"secret_updates_enabled":false'; then pass "网页改密钥已禁用"; else warn "SETTINGS_ALLOW_SECRET_UPDATES 不是 false"; fi

echo "== 5. 小红书边车 =="
HEALTH=$(curl -s --max-time 10 http://127.0.0.1:8010/health)
if echo "$HEALTH" | grep -q '"ok": true'; then pass "边车 /health ok"; else fail "边车 /health 异常：$HEALTH"; fi
if echo "$HEALTH" | grep -q '"cookieConfigured": true'; then pass "边车已配置 cookie"; else warn "边车没有 cookie（小红书能力降级）"; fi

echo "== 6. 关键文件 =="
for f in /opt/hellojourney/app.jar /etc/hellojourney/env /var/www/youxi/index.html \
         /var/www/youxi/hellojourney/index.html /var/www/blog/index.html \
         /etc/nginx/sites-available/liufengwei.com; do
  if [ -e "$f" ]; then pass "$f 存在"; else fail "$f 缺失"; fi
done
if grep -q 'location /hellojourney/' /etc/nginx/sites-available/liufengwei.com 2>/dev/null; then
  pass "nginx 有 /hellojourney/ location"
else
  fail "nginx 缺 /hellojourney/ location"
fi
if grep -q 'proxy_read_timeout 620s' /etc/nginx/sites-available/liufengwei.com 2>/dev/null; then
  pass "反代超时 620s"
else
  warn "反代超时可能过短（生成行程 3~6 分钟）"
fi

echo "== 7. 公网 DNS（缺记录只影响外网访问）=="
if command -v dig >/dev/null 2>&1; then
  for host in liufengwei.com www.liufengwei.com blog.liufengwei.com; do
    ip=$(dig +short @223.5.5.5 "$host" A +time=3 +tries=1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)
    if [ -n "$ip" ]; then pass "$host → $ip"; else warn "$host 无 A 记录（公网访问不到，需在阿里云加回解析）"; fi
  done
fi

echo "== 8. 资源 =="
AVAIL=$(free -m | awk '/^Mem:/{print $7}')
if [ "$AVAIL" -gt 150 ]; then pass "可用内存 ${AVAIL} MB"; else warn "可用内存只有 ${AVAIL} MB"; fi
DISK=$(df -h / | awk 'NR==2{gsub("%","",$5); print $5}')
if [ "$DISK" -lt 85 ]; then pass "磁盘已用 ${DISK}%"; else warn "磁盘已用 ${DISK}%"; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过：站点已恢复（核对时间 $(date '+%F %T')）"
else
  echo "有 $FAIL 项不通过 —— 线上与 AGENTS.md 描述不一致，请先更新文档再动代码"
fi
exit "$FAIL"
