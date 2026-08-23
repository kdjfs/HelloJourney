# ADR 0002：版本化 TripPlan Contract 与确定性 Review

- 状态：Accepted
- 日期：2026-08-20
- 范围：HelloJourney Backend / Trip Planning

## 背景

旧 Planner 从 Markdown 中用正则截取 JSON，并把引号修补、截断补全和 LLM 修复当作正常流程。该方案会掩盖模型输出错误，无法区分 AI 建议与真实地图数据，也不能保证日期、预算和城市等业务约束。

DeepSeek 稳定版 Chat Completions 支持 `response_format: {"type":"json_object"}`，保证输出为合法 JSON，但官方同时要求 Prompt 明确说明 JSON 输出；稳定接口没有提供任意业务 JSON Schema 的服务端强校验。参考 [Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion/)。

## 决策

1. 使用 DeepSeek JSON Output 作为语法层保障。
2. 将 `schemas/trip-plan-v3.schema.json` 作为版本化输出合同；本地校验通过后才映射 Java DTO。
3. `TripReviewAgent` 执行确定性的业务校验：请求日期与连续性、城市、坐标、时间冲突、三餐、预算复算、天气日期以及验证声明。
4. `verified` / `live_weather` 必须带地图来源、provider、验证时间和外部标识；否则按严重错误拒绝，避免 AI 冒充真实数据。
5. Schema 或 Review 失败时最多进行两次完整 JSON 修复。修复 Prompt 携带完整原输出和精确路径，不截断、不使用正则或本地“猜测修补”。
6. warnings 可以随响应返回；errors 在修复耗尽后终止任务，不能把严重错误行程返回前端。

## 后果

行程输出变得可验证、可演进并可用于前端类型契约。代价是 Prompt 中需要包含 Schema，且 provider 新增字段时必须先升级 contract。路线和酒店的实时证据仍受地图凭证与 provider 可用性约束；没有证据时明确标记 `needs_verification`，不会伪造成功。
