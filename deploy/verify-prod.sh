#!/bin/bash
# 线上状态核对：当前项目处于「已下线」状态（2026-11-18 用户要求删除站点内容、DNS 记录已移除）
#
# 用法：
#   ssh astrbot-server 'bash -s' < deploy/verify-prod.sh
#
# 全部 PASS 表示"确实已经下线、且没有残留内容"。
# 如果有 FAIL，通常意味着站点被重新上线了（或 DNS 被加回来了）——先去更新 AGENTS.md 再改代码。

FAIL=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }

echo "== 1. DNS：域名应无法解析 =="
# 用公共 DNS 判定：ECS 内部解析器会缓存已删除的记录（实测 blog 仍返回旧 IP），不能代表公网真实状态
resolve_public() {
  if command -v dig >/dev/null 2>&1; then
    dig +short @223.5.5.5 "$1" A +time=3 +tries=1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
  else
    getent ahosts "$1" 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
  fi
}
for host in liufengwei.com www.liufengwei.com blog.liufengwei.com; do
  ip=$(resolve_public "$host" | head -n 1)
  if [ -n "$ip" ]; then
    fail "$host 仍能解析到 $ip（站点可能被重新上线）"
  else
    pass "$host 已无 A 记录（全网访问不到）"
  fi
done

echo "== 2. nginx：停车配置生效，一律 410 =="
if [ "$(systemctl is-active nginx)" = "active" ]; then pass "nginx active"; else fail "nginx 未运行"; fi
if [ -f /etc/nginx/sites-enabled/parked ]; then pass "parked 站点配置已启用"; else fail "缺少 parked 配置"; fi
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Host: liufengwei.com' http://127.0.0.1/ 2>/dev/null || echo 000)
if [ "$CODE" = "410" ]; then pass "HTTP 请求返回 410 Gone（不显示任何内容）"; else fail "HTTP 返回 $CODE，期望 410"; fi
CODE443=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -k --resolve liufengwei.com:443:127.0.0.1 https://liufengwei.com/ 2>/dev/null || echo 000)
if [ "$CODE443" = "410" ]; then pass "HTTPS 请求返回 410 Gone"; else fail "HTTPS 返回 $CODE443，期望 410"; fi

echo "== 3. 站点内容应已删除 =="
for d in /var/www/blog /var/www/youxi /opt/hellojourney /opt/xhs-sign; do
  if [ -e "$d" ]; then fail "$d 仍然存在（应已删除）"; else pass "$d 已删除"; fi
done
if [ -d /var/www/acme ]; then pass "/var/www/acme 保留（证书续期用）"; else fail "缺少 /var/www/acme"; fi

echo "== 4. 服务与端口应已移除 =="
if ls /etc/systemd/system/hellojourney-*.service >/dev/null 2>&1; then
  fail "仍存在 hellojourney 的 systemd 单元"
else
  pass "hellojourney 服务单元已删除"
fi
for p in 8000 8010; do
  if ss -tln 2>/dev/null | grep -qE "[:.]$p "; then fail "端口 $p 仍在监听（后端/边车未清理）"; else pass "端口 $p 无监听"; fi
done
for p in 80 443; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then pass "端口 $p 由 nginx 监听"; else fail "端口 $p 没有监听"; fi
done

echo "== 5. 磁盘（内容删除后应释放 ~240 MB）=="
DISK=$(df -h / | awk 'NR==2{gsub("%","",$5); print $5}')
if [ "$DISK" -lt 90 ]; then pass "磁盘已用 ${DISK}%"; else fail "磁盘已用 ${DISK}%，接近写满"; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过：站点确实已下线，服务器无本站残留（核对时间 $(date '+%F %T')）"
else
  echo "有 $FAIL 项不通过 —— 线上与 AGENTS.md 第 1 节的「已下线」描述不一致，请先更新文档再动代码"
fi
exit "$FAIL"
