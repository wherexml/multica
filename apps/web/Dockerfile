# --- Build stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all files first
COPY . .

# Install dependencies (including monorepo root)
ENV CI=true
RUN pnpm install --frozen-lockfile

# Build the frontend
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG BACKEND_REWRITE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV BACKEND_REWRITE_URL=${BACKEND_REWRITE_URL}
RUN pnpm build

# --- Runtime stage ---
FROM node:22-alpine

WORKDIR /app

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./

# Copy static files and public folder
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
