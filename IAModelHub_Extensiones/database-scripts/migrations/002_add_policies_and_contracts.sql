-- Migration: Add Policy Definitions and Contract Definitions tables
-- Date: 2025
-- Description: Tables for managing EDC policies and contract definitions

-- Policy Definitions table
CREATE TABLE IF NOT EXISTS policy_definitions (
    id VARCHAR(255) PRIMARY KEY,
    policy JSONB NOT NULL, -- Full policy JSON with @context, odrl:permission, odrl:prohibition, odrl:obligation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) -- Future: reference to user who created it
);

-- Contract Definitions table
CREATE TABLE IF NOT EXISTS contract_definitions (
    id VARCHAR(255) PRIMARY KEY,
    access_policy_id VARCHAR(255) NOT NULL,
    contract_policy_id VARCHAR(255) NOT NULL,
    assets_selector JSONB NOT NULL, -- Array of criteria to select assets
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255), -- Future: reference to user who created it
    FOREIGN KEY (access_policy_id) REFERENCES policy_definitions(id) ON DELETE RESTRICT,
    FOREIGN KEY (contract_policy_id) REFERENCES policy_definitions(id) ON DELETE RESTRICT
);

-- Junction table for assets associated with contract definitions (denormalized for performance)
CREATE TABLE IF NOT EXISTS contract_definition_assets (
    contract_definition_id VARCHAR(255) NOT NULL,
    asset_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contract_definition_id, asset_id),
    FOREIGN KEY (contract_definition_id) REFERENCES contract_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_policy_definitions_created_at ON policy_definitions(created_at DESC);
CREATE INDEX idx_contract_definitions_created_at ON contract_definitions(created_at DESC);
CREATE INDEX idx_contract_definitions_access_policy ON contract_definitions(access_policy_id);
CREATE INDEX idx_contract_definitions_contract_policy ON contract_definitions(contract_policy_id);
CREATE INDEX idx_contract_definition_assets_asset_id ON contract_definition_assets(asset_id);

-- Triggers for updated_at
CREATE TRIGGER update_policy_definitions_updated_at BEFORE UPDATE ON policy_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_definitions_updated_at BEFORE UPDATE ON contract_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample policies for testing
INSERT INTO policy_definitions (id, policy)
VALUES 
    ('use-eu-policy', '{
        "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}],
        "@type": "PolicyDefinition",
        "@id": "use-eu-policy",
        "odrl:permission": [{
            "odrl:action": "USE",
            "odrl:constraint": [{
                "odrl:leftOperand": "BusinessPartnerNumber",
                "odrl:operator": "EQ",
                "odrl:rightOperand": "EU"
            }]
        }]
    }'::jsonb),
    ('connector-restricted-policy', '{
        "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}],
        "@type": "PolicyDefinition",
        "@id": "connector-restricted-policy",
        "odrl:permission": [{
            "odrl:action": "USE",
            "odrl:constraint": [{
                "odrl:leftOperand": "DataspaceIdentifier",
                "odrl:operator": "EQ",
                "odrl:rightOperand": "DataSpacePrototype"
            }]
        }]
    }'::jsonb),
    ('unrestricted-policy', '{
        "@context": ["https://www.w3.org/ns/odrl.jsonld", {"edc": "https://w3id.org/edc/v0.0.1/ns/"}],
        "@type": "PolicyDefinition",
        "@id": "unrestricted-policy",
        "odrl:permission": [{
            "odrl:action": "USE"
        }]
    }'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE policy_definitions IS 'EDC Policy Definitions (ODRL format)';
COMMENT ON TABLE contract_definitions IS 'EDC Contract Definitions linking policies to assets';
COMMENT ON TABLE contract_definition_assets IS 'Junction table for assets in contract definitions';
