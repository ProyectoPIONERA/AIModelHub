/**
 * ML Metadata Service Provider Interface (SPI)
 * Defines the contract for managing Machine Learning asset metadata
 * 
 * This interface mirrors EDC's Service Provider Interface pattern,
 * allowing different implementations while maintaining a consistent API.
 * 
 * @interface MLMetadataStore
 */

/**
 * ML Metadata model
 * @typedef {Object} MLMetadata
 * @property {string} assetId - Asset identifier
 * @property {string|null} task - ML task (e.g., Classification, Regression)
 * @property {string|null} subtask - ML subtask specification
 * @property {string|null} algorithm - Algorithm used
 * @property {string|null} library - ML library
 * @property {string|null} framework - ML framework (TensorFlow, PyTorch, etc.)
 * @property {string|null} software - Software version
 * @property {string|null} programmingLanguage - Programming language
 * @property {string|null} license - License type
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Interface for ML Metadata storage operations
 * Following EDC Store pattern
 */
class MLMetadataStore {
  /**
   * Save or update ML metadata for an asset
   * @param {MLMetadata} metadata - ML metadata to save
   * @returns {Promise<void>}
   */
  async save(metadata) {
    throw new Error('Not implemented');
  }

  /**
   * Find ML metadata by asset ID
   * @param {string} assetId - Asset identifier
   * @returns {Promise<MLMetadata|null>}
   */
  async findByAssetId(assetId) {
    throw new Error('Not implemented');
  }

  /**
   * Delete ML metadata for an asset
   * @param {string} assetId - Asset identifier
   * @returns {Promise<boolean>}
   */
  async deleteByAssetId(assetId) {
    throw new Error('Not implemented');
  }

  /**
   * Query ML metadata by criteria
   * @param {Object} criteria - Query criteria
   * @param {string} [criteria.task] - Filter by task
   * @param {string} [criteria.framework] - Filter by framework
   * @param {string} [criteria.algorithm] - Filter by algorithm
   * @returns {Promise<MLMetadata[]>}
   */
  async query(criteria) {
    throw new Error('Not implemented');
  }
}

/**
 * Service for managing ML metadata operations
 * Following EDC Service pattern
 */
class MLMetadataService {
  /**
   * @param {MLMetadataStore} store - ML metadata store implementation
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Create or update ML metadata
   * @param {string} assetId - Asset identifier
   * @param {Object} mlData - ML metadata properties
   * @returns {Promise<MLMetadata>}
   */
  async createOrUpdate(assetId, mlData) {
    throw new Error('Not implemented');
  }

  /**
   * Get ML metadata for an asset
   * @param {string} assetId - Asset identifier
   * @returns {Promise<MLMetadata|null>}
   */
  async getMetadata(assetId) {
    throw new Error('Not implemented');
  }

  /**
   * Extract ML metadata from asset properties
   * Handles both array and string values from controlled vocabulary
   * @param {Object} properties - Asset properties
   * @returns {Object} Extracted ML metadata
   */
  extractMLMetadata(properties) {
    throw new Error('Not implemented');
  }

  /**
   * Validate ML metadata against vocabulary
   * @param {Object} mlData - ML metadata to validate
   * @returns {Object} Validation result
   */
  validate(mlData) {
    throw new Error('Not implemented');
  }
}

module.exports = {
  MLMetadataStore,
  MLMetadataService
};
