/**
 * Service Extension Context
 * Similar to EDC's ServiceExtensionContext - provides access to services and configuration
 */
class ServiceExtensionContext {
  constructor() {
    this.services = new Map();
    this.config = new Map();
  }

  /**
   * Register a service
   */
  registerService(name, service) {
    console.log(`[EDC Runtime] Registering service: ${name}`);
    this.services.set(name, service);
  }

  /**
   * Get a service by name
   */
  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service;
  }

  /**
   * Check if service exists
   */
  hasService(name) {
    return this.services.has(name);
  }

  /**
   * Get configuration value
   */
  getSetting(key, defaultValue) {
    return this.config.get(key) || process.env[key] || defaultValue;
  }

  /**
   * Set configuration value
   */
  setSetting(key, value) {
    this.config.set(key, value);
  }
}

module.exports = { ServiceExtensionContext };
