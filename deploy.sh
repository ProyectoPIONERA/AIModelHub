#!/bin/bash
###############################################################################
# IAModelHub - Automated Deployment Script
# 
# Deploys the reorganized CatalogModelIA_DS stack (backend + UI) from scratch.
# Includes: Docker containers, database initialization, dependencies, and services.
#
# Usage: ./deploy.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$PROJECT_DIR/IAModelHub_Extensiones"
UI_DIR="$PROJECT_DIR/IAModelHub_EDCUI/ml-browser-app"
BACKEND_DIR="$EXT_DIR/backend"
FRONTEND_DIR="$UI_DIR"
DB_BACKUP="$EXT_DIR/database/full-backup.sql"
DB_INIT="$EXT_DIR/database/init-database.sql"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 IAModelHub - Automated Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

###############################################################################
# Step 1: Check Prerequisites
###############################################################################
echo -e "${YELLOW}[1/7]${NC} Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
    exit 1
fi

DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo -e "${GREEN}✓${NC} Docker: $DOCKER_VERSION"
echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
echo ""

###############################################################################
# Step 2: Stop Existing Services
###############################################################################
echo -e "${YELLOW}[2/7]${NC} Stopping existing services..."

# Stop any running Node processes
pkill -f "node.*server-edc.js" || true
pkill -f "ng serve" || true

# Stop Docker containers if running
docker stop ml-assets-postgres ml-assets-minio 2>/dev/null || true
docker rm ml-assets-postgres ml-assets-minio 2>/dev/null || true

echo -e "${GREEN}✓${NC} Existing services stopped"
echo ""

###############################################################################
# Step 3: Start Docker Infrastructure
###############################################################################
echo -e "${YELLOW}[3/7]${NC} Starting Docker infrastructure (PostgreSQL + MinIO)..."

# Start PostgreSQL
docker run -d \
  --name ml-assets-postgres \
  -e POSTGRES_USER=ml_assets_user \
  -e POSTGRES_PASSWORD=ml_assets_password \
  -e POSTGRES_DB=ml_assets_db \
  -p 5432:5432 \
  -v ml-assets-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine

# Start MinIO
docker run -d \
  --name ml-assets-minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  -p 9000:9000 \
  -p 9001:9001 \
  -v ml-assets-minio-data:/data \
  minio/minio:latest \
  server /data --console-address ":9001"

echo -e "${GREEN}✓${NC} Docker containers started"

# Wait for PostgreSQL to be ready
echo -n "Waiting for PostgreSQL to be ready"
for i in {1..30}; do
    if docker exec ml-assets-postgres pg_isready -U ml_assets_user &>/dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Wait for MinIO to be ready
echo -n "Waiting for MinIO to be ready"
for i in {1..30}; do
    if curl -s http://localhost:9000/minio/health/live &>/dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""

###############################################################################
# Step 4: Initialize Database
###############################################################################
echo -e "${YELLOW}[4/7]${NC} Initializing database..."

if [ -f "$DB_BACKUP" ]; then
    echo "Restoring database from full backup..."
    docker exec -i ml-assets-postgres psql -U ml_assets_user -d ml_assets_db < "$DB_BACKUP"
    echo -e "${GREEN}✓${NC} Database restored with all data (2 users, 13 assets, 10 ML metadata)"
else
    echo "Creating empty database schema..."
    docker exec -i ml-assets-postgres psql -U ml_assets_user -d ml_assets_db < "$DB_INIT"
    echo -e "${GREEN}✓${NC} Database schema created with default users"
fi

# Verify database
USER_COUNT=$(docker exec ml-assets-postgres psql -U ml_assets_user -d ml_assets_db -t -c "SELECT COUNT(*) FROM users;")
ASSET_COUNT=$(docker exec ml-assets-postgres psql -U ml_assets_user -d ml_assets_db -t -c "SELECT COUNT(*) FROM assets;")

echo "Database status:"
echo "  • Users: $USER_COUNT"
echo "  • Assets: $ASSET_COUNT"
echo ""

###############################################################################
# Step 5: Configure MinIO Bucket
###############################################################################
echo -e "${YELLOW}[5/7]${NC} Configuring MinIO bucket..."

# Create bucket using Docker exec
docker exec ml-assets-minio mkdir -p /data/ml-assets 2>/dev/null || true

echo -e "${GREEN}✓${NC} MinIO bucket 'ml-assets' configured"
echo ""

###############################################################################
# Step 6: Install Dependencies
###############################################################################
echo -e "${YELLOW}[6/7]${NC} Installing dependencies..."

# Backend dependencies
echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --silent

# Frontend dependencies
echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --silent

echo -e "${GREEN}✓${NC} All dependencies installed"
echo ""

###############################################################################
# Step 7: Start Application Services
###############################################################################
echo -e "${YELLOW}[7/7]${NC} Starting application services..."

# Start backend in background
echo "Starting backend (EDC + API)..."
cd "$BACKEND_DIR"
nohup node src/server-edc.js > "$PROJECT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start. Check backend.log${NC}"
    exit 1
fi

# Start frontend in background
echo "Starting frontend (Angular)..."
cd "$FRONTEND_DIR"
nohup npm run start > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo -e "${GREEN}✓${NC} Application services started"
echo ""

###############################################################################
# Deployment Complete
###############################################################################
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Service URLs:${NC}"
echo ""
echo -e "  🌐 Frontend (Angular):    ${GREEN}http://localhost:4200${NC}"
echo -e "  🔌 Backend API (EDC):     ${GREEN}http://localhost:3000${NC}"
echo -e "  🗄️  PostgreSQL:            ${GREEN}localhost:5432${NC}"
echo -e "  📦 MinIO Console:         ${GREEN}http://localhost:9001${NC}"
echo -e "  📦 MinIO API:             ${GREEN}http://localhost:9000${NC}"
echo ""
echo -e "${BLUE}🔐 Default Credentials:${NC}"
echo ""
echo -e "  Application Login:"
echo -e "    User: ${GREEN}user-conn-oeg-demo${NC} / Password: ${GREEN}demo123${NC}"
echo -e "    User: ${GREEN}user-conn-edmundo-demo${NC} / Password: ${GREEN}edmundo123${NC}"
echo ""
echo -e "  MinIO Console:"
echo -e "    User: ${GREEN}minioadmin${NC} / Password: ${GREEN}minioadmin123${NC}"
echo ""
echo -e "  PostgreSQL:"
echo -e "    User: ${GREEN}ml_assets_user${NC} / Password: ${GREEN}ml_assets_password${NC}"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo -e "  Backend:  ${GREEN}tail -f backend.log${NC}"
echo -e "  Frontend: ${GREEN}tail -f frontend.log${NC}"
echo ""
echo -e "${BLUE}🛑 Stop Services:${NC}"
echo -e "  ${GREEN}kill $BACKEND_PID $FRONTEND_PID${NC}"
echo -e "  ${GREEN}docker stop ml-assets-postgres ml-assets-minio${NC}"
echo ""
echo -e "${YELLOW}⏳ Note: Frontend may take 30-60 seconds to compile...${NC}"
echo ""
