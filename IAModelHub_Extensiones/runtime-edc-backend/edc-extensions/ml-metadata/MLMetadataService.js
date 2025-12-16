/**
 * ML Metadata Service
 * Manages Machine Learning metadata (task, algorithm, framework, etc.)
 */
class MLMetadataService {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Save ML metadata for an asset
   */
  async saveMlMetadata(assetId, mlData) {
    if (!mlData || Object.keys(mlData).length === 0) {
      return;
    }

    const extractValue = (val) => {
      if (!val) return null;
      if (Array.isArray(val)) return val[0] || null;
      return val;
    };

    // Procesar input_features si existe
    let inputFeaturesJson = null;
    if (mlData.inputFeatures && Array.isArray(mlData.inputFeatures)) {
      inputFeaturesJson = JSON.stringify(mlData.inputFeatures);
    }

    await this.pool.query(
      `INSERT INTO ml_metadata (asset_id, task, subtask, algorithm, library, framework, software, programming_language, license, input_features)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (asset_id) DO UPDATE SET
         task = EXCLUDED.task,
         subtask = EXCLUDED.subtask,
         algorithm = EXCLUDED.algorithm,
         library = EXCLUDED.library,
         framework = EXCLUDED.framework,
         software = EXCLUDED.software,
         programming_language = EXCLUDED.programming_language,
         license = EXCLUDED.license,
         input_features = EXCLUDED.input_features`,
      [
        assetId,
        extractValue(mlData.task),
        extractValue(mlData.subtask),
        extractValue(mlData.algorithm),
        extractValue(mlData.library),
        extractValue(mlData.framework),
        extractValue(mlData.software),
        extractValue(mlData.programmingLanguage),
        extractValue(mlData.license),
        inputFeaturesJson
      ]
    );
  }

  /**
   * Get ML metadata for an asset
   */
  async getMlMetadata(assetId) {
    const result = await this.pool.query(
      'SELECT * FROM ml_metadata WHERE asset_id = $1',
      [assetId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete ML metadata for an asset
   */
  async deleteMlMetadata(assetId) {
    await this.pool.query(
      'DELETE FROM ml_metadata WHERE asset_id = $1',
      [assetId]
    );
  }
}

module.exports = { MLMetadataService };
