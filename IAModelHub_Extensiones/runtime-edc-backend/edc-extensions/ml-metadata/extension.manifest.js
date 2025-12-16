/**
 * ML Metadata Extension
 * 
 * This extension provides ML metadata management capabilities similar to
 * a native EDC extension. It registers the MLMetadataService in the context
 * for use by other components.
 * 
 * EDC Equivalent: Custom ServiceExtension for ML asset metadata
 */
const { ExtensionManifest } = require('../core/ExtensionManifest');
const { MLMetadataService } = require('./MLMetadataService');

module.exports = new ExtensionManifest({
  name: 'ml-metadata-extension',
  version: '1.0.0',
  description: 'Manages Machine Learning asset metadata (task, algorithm, framework, etc.)',
  provides: ['MLMetadataService'],
  requires: ['DatabasePool'],
  
  initialize: async (context) => {
    console.log('[ML Metadata Extension] Initializing...');
    
    // Get database pool from context
    const pool = context.getService('DatabasePool');
    
    // Create and register ML Metadata Service
    const mlMetadataService = new MLMetadataService(pool);
    context.registerService('MLMetadataService', mlMetadataService);
    
    console.log('[ML Metadata Extension] Service registered: MLMetadataService');
    console.log('[ML Metadata Extension] Initialized successfully');
  }
});
