---
name: docker-compose
description: >
  Docker Compose patterns for development and production environments.
  Use this skill when writing or maintaining Docker Compose configurations,
  Dockerfiles, or containerized development workflows. Covers multi-stage
  builds, service orchestration, networking, and volumes.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: docker, docker-compose, containers, devops, deployment
---

# Docker Compose Patterns

## Dockerfile Best Practices

### Multi-Stage Builds

Use multi-stage builds to keep production images small and secure.

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER appuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Layer Optimization

- Copy dependency files (`package.json`, `requirements.txt`) before source code to cache dependency installation.
- Use `.dockerignore` to exclude `node_modules`, `.git`, test files, and documentation from the build context.
- Combine related `RUN` commands with `&&` to reduce layers.
- Use `--no-cache` or `--no-install-recommends` to minimize image size.
- Pin base image versions: `node:20.11-alpine`, not `node:latest`.

### Security

- Run as a non-root user. Create a dedicated user in the Dockerfile.
- Do not store secrets in the image. Use environment variables or mounted secrets.
- Use `alpine` or `distroless` base images for smaller attack surface.
- Scan images with `docker scout` or `trivy` in CI.

## Docker Compose for Development

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules    # Anonymous volume to preserve container's node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy
    command: npm run dev

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### Key Development Patterns

- Mount source code as a volume for hot reloading.
- Use anonymous volumes (`/app/node_modules`) to prevent host `node_modules` from overriding container dependencies.
- Use `depends_on` with `condition: service_healthy` to ensure databases are ready.
- Expose ports for local tools (database GUIs, debugging).
- Use a `target: development` stage in multi-stage Dockerfiles.

## Production Compose

For production or staging, use an override file.

```yaml
# docker-compose.prod.yml
services:
  app:
    build:
      context: .
      target: production
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

Run with: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

## Networking

- Services on the same Compose network can reach each other by service name: `http://app:3000`.
- Only expose ports that need to be accessible from the host.
- Use custom networks to isolate groups of services:

```yaml
services:
  app:
    networks:
      - frontend
      - backend
  db:
    networks:
      - backend

networks:
  frontend:
  backend:
```

## Volumes

- Use named volumes for persistent data (databases, uploads).
- Named volumes survive `docker compose down`. They are removed with `docker compose down -v`.
- Use bind mounts for development source code only.
- Back up named volumes before destructive operations.

## Environment Variables

- Use `env_file` for non-secret configuration.
- Use Docker secrets or a secrets manager for sensitive values in production.
- Document all required environment variables in a `.env.example` file.
- Never commit `.env` files with real credentials to version control.

## Health Checks

Always define health checks for services that other services depend on.

- For HTTP services: `curl -f http://localhost:PORT/health`
- For PostgreSQL: `pg_isready -U username`
- For Redis: `redis-cli ping`
- For MySQL: `mysqladmin ping -h localhost`

Set appropriate `interval`, `timeout`, `retries`, and `start_period` values. Start period should account for application boot time.

## Common Commands

```bash
docker compose up -d              # Start all services in background
docker compose down               # Stop and remove containers
docker compose down -v            # Stop and remove containers + volumes
docker compose logs -f app        # Follow logs for a service
docker compose exec app sh        # Shell into a running container
docker compose build --no-cache   # Rebuild without cache
docker compose ps                 # List running services
docker compose run app npm test   # Run one-off command
```

## Troubleshooting

- Container exits immediately: check logs with `docker compose logs app`.
- Port already in use: check for conflicting services with `lsof -i :PORT` or change the host port mapping.
- Volume permission issues: ensure the container user has access to mounted paths. Match UID/GID if needed.
- Slow builds: optimize `.dockerignore`, layer ordering, and use BuildKit (`DOCKER_BUILDKIT=1`).
- DNS resolution failures between services: ensure services are on the same network and use service names, not `localhost`.
