/**
 * EDC Runtime - Extension Loader and Manager
 * Similar to EDC's ServiceExtensionLoader
 */
const { ServiceExtensionContext } = require('./ServiceExtensionContext');
const fs = require('fs');
const path = require('path');

class EdcRuntime {
  constructor() {
    this.context = new ServiceExtensionContext();
    this.extensions = [];
  }

  /**
   * Load all extensions from the extensions directory
   */
  async loadExtensions() {
    const extensionsDir = path.join(__dirname, '..');
    const extensionFolders = fs.readdirSync(extensionsDir)
      .filter(f => {
        const fullPath = path.join(extensionsDir, f);
        return fs.statSync(fullPath).isDirectory() && f !== 'core';
      });

    console.log('[EDC Runtime] Loading extensions...');
    
    for (const folder of extensionFolders) {
      try {
        const manifestPath = path.join(extensionsDir, folder, 'extension.manifest.js');
        if (fs.existsSync(manifestPath)) {
          const manifest = require(manifestPath);
          console.log(`[EDC Runtime] Loading extension: ${manifest.name}`);
          this.extensions.push(manifest);
        }
      } catch (error) {
        console.error(`[EDC Runtime] Failed to load extension ${folder}:`, error.message);
      }
    }

    console.log(`[EDC Runtime] Loaded ${this.extensions.length} extensions`);
  }

  /**
   * Initialize all extensions
   */
  async initializeExtensions() {
    console.log('[EDC Runtime] Initializing extensions...');
    
    // Sort by dependencies (simple topological sort)
    const sorted = this.topologicalSort();
    
    for (const extension of sorted) {
      try {
        console.log(`[EDC Runtime] Initializing: ${extension.name}`);
        if (extension.initialize) {
          await extension.initialize(this.context);
        }
      } catch (error) {
        console.error(`[EDC Runtime] Failed to initialize ${extension.name}:`, error.message);
        throw error;
      }
    }

    console.log('[EDC Runtime] All extensions initialized successfully');
  }

  /**
   * Simple topological sort for dependency resolution
   */
  topologicalSort() {
    const sorted = [];
    const visited = new Set();

    const visit = (ext) => {
      if (visited.has(ext.name)) return;
      visited.add(ext.name);

      // Visit dependencies first
      if (ext.requires) {
        for (const depName of ext.requires) {
          const dep = this.extensions.find(e => e.provides && e.provides.includes(depName));
          if (dep) visit(dep);
        }
      }

      sorted.push(ext);
    };

    for (const ext of this.extensions) {
      visit(ext);
    }

    return sorted;
  }

  /**
   * Start the runtime
   */
  async start() {
    console.log('='.repeat(60));
    console.log('  EDC-Compatible Runtime for IA/ML Assets');
    console.log('  Node.js Backend with Extension Architecture');
    console.log('='.repeat(60));
    
    await this.loadExtensions();
    await this.initializeExtensions();
    
    console.log('[EDC Runtime] Runtime started successfully');
    return this.context;
  }
}

module.exports = { EdcRuntime };
