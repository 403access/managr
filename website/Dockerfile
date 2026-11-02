FROM oven/bun:1.4.4 AS build
WORKDIR /src
COPY docs ./docs
COPY website ./website
WORKDIR /src/website
RUN bun install --frozen-lockfile && bun run build

FROM nginx:1.28-alpine
COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/website/build /usr/share/nginx/html/managr
EXPOSE 3001
