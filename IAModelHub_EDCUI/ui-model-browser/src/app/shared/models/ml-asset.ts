export interface MLAsset {
  id: string;
  name: string;
  version: string;
  description: string;
  shortDescription: string;
  assetType: string;
  contentType: string;
  byteSize: string;
  format: string;
  keywords: string[];
  
  // Campos específicos de ML (extraídos de assetData)
  tasks: string[];
  subtasks: string[];
  algorithms: string[];
  libraries: string[];
  frameworks: string[];
  modelType: string;

  // Información de almacenamiento (extraída de dataAddress)
  storageType?: string;
  fileName?: string;
  
  // Multi-tenancy: owner y local/external indicator
  owner?: string; // Connector ID del propietario (e.g., 'conn-oeg-demo')
  isLocal?: boolean; // true si el asset pertenece al usuario autenticado
  
  // Información de contrato
  hasContractOffers?: boolean;
  contractOffers?: unknown[];
  endpointUrl?: string;
  participantId?: string;
  
  // Datos completos
  assetData: Record<string, unknown>;
  rawProperties: Record<string, unknown>;
  originator: string; // 'Local Connector' or 'Federated Catalog'
}
