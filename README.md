# HelloJourney

> A full-stack AI travel planning workspace for turning a destination, budget, and preferences into an actionable itinerary.

[Repository](https://github.com/kdjfs/HelloJourney) · [GPL-2.0 License](LICENSE)

**HelloJourney** 是一个可验证、可编辑、可局部重新规划、可撤销的 AI Travel Workspace。系统通过原生 Tool Calling 调用地图与天气能力，用结构化输出和 Review Agent 约束行程质量，并提供 **Web 端**（React）和 **微信小程序**（UniApp）体验。

HelloJourney combines a React web client, a Spring Boot service, and a UniApp / WeChat mini-program client. It is designed as a real product workflow: model output is enriched with map data, weather, travel content, structured POIs, and live task progress.

## Why it is interesting

- **AI itinerary planning** with multi-provider LLM support and context-aware follow-up chat.
- **Agentic pipeline**: native tool calling, structured JSON output, and a Review Agent that blocks invalid plans.
- **Real integrations** for Tencent Maps, AMap, Google Maps, weather, POI search, geocoding, and route planning — with automatic provider fallback.
- **Verified attraction photos** via AMap POI identity matching; deterministic placeholder cards when nothing is verified.
- **Editable itinerary workspace** with undo/redo, cross-day moves, and AI-proposed partial replan change sets you can apply or reject.
- **Knowledge graph view** built with ECharts for exploring destinations and relationships.
- **Interactive itinerary map** (dark 3D AMap) with numbered markers, info windows, and route fallbacks.
- **zh / en / ja i18n**, itinerary PNG export, reservation reminders, and a read-only settings page that never exposes secrets.
- **Async generation pipeline** with WebSocket progress updates, retryable sections, and history.
- **Multi-client delivery** across React Web, UniApp, and WeChat mini-program.
- **Mock-first development** with MSW, plus backend tests with JUnit 5 and Mockito.

## Stack

| Layer | Technologies |
| --- | --- |
| Web | React 19 · TypeScript · Vite · Ant Design · ECharts · i18next |
| Service | Java 17 · Spring Boot 3 · WebSocket · OkHttp |
| Mobile | UniApp · Vue 3 · TypeScript |
| AI / Data | DeepSeek · OpenAI-compatible providers · Tencent Maps · AMap · Google Maps |
| Quality | MSW · JUnit 5 · Mockito · Vitest · ESLint |

## Quick start

Requirements: JDK 17+, Maven 3.8+, Node.js 20+, and npm 10+.

```bash
git clone https://github.com/kdjfs/HelloJourney.git
cd HelloJourney
```

Start the service:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

Start the web client in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The web client runs at `http://localhost:5173`; the service defaults to `http://localhost:8000`. Configure provider keys and map credentials in `backend/src/main/resources/application.yml`. Keep secrets local and out of Git.

For a frontend-only walkthrough, use the repository's MSW mock mode with `VITE_USE_MOCK=true`.

## Project shape

```text
backend/   Spring Boot API, AI orchestration, integrations, WebSocket progress
frontend/  React web application and mock-first API layer
uniapp/    Vue 3 cross-platform / WeChat mini-program client
```

## Status

This is an active engineering project. The current README documents implemented capabilities and remaining roadmap items; external API credentials are intentionally required for live provider flows.
