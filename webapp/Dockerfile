# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY webapp/package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm config set strict-ssl false && npm ci

# Copy webapp source files
COPY webapp/ ./

# Remove the symlink and copy actual data files
# Docker cannot follow symlinks outside build context, so we replace the symlink
# with actual files from data/latest during the build
RUN rm -f public/data
COPY data/latest/ ./public/data/

# Generate pre-computed station groups
RUN node scripts/generate-station-groups.js

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 32516
EXPOSE 32516

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
