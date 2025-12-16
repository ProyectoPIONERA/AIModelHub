import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MlBrowserService } from './ml-browser.service';
import { MLAsset } from '../models/ml-asset';

export interface MLAssetFilter {
  searchTerm?: string;
  tasks?: string[];
  subtasks?: string[];
  algorithms?: string[];
  libraries?: string[];
  frameworks?: string[];
  storageTypes?: string[];
  software?: string[];
  assetSources?: string[]; // 'Local Asset' or 'External Asset'
  formats?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MlAssetsService {

  private readonly mlBrowserService = inject(MlBrowserService);

  /**
   * Obtiene todos los ML Assets desde Federated Catalog
   */
  getMachinelearningAssets(): Observable<MLAsset[]> {
    console.log('[ML Assets Service] Calling mlBrowserService.getPaginatedMLAssets()...');
    return this.mlBrowserService.getPaginatedMLAssets();
  }

  /**
   * Cuenta el total de ML Assets
   */
  count(): Observable<number> {
    return this.mlBrowserService.count();
  }

  /**
   * Filtra assets de ML según criterios específicos
   */
  filterAssets(assets: MLAsset[], filters: MLAssetFilter): MLAsset[] {
    let filtered = [...assets];

    // Filtro por término de búsqueda
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchLower) ||
        asset.description.toLowerCase().includes(searchLower) ||
        asset.shortDescription.toLowerCase().includes(searchLower) ||
        asset.keywords.some(k => k.toLowerCase().includes(searchLower))
      );
    }

    // Filtro por tasks
    if (filters.tasks && filters.tasks.length > 0) {
      filtered = filtered.filter(asset =>
        asset.tasks.some(t => filters.tasks!.includes(t))
      );
    }

    // Filtro por subtasks
    if (filters.subtasks && filters.subtasks.length > 0) {
      filtered = filtered.filter(asset =>
        asset.subtasks.some(s => filters.subtasks!.includes(s))
      );
    }

    // Filtro por algorithms
    if (filters.algorithms && filters.algorithms.length > 0) {
      filtered = filtered.filter(asset =>
        asset.algorithms.some(a => filters.algorithms!.includes(a))
      );
    }

    // Filtro por libraries
    if (filters.libraries && filters.libraries.length > 0) {
      filtered = filtered.filter(asset =>
        asset.libraries.some(l => filters.libraries!.includes(l))
      );
    }

    // Filtro por frameworks
    if (filters.frameworks && filters.frameworks.length > 0) {
      filtered = filtered.filter(asset =>
        asset.frameworks.some(f => filters.frameworks!.includes(f))
      );
    }

    // Filtro por storageTypes
    if (filters.storageTypes && filters.storageTypes.length > 0) {
      filtered = filtered.filter(asset =>
        !!asset.storageType && filters.storageTypes!.includes(asset.storageType)
      );
    }

    // Filtro por software (unión de libraries + frameworks)
    if (filters.software && filters.software.length > 0) {
      filtered = filtered.filter(asset => {
        const tags = new Set<string>([...asset.libraries, ...asset.frameworks]);
        return Array.from(tags).some(tag => filters.software!.includes(tag));
      });
    }

    // Filtro por assetSources (Local Asset o External Asset)
    if (filters.assetSources && filters.assetSources.length > 0) {
      filtered = filtered.filter(asset => {
        const assetType = asset.isLocal ? 'Local Asset' : 'External Asset';
        return filters.assetSources!.includes(assetType);
      });
    }

    // Filtro por formats
    if (filters.formats && filters.formats.length > 0) {
      filtered = filtered.filter(asset =>
        !!asset.format && filters.formats!.includes(asset.format)
      );
    }

    return filtered;
  }

  /**
   * Extrae todas las tareas únicas de los assets
   */
  extractUniqueTasks(assets: MLAsset[]): string[] {
    const tasks = new Set<string>();
    assets.forEach(asset => {
      asset.tasks.forEach(task => tasks.add(task));
    });
    return Array.from(tasks).sort();
  }

  /**
   * Extrae todos los subtasks únicos de los assets
   */
  extractUniqueSubtasks(assets: MLAsset[]): string[] {
    const subtasks = new Set<string>();
    assets.forEach(asset => {
      asset.subtasks.forEach(subtask => subtasks.add(subtask));
    });
    return Array.from(subtasks).sort();
  }

  /**
   * Extrae todos los algoritmos únicos de los assets
   */
  extractUniqueAlgorithms(assets: MLAsset[]): string[] {
    const algorithms = new Set<string>();
    assets.forEach(asset => {
      asset.algorithms.forEach(algo => algorithms.add(algo));
    });
    return Array.from(algorithms).sort();
  }

  /**
   * Extrae todas las librerías únicas de los assets
   */
  extractUniqueLibraries(assets: MLAsset[]): string[] {
    const libraries = new Set<string>();
    assets.forEach(asset => {
      asset.libraries.forEach(lib => libraries.add(lib));
    });
    return Array.from(libraries).sort();
  }

  /**
   * Extrae todos los frameworks únicos de los assets
   */
  extractUniqueFrameworks(assets: MLAsset[]): string[] {
    const frameworks = new Set<string>();
    assets.forEach(asset => {
      asset.frameworks.forEach(fw => frameworks.add(fw));
    });
    return Array.from(frameworks).sort();
  }

  /**
   * Extrae todos los storageTypes únicos de los assets
   */
  extractUniqueStorageTypes(assets: MLAsset[]): string[] {
    const storage = new Set<string>();
    assets.forEach(asset => {
      if (asset.storageType) storage.add(asset.storageType);
    });
    return Array.from(storage).sort();
  }

  /**
   * Extrae todas las etiquetas de software únicas (libraries + frameworks)
   */
  extractUniqueSoftware(assets: MLAsset[]): string[] {
    const software = new Set<string>();
    assets.forEach(asset => {
      asset.libraries.forEach(lib => software.add(lib));
      asset.frameworks.forEach(fw => software.add(fw));
    });
    return Array.from(software).sort();
  }

  /**
   * Extrae todos los Asset Sources únicos (Local Asset, External Asset)
   */
  extractUniqueAssetSources(assets: MLAsset[]): string[] {
    const sources = new Set<string>();
    assets.forEach(asset => {
      const assetType = asset.isLocal ? 'Local Asset' : 'External Asset';
      sources.add(assetType);
    });
    return Array.from(sources).sort();
  }

  /**
   * Extrae todos los Formats únicos de los assets
   */
  extractUniqueFormats(assets: MLAsset[]): string[] {
    const formats = new Set<string>();
    assets.forEach(asset => {
      if (asset.format && asset.format !== 'Unknown') {
        formats.add(asset.format);
      }
    });
    return Array.from(formats).sort();
  }
}
