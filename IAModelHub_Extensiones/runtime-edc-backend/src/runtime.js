/**
 * EDC-Style Runtime Launcher
 * Bootstraps the extension-based Node.js runtime following EDC patterns
 * 
 * This is equivalent to EDC's main runtime launcher that:
 * 1. Initializes the service context
 * 2. Discovers and loads extensions
 * 3. Starts the HTTP server
 * 4. Handles graceful shutdown
 */

const express = require('express');
const cors = require('cors');
const serviceContext = require('./core/boot/service-context');
const extensionRegistry = require('./core/boot/extension-registry');

class Runtime {
  constructor() {
    this.app = express();
    this.server = null;
  }

  /**
   * Initialize the runtime
   */
  async initialize() {
    console.log('\n========================================');
    console.log('  IA EDC Extension Runtime');
    console.log('  Node.js implementation of EDC patterns');
    console.log('========================================\n');

    try {
      // 1. Initialize service context (database, S3, config)
      await serviceContext.initialize();

      // 2. Discover and load extensions
      await extensionRegistry.discoverExtensions();

      // 3. Initialize all extensions
      await extensionRegistry.initializeExtensions(serviceContext);

      // 4. Setup Express middleware
      this.setupMiddleware();

      // 5. Register extension endpoints
      this.registerEndpoints();

      // 6. Setup error handling
      this.setupErrorHandling();

      console.log('\n[Runtime] Initialization complete\n');

    } catch (error) {
      console.error('[Runtime] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    const corsOrigins = serviceContext.getConfig('server.corsOrigins');
    
    this.app.use(cors({
      origin: corsOrigins,
      credentials: true
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[HTTP] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Register extension endpoints
   */
  registerEndpoints() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const extensions = extensionRegistry.listExtensions();
      res.json({
        status: 'UP',
        runtime: 'IA EDC Extension Runtime',
        version: '1.0.0',
        extensions: extensions.map(ext => ({
          name: ext.name,
          version: ext.version,
          initialized: ext.initialized
        }))
      });
    });

    // Extensions info endpoint
    this.app.get('/api/extensions', (req, res) => {
      const extensions = extensionRegistry.listExtensions();
      res.json(extensions);
    });

    // ML Metadata endpoints (if extension loaded)
    const mlMetadataService = extensionRegistry.getService('MLMetadataService');
    if (mlMetadataService) {
      this.registerMLMetadataEndpoints(mlMetadataService);
    }

    // Legacy server.js endpoints will be migrated progressively
    console.log('[Runtime] Extension endpoints registered');
  }

  /**
   * Register ML Metadata endpoints
   */
  registerMLMetadataEndpoints(mlMetadataService) {
    // Get ML metadata for an asset
    this.app.get('/api/ml-metadata/:assetId', async (req, res, next) => {
      try {
        const metadata = await mlMetadataService.getMetadata(req.params.assetId);
        
        if (!metadata) {
          return res.status(404).json({
            error: 'ML metadata not found'
          });
        }

        res.json(mlMetadataService.formatForEDC(metadata));
      } catch (error) {
        next(error);
      }
    });

    // Create/update ML metadata
    this.app.put('/api/ml-metadata/:assetId', async (req, res, next) => {
      try {
        const metadata = await mlMetadataService.createOrUpdate(
          req.params.assetId,
          req.body
        );

        res.status(201).json(mlMetadataService.formatForEDC(metadata));
      } catch (error) {
        next(error);
      }
    });

    // Search ML metadata
    this.app.post('/api/ml-metadata/search', async (req, res, next) => {
      try {
        const results = await mlMetadataService.search(req.body);
        res.json(results.map(m => mlMetadataService.formatForEDC(m)));
      } catch (error) {
        next(error);
      }
    });

    // ML metadata statistics
    this.app.get('/api/ml-metadata/statistics', async (req, res, next) => {
      try {
        const stats = await mlMetadataService.getStatistics();
        res.json(stats);
      } catch (error) {
        next(error);
      }
    });

    console.log('[Runtime] ML Metadata endpoints registered');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error('[Runtime] Error:', err);
      
      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  /**
   * Start the HTTP server
   */
  async start() {
    const port = serviceContext.getConfig('server.port');

    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`\n✓ Runtime listening on port ${port}`);
        console.log(`✓ Health check: http://localhost:${port}/health`);
        console.log(`✓ Extensions info: http://localhost:${port}/api/extensions\n`);
        resolve();
      });
    });
  }

  /**
   * Shutdown the runtime gracefully
   */
  async shutdown() {
    console.log('\n[Runtime] Shutting down...');

    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      console.log('[Runtime] HTTP server closed');
    }

    await serviceContext.shutdown();
    console.log('[Runtime] Shutdown complete\n');
  }
}

// Main execution
async function main() {
  const runtime = new Runtime();

  // Graceful shutdown handlers
  process.on('SIGTERM', async () => {
    await runtime.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await runtime.shutdown();
    process.exit(0);
  });

  try {
    await runtime.initialize();
    await runtime.start();
  } catch (error) {
    console.error('[Runtime] Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = Runtime;
