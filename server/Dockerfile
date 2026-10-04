# Multi-stage Docker build for RSM Messenger Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/avatars uploads/images uploads/videos uploads/audio uploads/documents uploads/thumbnails

EXPOSE 5000

CMD ["node", "dist/server.js"]
