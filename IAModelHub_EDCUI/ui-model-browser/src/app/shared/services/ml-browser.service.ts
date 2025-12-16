import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MLAsset } from '../models/ml-asset';

@Injectable({
  providedIn: 'root'
})
export class MlBrowserService {

  private readonly httpClient = inject(HttpClient);
  private readonly BASE_URL = `${environment.runtime.managementApiUrl}`;
  private readonly CATALOG_URL = `${environment.runtime.catalogUrl}`;

  /**
   * Obtiene ML Assets desde Management API /assets/request Y desde Catalog Browser (federated catalog)
   * Combina ambos resultados eliminando duplicados por @id
   * Los assets locales vienen del conector, los del catálogo vienen de otros conectores
   */
  getPaginatedMLAssets(): Observable<MLAsset[]> {
    // Realizar ambas consultas en paralelo
    const localAssets$ = this.getLocalMLAssets();
    const catalogAssets$ = this.getCatalogMLAssets();
    
    return forkJoin([localAssets$, catalogAssets$]).pipe(
      map(([localAssets, catalogAssets]) => {
        console.log('[ML Browser Service] Local assets:', localAssets.length);
        console.log('[ML Browser Service] Catalog assets:', catalogAssets.length);
        
        // Combinar eliminando duplicados por @id
        const assetMap = new Map<string, MLAsset>();
        
        // Agregar assets locales primero
        localAssets.forEach(asset => {
          assetMap.set(asset.id, { ...asset, originator: 'Local Connector' });
        });
        
        // Agregar assets del catálogo (solo si no existen ya)
        catalogAssets.forEach(asset => {
          if (!assetMap.has(asset.id)) {
            assetMap.set(asset.id, { 
              ...asset, 
              originator: 'Federated Catalog',
              hasContractOffers: true // Assets del catálogo siempre tienen contract offers
            });
          }
        });
        
        const uniqueAssets = Array.from(assetMap.values());
        console.log('[ML Browser Service] Unique ML assets:', uniqueAssets.length);
        
        return uniqueAssets;
      })
    );
  }

  /**
   * Obtiene ML Assets locales desde Management API /assets/request
   */
  private getLocalMLAssets(): Observable<MLAsset[]> {
    const url = `${this.BASE_URL}/v3/assets/request`;
    const body = {
      "@context": {
        "@vocab": "https://w3id.org/edc/v0.0.1/ns/"
      },
      "@type": "QuerySpec"
    };
    
    console.log('[ML Browser Service] Calling local assets/request:', url);

    return this.httpClient.post<unknown[]>(url, body).pipe(
      map(response => {
        console.log('[ML Browser Service] Raw local assets response:', response);
        console.log('[ML Browser Service] Response is array?', Array.isArray(response));
        console.log('[ML Browser Service] Number of assets:', Array.isArray(response) ? response.length : 'N/A');
        
        const datasets = this.parseCatalogDatasets(response);
        console.log('[ML Browser Service] Parsed datasets:', datasets);
        console.log('[ML Browser Service] Dataset types:', datasets.map(d => ({ id: d.id, type: d.assetType })));
        
        // Filtrar client-side por assetType=machineLearning OR deepLearning
        const mlAssets = datasets.filter(asset => {
          const isAI = asset.assetType === 'machineLearning' || 
                       asset.assetType === 'Machine Learning' ||
                       asset.assetType === 'deepLearning' ||
                       asset.assetType === 'Deep Learning';
          console.log(`[ML Browser Service] Asset ${asset.id}: type="${asset.assetType}", isAI=${isAI}`);
          return isAI;
        });
        console.log('[ML Browser Service] Local AI assets after filter:', mlAssets.length);
        console.log('[ML Browser Service] Filtered AI assets:', mlAssets.map(a => ({ id: a.id, name: a.name, type: a.assetType })));
        
        return mlAssets;
      })
    );
  }

  /**
   * Obtiene ML Assets desde Federated Catalog
   * NOTA: Por ahora usa el mismo endpoint que assets locales
   * En el futuro se conectará a un catálogo federado real
   */
  private getCatalogMLAssets(): Observable<MLAsset[]> {
    // Por ahora retornamos un array vacío ya que no tenemos catálogo federado
    // En el futuro esto se conectará a un servicio de catálogo federado real
    console.log('[ML Browser Service] Federated catalog not configured, returning empty array');
    return new Observable(observer => {
      observer.next([]);
      observer.complete();
    });
  }

  /**
   * Cuenta el total de ML Assets
   */
  count(): Observable<number> {
    return this.getPaginatedMLAssets().pipe(
      map(assets => assets.length)
    );
  }

  /**
   * Parsea la respuesta de assets del Management API
   */
  private parseCatalogDatasets(assets: unknown): MLAsset[] {
    const datasets: MLAsset[] = [];
    
    if (!assets) {
      return datasets;
    }

    let assetList: unknown[];
    if (Array.isArray(assets)) {
      assetList = assets;
    } else {
      assetList = [assets];
    }

    for (const asset of assetList) {
      if (!asset) continue;

      const assetObj = asset as Record<string, unknown>;
      console.debug('[ML Browser] Processing asset:', assetObj);

      // Soportar tanto formato EDC (edc:properties) como formato directo (properties)
      const properties = (assetObj['edc:properties'] || assetObj['properties'] || assetObj) as Record<string, unknown>;
      
      const id = String(assetObj['@id'] || properties['id'] || 'Unknown');
      
      // Buscar name en múltiples ubicaciones
      const name = String(
        properties['asset:prop:name'] || 
        properties['name'] || 
        id || 
        'Untitled'
      );
      
      // Buscar description
      const descriptionRaw = String(
        properties['asset:prop:description'] ||
        properties['http://purl.org/dc/terms/description'] || 
        properties['shortDescription'] || 
        properties['asset:prop:shortDescription'] ||
        'No description'
      );
      const description = descriptionRaw.replace(/<[^>]+>/g, '');
      const shortDescription = String(
        properties['asset:prop:shortDescription'] ||
        properties['shortDescription'] || 
        description
      );
      
      // Buscar version
      const version = String(
        properties['asset:prop:version'] ||
        properties['version'] || 
        'N/A'
      );
      
      // Buscar assetType - CRÍTICO para filtrar ML assets
      const assetType = String(
        properties['asset:prop:type'] ||
        properties['assetType'] || 
        'Unknown'
      );
      
      // Buscar contentType
      const contentType = String(
        properties['asset:prop:contenttype'] ||
        properties['contenttype'] || 
        ''
      );
      const contentTypeDisplay = contentType || 'Not available';
      
      // Buscar byteSize
      const byteSize = String(
        properties['asset:prop:byteSize'] ||
        properties['http://www.w3.org/ns/dcat#byteSize'] || 
        ''
      );
      const byteSizeDisplay = byteSize || 'Not available';
      
      // Buscar format
      const format = String(
        properties['asset:prop:format'] ||
        properties['http://purl.org/dc/terms/format'] || 
        'Unknown'
      );
      
      // Buscar keywords
      let keywords: string[] = [];
      const keywordsRaw = properties['asset:prop:keywords'] || properties['http://www.w3.org/ns/dcat#keyword'];
      if (Array.isArray(keywordsRaw)) {
        keywords = keywordsRaw.map(k => String(k));
      } else if (keywordsRaw) {
        const keywordsStr = String(keywordsRaw);
        keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : [];
      }

      // Buscar metadata de ML
      const mlMetadata = (properties['ml:metadata'] as Record<string, unknown>) || {};
      const assetData = (properties['assetData'] as Record<string, unknown>) || {};
      
      // Buscar dataAddress con soporte para formato EDC
      const dataAddress = (
        assetObj['edc:dataAddress'] || 
        assetObj['dataAddress'] || 
        properties['dataAddress'] || 
        {}
      ) as Record<string, unknown>;
      
      const storageType = String(dataAddress['type'] || dataAddress['@type'] || '');
      const fileName = String(
        dataAddress['s3Key'] ||
        dataAddress['keyName'] || 
        dataAddress['filename'] || 
        ''
      );

      // Extraer metadata de ML desde ml:metadata o assetData
      const ontology = (assetData['JS_Pionera_Ontology'] as Record<string, unknown>) || {};
      const model = (ontology['model'] as Record<string, unknown>) || {};
      const software = (ontology['software'] as Record<string, unknown>) || {};
      const algorithm = (ontology['algorithm'] as Record<string, unknown>) || {};

      // Tasks desde ml:metadata o model
      const tasksValue = mlMetadata['task'] || model['tasks'] || '';
      const tasks = tasksValue ? (Array.isArray(tasksValue) ? tasksValue.map(t => String(t)) : [String(tasksValue)].filter(t => t)) : [];
      
      // Subtasks
      const subTasksValue = mlMetadata['subtask'] || model['subTasks'] || '';
      const subtasks = subTasksValue ? (Array.isArray(subTasksValue) ? subTasksValue.map(t => String(t)) : [String(subTasksValue)].filter(t => t)) : [];

      // Libraries
      const libraryValue = mlMetadata['library'] || software['description'] || '';
      const libraries = libraryValue ? [String(libraryValue)].filter(l => l) : [];
      
      // Algorithms
      const algorithmValue = mlMetadata['algorithm'] || algorithm['title'] || algorithm['identifier'] || '';
      const algorithmMediaType = String(algorithm['mediaType'] || '');
      const algorithms: string[] = [];
      if (algorithmValue) algorithms.push(String(algorithmValue));
      if (algorithmMediaType && algorithmMediaType !== algorithmValue) algorithms.push(algorithmMediaType);
      
      // Frameworks
      const frameworkValue = mlMetadata['framework'] || algorithm['description'] || '';
      const frameworks = frameworkValue ? [String(frameworkValue)].filter(f => f) : [];

      // Extract owner and isLocal from EDC response
      const owner = String(assetObj['edc:owner'] || properties['asset:prop:owner'] || '');
      const isLocal = assetObj['edc:isLocal'] === true || assetObj['edc:isLocal'] === 'true';

      const mlAsset: MLAsset = {
        id,
        name,
        version,
        description,
        shortDescription,
        assetType,
        contentType: contentTypeDisplay,
        byteSize: byteSizeDisplay,
        format,
        keywords,
        
        tasks,
        subtasks,
        algorithms,
        libraries,
        frameworks,
        modelType: String(assetData['modelType'] || ''),
        
        owner,
        isLocal,
        
        assetData,
        rawProperties: properties as Record<string, unknown>,
        originator: 'Local Connector',

        storageType,
        fileName
      };

      datasets.push(mlAsset);
    }

    return datasets;
  }

  /**
   * Parsea un dataset individual del catálogo federado
   */
  private parseCatalogDataset(dataset: Record<string, unknown>, catalog: Record<string, unknown>): MLAsset {
    console.debug('[ML Browser] Processing catalog dataset:', dataset);

    const id = String(dataset['@id'] || dataset['id'] || 'Unknown');
    const name = String(dataset['name'] || id || 'Untitled');
    
    const descriptionRaw = String(dataset['http://purl.org/dc/terms/description'] || 
                           dataset['shortDescription'] || 
                           'No description');
    const description = descriptionRaw.replace(/<[^>]+>/g, '');
    const shortDescription = String(dataset['shortDescription'] || description);
    
    const version = String(dataset['version'] || 'N/A');
    const assetType = String(dataset['assetType'] || 'Unknown');
    
    const contentType = String(dataset['contenttype'] || '');
    const contentTypeDisplay = contentType || 'Not available';
    const byteSize = String(dataset['http://www.w3.org/ns/dcat#byteSize'] || '');
    const byteSizeDisplay = byteSize || 'Not available';
    
    const format = String(dataset['http://purl.org/dc/terms/format'] || 'Unknown');
    
    let keywords: string[] = [];
    const keywordsRaw = dataset['http://www.w3.org/ns/dcat#keyword'];
    if (Array.isArray(keywordsRaw)) {
      keywords = keywordsRaw.map(k => String(k));
    } else if (keywordsRaw) {
      keywords = [String(keywordsRaw)];
    }

    let assetData: Record<string, unknown> = {};
    const assetDataRaw = dataset['assetData'];
    if (typeof assetDataRaw === 'string') {
      try {
        assetData = JSON.parse(assetDataRaw) as Record<string, unknown>;
      } catch {
        console.warn('[ML Browser] Could not parse assetData JSON string:', assetDataRaw);
        assetData = {};
      }
    } else if (assetDataRaw && typeof assetDataRaw === 'object') {
      assetData = assetDataRaw as Record<string, unknown>;
    }
    
    const dataAddress = (dataset['dataAddress'] as Record<string, unknown>) || {};
    const storageType = String(dataAddress['type'] || dataAddress['@type'] || '');
    const fileName = String(dataAddress['keyName'] || dataAddress['filename'] || '');

    console.debug('[ML Browser] Asset Data for', id, ':', assetData);

    const ontology = (assetData['JS_Pionera_Ontology'] as Record<string, unknown>) || {};
    const model = (ontology['model'] as Record<string, unknown>) || {};
    const software = (ontology['software'] as Record<string, unknown>) || {};
    const algorithm = (ontology['algorithm'] as Record<string, unknown>) || {};

    const tasksValue = model['tasks'] || '';
    const tasks = tasksValue ? (Array.isArray(tasksValue) ? tasksValue.map(t => String(t)) : [String(tasksValue)]) : [];
    
    const subTasksValue = model['subTasks'] || '';
    const subtasks = subTasksValue ? (Array.isArray(subTasksValue) ? subTasksValue.map(t => String(t)) : [String(subTasksValue)]) : [];

    const softwareDesc = String(software['description'] || '');
    const libraries = softwareDesc ? [softwareDesc] : [];
    
    const algorithmTitle = String(algorithm['title'] || algorithm['identifier'] || '');
    const algorithmMediaType = String(algorithm['mediaType'] || '');
    const algorithms: string[] = [];
    if (algorithmTitle) algorithms.push(algorithmTitle);
    if (algorithmMediaType && algorithmMediaType !== algorithmTitle) algorithms.push(algorithmMediaType);
    
    const algorithmDesc = String(algorithm['description'] || '');
    const frameworks = algorithmDesc ? [algorithmDesc] : [];

    const participantId = String(dataset['participantId'] || catalog['participantId'] || catalog['@id'] || '');
    
    let endpointUrl = '';
    try {
      let serviceId: string | undefined;
      const distribution = dataset['http://www.w3.org/ns/dcat#distribution'];
      if (Array.isArray(distribution)) {
        const distObj = distribution[0] as Record<string, unknown>;
        const accessService = distObj['http://www.w3.org/ns/dcat#accessService'] as Record<string, unknown>;
        serviceId = String(accessService?.['@id'] || '');
      } else if (distribution) {
        const distObj = distribution as Record<string, unknown>;
        const accessService = distObj['http://www.w3.org/ns/dcat#accessService'] as Record<string, unknown>;
        serviceId = String(accessService?.['@id'] || '');
      }
      
      if (serviceId) {
        const services = catalog['http://www.w3.org/ns/dcat#service'];
        if (Array.isArray(services)) {
          const service = services.find(s => (s as Record<string, unknown>)['@id'] === serviceId) as Record<string, unknown> | undefined;
          endpointUrl = String(service?.['http://www.w3.org/ns/dcat#endpointUrl'] || '');
        } else if (services) {
          const servicesObj = services as Record<string, unknown>;
          endpointUrl = String(servicesObj['http://www.w3.org/ns/dcat#endpointUrl'] || '');
        }
      }
    } catch {
      console.warn('[ML Browser] Could not extract endpointUrl from catalog');
    }
    
    const contractOffersRaw = dataset['odrl:hasPolicy'] || dataset['contractOffers'] || [];
    const contractOffers = Array.isArray(contractOffersRaw) ? contractOffersRaw : (contractOffersRaw ? [contractOffersRaw] : []);

    const mlAsset: MLAsset = {
      id,
      name,
      version,
      description,
      shortDescription,
      assetType,
      contentType: contentTypeDisplay,
      byteSize: byteSizeDisplay,
      format,
      keywords,
      
      tasks,
      subtasks,
      algorithms,
      libraries,
      frameworks,
      modelType: String(assetData['modelType'] || ''),
      
      assetData,
      rawProperties: dataset,
      originator: 'Federated Catalog',

      storageType,
      fileName,

      hasContractOffers: contractOffers.length > 0,
      contractOffers,
      participantId,
      endpointUrl
    };

    return mlAsset;
  }

  /**
   * Get catalog items (assets with contract offers)
   */
  getCatalog(querySpec: { offset: number; limit: number }): Observable<any[]> {
    const body = {
      offset: querySpec.offset,
      limit: querySpec.limit
    };

    console.log('[ML Browser Service] Fetching catalog with:', body);

    return this.httpClient.post<any[]>(`${this.BASE_URL}/v3/catalog/request`, body).pipe(
      map((response: any) => {
        console.log('[ML Browser Service] Catalog response:', response);
        return Array.isArray(response) ? response : [];
      })
    );
  }

  /**
   * Count total catalog items
   */
  getCatalogCount(): Observable<number> {
    return this.httpClient.post<number>(`${this.BASE_URL}/v3/catalog/request/count`, {}).pipe(
      map((response: any) => {
        const count = typeof response === 'number' ? response : 0;
        console.log('[ML Browser Service] Catalog count:', count);
        return count;
      })
    );
  }
}
