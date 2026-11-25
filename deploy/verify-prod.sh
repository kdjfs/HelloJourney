#!/bin/bash
# 线上状态核对：站点已恢复（2026-11-25）并启用了 HTTP Basic Auth（仅本人可访问）
#
# 用法：ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
#
# - 未登录访问应当一律 401
# - 带凭据访问应当 200（凭据从 /root/basic-auth-credentials.txt 读取）
# - 全部用 --resolve 直连本机，不依赖公网 DNS

FAIL=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }

CRED_FILE=/root/basic-auth-credentials.txt
AUTH=""
if [ -f "$CRED_FILE" ]; then
  U=$(grep -m1 '^用户名:' "$CRED_FILE" | sed 's/^用户名:[[:space:]]*//' | tr -d '\r')
  P=$(grep -m1 '^密码:' "$CRED_FILE" | sed 's/^密码:[[:space:]]*//' | tr -d '\r')
  if [ -n "$U" ] && [ -n "$P" ]; then AUTH="-u $U:$P"; else warn "凭据文件存在但解析失败，跳过鉴权后检查"; fi
else
  warn "$CRED_FILE 不存在，跳过鉴权后检查"
fi

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

echo "== 3. 访问控制：未登录必须 401 =="
probe_anon() {
  local host="$1" path="$2"
  local code
  code=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 25 -k \
    --resolve "$host:443:127.0.0.1" "https://$host$path")
  if [ "$code" = "401" ]; then pass "未登录 $host$path → 401"; else fail "未登录 $host$path 期望 401，实际 $code"; fi
}
probe_anon liufengwei.com /
probe_anon liufengwei.com /hellojourney/
probe_anon liufengwei.com /api/settings
probe_anon blog.liufengwei.com /
P8080=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:8080/)
if [ "$P8080" = "401" ]; then pass "8080 默认站 → 401"; else fail "8080 默认站 期望 401，实际 $P8080"; fi
WRONG=$(curl -4 -s -o /dev/null -w '%{http_code}' -u 'lfw:definitely-wrong' -k \
  --resolve liufengwei.com:443:127.0.0.1 https://liufengwei.com/)
if [ "$WRONG" = "401" ]; then pass "错误密码 → 401"; else fail "错误密码 期望 401，实际 $WRONG"; fi

echo "== 4. 带凭据必须 200 =="
probe_auth() {
  local host="$1" path="$2"
  local code
  code=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 25 -k $AUTH \
    --resolve "$host:443:127.0.0.1" "https://$host$path")
  if [ "$code" = "200" ]; then pass "已登录 $host$path → 200"; else fail "已登录 $host$path 期望 200，实际 $code"; fi
}
if [ -n "$AUTH" ]; then
  probe_auth liufengwei.com /
  probe_auth liufengwei.com /hellojourney/
  probe_auth liufengwei.com /hellojourney/result
  probe_auth liufengwei.com /api/settings
  probe_auth liufengwei.com /api/settings/llm/models
  probe_auth blog.liufengwei.com /
  probe_auth blog.liufengwei.com /blog/
fi

echo "== 5. 证书续期路径必须免鉴权 =="
mkdir -p /var/www/acme/.well-known/acme-challenge
echo ok > /var/www/acme/.well-known/acme-challenge/probe.txt
ACME=$(curl -4 -s -o /dev/null -w '%{http_code}' -H 'Host: liufengwei.com' \
  http://127.0.0.1/.well-known/acme-challenge/probe.txt)
rm -f /var/www/acme/.well-known/acme-challenge/probe.txt
if [ "$ACME" = "200" ]; then pass "ACME 校验路径免鉴权（200）"; else fail "ACME 校验路径返回 $ACME，证书将无法续期"; fi

echo "== 6. 后端与边车 =="
SETTINGS=$(curl -4 -s --max-time 15 -k $AUTH --resolve liufengwei.com:443:127.0.0.1 https://liufengwei.com/api/settings)
for key in amap_maps_configured xhs_configured; do
  if echo "$SETTINGS" | grep -q "\"$key\":true"; then pass "$key = true"; else fail "$key 不是 true"; fi
done
if echo "$SETTINGS" | grep -q '"secret_updates_enabled":false'; then pass "网页改密钥已禁用"; else warn "SETTINGS_ALLOW_SECRET_UPDATES 不是 false"; fi
HEALTH=$(curl -s --max-time 10 http://127.0.0.1:8010/health)
if echo "$HEALTH" | grep -q '"ok": true'; then pass "边车 /health ok"; else fail "边车 /health 异常：$HEALTH"; fi
if echo "$HEALTH" | grep -q '"cookieConfigured": true'; then pass "边车已配置 cookie"; else warn "边车没有 cookie"; fi

echo "== 7. 关键文件 =="
for f in /opt/hellojourney/app.jar /etc/hellojourney/env /var/www/youxi/index.html \
         /var/www/youxi/hellojourney/index.html /var/www/blog/index.html \
         /etc/nginx/sites-available/liufengwei.com /etc/nginx/htpasswd-liufengwei; do
  if [ -e "$f" ]; then pass "$f 存在"; else fail "$f 缺失"; fi
done
if grep -q 'auth_basic_user_file' /etc/nginx/sites-available/liufengwei.com 2>/dev/null; then
  pass "nginx 已启用 Basic Auth"
else
  fail "nginx 没有 auth_basic（站点对所有人开放）"
fi

echo "== 8. 资源 =="
AVAIL=$(free -m | awk '/^Mem:/{print $7}')
if [ "$AVAIL" -gt 150 ]; then pass "可用内存 ${AVAIL} MB"; else warn "可用内存只有 ${AVAIL} MB"; fi
DISK=$(df -h / | awk 'NR==2{gsub("%","",$5); print $5}')
if [ "$DISK" -lt 85 ]; then pass "磁盘已用 ${DISK}%"; else warn "磁盘已用 ${DISK}%"; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过：站点在线且仅本人可访问（核对时间 $(date '+%F %T')）"
else
  echo "有 $FAIL 项不通过 —— 线上与 AGENTS.md 描述不一致，请先更新文档再动代码"
fi
exit "$FAIL"
