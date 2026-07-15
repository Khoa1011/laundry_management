FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --chown=101:101 nginx.conf /etc/nginx/nginx.conf
COPY --from=builder --chown=101:101 /app/dist/ /usr/share/nginx/html/

USER 101:101

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD wget -qO- http://127.0.0.1:8080/health | grep -q '^healthy$' || exit 1

CMD ["nginx", "-g", "daemon off;"]

