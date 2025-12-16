-- ML Assets Database Schema
-- Compatible with EDC (Eclipse Dataspace Components) and ML Metadata

-- Create tables for ML Assets Management
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    version VARCHAR(50) DEFAULT '1.0',
    content_type VARCHAR(100) DEFAULT 'application/octet-stream',
    description TEXT,
    short_description VARCHAR(1000),
    keywords TEXT,
    byte_size BIGINT,
    format VARCHAR(100),
    asset_type VARCHAR(100) DEFAULT 'MLModel',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ML Metadata (from JS_Pionera_Ontology)
CREATE TABLE IF NOT EXISTS ml_metadata (
    asset_id VARCHAR(255) PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    task VARCHAR(200),
    subtask VARCHAR(200),
    algorithm VARCHAR(200),
    library VARCHAR(200),
    framework VARCHAR(200),
    software VARCHAR(200),
    programming_language VARCHAR(100),
    license VARCHAR(200),
    version VARCHAR(50),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- Data Addresses (Storage Configuration)
CREATE TABLE IF NOT EXISTS data_addresses (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'HttpData', 'AmazonS3', 'InesDataStore'
    -- Common fields
    name VARCHAR(500),
    -- HTTP Data fields
    base_url TEXT,
    path TEXT,
    auth_key VARCHAR(255),
    auth_code VARCHAR(255),
    secret_name VARCHAR(255),
    proxy_body VARCHAR(50),
    proxy_path VARCHAR(50),
    proxy_query_params VARCHAR(50),
    proxy_method VARCHAR(50),
    -- Amazon S3 / MinIO fields
    region VARCHAR(100),
    bucket_name VARCHAR(255),
    access_key_id VARCHAR(255),
    secret_access_key VARCHAR(500),
    endpoint_override TEXT,
    key_prefix VARCHAR(500),
    folder_name VARCHAR(500),
    -- InesDataStore fields
    folder VARCHAR(500),
    file_name VARCHAR(500),
    s3_key VARCHAR(1000), -- MinIO object key
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- File Upload Tracking (for chunked uploads)
CREATE TABLE IF NOT EXISTS upload_sessions (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    total_chunks INTEGER NOT NULL,
    uploaded_chunks INTEGER DEFAULT 0,
    s3_upload_id VARCHAR(500), -- MinIO multipart upload ID
    status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chunk tracking for multipart uploads
CREATE TABLE IF NOT EXISTS upload_chunks (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    etag VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, chunk_index)
);

-- Indexes for better query performance
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX idx_ml_metadata_task ON ml_metadata(task);
CREATE INDEX idx_ml_metadata_algorithm ON ml_metadata(algorithm);
CREATE INDEX idx_data_addresses_asset_id ON data_addresses(asset_id);
CREATE INDEX idx_data_addresses_type ON data_addresses(type);
CREATE INDEX idx_upload_sessions_asset_id ON upload_sessions(asset_id);
CREATE INDEX idx_upload_sessions_status ON upload_sessions(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_upload_sessions_updated_at BEFORE UPDATE ON upload_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - for testing)
INSERT INTO assets (id, name, version, content_type, description, asset_type, keywords, format)
VALUES 
    ('sample-ml-model-1', 'Sample Classification Model', '1.0', 'application/octet-stream', 
     'A sample machine learning model for testing', 'MLModel', 'classification,sample,test', 'pkl'),
    ('sample-dataset-1', 'Sample Training Dataset', '1.0', 'text/csv', 
     'A sample dataset for testing', 'Dataset', 'dataset,sample,training', 'csv')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ml_metadata (asset_id, task, algorithm, framework, programming_language, license)
VALUES 
    ('sample-ml-model-1', 'Classification', 'RandomForest', 'scikit-learn', 'Python', 'MIT'),
    ('sample-dataset-1', 'Classification', NULL, NULL, NULL, 'CC-BY-4.0')
ON CONFLICT (asset_id) DO NOTHING;

-- View for easy querying of complete asset information
CREATE OR REPLACE VIEW assets_complete AS
SELECT 
    a.*,
    m.task, m.subtask, m.algorithm, m.library, m.framework, 
    m.software, m.programming_language, m.license as ml_license,
    da.type as storage_type, da.bucket_name, da.s3_key, da.base_url
FROM assets a
LEFT JOIN ml_metadata m ON a.id = m.asset_id
LEFT JOIN data_addresses da ON a.id = da.asset_id;

COMMENT ON TABLE assets IS 'Main table for ML assets metadata';
COMMENT ON TABLE ml_metadata IS 'ML-specific metadata from JS_Pionera_Ontology';
COMMENT ON TABLE data_addresses IS 'Storage configuration for assets (HTTP, S3, InesDataStore)';
COMMENT ON TABLE upload_sessions IS 'Tracking chunked file uploads to MinIO';
COMMENT ON TABLE upload_chunks IS 'Individual chunks for multipart uploads';
