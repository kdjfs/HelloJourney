FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_USE_MOCK=false
ARG VITE_API_BASE_URL=
ARG VITE_AMAP_WEB_JS_KEY=
ARG VITE_AMAP_SECURITY_JS_CODE=
ENV VITE_USE_MOCK=${VITE_USE_MOCK} VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_AMAP_WEB_JS_KEY=${VITE_AMAP_WEB_JS_KEY} VITE_AMAP_SECURITY_JS_CODE=${VITE_AMAP_SECURITY_JS_CODE}
RUN npm run build

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
