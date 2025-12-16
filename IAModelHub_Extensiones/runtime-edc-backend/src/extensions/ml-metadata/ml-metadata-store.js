/**
 * ML Metadata Store Implementation
 * Manages persistence of ML/DL metadata in PostgreSQL
 * 
 * Implements: MLMetadataStore interface from spi/asset/ml-metadata-spi.js
 * 
 * EDC Equivalent: Custom DataSource for ML metadata
 */

class SqlMLMetadataStore {
  /**
   * @param {Object} context - Service context with database pool
   */
  constructor(context) {
    this.dbPool = context.getDatabase();
    this.logger = context.getLogger('MLMetadataStore');
  }

  /**
   * Save ML metadata for an asset
   * @param {Object} metadata - ML metadata object
   * @returns {Promise<Object>} Saved metadata with timestamps
   */
  async save(metadata) {
    const { assetId, task, subtask, algorithm, library, framework, software, programmingLanguage, license } = metadata;

    this.logger.info(`Saving ML metadata for asset ${assetId}`);

    const query = `
      INSERT INTO ml_metadata (
        asset_id, task, subtask, algorithm, library, framework, 
        software, programming_language, license
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (asset_id) DO UPDATE SET
        task = EXCLUDED.task,
        subtask = EXCLUDED.subtask,
        algorithm = EXCLUDED.algorithm,
        library = EXCLUDED.library,
        framework = EXCLUDED.framework,
        software = EXCLUDED.software,
        programming_language = EXCLUDED.programming_language,
        license = EXCLUDED.license,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      assetId,
      task || null,
      subtask || null,
      algorithm || null,
      library || null,
      framework || null,
      software || null,
      programmingLanguage || null,
      license || null
    ];

    try {
      const result = await this.dbPool.query(query, values);
      this.logger.info(`ML metadata saved for asset ${assetId}`);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Error saving ML metadata for asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Find ML metadata by asset ID
   * @param {string} assetId - Asset identifier
   * @returns {Promise<Object|null>} ML metadata or null if not found
   */
  async findByAssetId(assetId) {
    const query = `
      SELECT * FROM ml_metadata
      WHERE asset_id = $1
    `;

    try {
      const result = await this.dbPool.query(query, [assetId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Error finding ML metadata for asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Delete ML metadata by asset ID
   * @param {string} assetId - Asset identifier
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteByAssetId(assetId) {
    const query = `
      DELETE FROM ml_metadata
      WHERE asset_id = $1
      RETURNING asset_id
    `;

    try {
      const result = await this.dbPool.query(query, [assetId]);
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        this.logger.info(`ML metadata deleted for asset ${assetId}`);
      }
      
      return deleted;
    } catch (error) {
      this.logger.error(`Error deleting ML metadata for asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Query ML metadata by criteria
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array>} Array of matching ML metadata
   */
  async query(criteria = {}) {
    let query = 'SELECT * FROM ml_metadata WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    // Build dynamic query based on criteria
    if (criteria.task) {
      query += ` AND task = $${paramIndex++}`;
      values.push(criteria.task);
    }

    if (criteria.algorithm) {
      query += ` AND algorithm = $${paramIndex++}`;
      values.push(criteria.algorithm);
    }

    if (criteria.framework) {
      query += ` AND framework = $${paramIndex++}`;
      values.push(criteria.framework);
    }

    if (criteria.library) {
      query += ` AND library = $${paramIndex++}`;
      values.push(criteria.library);
    }

    if (criteria.programmingLanguage) {
      query += ` AND programming_language = $${paramIndex++}`;
      values.push(criteria.programmingLanguage);
    }

    // Add ordering
    query += ' ORDER BY created_at DESC';

    // Add limit if specified
    if (criteria.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(criteria.limit);
    }

    try {
      const result = await this.dbPool.query(query, values);
      return result.rows;
    } catch (error) {
      this.logger.error('Error querying ML metadata:', error);
      throw error;
    }
  }

  /**
   * Get statistics about ML metadata
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    const query = `
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT task) as unique_tasks,
        COUNT(DISTINCT algorithm) as unique_algorithms,
        COUNT(DISTINCT framework) as unique_frameworks,
        COUNT(DISTINCT library) as unique_libraries
      FROM ml_metadata
    `;

    try {
      const result = await this.dbPool.query(query);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Error getting ML metadata statistics:', error);
      throw error;
    }
  }
}

module.exports = SqlMLMetadataStore;
