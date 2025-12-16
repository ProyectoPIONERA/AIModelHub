/**
 * Extension Registry
 * Central registry for all EDC-style extensions loaded in the runtime
 * 
 * This follows EDC's ServiceExtensionContext pattern where extensions
 * are discovered, initialized, and their services made available
 * to the runtime and other extensions.
 */

const fs = require('fs');
const path = require('path');

class ExtensionRegistry {
  constructor() {
    this.extensions = new Map();
    this.services = new Map();
    this.extensionsPath = path.join(__dirname, 'extensions');
  }

  /**
   * Discover and load all extensions
   * Scans the extensions directory for extension.json manifests
   */
  async discoverExtensions() {
    console.log('[Extension Registry] Discovering extensions...');
    
    const extensionDirs = fs.readdirSync(this.extensionsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of extensionDirs) {
      await this.loadExtension(dir);
    }

    console.log(`[Extension Registry] Discovered ${this.extensions.size} extensions`);
  }

  /**
   * Load a single extension
   * @param {string} extensionName - Extension directory name
   */
  async loadExtension(extensionName) {
    const manifestPath = path.join(this.extensionsPath, extensionName, 'extension.json');
    
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[Extension Registry] No manifest found for ${extensionName}`);
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      this.extensions.set(extensionName, {
        manifest,
        initialized: false,
        services: {}
      });

      console.log(`[Extension Registry] Loaded extension: ${manifest.extension.displayName}`);
    } catch (error) {
      console.error(`[Extension Registry] Error loading extension ${extensionName}:`, error);
    }
  }

  /**
   * Initialize all extensions
   * Following EDC initialization lifecycle
   * @param {Object} context - Service extension context (contains shared services)
   */
  async initializeExtensions(context) {
    console.log('[Extension Registry] Initializing extensions...');
    
    // Sort extensions by dependencies (simple topological sort)
    const sortedExtensions = this.resolveDependencies();

    for (const extensionName of sortedExtensions) {
      await this.initializeExtension(extensionName, context);
    }

    console.log('[Extension Registry] All extensions initialized');
  }

  /**
   * Initialize a single extension
   * @param {string} extensionName - Extension name
   * @param {Object} context - Service context
   */
  async initializeExtension(extensionName, context) {
    const extension = this.extensions.get(extensionName);
    if (!extension || extension.initialized) {
      return;
    }

    try {
      console.log(`[Extension Registry] Initializing ${extension.manifest.extension.displayName}...`);

      // Check required services
      if (extension.manifest.requires) {
        for (const requirement of extension.manifest.requires) {
          if (!this.services.has(requirement.service) && !context[requirement.service]) {
            throw new Error(`Required service not available: ${requirement.service}`);
          }
        }
      }

      // Load and instantiate provided services
      if (extension.manifest.provides) {
        for (const provided of extension.manifest.provides) {
          const servicePath = path.join(__dirname, provided.implementation);
          if (fs.existsSync(servicePath)) {
            const ServiceClass = require(servicePath);
            
            // Instantiate with context dependencies
            const serviceInstance = this.instantiateService(ServiceClass, context);
            
            this.registerService(provided.service, serviceInstance);
            extension.services[provided.service] = serviceInstance;
            
            console.log(`  ✓ Registered service: ${provided.service}`);
          }
        }
      }

      extension.initialized = true;
      console.log(`  ✓ ${extension.manifest.extension.displayName} initialized`);
      
    } catch (error) {
      console.error(`[Extension Registry] Failed to initialize ${extensionName}:`, error);
      throw error;
    }
  }

  /**
   * Instantiate a service with dependency injection
   * @param {Function} ServiceClass - Service constructor
   * @param {Object} context - Service context
   * @returns {Object} Service instance
   */
  instantiateService(ServiceClass, context) {
    // Simple dependency injection - can be enhanced
    return new ServiceClass(context);
  }

  /**
   * Register a service in the global registry
   * @param {string} serviceName - Service name
   * @param {Object} serviceInstance - Service instance
   */
  registerService(serviceName, serviceInstance) {
    this.services.set(serviceName, serviceInstance);
  }

  /**
   * Get a registered service
   * @param {string} serviceName - Service name
   * @returns {Object|null} Service instance or null
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Resolve extension dependencies (simple version)
   * @returns {string[]} Sorted extension names
   */
  resolveDependencies() {
    // For now, return in discovery order
    // TODO: Implement proper topological sort based on requires/provides
    return Array.from(this.extensions.keys());
  }

  /**
   * Get extension manifest
   * @param {string} extensionName - Extension name
   * @returns {Object|null} Extension manifest
   */
  getExtensionManifest(extensionName) {
    const extension = this.extensions.get(extensionName);
    return extension ? extension.manifest : null;
  }

  /**
   * List all loaded extensions
   * @returns {Array} Extension information
   */
  listExtensions() {
    return Array.from(this.extensions.values()).map(ext => ({
      name: ext.manifest.extension.name,
      displayName: ext.manifest.extension.displayName,
      version: ext.manifest.extension.version,
      description: ext.manifest.extension.description,
      category: ext.manifest.extension.category,
      initialized: ext.initialized,
      provides: ext.manifest.provides?.map(p => p.service) || [],
      requires: ext.manifest.requires?.map(r => r.service) || []
    }));
  }
}

module.exports = new ExtensionRegistry();
