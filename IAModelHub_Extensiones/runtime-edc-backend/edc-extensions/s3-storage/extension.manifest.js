/**
 * S3 Storage Extension
 * 
 * Provides chunked file upload capabilities to S3-compatible storage (MinIO).
 * Similar to EDC's Data Plane S3 extension.
 * 
 * EDC Equivalent: org.eclipse.edc:data-plane-aws-s3
 */
const { ExtensionManifest } = require('../core/ExtensionManifest');
const { S3StorageService } = require('./S3StorageService');

module.exports = new ExtensionManifest({
  name: 's3-storage-extension',
  version: '1.0.0',
  description: 'S3/MinIO storage with chunked upload support',
  provides: ['S3StorageService'],
  requires: ['DatabasePool'],
  
  initialize: async (context) => {
    console.log('[S3 Storage Extension] Initializing...');
    
    const pool = context.getService('DatabasePool');
    
    // Get S3 configuration from environment
    const config = {
      endpoint: context.getSetting('S3_ENDPOINT', 'http://localhost:9000'),
      accessKey: context.getSetting('S3_ACCESS_KEY', 'minioadmin'),
      secretKey: context.getSetting('S3_SECRET_KEY', 'minioadmin123'),
      bucket: context.getSetting('S3_BUCKET', 'ml-assets'),
      region: context.getSetting('S3_REGION', 'us-east-1'),
    };
    
    const s3StorageService = new S3StorageService(pool, config);
    context.registerService('S3StorageService', s3StorageService);
    
    console.log('[S3 Storage Extension] Configured for bucket:', config.bucket);
    console.log('[S3 Storage Extension] Service registered: S3StorageService');
    console.log('[S3 Storage Extension] Initialized successfully');
  }
});
