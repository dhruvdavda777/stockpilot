# syntax=docker/dockerfile:1

# ---- build stage: Node + Vite produce static files ----
FROM node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_APP_VERSION=local
ARG VITE_APP_ENV=production
ENV VITE_APP_VERSION=${VITE_APP_VERSION} VITE_APP_ENV=${VITE_APP_ENV}
RUN npm run build

# ---- runtime stage: unprivileged Nginx serves dist/ (no Node in the final image) ----
FROM nginxinc/nginx-unprivileged:1.29-alpine
USER root
RUN apk upgrade --no-cache
USER 101
ENV BACKEND_URL=http://backend:8000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
