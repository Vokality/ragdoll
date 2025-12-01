# Multi-stage build for Ragdoll Demo in production mode
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy all source code (monorepo workspace requires full context)
COPY . .

# Install all dependencies (including dev dependencies for building)
RUN bun install

# Build the ragdoll package first (demo depends on it)
RUN cd packages/ragdoll && bun run build

# Build the demo app (frontend)
RUN cd apps/demo && bun run build

# Production stage
FROM oven/bun:1 AS runner

WORKDIR /app

# Copy all source code for workspace resolution
COPY . .

# Install production dependencies only
RUN bun install --production

# Copy built artifacts from builder (overwrite the source with built versions)
COPY --from=builder /app/packages/ragdoll/dist ./packages/ragdoll/dist
COPY --from=builder /app/apps/demo/dist ./apps/demo/dist

# Expose backend port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the backend server (which will serve static files and API)
CMD ["bun", "run", "apps/demo/server/index.ts"]
