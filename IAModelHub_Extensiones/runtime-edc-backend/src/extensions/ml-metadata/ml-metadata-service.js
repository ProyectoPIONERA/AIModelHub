/**
 * ML Metadata Service Implementation
 * Business logic for ML/DL metadata management
 * 
 * Implements: MLMetadataService interface from spi/asset/ml-metadata-spi.js
 * 
 * EDC Equivalent: Custom extension service combining store operations with validation
 */

class MLMetadataService {
  /**
   * @param {Object} context - Service context
   */
  constructor(context) {
    const SqlMLMetadataStore = require('./ml-metadata-store');
    this.store = new SqlMLMetadataStore(context);
    this.logger = context.getLogger('MLMetadataService');
  }

  /**
   * Extract ML metadata from asset properties
   * Handles multiple property formats (nested objects, arrays, direct values)
   * 
   * @param {Object} properties - Asset properties
   * @returns {Object} Extracted ML metadata
   */
  extractMLMetadata(properties) {
    // Helper to extract value from array or direct value
    const extractValue = (val) => {
      if (!val) return null;
      if (Array.isArray(val)) return val[0] || null;
      return val;
    };

    // Try multiple property paths for ML metadata
    const mlData = properties['ml:metadata'] || 
                   properties.mlMetadata || 
                   (properties.assetData && properties.assetData.mlMetadata) || 
                   {};

    return {
      task: extractValue(mlData.task),
      subtask: extractValue(mlData.subtask),
      algorithm: extractValue(mlData.algorithm),
      library: extractValue(mlData.library),
      framework: extractValue(mlData.framework),
      software: extractValue(mlData.software),
      programmingLanguage: extractValue(mlData.programmingLanguage || mlData.programming_language),
      license: extractValue(mlData.license)
    };
  }

  /**
   * Validate ML metadata
   * @param {Object} mlData - ML metadata to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate(mlData) {
    const errors = [];

    // Task validation (if provided)
    if (mlData.task) {
      const validTasks = [
        'Classification', 'Regression', 'Clustering', 'Dimensionality Reduction',
        'Natural Language Processing', 'Computer Vision', 'Reinforcement Learning',
        'Time Series Analysis', 'Anomaly Detection', 'Recommendation Systems'
      ];
      
      if (!validTasks.includes(mlData.task)) {
        errors.push(`Invalid task: ${mlData.task}. Must be one of: ${validTasks.join(', ')}`);
      }
    }

    // Framework validation (if provided)
    if (mlData.framework) {
      const validFrameworks = [
        'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'XGBoost',
        'LightGBM', 'Caffe', 'MXNet', 'ONNX', 'JAX', 'Hugging Face'
      ];
      
      if (!validFrameworks.includes(mlData.framework)) {
        // Warning only, not blocking
        this.logger.warn(`Uncommon framework: ${mlData.framework}`);
      }
    }

    // Programming language validation
    if (mlData.programmingLanguage) {
      const validLanguages = ['Python', 'R', 'Julia', 'Java', 'C++', 'JavaScript'];
      
      if (!validLanguages.includes(mlData.programmingLanguage)) {
        this.logger.warn(`Uncommon programming language: ${mlData.programmingLanguage}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create or update ML metadata for an asset
   * @param {string} assetId - Asset identifier
   * @param {Object} mlData - ML metadata (can be raw properties or extracted)
   * @returns {Promise<Object>} Saved ML metadata
   */
  async createOrUpdate(assetId, mlData) {
    this.logger.info(`Processing ML metadata for asset ${assetId}`);

    // Extract if raw properties provided
    let metadata = mlData;
    if (mlData['ml:metadata'] || mlData.mlMetadata) {
      metadata = this.extractMLMetadata(mlData);
    }

    // Validate
    const validation = this.validate(metadata);
    if (!validation.valid) {
      this.logger.warn(`Validation warnings for asset ${assetId}:`, validation.errors);
      // Continue anyway - warnings not blocking
    }

    // Add asset ID
    metadata.assetId = assetId;

    // Save to store
    return await this.store.save(metadata);
  }

  /**
   * Get ML metadata for an asset
   * @param {string} assetId - Asset identifier
   * @returns {Promise<Object|null>} ML metadata or null
   */
  async getMetadata(assetId) {
    return await this.store.findByAssetId(assetId);
  }

  /**
   * Delete ML metadata for an asset
   * @param {string} assetId - Asset identifier
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteMetadata(assetId) {
    return await this.store.deleteByAssetId(assetId);
  }

  /**
   * Search ML metadata by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching metadata entries
   */
  async search(criteria) {
    return await this.store.query(criteria);
  }

  /**
   * Get statistics about ML metadata
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    return await this.store.getStatistics();
  }

  /**
   * Format ML metadata for EDC JSON-LD response
   * @param {Object} metadata - Raw metadata from database
   * @returns {Object} EDC-formatted ML metadata
   */
  formatForEDC(metadata) {
    if (!metadata) return null;

    return {
      '@type': 'ml:Metadata',
      'ml:task': metadata.task,
      'ml:subtask': metadata.subtask,
      'ml:algorithm': metadata.algorithm,
      'ml:library': metadata.library,
      'ml:framework': metadata.framework,
      'ml:software': metadata.software,
      'ml:programmingLanguage': metadata.programming_language,
      'ml:license': metadata.license
    };
  }
}

module.exports = MLMetadataService;
