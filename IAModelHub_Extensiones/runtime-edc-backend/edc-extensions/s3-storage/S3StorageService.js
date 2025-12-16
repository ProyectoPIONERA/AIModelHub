/**
 * S3 Storage Service
 * Manages chunked file uploads to MinIO/S3
 */
const { 
  S3Client, 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand 
} = require('@aws-sdk/client-s3');

class S3StorageService {
  constructor(pool, config) {
    this.pool = pool;
    this.s3Client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
    this.bucket = config.bucket;
  }

  /**
   * Initialize multipart upload
   */
  async initUpload(fileName, contentType) {
    const s3Key = `uploads/${Date.now()}-${fileName}`;
    
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: contentType,
    });

    const result = await this.s3Client.send(command);
    return {
      uploadId: result.UploadId,
      s3Key: s3Key
    };
  }

  /**
   * Upload a chunk
   */
  async uploadChunk(uploadId, s3Key, chunkIndex, chunkData) {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: chunkIndex + 1,
      Body: chunkData,
    });

    const result = await this.s3Client.send(command);
    return result.ETag;
  }

  /**
   * Complete multipart upload
   */
  async completeUpload(uploadId, s3Key, parts) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });

    await this.s3Client.send(command);
  }

  /**
   * Abort multipart upload
   */
  async abortUpload(uploadId, s3Key) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: s3Key,
      UploadId: uploadId,
    });

    await this.s3Client.send(command);
  }

  /**
   * Save upload session to database
   */
  async saveUploadSession(sessionData) {
    await this.pool.query(
      `INSERT INTO upload_sessions (id, asset_id, user_id, file_name, total_chunks, s3_upload_id, s3_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionData.id,
        sessionData.assetId,
        sessionData.userId,
        sessionData.fileName,
        sessionData.totalChunks,
        sessionData.s3UploadId,
        sessionData.s3Key,
        'pending'
      ]
    );
  }

  /**
   * Get upload session
   */
  async getUploadSession(sessionId) {
    const result = await this.pool.query(
      'SELECT * FROM upload_sessions WHERE id = $1',
      [sessionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update upload session status
   */
  async updateSessionStatus(sessionId, status) {
    await this.pool.query(
      'UPDATE upload_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, sessionId]
    );
  }
}

module.exports = { S3StorageService };
