/**
 * EDC Extension Manifest
 * Defines metadata and dependencies for an extension
 */
class ExtensionManifest {
  constructor(config) {
    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.description = config.description;
    this.provides = config.provides || []; // Services this extension provides
    this.requires = config.requires || []; // Services this extension requires
    this.initialize = config.initialize; // Initialization function
  }
}

module.exports = { ExtensionManifest };
