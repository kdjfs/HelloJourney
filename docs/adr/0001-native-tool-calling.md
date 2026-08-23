# ADR 0001：采用受控的原生 Tool Calling 循环

- 状态：Accepted
- 日期：2026-08-20
- 范围：HelloJourney Backend / AI Agent

## 背景

旧实现让模型输出 `[TOOL_CALL:...]` 文本，但没有真正执行模型协议中的 `tools` / `tool_calls`。它无法可靠校验参数、限制可调用能力、续传 DeepSeek 的思考模式上下文，也无法提供一致的取消、超时和审计边界。

DeepSeek V4 Pro 的 Chat Completions 接口原生支持工具调用。思考模式发生工具调用时，后续请求必须原样带回对应 assistant 消息的 `reasoning_content`；该字段只用于协议连续性，不能作为进度或结果返回用户。参考 [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) 与 [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)。

## 决策

1. `AgentLoop` 只管理消息、轮次、去重、取消、token 汇总和安全事件，不直接接触地图实现。
2. `ToolRegistry` 是唯一工具入口；当前只注册 `get_weather`、`search_poi`、`search_hotel`、`search_restaurant`、`geocode`、`route_plan`。
3. `ToolExecutor` 在有界 Spring 线程池上执行，通过本地 JSON Schema 子集校验参数，并实施单工具超时、有限重试和结果大小限制。
4. 每次 Agent 运行生成 trace ID。日志只记录 trace、工具名、状态、轮次和 token，不记录 Secret、完整 Prompt、原始响应或私有推理。
5. 前端只接收固定语义的 `AgentEvent`，不接收 `reasoning_content`。
6. 暂不启用 DeepSeek provider-side `strict` tool schema。官方 strict 模式当前要求 `/beta` Base URL；V3 使用稳定的 `https://api.deepseek.com`，由本地校验承担强制边界。
7. 地图结果带 `source`、实际 provider、`verified_at` 和 `verified`。地图查询失败时返回空/未验证结果，不再伪装成北京默认坐标。

## 后果

正向结果：模型不能调用任意 Java 方法或系统命令；工具协议可测试、可取消、可观察；后续可以在不改循环的情况下增加适配器。

代价与限制：工具目前串行执行；地图 SDK 的底层网络取消能力仍取决于各 provider；小红书保持独立 adapter，不阻塞地图核心链路。
