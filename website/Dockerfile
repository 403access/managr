FROM oven/bun:1.4.4 AS build
WORKDIR /src/website
COPY website/package.json website/bun.lock ./
RUN bun install --frozen-lockfile
COPY website ./
COPY docs /src/docs
RUN bun run build

FROM nginx:1.28-alpine
COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/website/build /usr/share/nginx/html/managr
EXPOSE 3001
