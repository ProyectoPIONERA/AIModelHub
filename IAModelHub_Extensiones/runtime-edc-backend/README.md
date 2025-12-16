# ML Assets Backend

Node.js/Express backend for ML Assets management with MinIO S3 storage and PostgreSQL metadata.

## Quick Start

### Development (without Docker)

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Ensure PostgreSQL and MinIO are running
# Then start the server
npm run dev
```

### Production (with Docker)

```bash
# From ml-browser-app directory
docker-compose up -d
```

## Environment Variables

See `.env.example` for required configuration.

## API Endpoints

- `POST /v3/assets` - Create asset
- `POST /v3/assets/request` - List assets
- `POST /s3assets/upload-chunk` - Upload file chunk
- `POST /s3assets/finalize-upload` - Finalize upload
- `GET /health` - Health check

See parent directory's `SETUP_GUIDE.md` for complete documentation.
