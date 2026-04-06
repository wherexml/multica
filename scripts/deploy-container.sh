#!/bin/bash
# Multica Container Deployment Script
# Uses 41XXX port range by default

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env.container"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    echo "Please copy from .env.example:"
    echo "  cp .env.example .env.container"
    echo "Then edit the ports to use 41XXX range:"
    echo "  POSTGRES_PORT=41500"
    echo "  BACKEND_PORT=41501"
    echo "  FRONTEND_PORT=41502"
    exit 1
fi

# Load environment variables
log_info "Loading configuration from $ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | xargs)

echo ""
echo "=========================================="
echo "  Multica Container Deployment"
echo "=========================================="
echo ""
echo "Services will be available at:"
echo "  - PostgreSQL:  localhost:${POSTGRES_PORT:-41500}"
echo "  - Backend API: http://localhost:${BACKEND_PORT:-41501}"
echo "  - Frontend:    http://localhost:${FRONTEND_PORT:-41502}"
echo ""

# Check if JWT_SECRET is still the default
if [ "$JWT_SECRET" = "change-me-in-production-please-generate-a-random-string" ] || [ "$JWT_SECRET" = "change-me-in-production" ]; then
    log_warn "JWT_SECRET is using the default value!"
    log_warn "Generating a random JWT_SECRET for this deployment..."
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    # Update the env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
    else
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
    fi
    export JWT_SECRET
    log_success "New JWT_SECRET generated and saved to $ENV_FILE"
fi

# Check for required commands
command -v docker >/dev/null 2>&1 || { log_error "Docker is required but not installed."; exit 1; }
command -v docker compose >/dev/null 2>&1 || { log_error "Docker Compose is required but not installed."; exit 1; }

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Check ports
docker_compose_cmd="docker compose -f ${PROJECT_DIR}/docker-compose.yml --env-file ${ENV_FILE}"
log_info "Checking ports..."
PORTS_IN_USE=""

for port in "${POSTGRES_PORT:-41500}" "${BACKEND_PORT:-41501}" "${FRONTEND_PORT:-41502}"; do
    if ! check_port "$port"; then
        PORTS_IN_USE="$PORTS_IN_USE $port"
    fi
done

if [ -n "$PORTS_IN_USE" ]; then
    log_warn "Ports$PORTS_IN_USE are already in use."
    read -p "Do you want to stop existing containers? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Stopping existing containers..."
        $docker_compose_cmd down 2>/dev/null || true
    else
        log_error "Cannot start deployment - ports are in use"
        exit 1
    fi
fi

# Pull/build images
echo ""
log_info "Building Docker images..."
$docker_compose_cmd build --no-cache

# Start PostgreSQL first
echo ""
log_info "Starting PostgreSQL..."
$docker_compose_cmd up -d postgres

# Wait for PostgreSQL to be ready
echo ""
log_info "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec multica-postgres pg_isready -U "${POSTGRES_USER:-multica}" -d "${POSTGRES_DB:-multica}" >/dev/null 2>&1; then
        log_success "PostgreSQL is ready!"
        break
    fi
    sleep 1
done

# Run migrations
echo ""
log_info "Running database migrations..."
$docker_compose_cmd --profile migrate run --rm migrate

# Start backend and frontend
echo ""
log_info "Starting backend and frontend..."
$docker_compose_cmd up -d backend frontend

# Wait for services to be ready
echo ""
log_info "Waiting for services to start..."
sleep 5

# Health check
echo ""
log_info "Checking service health..."

# Check backend
if curl -s http://localhost:"${BACKEND_PORT:-41501}"/health >/dev/null 2>&1; then
    log_success "Backend is healthy"
else
    log_warn "Backend health check failed (may still be starting)"
fi

# Check frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:"${FRONTEND_PORT:-41502}" | grep -q "200\|307"; then
    log_success "Frontend is responding"
else
    log_warn "Frontend check failed (may still be starting)"
fi

echo ""
echo "=========================================="
log_success "Multica deployment complete!"
echo "=========================================="
echo ""
echo "Access your services:"
echo "  Frontend:    http://localhost:${FRONTEND_PORT:-41502}"
echo "  Backend API: http://localhost:${BACKEND_PORT:-41501}"
echo "  Health:      http://localhost:${BACKEND_PORT:-41501}/health"
echo ""
echo "Useful commands:"
echo "  View logs:   docker compose -f docker-compose.yml --env-file .env.container logs -f"
echo "  Stop:        docker compose -f docker-compose.yml --env-file .env.container down"
echo "  Restart:     docker compose -f docker-compose.yml --env-file .env.container restart"
echo ""
echo "To configure the CLI/daemon, set:"
echo "  export MULTICA_APP_URL=http://localhost:${FRONTEND_PORT:-41502}"
echo "  export MULTICA_SERVER_URL=ws://localhost:${BACKEND_PORT:-41501}/ws"
echo ""
