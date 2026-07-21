FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV MODE=http
ENV HTTPS=false

EXPOSE 3000

# Alpine's node image ships a non-root `node` user (uid 1000) — run as that
# instead of root.
USER node

CMD ["node", "dist/index.js"]
