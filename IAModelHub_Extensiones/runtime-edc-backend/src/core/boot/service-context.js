/**
 * Service Extension Context
 * Equivalent to EDC's ServiceExtensionContext
 * 
 * Provides shared infrastructure services to extensions:
 * - Database connections
 * - Configuration
 * - Logging
 * - Service registration/retrieval
 */

const { Pool } = require('pg');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

class ServiceContext {
  constructor() {
    this.config = {};
    this.dbPool = null;
    this.s3Client = null;
    this.logger = console; // Can be replaced with Winston/Pino
  }

  /**
   * Initialize context with configuration
   * @param {Object} options - Configuration options
   */
  async initialize(options = {}) {
    console.log('[Service Context] Initializing...');

    // Load configuration
    this.loadConfiguration(options);

    // Initialize database pool
    await this.initializeDatabase();

    // Initialize S3 client
    this.initializeS3();

    console.log('[Service Context] Initialized successfully');
  }

  /**
   * Load configuration from environment and options
   * @param {Object} options - Additional options
   */
  loadConfiguration(options) {
    this.config = {
      // Database
      db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'ml_assets_db',
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'password',
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '2000')
      },

      // S3/MinIO
      s3: {
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
        bucket: process.env.S3_BUCKET || 'ml-assets',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
      },

      // JWT
      jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      },

      // Server
      server: {
        port: parseInt(process.env.PORT || '3000'),
        corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200').split(',')
      },

      // Extensions
      extensions: {
        path: path.join(__dirname, '..', '..', 'extensions')
      },

      ...options
    };
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  async initializeDatabase() {
    console.log('[Service Context] Connecting to database...');
    
    this.dbPool = new Pool(this.config.db);

    // Test connection
    try {
      const client = await this.dbPool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('[Service Context] Database connected:', result.rows[0].now);
      client.release();
    } catch (error) {
      console.error('[Service Context] Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Initialize S3 client
   */
  initializeS3() {
    console.log('[Service Context] Initializing S3 client...');
    
    this.s3Client = new S3Client({
      endpoint: this.config.s3.endpoint,
      region: this.config.s3.region,
      credentials: {
        accessKeyId: this.config.s3.accessKeyId,
        secretAccessKey: this.config.s3.secretAccessKey
      },
      forcePathStyle: this.config.s3.forcePathStyle
    });

    console.log('[Service Context] S3 client initialized');
  }

  /**
   * Get database pool
   * @returns {Pool} PostgreSQL connection pool
   */
  getDatabase() {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized');
    }
    return this.dbPool;
  }

  /**
   * Get S3 client
   * @returns {S3Client} S3 client instance
   */
  getS3Client() {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }
    return this.s3Client;
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @returns {*} Configuration value
   */
  getConfig(key) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        return null;
      }
    }
    
    return value;
  }

  /**
   * Get logger
   * @param {string} name - Logger name
   * @returns {Object} Logger instance
   */
  getLogger(name) {
    // Simple wrapper - can be enhanced with Winston/Pino
    return {
      info: (...args) => console.log(`[${name}]`, ...args),
      warn: (...args) => console.warn(`[${name}]`, ...args),
      error: (...args) => console.error(`[${name}]`, ...args),
      debug: (...args) => console.debug(`[${name}]`, ...args)
    };
  }

  /**
   * Shutdown context and cleanup resources
   */
  async shutdown() {
    console.log('[Service Context] Shutting down...');

    if (this.dbPool) {
      await this.dbPool.end();
      console.log('[Service Context] Database pool closed');
    }

    console.log('[Service Context] Shutdown complete');
  }
}

module.exports = new ServiceContext();
