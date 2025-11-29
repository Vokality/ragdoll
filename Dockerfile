FROM oven/bun:1-alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files (bun uses bun.lock)
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose ports for API server and Vite dev server
EXPOSE 3001 5173

# Start both servers using concurrently
CMD ["bun", "run", "docker:dev"]
