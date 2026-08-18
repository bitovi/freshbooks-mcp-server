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

# SERVER_URL is deliberately NOT set here — it's environment-specific (the
# app uses it to construct its own OAuth callback URI) and defaults to
# https://localhost:3443 if unset, which is wrong for anywhere but local
# testing. Always pass it at runtime: `docker run -e SERVER_URL=...` locally,
# or via deploy/values.yaml's app.env in the platform deployment.

EXPOSE 3000

# Alpine's node image ships a non-root `node` user (uid 1000) — run as that
# instead of root.
USER node

CMD ["node", "dist/index.js"]
