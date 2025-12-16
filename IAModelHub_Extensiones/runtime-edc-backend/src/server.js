const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, UploadPartCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { generateToken, authenticateToken, optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ml_assets_db',
  user: process.env.DB_USER || 'ml_assets_user',
  password: process.env.DB_PASSWORD || 'ml_assets_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// S3/MinIO Client
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
  },
  forcePathStyle: true, // Required for MinIO
});

const S3_BUCKET = process.env.S3_BUCKET || 'ml-assets';

// Multer for handling multipart/form-data
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB per chunk
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: 'Username and password are required' 
      });
    }

    // Query user from database
    const result = await pool.query(
      'SELECT id, username, password_hash, connector_id, display_name, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid username or password' 
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account disabled',
        message: 'This account has been disabled' 
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Return success response
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        connectorId: user.connector_id,
        displayName: user.display_name
      }
    });

    console.log(`[Auth] User ${username} logged in successfully (connector: ${user.connector_id})`);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during authentication' 
    });
  }
});

/**
 * GET /auth/me
 * Get current user info (requires authentication)
 */
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    // User info is already in req.user from the middleware
    res.status(200).json({
      success: true,
      user: {
        id: req.user.userId,
        username: req.user.username,
        connectorId: req.user.connectorId,
        displayName: req.user.displayName
      }
    });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred retrieving user information' 
    });
  }
});

/**
 * POST /auth/logout
 * Logout endpoint (client-side should delete token)
 */
app.post('/auth/logout', authenticateToken, (req, res) => {
  console.log(`[Auth] User ${req.user.username} logged out`);
  res.status(200).json({ 
    success: true,
    message: 'Logged out successfully' 
  });
});

// ==================== ASSET ENDPOINTS ====================

// Helper function to extract keywords from different formats
const extractKeywords = (properties) => {
  // Try dcat:keyword first (array format from frontend)
  const dcatKeyword = properties['dcat:keyword'];
  if (dcatKeyword) {
    if (Array.isArray(dcatKeyword)) {
      return dcatKeyword.join(', ');
    }
    return dcatKeyword;
  }
  
  // Fallback to other formats
  return properties['asset:prop:keywords'] || properties.keywords || '';
};

// Create Asset Endpoint (without file) - Requires authentication
app.post('/v3/assets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const assetData = req.body;
    const assetId = assetData['@id'] || assetData.id || uuidv4();
    const owner = req.user.connectorId; // Get owner from authenticated user
    
    // Extract properties
    const properties = assetData['edc:properties'] || assetData.properties || {};
    const dataAddress = assetData['edc:dataAddress'] || assetData.dataAddress || {};
    
    await client.query('BEGIN');
    
    // Insert asset WITH OWNER
    await client.query(
      `INSERT INTO assets (id, name, version, content_type, description, short_description, keywords, byte_size, format, asset_type, owner)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         version = EXCLUDED.version,
         owner = EXCLUDED.owner,
         updated_at = CURRENT_TIMESTAMP`,
      [
        assetId,
        properties['asset:prop:name'] || properties.name || 'Untitled Asset',
        properties['asset:prop:version'] || properties.version || '1.0',
        properties['asset:prop:contenttype'] || properties.contenttype || 'application/octet-stream',
        properties['asset:prop:description'] || properties.description || '',
        properties['asset:prop:shortDescription'] || properties.shortDescription || '',
        extractKeywords(properties),
        parseInt(properties['asset:prop:byteSize'] || properties.byteSize || '0'),
        properties['asset:prop:format'] || properties.format || '',
        properties['asset:prop:type'] || properties.assetType || 'MLModel',
        owner // Add owner field
      ]
    );
    
    // Insert ML metadata if present
    const mlData = properties['ml:metadata'] || 
                   properties.mlMetadata || 
                   (properties.assetData && properties.assetData.mlMetadata) || 
                   {};
    if (Object.keys(mlData).length > 0) {
      // Helper function to extract string value from array or string
      const extractValue = (val) => {
        if (!val) return null;
        if (Array.isArray(val)) return val[0] || null;
        return val;
      };
      
      await client.query(
        `INSERT INTO ml_metadata (asset_id, task, subtask, algorithm, library, framework, software, programming_language, license)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (asset_id) DO UPDATE SET
           task = EXCLUDED.task,
           subtask = EXCLUDED.subtask,
           algorithm = EXCLUDED.algorithm,
           library = EXCLUDED.library,
           framework = EXCLUDED.framework,
           software = EXCLUDED.software,
           programming_language = EXCLUDED.programming_language,
           license = EXCLUDED.license`,
        [
          assetId,
          extractValue(mlData.task),
          extractValue(mlData.subtask),
          extractValue(mlData.algorithm),
          extractValue(mlData.library),
          extractValue(mlData.framework),
          extractValue(mlData.software),
          extractValue(mlData.programmingLanguage),
          extractValue(mlData.license)
        ]
      );
    }
    
    // Insert data address
    if (dataAddress && dataAddress.type) {
      await client.query(
        `INSERT INTO data_addresses (asset_id, type, name, base_url, path, bucket_name, endpoint_override, folder, file_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          assetId,
          dataAddress['@type'] || dataAddress.type,
          dataAddress.name || null,
          dataAddress.baseUrl || null,
          dataAddress.path || null,
          dataAddress.bucketName || null,
          dataAddress.endpointOverride || null,
          dataAddress.folder || null,
          dataAddress.fileName || null
        ]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(200).json({
      '@type': 'IdResponse',
      '@id': assetId,
      createdAt: Date.now()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating asset:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'DatabaseError'
      }]
    });
  } finally {
    client.release();
  }
});

// Upload chunk endpoint - Requires authentication
app.post('/s3assets/upload-chunk', authenticateToken, upload.any(), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const owner = req.user.connectorId; // Get owner from authenticated user
    // Find the file and json from the uploaded files
    const fileField = req.files?.find(f => f.fieldname === 'file');
    const jsonField = req.files?.find(f => f.fieldname === 'json');
    
    if (!fileField) {
      return res.status(400).json({ errors: [{ message: 'No file provided' }] });
    }
    
    // Parse JSON from blob or body
    let assetData;
    if (jsonField) {
      const jsonContent = jsonField.buffer.toString('utf-8');
      assetData = JSON.parse(jsonContent);
    } else {
      const jsonBlob = req.body.json || req.body;
      assetData = typeof jsonBlob === 'string' ? JSON.parse(jsonBlob) : jsonBlob;
    }
    
    const file = fileField;
    
    const chunkIndex = parseInt(req.headers['chunk-index']);
    const totalChunks = parseInt(req.headers['total-chunks']);
    const fileName = req.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || fileField.originalname;
    
    const assetId = assetData['@id'] || assetData.id || uuidv4();
    const s3Key = `${assetId}/${fileName}`;
    
    console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks} for asset ${assetId}`);
    
    // Get or create upload session
    let sessionResult = await client.query(
      'SELECT * FROM upload_sessions WHERE asset_id = $1 AND file_name = $2 AND status = $3',
      [assetId, fileName, 'in_progress']
    );
    
    let session;
    let uploadId;
    
    if (sessionResult.rows.length === 0) {
      // Create new multipart upload in S3
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        ContentType: assetData.properties?.contenttype || 'application/octet-stream'
      });
      
      const createResponse = await s3Client.send(createCommand);
      uploadId = createResponse.UploadId;
      
      // Create session in database WITH OWNER
      const insertResult = await client.query(
        `INSERT INTO upload_sessions (asset_id, file_name, total_chunks, s3_upload_id, owner)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [assetId, fileName, totalChunks, uploadId, owner]
      );
      
      session = insertResult.rows[0];
    } else {
      session = sessionResult.rows[0];
      uploadId = session.s3_upload_id;
    }
    
    // Upload chunk to S3
    const uploadCommand = new UploadPartCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: chunkIndex + 1,
      Body: fileField.buffer
    });
    
    const uploadResponse = await s3Client.send(uploadCommand);
    
    // Save chunk info
    await client.query(
      `INSERT INTO upload_chunks (session_id, chunk_index, etag)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id, chunk_index) DO UPDATE SET etag = EXCLUDED.etag`,
      [session.id, chunkIndex, uploadResponse.ETag]
    );
    
    // Update session
    await client.query(
      'UPDATE upload_sessions SET uploaded_chunks = uploaded_chunks + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [session.id]
    );
    
    res.status(200).json({
      success: true,
      chunkIndex,
      uploadId,
      etag: uploadResponse.ETag
    });
    
  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'UploadError'
      }]
    });
  } finally {
    client.release();
  }
});

// Finalize upload endpoint - Requires authentication
app.post('/s3assets/finalize-upload', authenticateToken, upload.any(), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const owner = req.user.connectorId; // Get owner from authenticated user
    // Parse JSON from uploaded files or body
    const jsonField = req.files?.find(f => f.fieldname === 'json');
    let assetData;
    
    if (jsonField) {
      const jsonContent = jsonField.buffer.toString('utf-8');
      assetData = JSON.parse(jsonContent);
    } else {
      const jsonBlob = req.body.json || req.body;
      assetData = typeof jsonBlob === 'string' ? JSON.parse(jsonBlob) : jsonBlob;
    }
    
    const fileName = req.body.fileName;
    
    const assetId = assetData['@id'] || assetData.id;
    const s3Key = `${assetId}/${fileName}`;
    
    console.log(`Finalizing upload for asset ${assetId}`);
    
    // Get session
    const sessionResult = await client.query(
      'SELECT * FROM upload_sessions WHERE asset_id = $1 AND file_name = $2',
      [assetId, fileName]
    );
    
    if (sessionResult.rows.length === 0) {
      throw new Error('Upload session not found');
    }
    
    const session = sessionResult.rows[0];
    
    // Get all chunks
    const chunksResult = await client.query(
      'SELECT chunk_index, etag FROM upload_chunks WHERE session_id = $1 ORDER BY chunk_index',
      [session.id]
    );
    
    const parts = chunksResult.rows.map(chunk => ({
      ETag: chunk.etag,
      PartNumber: chunk.chunk_index + 1
    }));
    
    // Complete multipart upload in S3
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      UploadId: session.s3_upload_id,
      MultipartUpload: { Parts: parts }
    });
    
    await s3Client.send(completeCommand);
    
    await client.query('BEGIN');
    
    // Update session status
    await client.query(
      'UPDATE upload_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', session.id]
    );
    
    // Create asset in database WITH OWNER
    const properties = assetData['edc:properties'] || assetData.properties || {};
    const dataAddress = assetData['edc:dataAddress'] || assetData.dataAddress || {};
    
    await client.query(
      `INSERT INTO assets (id, name, version, content_type, description, short_description, keywords, byte_size, format, asset_type, owner)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP, owner = EXCLUDED.owner`,
      [
        assetId,
        properties['asset:prop:name'] || properties.name || 'Untitled Asset',
        properties['asset:prop:version'] || properties.version || '1.0',
        properties['asset:prop:contenttype'] || properties.contenttype || 'application/octet-stream',
        properties['asset:prop:description'] || properties.description || '',
        properties['asset:prop:shortDescription'] || properties.shortDescription || '',
        extractKeywords(properties),
        parseInt(properties['asset:prop:byteSize'] || properties.byteSize || '0'),
        properties['asset:prop:format'] || properties.format || '',
        properties['asset:prop:type'] || properties.assetType || 'MLModel',
        owner // Add owner field
      ]
    );
    
    // Insert ML metadata - Always insert even if empty to ensure LEFT JOIN works
    const mlData = properties['ml:metadata'] || 
                   properties.mlMetadata || 
                   (properties.assetData && properties.assetData.mlMetadata) || 
                   {};
    
    // Helper function to extract string value from array or string
    const extractValue = (val) => {
      if (!val) return null;
      if (Array.isArray(val)) return val[0] || null;
      return val;
    };
    
    await client.query(
      `INSERT INTO ml_metadata (asset_id, task, subtask, algorithm, library, framework, software, programming_language, license)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (asset_id) DO UPDATE SET
         task = EXCLUDED.task, 
         subtask = EXCLUDED.subtask,
         algorithm = EXCLUDED.algorithm, 
         library = EXCLUDED.library,
         framework = EXCLUDED.framework,
         software = EXCLUDED.software,
         programming_language = EXCLUDED.programming_language,
         license = EXCLUDED.license`,
      [
        assetId,
        extractValue(mlData.task),
        extractValue(mlData.subtask),
        extractValue(mlData.algorithm),
        extractValue(mlData.library),
        extractValue(mlData.framework),
        extractValue(mlData.software),
        extractValue(mlData.programmingLanguage),
        extractValue(mlData.license)
      ]
    );
    
    // Insert data address with S3 info
    await client.query(
      `INSERT INTO data_addresses (asset_id, type, bucket_name, s3_key, endpoint_override, file_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [assetId, 'AmazonS3', S3_BUCKET, s3Key, process.env.S3_ENDPOINT, fileName]
    );
    
    await client.query('COMMIT');
    
    const downloadUrl = `${process.env.S3_ENDPOINT}/${S3_BUCKET}/${s3Key}`;
    
    res.status(200).json({
      '@type': 'IdResponse',
      '@id': assetId,
      success: true,
      s3Key,
      downloadUrl
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error finalizing upload:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'FinalizeError'
      }]
    });
  } finally {
    client.release();
  }
});

// Get all assets (EDC-compatible) - Optional authentication to mark local vs external assets
app.post('/v3/assets/request', optionalAuth, async (req, res) => {
  try {
    const currentUserConnectorId = req.user ? req.user.connectorId : null;
    
    const result = await pool.query(`
      SELECT 
        a.id as "@id",
        json_build_object(
          'asset:prop:name', a.name,
          'asset:prop:version', a.version,
          'asset:prop:contenttype', a.content_type,
          'asset:prop:description', a.description,
          'asset:prop:shortDescription', a.short_description,
          'asset:prop:keywords', a.keywords,
          'asset:prop:byteSize', CAST(a.byte_size AS TEXT),
          'asset:prop:format', a.format,
          'asset:prop:type', a.asset_type,
          'asset:prop:owner', a.owner,
          'ml:metadata', json_build_object(
            'task', m.task,
            'subtask', m.subtask,
            'algorithm', m.algorithm,
            'library', m.library,
            'framework', m.framework,
            'software', m.software,
            'programmingLanguage', m.programming_language,
            'license', m.license
          )
        ) as "edc:properties",
        json_build_object(
          '@type', da.type,
          'type', da.type,
          'name', da.name,
          'baseUrl', da.base_url,
          'bucketName', da.bucket_name,
          's3Key', da.s3_key,
          'endpointOverride', da.endpoint_override,
          'folder', da.folder
        ) as "edc:dataAddress",
        a.created_at as "edc:createdAt",
        a.owner as "edc:owner",
        CASE 
          WHEN $1::VARCHAR IS NOT NULL AND a.owner = $1::VARCHAR THEN true
          ELSE false
        END as "edc:isLocal"
      FROM assets a
      LEFT JOIN ml_metadata m ON a.id = m.asset_id
      LEFT JOIN data_addresses da ON a.id = da.asset_id
      ORDER BY a.created_at DESC
    `, [currentUserConnectorId]);
    
    res.status(200).json(result.rows);
    
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

// Get asset count
app.post('/v3/assets/request/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM assets');
    res.status(200).json(parseInt(result.rows[0].count));
  } catch (error) {
    console.error('Error counting assets:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// Get single asset by ID - Optional authentication to mark local vs external
app.get('/v3/assets/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserConnectorId = req.user ? req.user.connectorId : null;
    
    const result = await pool.query(`
      SELECT 
        a.id as "@id",
        json_build_object(
          'asset:prop:name', a.name,
          'asset:prop:version', a.version,
          'asset:prop:contenttype', a.content_type,
          'asset:prop:description', a.description,
          'asset:prop:shortDescription', a.short_description,
          'asset:prop:keywords', a.keywords,
          'asset:prop:byteSize', CAST(a.byte_size AS TEXT),
          'asset:prop:format', a.format,
          'asset:prop:type', a.asset_type,
          'asset:prop:owner', a.owner,
          'ml:metadata', json_build_object(
            'task', m.task,
            'subtask', m.subtask,
            'algorithm', m.algorithm,
            'library', m.library,
            'framework', m.framework,
            'software', m.software,
            'programmingLanguage', m.programming_language,
            'license', m.license
          )
        ) as "edc:properties",
        json_build_object(
          '@type', da.type,
          'type', da.type,
          'name', da.name,
          'baseUrl', da.base_url,
          'bucketName', da.bucket_name,
          's3Key', da.s3_key,
          'endpointOverride', da.endpoint_override,
          'folder', da.folder
        ) as "edc:dataAddress",
        a.created_at as "edc:createdAt",
        a.owner as "edc:owner",
        CASE 
          WHEN $2::VARCHAR IS NOT NULL AND a.owner = $2::VARCHAR THEN true
          ELSE false
        END as "edc:isLocal"
      FROM assets a
      LEFT JOIN ml_metadata m ON a.id = m.asset_id
      LEFT JOIN data_addresses da ON a.id = da.asset_id
      WHERE a.id = $1
    `, [id, currentUserConnectorId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        errors: [{
          message: 'Asset not found',
          type: 'NotFoundError'
        }]
      });
    }
    
    res.status(200).json(result.rows[0]);
    
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

// Delete asset
app.delete('/v3/assets/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Get S3 key before deleting
    const dataAddressResult = await client.query(
      'SELECT s3_key FROM data_addresses WHERE asset_id = $1 AND s3_key IS NOT NULL',
      [id]
    );
    
    // Delete from database (cascades to ml_metadata and data_addresses)
    await client.query('DELETE FROM assets WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    // TODO: Delete from S3 if needed
    // if (dataAddressResult.rows.length > 0) {
    //   const deleteCommand = new DeleteObjectCommand({
    //     Bucket: S3_BUCKET,
    //     Key: dataAddressResult.rows[0].s3_key
    //   });
    //   await s3Client.send(deleteCommand);
    // }
    
    res.status(204).send();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting asset:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'DeleteError'
      }]
    });
  } finally {
    client.release();
  }
});

// ==================== POLICY DEFINITIONS ENDPOINTS ====================

/**
 * POST /v3/policydefinitions/request
 * Query all policy definitions
 */
app.post('/v3/policydefinitions/request', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id as "@id", policy, created_at, updated_at 
       FROM policy_definitions 
       ORDER BY created_at DESC`
    );

    const policies = result.rows.map(row => ({
      '@id': row['@id'],
      ...row.policy,
      _metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }));

    res.json(policies);
  } catch (error) {
    console.error('Error querying policy definitions:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

/**
 * POST /v3/policydefinitions
 * Create a new policy definition
 */
app.post('/v3/policydefinitions', authenticateToken, async (req, res) => {
  try {
    const policyData = req.body;
    const policyId = policyData['@id'];

    if (!policyId) {
      return res.status(400).json({
        errors: [{
          message: 'Policy @id is required',
          type: 'ValidationError'
        }]
      });
    }

    // Store the full policy JSON
    await pool.query(
      `INSERT INTO policy_definitions (id, policy, created_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (id) DO UPDATE 
       SET policy = $2::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [policyId, JSON.stringify(policyData), req.user?.username || null]
    );

    res.status(201).json({
      '@id': policyId,
      '@type': 'IdResponse',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating policy definition:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'CreateError'
      }]
    });
  }
});

/**
 * GET /v3/policydefinitions/:id
 * Get a specific policy definition
 */
app.get('/v3/policydefinitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT policy FROM policy_definitions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        errors: [{
          message: `Policy definition not found: ${id}`,
          type: 'NotFoundError'
        }]
      });
    }

    res.json(result.rows[0].policy);
  } catch (error) {
    console.error('Error fetching policy definition:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

// ==================== CONTRACT DEFINITIONS ENDPOINTS ====================

/**
 * POST /v3/contractdefinitions/request
 * Query all contract definitions with policy details
 */
app.post('/v3/contractdefinitions/request', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cd.id, cd.access_policy_id, cd.contract_policy_id, cd.assets_selector,
              cd.created_at, cd.updated_at,
              ap.policy as access_policy,
              cp.policy as contract_policy,
              COALESCE(
                json_agg(
                  json_build_object('asset_id', cda.asset_id)
                ) FILTER (WHERE cda.asset_id IS NOT NULL),
                '[]'::json
              ) as assets
       FROM contract_definitions cd
       LEFT JOIN contract_definition_assets cda ON cd.id = cda.contract_definition_id
       LEFT JOIN policy_definitions ap ON cd.access_policy_id = ap.id
       LEFT JOIN policy_definitions cp ON cd.contract_policy_id = cp.id
       GROUP BY cd.id, cd.access_policy_id, cd.contract_policy_id, cd.assets_selector, 
                cd.created_at, cd.updated_at, ap.policy, cp.policy
       ORDER BY cd.created_at DESC`
    );

    const contractDefinitions = result.rows.map(row => ({
      '@id': row.id,
      '@type': 'ContractDefinition',
      accessPolicyId: row.access_policy_id,
      contractPolicyId: row.contract_policy_id,
      accessPolicy: row.access_policy,
      contractPolicy: row.contract_policy,
      assetsSelector: row.assets_selector,
      assets: row.assets,
      _metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }));

    res.json(contractDefinitions);
  } catch (error) {
    console.error('Error querying contract definitions:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

/**
 * POST /v3/contractdefinitions
 * Create a new contract definition
 */
app.post('/v3/contractdefinitions', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { '@id': contractId, accessPolicyId, contractPolicyId, assetsSelector } = req.body;

    if (!contractId || !accessPolicyId || !contractPolicyId || !assetsSelector) {
      return res.status(400).json({
        errors: [{
          message: 'Missing required fields: @id, accessPolicyId, contractPolicyId, assetsSelector',
          type: 'ValidationError'
        }]
      });
    }

    await client.query('BEGIN');

    // Insert contract definition
    await client.query(
      `INSERT INTO contract_definitions (id, access_policy_id, contract_policy_id, assets_selector, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [contractId, accessPolicyId, contractPolicyId, JSON.stringify(assetsSelector), req.user?.username || null]
    );

    // Process assetsSelector to populate contract_definition_assets junction table
    // Extract asset IDs from assetsSelector criteria
    const assetIds = [];
    if (Array.isArray(assetsSelector)) {
      for (const selector of assetsSelector) {
        if (selector.operator === 'in' && Array.isArray(selector.operandRight)) {
          assetIds.push(...selector.operandRight);
        } else if (selector.operator === '=' && selector.operandRight) {
          assetIds.push(selector.operandRight);
        }
      }
    }

    // Insert junction table records
    if (assetIds.length > 0) {
      const insertValues = assetIds.map(assetId => `('${contractId}', '${assetId}')`).join(',');
      await client.query(
        `INSERT INTO contract_definition_assets (contract_definition_id, asset_id)
         VALUES ${insertValues}
         ON CONFLICT DO NOTHING`
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      '@id': contractId,
      '@type': 'IdResponse',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating contract definition:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'CreateError'
      }]
    });
  } finally {
    client.release();
  }
});

/**
 * GET /v3/contractdefinitions/:id
 * Get a specific contract definition
 */
app.get('/v3/contractdefinitions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT cd.id, cd.access_policy_id, cd.contract_policy_id, cd.assets_selector,
              cd.created_at, cd.updated_at,
              COALESCE(
                json_agg(
                  json_build_object('asset_id', cda.asset_id)
                ) FILTER (WHERE cda.asset_id IS NOT NULL),
                '[]'::json
              ) as assets
       FROM contract_definitions cd
       LEFT JOIN contract_definition_assets cda ON cd.id = cda.contract_definition_id
       WHERE cd.id = $1
       GROUP BY cd.id, cd.access_policy_id, cd.contract_policy_id, cd.assets_selector, cd.created_at, cd.updated_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        errors: [{
          message: `Contract definition not found: ${id}`,
          type: 'NotFoundError'
        }]
      });
    }

    const row = result.rows[0];
    res.json({
      '@id': row.id,
      '@type': 'ContractDefinition',
      accessPolicyId: row.access_policy_id,
      contractPolicyId: row.contract_policy_id,
      assetsSelector: row.assets_selector,
      assets: row.assets,
      _metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching contract definition:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

/**
 * GET /v3/assets/:id/contracts
 * Get all contract definitions associated with a specific asset
 */
app.get('/v3/assets/:id/contracts', optionalAuth, async (req, res) => {
  try {
    const { id: assetId } = req.params;

    const result = await pool.query(
      `SELECT cd.id, cd.access_policy_id, cd.contract_policy_id, cd.created_at
       FROM contract_definitions cd
       INNER JOIN contract_definition_assets cda ON cd.id = cda.contract_definition_id
       WHERE cda.asset_id = $1
       ORDER BY cd.created_at DESC`,
      [assetId]
    );

    const contracts = result.rows.map(row => ({
      '@id': row.id,
      '@type': 'ContractDefinition',
      accessPolicyId: row.access_policy_id,
      contractPolicyId: row.contract_policy_id,
      createdAt: row.created_at
    }));

    res.json(contracts);
  } catch (error) {
    console.error('Error fetching asset contracts:', error);
    res.status(500).json({
      errors: [{
        message: error.message,
        type: 'QueryError'
      }]
    });
  }
});

// ==================== CATALOG ENDPOINTS ====================

/**
 * POST /v3/catalog/request
 * Get catalog with assets and their associated contract offers
 * Returns assets that have at least one contract definition
 */
app.post('/v3/catalog/request', optionalAuth, async (req, res) => {
  try {
    const { offset = 0, limit = 10 } = req.body;

    console.log(`[Catalog] Fetching catalog with offset: ${offset}, limit: ${limit}`);

    // Query to get assets that have contract definitions
    const query = `
      SELECT DISTINCT
        a.id,
        a.name,
        a.version,
        a.content_type,
        a.description,
        a.short_description,
        a.keywords,
        a.byte_size,
        a.format,
        a.asset_type,
        a.created_at,
        a.owner,
        COUNT(DISTINCT cd.id) as contract_count
      FROM assets a
      INNER JOIN contract_definition_assets cda ON a.id = cda.asset_id
      INNER JOIN contract_definitions cd ON cda.contract_definition_id = cd.id
      GROUP BY a.id, a.name, a.version, a.content_type, a.description, a.short_description, 
               a.keywords, a.byte_size, a.format, a.asset_type, a.created_at, a.owner
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    // For each asset, get its contract definitions with policies
    const catalogItems = await Promise.all(
      result.rows.map(async (row) => {
        // Get contract definitions for this asset
        const contractsQuery = `
          SELECT 
            cd.id as contract_id,
            cd.access_policy_id,
            cd.contract_policy_id,
            ap.policy as access_policy,
            cp.policy as contract_policy
          FROM contract_definitions cd
          INNER JOIN contract_definition_assets cda ON cd.id = cda.contract_definition_id
          LEFT JOIN policy_definitions ap ON cd.access_policy_id = ap.id
          LEFT JOIN policy_definitions cp ON cd.contract_policy_id = cp.id
          WHERE cda.asset_id = $1
        `;

        const contractsResult = await pool.query(contractsQuery, [row.id]);

        // Build properties object from asset columns
        const properties = {
          name: row.name,
          version: row.version,
          contentType: row.content_type,
          description: row.description,
          shortDescription: row.short_description,
          keywords: row.keywords ? row.keywords.split(',') : [],
          byteSize: row.byte_size,
          format: row.format,
          type: row.asset_type,
          owner: row.owner
        };

        return {
          '@type': 'dcat:Dataset',
          '@id': row.id,
          assetId: row.id,
          properties: properties,
          originator: 'DataSpacePrototype',
          contractOffers: contractsResult.rows.map(contract => ({
            '@id': contract.contract_id,
            '@type': 'odrl:Offer',
            contractId: contract.contract_id,
            accessPolicyId: contract.access_policy_id,
            contractPolicyId: contract.contract_policy_id,
            accessPolicy: contract.access_policy,
            contractPolicy: contract.contract_policy
          })),
          contractCount: parseInt(row.contract_count)
        };
      })
    );

    console.log(`[Catalog] Returning ${catalogItems.length} catalog items`);

    res.json(catalogItems);
  } catch (error) {
    console.error('[Catalog] Error fetching catalog:', error);
    res.status(500).json({
      error: 'Failed to fetch catalog',
      message: error.message
    });
  }
});

/**
 * POST /v3/catalog/request/count
 * Count total number of assets in catalog (assets with contracts)
 */
app.post('/v3/catalog/request/count', optionalAuth, async (req, res) => {
  try {
    const query = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM assets a
      INNER JOIN contract_definition_assets cda ON a.id = cda.asset_id
      INNER JOIN contract_definitions cd ON cda.contract_definition_id = cd.id
    `;

    const result = await pool.query(query);
    const count = parseInt(result.rows[0].total);

    console.log(`[Catalog] Total catalog items: ${count}`);

    res.json(count);
  } catch (error) {
    console.error('[Catalog] Error counting catalog items:', error);
    res.status(500).json({
      error: 'Failed to count catalog items',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ML Assets Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PostgreSQL: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`MinIO S3: ${process.env.S3_ENDPOINT}`);
  console.log(`CORS Origin: ${process.env.CORS_ORIGIN}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  process.exit(0);
});
