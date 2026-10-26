FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
COPY . .
# Build-time URL is non-secret and is never connected to during the build.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
