/**
 * Identity Extension
 * 
 * Provides multi-tenant authentication and identity management.
 * Similar to EDC's Identity & Access Management extension.
 * 
 * EDC Equivalent: Identity Hub / OAuth2 Extension
 */
const { ExtensionManifest } = require('../core/ExtensionManifest');
const { IdentityService } = require('./IdentityService');

module.exports = new ExtensionManifest({
  name: 'identity-extension',
  version: '1.0.0',
  description: 'Multi-tenant authentication and identity management',
  provides: ['IdentityService'],
  requires: ['DatabasePool'],
  
  initialize: async (context) => {
    console.log('[Identity Extension] Initializing...');
    
    const pool = context.getService('DatabasePool');
    const identityService = new IdentityService(pool);
    
    context.registerService('IdentityService', identityService);
    
    console.log('[Identity Extension] Service registered: IdentityService');
    console.log('[Identity Extension] Initialized successfully');
  }
});
