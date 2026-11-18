#!/bin/bash
# 线上状态核对脚本：本文件描述的事实（AGENTS.md / docs/INFRA.md）是否还成立
#
# 用法：
#   ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
# 或拷贝到服务器执行：bash verify-prod.sh
#
# 全部 PASS 才说明"记忆没有过期"。

FAIL=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }

echo "== 1. systemd 服务 =="
for s in hellojourney-backend hellojourney-xhs nginx; do
  state=$(systemctl is-active "$s" 2>/dev/null)
  if [ "$state" = "active" ]; then pass "$s active"; else fail "$s 期望 active，实际 $state"; fi
done

echo "== 2. 监听端口 =="
LISTEN=$(ss -tln 2>/dev/null)
for p in 80 443 8080; do
  if echo "$LISTEN" | grep -q ":$p "; then pass "端口 $p 有监听"; else fail "端口 $p 没有监听"; fi
done
for p in 8000 8010; do
  # ss 对 IPv4 回环可能显示成 127.0.0.1 或 [::ffff:127.0.0.1]，两种都要认
  lines=$(printf '%s\n' "$LISTEN" | grep -E "[:.]$p ")
  if [ -z "$lines" ]; then
    fail "端口 $p 没有监听"
  elif printf '%s\n' "$lines" | grep -qvE '127\.0\.0\.1|\[::1\]'; then
    fail "端口 $p 有非回环监听（应由 127.0.0.1 独占）：$(printf '%s\n' "$lines" | tr '\n' ' ')"
  else
    pass "端口 $p 只绑回环"
  fi
done

echo "== 3. 站点可访问性 =="
check_code() {  # $1=url 期望 200（-k 允许自签/本地；-4 避免走 IPv6 无路由；失败重试两次）
  code=$(curl -4 -sS -o /dev/null -w '%{http_code}' --max-time 20 \
    --retry 2 --retry-connrefused --retry-delay 1 -k "$1" 2>/dev/null || echo 000)
  if [ "$code" = "$2" ]; then pass "$1 → $code"; else fail "$1 期望 $2，实际 $code"; fi
}
check_code "https://liufengwei.com/" 200
check_code "https://liufengwei.com/hellojourney/" 200
check_code "https://liufengwei.com/hellojourney/result" 200
check_code "https://liufengwei.com/api/settings" 200

echo "== 3.1 个人主页（游戏内容已于 2026-11-18 彻底删除，无备份）=="
if [ -d /var/www/youxi/games ]; then
  fail "/var/www/youxi/games 仍然存在（应已删除，见 AGENTS.md 第 2 节）"
else
  pass "/var/www/youxi/games 已删除"
fi
if [ -d /var/www/youxi/assets ]; then
  warn "/var/www/youxi/assets 仍存在（首页图标/封面应已删除）"
else
  pass "/var/www/youxi/assets 已删除"
fi
OLD_GAME=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 15 -k https://liufengwei.com/games/xiangqi/)
if [ "$OLD_GAME" = "404" ]; then pass "旧游戏地址已 404"; else warn "旧游戏地址返回 $OLD_GAME（预期 404）"; fi
HOME_HTML=$(curl -4 -s --max-time 15 -k https://liufengwei.com/)
if printf '%s' "$HOME_HTML" | grep -q '做会思考的界面'; then
  pass "首页是当前个人主页"
else
  warn "首页不是当前个人主页（是否被改回旧站？）"
fi
if printf '%s' "$HOME_HTML" | grep -qE '游戏|街机|可玩作品'; then
  fail "首页仍出现游戏字样（应已彻底清除）"
else
  pass "首页无游戏字样"
fi
if printf '%s' "$HOME_HTML" | grep -q 'id="contact"'; then
  pass "首页保留 #contact 锚点（旧外链可用）"
else
  warn "首页缺少 #contact 锚点（历史外链会落到页首）"
fi
if ls /root/youxi-site-backup-*.tgz >/dev/null 2>&1; then
  warn "服务器上仍有 youxi 备份包（用户要求全部删除）"
else
  pass "服务器无游戏备份残留"
fi

echo "== 4. 后端配置 =="
SETTINGS=$(curl -4 -s --max-time 15 https://liufengwei.com/api/settings)
for key in amap_maps_configured xhs_configured; do
  if echo "$SETTINGS" | grep -q "\"$key\":true"; then pass "$key = true"; else fail "$key 不是 true"; fi
done
if echo "$SETTINGS" | grep -q '"llm_active_provider":"siliconflow"'; then
  pass "LLM 供应商 = siliconflow"
else
  warn "LLM 供应商不是 siliconflow：$(echo "$SETTINGS" | grep -o '"llm_active_provider":"[^"]*"')"
fi

echo "== 5. 小红书边车 =="
HEALTH=$(curl -s --max-time 10 http://127.0.0.1:8010/health)
if echo "$HEALTH" | grep -q '"ok": true'; then pass "边车 /health ok"; else fail "边车 /health 异常：$HEALTH"; fi
if echo "$HEALTH" | grep -q '"cookieConfigured": true'; then pass "边车已配置 cookie"; else warn "边车没有 cookie（小红书能力降级）"; fi
if grep -q '^XHS_SERVICE_URL=' /etc/hellojourney/env 2>/dev/null; then
  pass "后端已指向边车 XHS_SERVICE_URL"
else
  warn "未设置 XHS_SERVICE_URL，后端会退回 SSR（搜索结果为空）"
fi

echo "== 6. 关键文件 =="
for f in /opt/hellojourney/app.jar /etc/hellojourney/env /var/www/youxi/hellojourney/index.html /etc/nginx/sites-available/youxi; do
  if [ -e "$f" ]; then pass "$f 存在"; else fail "$f 缺失"; fi
done
if grep -q 'location /hellojourney/' /etc/nginx/sites-available/youxi 2>/dev/null; then
  pass "nginx 里有 /hellojourney/ location"
else
  fail "nginx 里缺 /hellojourney/ location"
fi
if grep -q 'proxy_read_timeout 620s' /etc/nginx/sites-available/youxi 2>/dev/null; then
  pass "反代超时 ≥ 620s"
else
  warn "反代超时可能过短（生成行程 3~6 分钟）"
fi

echo "== 7. 资源 =="
AVAIL=$(free -m | awk '/^Mem:/{print $7}')
if [ "$AVAIL" -gt 150 ]; then pass "可用内存 ${AVAIL} MB"; else warn "可用内存只有 ${AVAIL} MB"; fi
DISK=$(df -h / | awk 'NR==2{gsub("%","",$5); print $5}')
if [ "$DISK" -lt 85 ]; then pass "磁盘已用 ${DISK}%"; else warn "磁盘已用 ${DISK}%"; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过，AGENTS.md 描述与线上一致（核对时间 $(date '+%F %T')）"
else
  echo "有 $FAIL 项不通过 —— 线上与文档不一致，请先更新 AGENTS.md / docs/INFRA.md 再改代码"
fi
exit "$FAIL"
