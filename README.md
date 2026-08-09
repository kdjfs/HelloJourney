# HelloJourney

> A full-stack AI travel planning workspace for turning a destination, budget, and preferences into an actionable itinerary.

[Repository](https://github.com/kdjfs/HelloJourney) · [GPL-2.0 License](LICENSE)

HelloJourney combines a React web client, a Spring Boot service, and a UniApp / WeChat mini-program client. It is designed as a real product workflow: model output is enriched with map data, weather, travel content, structured POIs, and live task progress.

## Why it is interesting

- **AI itinerary planning** with multi-provider LLM support and context-aware follow-up chat.
- **Real integrations** for Tencent Maps, Google Maps, weather, POI search, geocoding, and route planning.
- **Knowledge graph view** built with ECharts for exploring destinations and relationships.
- **Async generation pipeline** with WebSocket progress updates, retryable sections, and history.
- **Multi-client delivery** across React Web, UniApp, and WeChat mini-program.
- **Mock-first development** with MSW, plus backend tests with JUnit 5 and Mockito.

## Stack

| Layer | Technologies |
| --- | --- |
| Web | React 19 · TypeScript · Vite · Ant Design · ECharts |
| Service | Java 17 · Spring Boot 3 · WebSocket · OkHttp |
| Mobile | UniApp · Vue 3 · TypeScript |
| AI / Data | DeepSeek · OpenAI-compatible providers · Tencent Maps · Google Maps |
| Quality | MSW · JUnit 5 · Mockito · ESLint |

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
npm install
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
