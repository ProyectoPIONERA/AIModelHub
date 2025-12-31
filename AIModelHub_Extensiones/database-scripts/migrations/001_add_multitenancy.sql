-- Migration: Add Multi-tenancy Support
-- Description: Add owner field to track which connector/user owns each asset
-- Date: 2025-12-11

-- 1. Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    connector_id VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'conn-user1-demo', 'conn-user2-demo'
    display_name VARCHAR(200),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add owner column to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS owner VARCHAR(100) DEFAULT 'conn-user1-demo';

-- 3. Add owner column to upload_sessions
ALTER TABLE upload_sessions 
ADD COLUMN IF NOT EXISTS owner VARCHAR(100) DEFAULT 'conn-user1-demo';

-- 4. Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_owner ON upload_sessions(owner);

-- 5. Insert default users
-- Password for user-conn-user1-demo: user1123
-- Password for user-conn-user2-demo: user2123
-- Using bcrypt hash with 10 rounds
INSERT INTO users (username, password_hash, connector_id, display_name, is_active)
VALUES 
    ('user-conn-user1-demo', '$2a$10$I/m17k0PieyAy2M71CT9De3uVqv0mNft/yz.DmvGYrEZKAYc5qA1C', 'conn-user1-demo', 'User1 Demo Connector', true),
    ('user-conn-user2-demo', '$2a$10$4V9w.aXdEAcxU/ln6M7MHue25m6yjTeeJM1E3bkvEPj2XaSOa8M5.', 'conn-user2-demo', 'User2 Demo Connector', true)
ON CONFLICT (username) DO NOTHING;

-- 6. Create view for assets with owner information
CREATE OR REPLACE VIEW assets_with_owner AS
SELECT 
    a.*,
    u.display_name as owner_display_name,
    u.connector_id as owner_connector_id
FROM assets a
LEFT JOIN users u ON a.owner = u.connector_id;

-- 7. Add comment explaining multi-tenancy
COMMENT ON COLUMN assets.owner IS 'Connector ID of the user who owns this asset (e.g., conn-user1-demo)';
COMMENT ON COLUMN upload_sessions.owner IS 'Connector ID of the user who owns this upload session';
COMMENT ON TABLE users IS 'User authentication table for multi-tenant connector system';
