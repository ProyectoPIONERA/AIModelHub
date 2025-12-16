/**
 * IA EDC Connector - Main Runtime
 * 
 * Node.js implementation of EDC-like connector with extension architecture.
 * This backend simulates EDC's extension system while maintaining full compatibility
 * with EDC Management API v3 specifications.
 * 
 * Architecture:
 * - Core: Runtime loader and service context
 * - Extensions: Modular services (ML Metadata, Identity, S3 Storage, Management API)
 * - Compatible with EDC frontend clients
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { EdcRuntime } = require('../edc-extensions/core/EdcRuntime');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - Allow frontend to communicate with backend
// Support multiple origins including localhost variations
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or if CORS_ORIGIN env is set
    const envOrigin = process.env.CORS_ORIGIN;
    if (envOrigin && origin === envOrigin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Log the blocked origin for debugging
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(null, true); // Still allow but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Explicitly handle OPTIONS requests for all routes
app.options('*', cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    runtime: 'EDC-Compatible Node.js Runtime',
    timestamp: new Date().toISOString() 
  });
});

/**
 * Bootstrap the EDC Runtime
 */
async function bootstrap() {
  try {
    console.log('[Bootstrap] Starting IA EDC Connector...');
    
    // Create PostgreSQL Connection Pool
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ml_assets_db',
      user: process.env.DB_USER || 'ml_assets_user',
      password: process.env.DB_PASSWORD || 'ml_assets_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('[Bootstrap] Database connection established');
    
    // Create EDC Runtime
    const runtime = new EdcRuntime();
    
    // Register core services
    runtime.context.registerService('DatabasePool', pool);
    
    // Load and initialize all extensions
    await runtime.start();
    
    // Get Management API router from extensions
    if (runtime.context.hasService('ManagementAPIRouter')) {
      const managementRouter = runtime.context.getService('ManagementAPIRouter');
      app.use('/', managementRouter);
      console.log('[Bootstrap] Management API routes mounted');
    }
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log(`  IA EDC Connector - Runtime Started`);
      console.log(`  Port: ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Database: ${process.env.DB_NAME || 'ml_assets_db'}`);
      console.log('='.repeat(60));
      console.log(`[Server] Listening on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`[Server] Management API: http://localhost:${PORT}/v3/*`);
    });
    
  } catch (error) {
    console.error('[Bootstrap] Fatal error during startup:', error);
    process.exit(1);
  }
}

// Start the runtime
bootstrap();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Gracefully shutting down...');
  process.exit(0);
});
