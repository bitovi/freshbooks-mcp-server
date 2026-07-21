FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV MODE=http
ENV HTTPS=false

EXPOSE 3000

CMD ["node", "dist/index.js"]
