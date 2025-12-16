export const environment = {
  production: false,
  appName: 'CatalogModelIA DS',
  version: '1.0.0',
  
  // EDC Connector endpoints - will be overridden by runtime config
  runtime: {
    managementApiUrl: 'http://localhost:3000',
    catalogUrl: 'http://localhost:3000',
    participantId: 'ml-catalog-demo',
    
    // EDC API service endpoints (standard EDC paths)
    service: {
      asset: {
        baseUrl: '/v3/assets',
        get: '/',
        getAll: '/request',
        count: '/request/count',
        uploadChunk: '/s3assets/upload-chunk',
        finalizeUpload: '/s3assets/finalize-upload',
      },
      policy: {
        baseUrl: '/v3/policydefinitions',
        get: '/',
        getAll: '/request',
        count: '/request',
        complexBaseUrl: '/v3/policydefinitions/complex',
      },
      contractDefinition: {
        baseUrl: '/v3/contractdefinitions',
        get: '/',
        getAll: '/request',
        count: '/request',
      },
      contractNegotiation: {
        baseUrl: '/v3/contractnegotiations',
        get: '/',
        getAll: '/request',
      },
      transferProcess: {
        baseUrl: '/v3/transferprocesses',
        get: '/',
        getAll: '/request',
      },
      federatedCatalog: {
        paginationRequest: '/request'
      }
    },
    
    // OAuth2/OIDC configuration (optional)
    oauth2: {
      enabled: false, // Set to true to enable OAuth2 authentication
      issuer: 'http://localhost:18082/realms/demo',
      clientId: 'ml-browser-client',
      scope: 'openid profile email',
      responseType: 'code',
      showDebugInformation: true,
    }
  },
  
  // Feature flags
  features: {
    enableAssetSourceFilter: true,
    enableStorageTypeFilter: true,
    enableFormatFilter: true,
    enableTaskFilter: true,
    enableContractCreation: true,
    enableNegotiation: true,
  }
};
