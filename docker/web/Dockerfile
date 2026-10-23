# syntax=docker/dockerfile:1.7
# Daiq web: build the static SPA, serve it with unprivileged nginx (ADR-0012).

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY patches patches
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/data/package.json packages/data/
COPY packages/ui/package.json packages/ui/
COPY packages/editor/package.json packages/editor/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "@daiq/web..."
COPY packages packages
COPY apps/web apps/web
ARG DAIQ_BUILD_ID=docker
RUN VITE_BUILD_ID="$DAIQ_BUILD_ID" pnpm --filter @daiq/web build

FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY docker/web/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/web/05-daiq.envsh /docker-entrypoint.d/05-daiq.envsh
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
