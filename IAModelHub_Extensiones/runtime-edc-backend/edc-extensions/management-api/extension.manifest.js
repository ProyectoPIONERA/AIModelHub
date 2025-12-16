/**
 * Management API Extension
 * 
 * Provides REST API endpoints compatible with EDC Management API v3.
 * Exposes asset management, authentication, and file upload endpoints.
 * 
 * EDC Equivalent: org.eclipse.edc:management-api
 */
const { ExtensionManifest } = require('../core/ExtensionManifest');
const express = require('express');
const { authenticateToken, optionalAuth } = require('../../src/middleware/auth');
const { v4: uuidv4 } = require('uuid');

module.exports = new ExtensionManifest({
  name: 'management-api-extension',
  version: '1.0.0',
  description: 'REST API endpoints for asset and identity management',
  provides: ['ManagementAPI'],
  requires: ['DatabasePool', 'MLMetadataService', 'IdentityService', 'S3StorageService'],
  
  initialize: async (context) => {
    console.log('[Management API Extension] Initializing...');
    
    const pool = context.getService('DatabasePool');
    const mlMetadataService = context.getService('MLMetadataService');
    const identityService = context.getService('IdentityService');
    const s3StorageService = context.getService('S3StorageService');
    
    // Create Express router for Management API
    const router = express.Router();
    
    // CORS preflight handler - ensure OPTIONS requests are handled
    router.options('*', (req, res) => {
      res.status(204).end();
    });
    
    // Helper function to extract keywords
    const extractKeywords = (properties) => {
      const dcatKeyword = properties['dcat:keyword'];
      if (dcatKeyword) {
        if (Array.isArray(dcatKeyword)) {
          return dcatKeyword.join(', ');
        }
        return dcatKeyword;
      }
      return properties['asset:prop:keywords'] || properties.keywords || '';
    };
    
    // ==================== AUTHENTICATION ENDPOINTS ====================
    
    router.post('/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ 
            error: 'Missing credentials',
            message: 'Username and password are required' 
          });
        }
        
        const result = await identityService.authenticate(username, password);
        res.status(200).json({ success: true, ...result });
        
        console.log(`[Management API] User ${username} logged in successfully`);
      } catch (error) {
        console.error('[Management API] Login error:', error.message);
        res.status(401).json({ 
          error: 'Authentication failed',
          message: error.message
        });
      }
    });
    
    router.get('/auth/me', authenticateToken, async (req, res) => {
      try {
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
        res.status(500).json({ error: 'Server error', message: error.message });
      }
    });
    
    router.post('/auth/logout', authenticateToken, (req, res) => {
      console.log(`[Management API] User ${req.user.username} logged out`);
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
    
    // ==================== ASSET ENDPOINTS (EDC v3) ====================
    
    router.post('/v3/assets', authenticateToken, async (req, res) => {
      const client = await pool.connect();
      
      try {
        const assetData = req.body;
        
        // Support both wrapped and unwrapped formats
        // EDC v3 format: { "asset": { "@id": "...", "properties": {...} }, "dataAddress": {...}, "mlMetadata": {...} }
        // Legacy format: { "@id": "...", "properties": {...}, "dataAddress": {...} }
        const asset = assetData.asset || assetData;
        const assetId = asset['@id'] || asset.id || assetData['@id'] || assetData.id || uuidv4();
        const owner = req.user.connectorId;
        
        const properties = asset.properties || assetData['edc:properties'] || assetData.properties || {};
        const dataAddress = assetData.dataAddress || assetData['edc:dataAddress'] || {};
        
        // Extract ML metadata before transaction
        // Check root level first (EDC v3 standard), then inside properties (legacy)
        const mlData = assetData.mlMetadata ||           // Root level (EDC v3 standard)
                       assetData['ml:metadata'] ||        // Root level with namespace
                       properties['ml:metadata'] ||       // Inside properties
                       properties.mlMetadata ||           // Inside properties
                       (properties.assetData && properties.assetData.mlMetadata) || 
                       {};
        
        await client.query('BEGIN');
        
        // Insert asset
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
            owner
          ]
        );
        
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
        
        // Save ML metadata AFTER asset is committed (to satisfy foreign key constraint)
        if (mlData && Object.keys(mlData).length > 0) {
          console.log('[Management API] Saving ML metadata for asset:', assetId);
          await mlMetadataService.saveMlMetadata(assetId, mlData);
        } else {
          console.log('[Management API] No ML metadata found for asset:', assetId);
        }
        
        res.status(200).json({
          '@type': 'IdResponse',
          '@id': assetId,
          createdAt: Date.now()
        });
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Management API] Error creating asset:', error);
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
    
    router.post('/v3/assets/request', optionalAuth, async (req, res) => {
      try {
        const currentUserConnectorId = req.user ? req.user.connectorId : null;
        
        // When authenticated, filter external assets: only show those with contracts
        // Local assets (owner = currentUserConnectorId) are always shown
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
                'license', m.license,
                'inputFeatures', m.input_features
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
          WHERE 
            -- If authenticated, apply filtering
            CASE 
              WHEN $1::VARCHAR IS NOT NULL THEN
                -- Show local assets OR external assets with contracts
                (a.owner = $1::VARCHAR) OR 
                (a.owner != $1::VARCHAR AND EXISTS (
                  SELECT 1 FROM contract_definition_assets cda 
                  WHERE cda.asset_id = a.id
                ))
              ELSE 
                -- If not authenticated, show all assets
                true
            END
          ORDER BY a.created_at DESC
        `, [currentUserConnectorId]);
        
        res.status(200).json(result.rows);
        
      } catch (error) {
        console.error('[Management API] Error fetching assets:', error);
        res.status(500).json({
          errors: [{
            message: error.message,
            type: 'QueryError'
          }]
        });
      }
    });
    
    // GET /v3/assets/:id - Get a specific asset by ID
    router.get('/v3/assets/:id', optionalAuth, async (req, res) => {
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
                'license', m.license,
                'inputFeatures', m.input_features
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
        console.error('[Management API] Error fetching asset:', error);
        res.status(500).json({
          errors: [{
            message: error.message,
            type: 'QueryError'
          }]
        });
      }
    });
    
    // ==================== S3 UPLOAD ENDPOINTS ====================
    
    router.post('/s3assets/init-upload', authenticateToken, async (req, res) => {
      try {
        const { fileName, totalChunks, contentType, assetId } = req.body;
        
        const { uploadId, s3Key } = await s3StorageService.initUpload(fileName, contentType);
        const sessionId = uuidv4();
        
        await s3StorageService.saveUploadSession({
          id: sessionId,
          assetId: assetId || uuidv4(),
          userId: req.user.userId,
          fileName,
          totalChunks,
          s3UploadId: uploadId,
          s3Key
        });
        
        res.status(200).json({
          sessionId,
          uploadId,
          s3Key
        });
        
        console.log(`[Management API] Upload session created: ${sessionId}`);
      } catch (error) {
        console.error('[Management API] Init upload error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    router.post('/s3assets/upload-chunk', authenticateToken, async (req, res) => {
      try {
        const { sessionId, chunkNumber, data } = req.body;
        
        const session = await s3StorageService.getUploadSession(sessionId);
        
        if (!session || session.user_id !== req.user.userId) {
          return res.status(404).json({ error: 'Upload session not found' });
        }
        
        const buffer = Buffer.from(data, 'base64');
        const etag = await s3StorageService.uploadChunk(
          session.s3_key,
          session.s3_upload_id,
          chunkNumber,
          buffer
        );
        
        res.status(200).json({ 
          success: true, 
          chunkNumber,
          etag 
        });
        
        console.log(`[Management API] Chunk ${chunkNumber} uploaded for session ${sessionId}`);
      } catch (error) {
        console.error('[Management API] Upload chunk error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    router.post('/s3assets/finalize-upload', authenticateToken, async (req, res) => {
      try {
        const { sessionId, parts } = req.body;
        
        const session = await s3StorageService.getUploadSession(sessionId);
        
        if (!session || session.user_id !== req.user.userId) {
          return res.status(404).json({ error: 'Upload session not found' });
        }
        
        await s3StorageService.completeUpload(
          session.s3_key,
          session.s3_upload_id,
          parts
        );
        
        // Update asset with S3 data address
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE data_addresses 
             SET s3_key = $1, bucket_name = $2
             WHERE asset_id = $3`,
            [session.s3_key, process.env.S3_BUCKET_NAME, session.asset_id]
          );
        } finally {
          client.release();
        }
        
        res.status(200).json({ 
          success: true, 
          s3Key: session.s3_key,
          assetId: session.asset_id 
        });
        
        console.log(`[Management API] Upload finalized for session ${sessionId}`);
      } catch (error) {
        console.error('[Management API] Finalize upload error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    router.post('/s3assets/abort-upload', authenticateToken, async (req, res) => {
      try {
        const { sessionId } = req.body;
        
        const session = await s3StorageService.getUploadSession(sessionId);
        
        if (!session || session.user_id !== req.user.userId) {
          return res.status(404).json({ error: 'Upload session not found' });
        }
        
        await s3StorageService.abortUpload(session.s3_key, session.s3_upload_id);
        
        res.status(200).json({ success: true });
        
        console.log(`[Management API] Upload aborted for session ${sessionId}`);
      } catch (error) {
        console.error('[Management API] Abort upload error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // ==================== POLICY DEFINITIONS ENDPOINTS ====================
    
    // POST /v3/policydefinitions - Create a new policy definition
    router.post('/v3/policydefinitions', authenticateToken, async (req, res) => {
      try {
        const policyDefinition = req.body;
        const policyId = policyDefinition['@id'] || uuidv4();
        
        // Validate required fields
        if (!policyDefinition.policy) {
          return res.status(400).json({
            errors: [{
              message: 'Policy definition must contain a policy object',
              type: 'ValidationError'
            }]
          });
        }
        
        // Insert into database
        await pool.query(
          `INSERT INTO policy_definitions (id, policy, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE 
           SET policy = $2, updated_at = NOW()`,
          [policyId, policyDefinition.policy, req.user?.username]
        );
        
        res.status(200).json({
          '@id': policyId,
          '@type': 'PolicyDefinition',
          'edc:createdAt': Date.now()
        });
        
        console.log(`[Management API] Policy definition created: ${policyId}`);
      } catch (error) {
        console.error('[Management API] Error creating policy definition:', error);
        res.status(500).json({
          errors: [{
            message: error.message,
            type: 'QueryError'
          }]
        });
      }
    });
    
    // POST /v3/policydefinitions/request - Query all policy definitions
    router.post('/v3/policydefinitions/request', optionalAuth, async (req, res) => {
      try {
        const result = await pool.query('SELECT id, policy, created_at FROM policy_definitions ORDER BY created_at DESC');
        
        const policies = result.rows.map(row => ({
          '@id': row.id,
          '@type': 'PolicyDefinition',
          policy: row.policy,
          createdAt: row.created_at
        }));
        
        res.status(200).json(policies);
      } catch (error) {
        console.error('[Management API] Error fetching policies:', error);
        res.status(500).json({ errors: [{ message: error.message, type: 'QueryError' }] });
      }
    });
    
    // ==================== CONTRACT DEFINITIONS ENDPOINTS ====================
    
    // POST /v3/contractdefinitions - Create a new contract definition
    router.post('/v3/contractdefinitions', authenticateToken, async (req, res) => {
      try {
        const contractDefinition = req.body;
        const contractId = contractDefinition['@id'] || uuidv4();
        const accessPolicyId = contractDefinition.accessPolicyId;
        const contractPolicyId = contractDefinition.contractPolicyId;
        const assetsSelector = contractDefinition.assetsSelector || [];
        
        // Validate required fields
        if (!accessPolicyId || !contractPolicyId) {
          return res.status(400).json({
            errors: [{
              message: 'Contract definition must have accessPolicyId and contractPolicyId',
              type: 'ValidationError'
            }]
          });
        }
        
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Insert contract definition
          await client.query(
            `INSERT INTO contract_definitions (id, access_policy_id, contract_policy_id, assets_selector, created_by)
             VALUES ($1, $2, $3, $4::jsonb, $5)
             ON CONFLICT (id) DO UPDATE 
             SET access_policy_id = $2, contract_policy_id = $3, assets_selector = $4::jsonb, updated_at = NOW()`,
            [contractId, accessPolicyId, contractPolicyId, JSON.stringify(assetsSelector), req.user?.username]
          );
          
          // Extract asset IDs from assetsSelector and insert into junction table
          const assetIds = [];
          if (Array.isArray(assetsSelector)) {
            for (const selector of assetsSelector) {
              if (selector.operandLeft === 'https://w3id.org/edc/v0.0.1/ns/id' || selector.operandLeft === 'id') {
                if (selector.operator === 'in' && Array.isArray(selector.operandRight)) {
                  assetIds.push(...selector.operandRight);
                } else if (selector.operator === '=' && selector.operandRight) {
                  assetIds.push(selector.operandRight);
                }
              }
            }
          }
          
          // Delete existing associations
          await client.query(
            'DELETE FROM contract_definition_assets WHERE contract_definition_id = $1',
            [contractId]
          );
          
          // Insert new associations
          if (assetIds.length > 0) {
            for (const assetId of assetIds) {
              await client.query(
                `INSERT INTO contract_definition_assets (contract_definition_id, asset_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [contractId, assetId]
              );
            }
          }
          
          await client.query('COMMIT');
          
          res.status(200).json({
            '@id': contractId,
            '@type': 'ContractDefinition',
            'edc:createdAt': Date.now()
          });
          
          console.log(`[Management API] Contract definition created: ${contractId} with ${assetIds.length} assets`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('[Management API] Error creating contract definition:', error);
        res.status(500).json({
          errors: [{
            message: error.message,
            type: 'QueryError'
          }]
        });
      }
    });
    
    // POST /v3/contractdefinitions/request - Query all contract definitions
    router.post('/v3/contractdefinitions/request', optionalAuth, async (req, res) => {
      try {
        // Get all contracts
        const contractsResult = await pool.query(`
          SELECT cd.id, cd.access_policy_id, cd.contract_policy_id, cd.assets_selector,
                 cd.created_at, cd.updated_at,
                 ap.policy as access_policy,
                 cp.policy as contract_policy
          FROM contract_definitions cd
          LEFT JOIN policy_definitions ap ON cd.access_policy_id = ap.id
          LEFT JOIN policy_definitions cp ON cd.contract_policy_id = cp.id
          ORDER BY cd.created_at DESC
        `);
        
        // For each contract, get associated assets
        const contracts = [];
        for (const row of contractsResult.rows) {
          const assetsResult = await pool.query(
            'SELECT asset_id FROM contract_definition_assets WHERE contract_definition_id = $1',
            [row.id]
          );
          
          contracts.push({
            '@id': row.id,
            '@type': 'ContractDefinition',
            accessPolicyId: row.access_policy_id,
            contractPolicyId: row.contract_policy_id,
            assetsSelector: row.assets_selector || [],
            assetIds: assetsResult.rows.map(a => a.asset_id),
            accessPolicy: row.access_policy,
            contractPolicy: row.contract_policy,
            createdAt: row.created_at
          });
        }
        
        res.status(200).json(contracts);
      } catch (error) {
        console.error('[Management API] Error fetching contract definitions:', error);
        res.status(500).json({ errors: [{ message: error.message, type: 'QueryError' }] });
      }
    });
    
    // ==================== CATALOG ENDPOINT ====================
    
    router.post('/v3/catalog/request', optionalAuth, async (req, res) => {
      try {
        const { offset = 0, limit = 50 } = req.body;
        
        // Get only assets that have at least one contract (catalog = assets with offers)
        const assetsResult = await pool.query(`
          SELECT DISTINCT a.id, a.name, a.version, a.content_type, a.description,
                 a.short_description, a.keywords, a.byte_size, a.format,
                 a.asset_type, a.created_at, a.owner,
                 COUNT(DISTINCT cda.contract_definition_id) as contract_count
          FROM assets a
          INNER JOIN contract_definition_assets cda ON a.id = cda.asset_id
          GROUP BY a.id, a.name, a.version, a.content_type, a.description,
                   a.short_description, a.keywords, a.byte_size, a.format,
                   a.asset_type, a.created_at, a.owner
          ORDER BY a.created_at DESC
          LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        // For each asset, get its contract offers and ML metadata
        const catalog = [];
        for (const row of assetsResult.rows) {
          const contractsResult = await pool.query(`
            SELECT cd.id, cd.access_policy_id, cd.contract_policy_id,
                   ap.policy as access_policy,
                   cp.policy as contract_policy
            FROM contract_definition_assets cda
            JOIN contract_definitions cd ON cda.contract_definition_id = cd.id
            LEFT JOIN policy_definitions ap ON cd.access_policy_id = ap.id
            LEFT JOIN policy_definitions cp ON cd.contract_policy_id = cp.id
            WHERE cda.asset_id = $1
          `, [row.id]);
          
          // Get ML metadata if available
          const mlMetadataResult = await pool.query(`
            SELECT task, subtask, algorithm, library, framework, 
                   software, programming_language, license
            FROM ml_metadata
            WHERE asset_id = $1
          `, [row.id]);
          
          const contractOffers = contractsResult.rows.map(c => ({
            '@id': c.id,
            '@type': 'ContractDefinition',
            contractId: c.id,
            accessPolicyId: c.access_policy_id,
            contractPolicyId: c.contract_policy_id,
            accessPolicy: c.access_policy,
            contractPolicy: c.contract_policy
          }));
          
          // Build properties without 'asset:prop:' prefix for easier frontend consumption
          const properties = {
            name: row.name,
            version: row.version,
            contentType: row.content_type,
            description: row.description,
            shortDescription: row.short_description,
            keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()) : [],
            byteSize: row.byte_size,
            format: row.format,
            type: row.asset_type,
            owner: row.owner
          };
          
          // Add ML metadata if available
          if (mlMetadataResult.rows.length > 0) {
            const mlMeta = mlMetadataResult.rows[0];
            properties.mlMetadata = {
              task: mlMeta.task,
              subtask: mlMeta.subtask,
              algorithm: mlMeta.algorithm,
              library: mlMeta.library,
              framework: mlMeta.framework,
              software: mlMeta.software,
              programmingLanguage: mlMeta.programming_language,
              license: mlMeta.license
            };
          }
          
          catalog.push({
            '@id': row.id,
            '@type': 'dcat:Dataset',
            assetId: row.id,
            originator: row.owner,
            properties: properties,
            contractOffers: contractOffers,
            contractCount: parseInt(row.contract_count)
          });
        }
        
        res.status(200).json(catalog);
      } catch (error) {
        console.error('[Management API] Error fetching catalog:', error);
        res.status(500).json({ errors: [{ message: error.message, type: 'QueryError' }] });
      }
    });
    
    // ==================== VOCABULARY ENDPOINT ====================
    
    router.get('/vocabulary', (req, res) => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        const vocabularyPath = path.join(__dirname, '../../content/JS_Pionera_Ontology.json');
        
        if (fs.existsSync(vocabularyPath)) {
          const vocabulary = JSON.parse(fs.readFileSync(vocabularyPath, 'utf-8'));
          res.status(200).json(vocabulary);
        } else {
          res.status(404).json({ error: 'Vocabulary not found' });
        }
      } catch (error) {
        console.error('[Management API] Vocabulary error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Register router
    context.registerService('ManagementAPIRouter', router);
    
    console.log('[Management API Extension] Registered endpoints:');
    console.log('  - POST /auth/login');
    console.log('  - GET /auth/me');
    console.log('  - POST /auth/logout');
    console.log('  - POST /v3/assets');
    console.log('  - POST /v3/assets/request');
    console.log('  - GET /v3/assets/:id');
    console.log('  - POST /v3/policydefinitions');
    console.log('  - POST /v3/policydefinitions/request');
    console.log('  - POST /v3/contractdefinitions');
    console.log('  - POST /v3/contractdefinitions/request');
    console.log('  - POST /v3/catalog/request');
    console.log('  - POST /s3assets/init-upload');
    console.log('  - POST /s3assets/upload-chunk');
    console.log('  - POST /s3assets/finalize-upload');
    console.log('  - POST /s3assets/abort-upload');
    console.log('  - GET /vocabulary');
    console.log('[Management API Extension] Initialized successfully');
  }
});
