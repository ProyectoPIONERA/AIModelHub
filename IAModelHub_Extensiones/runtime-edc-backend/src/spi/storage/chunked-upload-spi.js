/**
 * S3 Chunked Upload Service Provider Interface (SPI)
 * Defines the contract for multi-part file uploads to S3/MinIO
 * 
 * Mirrors EDC's DataSource pattern for storage operations
 * 
 * @interface ChunkedUploadService
 */

/**
 * Upload session model
 * @typedef {Object} UploadSession
 * @property {string} sessionId - Session identifier
 * @property {string} assetId - Associated asset ID
 * @property {string} userId - User who initiated upload
 * @property {number} totalChunks - Total number of chunks
 * @property {number} uploadedChunks - Number of uploaded chunks
 * @property {string} s3UploadId - S3 multipart upload ID
 * @property {string} s3Key - S3 object key
 * @property {string} status - Session status (active, completed, failed)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Upload chunk metadata
 * @typedef {Object} UploadChunk
 * @property {number} chunkIndex - Chunk index (0-based)
 * @property {string} etag - S3 ETag
 * @property {number} size - Chunk size in bytes
 */

/**
 * Interface for upload session storage
 */
class UploadSessionStore {
  /**
   * Create new upload session
   * @param {Object} sessionData - Session data
   * @returns {Promise<UploadSession>}
   */
  async create(sessionData) {
    throw new Error('Not implemented');
  }

  /**
   * Find session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<UploadSession|null>}
   */
  async findById(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Update session
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<UploadSession>}
   */
  async update(sessionId, updates) {
    throw new Error('Not implemented');
  }

  /**
   * Record uploaded chunk
   * @param {string} sessionId - Session ID
   * @param {UploadChunk} chunkData - Chunk metadata
   * @returns {Promise<void>}
   */
  async recordChunk(sessionId, chunkData) {
    throw new Error('Not implemented');
  }

  /**
   * Get all chunks for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<UploadChunk[]>}
   */
  async getChunks(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Delete session and chunks
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async delete(sessionId) {
    throw new Error('Not implemented');
  }
}

/**
 * Service for managing chunked uploads to S3
 * Following EDC DataSource pattern
 */
class ChunkedUploadService {
  /**
   * @param {UploadSessionStore} sessionStore - Session store implementation
   * @param {Object} s3Client - S3 client instance
   * @param {string} bucket - S3 bucket name
   */
  constructor(sessionStore, s3Client, bucket) {
    this.sessionStore = sessionStore;
    this.s3Client = s3Client;
    this.bucket = bucket;
  }

  /**
   * Initialize multipart upload
   * @param {string} assetId - Asset ID
   * @param {string} fileName - File name
   * @param {number} totalChunks - Total number of chunks
   * @param {string} userId - User ID
   * @returns {Promise<UploadSession>}
   */
  async initializeUpload(assetId, fileName, totalChunks, userId) {
    throw new Error('Not implemented');
  }

  /**
   * Upload a single chunk
   * @param {string} sessionId - Session ID
   * @param {number} chunkIndex - Chunk index
   * @param {Buffer} chunkData - Chunk binary data
   * @returns {Promise<UploadChunk>}
   */
  async uploadChunk(sessionId, chunkIndex, chunkData) {
    throw new Error('Not implemented');
  }

  /**
   * Finalize multipart upload
   * @param {string} sessionId - Session ID
   * @returns {Promise<{s3Key: string, downloadUrl: string}>}
   */
  async finalizeUpload(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Abort multipart upload
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async abortUpload(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Get upload progress
   * @param {string} sessionId - Session ID
   * @returns {Promise<{total: number, uploaded: number, percentage: number}>}
   */
  async getProgress(sessionId) {
    throw new Error('Not implemented');
  }
}

module.exports = {
  UploadSessionStore,
  ChunkedUploadService
};
