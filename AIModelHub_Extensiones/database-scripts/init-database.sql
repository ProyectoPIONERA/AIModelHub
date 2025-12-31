-- ============================================================
-- AIModelHub (CatalogModelIA_DS reorganization) - Database Initialization Script
-- ============================================================
-- Purpose: Initialize PostgreSQL database for IA Assets Catalog
-- Database: ml_assets_db
-- User: ml_assets_user
-- Version: 1.0
-- Date: 2025-12-12
-- ============================================================

-- Connect to database (if running from psql)
-- \c ml_assets_db;

-- ============================================================
-- FUNCTION: Auto-update timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: users
-- Purpose: User authentication and multi-tenant connector system
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    connector_id VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'User authentication table for multi-tenant connector system';
COMMENT ON COLUMN users.connector_id IS 'Unique connector identifier (e.g., conn-user1-demo)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password';

-- ============================================================
-- TABLE: assets
-- Purpose: Main table for IA assets metadata
-- ============================================================

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    owner VARCHAR(100) DEFAULT 'conn-user1-demo'
);

COMMENT ON TABLE assets IS 'Main table for IA assets metadata';
COMMENT ON COLUMN assets.owner IS 'Connector ID of the user who owns this asset (e.g., conn-user1-demo)';

-- ============================================================
-- TABLE: data_addresses
-- Purpose: Storage configuration for assets (HTTP, S3, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS data_addresses (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(500),
    
    -- HTTP Data Address fields
    base_url TEXT,
    path TEXT,
    auth_key VARCHAR(255),
    auth_code VARCHAR(255),
    secret_name VARCHAR(255),
    proxy_body VARCHAR(50),
    proxy_path VARCHAR(50),
    proxy_query_params VARCHAR(50),
    proxy_method VARCHAR(50),
    
    -- S3 Data Address fields
    region VARCHAR(100),
    bucket_name VARCHAR(255),
    access_key_id VARCHAR(255),
    secret_access_key VARCHAR(500),
    endpoint_override TEXT,
    key_prefix VARCHAR(500),
    folder_name VARCHAR(500),
    
    -- DataSpacePrototypeStore fields
    folder VARCHAR(500),
    file_name VARCHAR(500),
    
    -- S3 upload session fields
    s3_key VARCHAR(1000),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_asset
        FOREIGN KEY(asset_id) 
        REFERENCES assets(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE data_addresses IS 'Storage configuration for assets (HTTP, S3, DataSpacePrototypeStore)';

-- ============================================================
-- TABLE: ml_metadata
-- Purpose: ML-specific metadata from JS_Pionera_Ontology
-- ============================================================

CREATE TABLE IF NOT EXISTS ml_metadata (
    asset_id VARCHAR(255) PRIMARY KEY,
    task VARCHAR(200),
    subtask VARCHAR(200),
    algorithm VARCHAR(200),
    library VARCHAR(200),
    framework VARCHAR(200),
    software VARCHAR(200),
    programming_language VARCHAR(100),
    license VARCHAR(200),
    version VARCHAR(50),
    input_features JSONB,
    metrics JSONB,
    
    CONSTRAINT fk_asset_ml
        FOREIGN KEY(asset_id) 
        REFERENCES assets(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE ml_metadata IS 'ML-specific metadata from JS_Pionera_Ontology';
COMMENT ON COLUMN ml_metadata.input_features IS 'JSON structure describing model input variables';
COMMENT ON COLUMN ml_metadata.metrics IS 'JSON structure with model performance metrics';

-- ============================================================
-- TABLE: contract_definitions
-- Purpose: EDC contract definitions for assets
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_definitions (
    id VARCHAR(255) PRIMARY KEY,
    access_policy_id VARCHAR(255) NOT NULL,
    contract_policy_id VARCHAR(255) NOT NULL,
    asset_selector JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE contract_definitions IS 'EDC contract definitions linking assets to policies';

-- ============================================================
-- TABLE: policy_definitions
-- Purpose: EDC policy definitions (ODRL)
-- ============================================================

CREATE TABLE IF NOT EXISTS policy_definitions (
    id VARCHAR(255) PRIMARY KEY,
    policy JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE policy_definitions IS 'EDC policy definitions using ODRL format';

-- ============================================================
-- TABLE: s3_upload_sessions
-- Purpose: Track S3 multipart upload sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS s3_upload_sessions (
    id VARCHAR(255) PRIMARY KEY,
    asset_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    total_chunks INTEGER NOT NULL,
    s3_upload_id VARCHAR(500) NOT NULL,
    s3_key VARCHAR(1000) NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    CONSTRAINT fk_session_user
        FOREIGN KEY(user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE s3_upload_sessions IS 'Tracks S3 multipart upload sessions';

-- ============================================================
-- INDEXES
-- ============================================================

-- Assets indexes
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(created_at DESC);

-- Data addresses indexes
CREATE INDEX IF NOT EXISTS idx_data_addresses_asset ON data_addresses(asset_id);
CREATE INDEX IF NOT EXISTS idx_data_addresses_type ON data_addresses(type);

-- ML metadata indexes
CREATE INDEX IF NOT EXISTS idx_ml_metadata_task ON ml_metadata(task);
CREATE INDEX IF NOT EXISTS idx_ml_metadata_algorithm ON ml_metadata(algorithm);

-- S3 upload sessions indexes
CREATE INDEX IF NOT EXISTS idx_s3_sessions_asset ON s3_upload_sessions(asset_id);
CREATE INDEX IF NOT EXISTS idx_s3_sessions_user ON s3_upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_s3_sessions_status ON s3_upload_sessions(status);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on assets table
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VIEWS
-- ============================================================

-- Complete assets view with ML metadata and storage info
CREATE OR REPLACE VIEW assets_complete AS
SELECT 
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
    a.updated_at,
    a.owner,
    m.task,
    m.subtask,
    m.algorithm,
    m.library,
    m.framework,
    m.software,
    m.programming_language,
    m.license AS ml_license,
    m.input_features,
    da.type AS storage_type,
    da.bucket_name,
    da.s3_key,
    da.base_url
FROM assets a
LEFT JOIN ml_metadata m ON a.id = m.asset_id
LEFT JOIN data_addresses da ON a.id = da.asset_id;

COMMENT ON VIEW assets_complete IS 'Complete view of assets with ML metadata and storage information';

-- Assets with owner details
CREATE OR REPLACE VIEW assets_with_owner AS
SELECT 
    a.*,
    u.username AS owner_username,
    u.display_name AS owner_display_name
FROM assets a
LEFT JOIN users u ON a.owner = u.connector_id;

COMMENT ON VIEW assets_with_owner IS 'Assets with owner user information';

-- ============================================================
-- DEFAULT DATA (Optional - Development/Demo)
-- ============================================================

-- Insert default users (passwords are hashed with bcrypt)
-- Password for user-conn-user1-demo: user1123
-- Password for user-conn-user2-demo: user2123
-- IMPORTANT: Change these passwords in production environments!

INSERT INTO users (username, password_hash, connector_id, display_name, email)
VALUES 
    ('user-conn-user1-demo', '$2a$10$I/m17k0PieyAy2M71CT9De3uVqv0mNft/yz.DmvGYrEZKAYc5qA1C', 'conn-user1-demo', 'User1 Demo', 'demo@oeg.fi.upm.es'),
    ('user-conn-user2-demo', '$2a$10$4V9w.aXdEAcxU/ln6M7MHue25m6yjTeeJM1E3bkvEPj2XaSOa8M5.', 'conn-user2-demo', 'User2 Demo', 'edmundo@demo.com')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show created tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Show created views
SELECT table_name as view_name
FROM information_schema.tables
WHERE table_schema = 'public' 
AND table_type = 'VIEW'
ORDER BY table_name;

-- ============================================================
-- END OF INITIALIZATION SCRIPT
-- ============================================================

COMMENT ON DATABASE ml_assets_db IS 'IA Assets Catalog Database for EDC Connector - AIModelHub Project';
