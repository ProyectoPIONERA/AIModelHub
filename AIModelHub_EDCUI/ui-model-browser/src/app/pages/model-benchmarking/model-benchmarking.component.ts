import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AssetService } from '../../shared/services/asset.service';
import { ModelExecutionService } from '../../shared/services/model-execution.service';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

type InputMode = 'single' | 'dataset';
type ModelTask = 'classification' | 'regression' | 'nlp' | 'vision' | 'other';
type DownloadFormat = 'csv' | 'json';

interface ModelMetrics {
  [key: string]: number;
}

interface BenchmarkAsset {
  id: string;
  name: string;
  task: string;
  subtask: string;
  algorithm: string;
  inputSchema: any;
  dataAddress: any;
}

interface RankingRow {
  rank: number;
  modelId: string;
  modelName: string;
  metrics: ModelMetrics;
  latency: number;
  cost: number;
  compositeScore?: number;
  top?: boolean;
}

interface DatasetInfo {
  id: string;
  name: string;
  samples: number;
  taskType: ModelTask;
  description: string;
  featuresSchema?: any;
  data?: any;
  labelsColumn?: string;
}

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  min?: number;
  max?: number;
  description?: string;
}

interface InputValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedInput?: any;
}

interface InputExecutionResult {
  modelId: string;
  modelName: string;
  status: 'success' | 'partial' | 'error';
  latencyMs: number;
  processedInputs: number;
  successfulOutputs: number;
  failedOutputs: number;
  output: any;
  outputPreview: string;
  errorMessage?: string;
}

interface PrimaryOutputInfo {
  value: string;
  confidence: string;
}

@Component({
  selector: 'app-model-benchmarking',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './model-benchmarking.component.html',
  styleUrl: './model-benchmarking.component.scss'
})
export class ModelBenchmarkingComponent implements OnInit {
  private readonly assetService = inject(AssetService);
  private readonly executionService = inject(ModelExecutionService);
  private readonly notificationService = inject(NotificationService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.runtime.managementApiUrl || 'http://localhost:3000';

  // Input mode
  inputMode: InputMode = 'single';
  sampleInput = '';
  selectedFileName = '';
  datasetBatchInputs: any[] = [];
  standardizedInputFields: SchemaField[] = [];
  standardizedInputValues: Record<string, any> = {};

  // Input validation + ad-hoc execution
  isObtainingOutputs = false;
  outputStatusMessage = 'No outputs generated yet.';
  modelInputOutputs: InputExecutionResult[] = [];
  outputMode: InputMode | null = null;
  globalDatasetDownloadFormat: DownloadFormat = 'json';
  datasetDownloadFormatByModel: Record<string, DownloadFormat> = {};
  
  // Execution state
  isRunning = false;
  statusMessage = 'Select models and configure benchmark settings to begin.';
  progress = 0;

  // Model pool
  allHttpAssets: any[] = [];
  modelPoolAssets: BenchmarkAsset[] = [];
  filteredModelPoolAssets: BenchmarkAsset[] = [];
  selectedAssetIds: string[] = [];
  isLoadingAssets = false;
  assetsError = '';

  // Search and filters
  searchKeyword = '';
  activeFilter: 'all' | 'classification' | 'regression' | 'nlp' | 'vision' = 'all';

  // Model task detection
  detectedTask: ModelTask | null = null;
  availableMetrics: string[] = [];
  selectedMetrics: string[] = [];

  // Datasets
  validationDatasetFileName = '';
  validationDatasetRows: any[] = [];
  availableDatasets: DatasetInfo[] = [];
  selectedDatasetId: string | null = null;
  
  // Ranking
  rankingRows: RankingRow[] = [];
  recommendationMetric: string = '';

  // Cost configuration ($/second)
  costPerSecond = 0.00001;
  private readonly benchmarkBatchSize = 300;
  private readonly benchmarkRequestTimeoutMs = 10000;

  // Metrics configuration by task type
  private readonly metricsConfig: { [key in ModelTask]: string[] } = {
    classification: ['AUC', 'GINI', 'Precision', 'Recall', 'F1 Score'],
    regression: ['RMSE', 'MAE', 'MSE', 'R2'],
    nlp: ['Accuracy', 'F1 Score', 'BLEU', 'Perplexity', 'ROUGE'],
    vision: ['Accuracy', 'Precision', 'Recall', 'mAP', 'IoU'],
    other: ['Accuracy', 'Custom Score']
  };

  ngOnInit(): void {
    this.loadHttpModels();
  }

  get selectedCount(): number {
    return this.selectedAssetIds.length;
  }

  get canRunBenchmark(): boolean {
    return this.selectedAssetIds.length >= 2 && 
           this.selectedMetrics.length > 0 && 
           this.validationDatasetRows.length > 0 &&
           !this.isRunning;
  }

  get canObtainOutputs(): boolean {
    const hasSingleInput = this.inputMode === 'single' && !!this.sampleInput.trim();
    const hasDatasetInput = this.inputMode === 'dataset' && this.datasetBatchInputs.length > 0;
    return this.selectedAssetIds.length > 0 &&
           !this.isRunning &&
           !this.isObtainingOutputs &&
           (hasSingleInput || hasDatasetInput);
  }

  getSelectedDatasetName(): string {
    return this.validationDatasetFileName || 'validation dataset';
  }

  loadHttpModels(): void {
    this.isLoadingAssets = true;
    this.assetsError = '';

    // Use executable models endpoint which filters by ownership and permissions
    this.http.get<any>(`${this.apiUrl}/v3/models/executable`)
      .subscribe({
        next: (response: any) => {
          const assets = response.assets || [];
          console.log('🔍 Executable models loaded:', assets.length);
          if (assets.length > 0) {
            console.log('📦 Sample asset structure:', assets[0]);
            
            // Debug dataAddress access
            const testAsset = assets[0];
            const da = testAsset['edc:dataAddress'];
            if (da) {
              console.log('🔍 DataAddress @type:', da['@type']);
              console.log('🔍 DataAddress type:', da.type);
            }
          }
          
          // Filter only HTTP models (executable endpoint already filters by permission)
          this.allHttpAssets = assets.filter((asset: any) => 
            this.isHttpModel(asset)
          );
          console.log('✅ HTTP models filtered:', this.allHttpAssets.length);
          
          // Group by task and input schema compatibility
          this.modelPoolAssets = this.processHttpModels(this.allHttpAssets);
          console.log('📊 Processed benchmark assets:', this.modelPoolAssets.length);
          
          // Initialize filtered list with all models
          this.filteredModelPoolAssets = [...this.modelPoolAssets];
          
          this.isLoadingAssets = false;
          
          if (this.modelPoolAssets.length === 0) {
            this.assetsError = 'No executable HTTP models found. Models must have execution endpoints configured.';
          }
        },
        error: (error: any) => {
          console.error('Error loading executable models:', error);
          this.assetsError = 'Unable to load models. Please ensure you are logged in.';
          this.isLoadingAssets = false;
        }
      });
  }

  private isHttpModel(asset: any): boolean {
    // New structure from /v3/models/executable has execution_endpoint directly
    const hasExecutionEndpoint = !!asset.execution_endpoint;
    
    // Fallback to old JSON-LD structure if needed
    if (!hasExecutionEndpoint) {
      const dataAddress = asset['edc:dataAddress'] || asset.dataAddress;
      const addressType = dataAddress?.['@type'] || dataAddress?.type;
      const isHttp = addressType === 'HttpData';
      
      if (!isHttp) {
        console.log(`⏩ Skipping asset ${asset['@id'] || asset.id}: no execution endpoint or not HttpData`);
      }
      return isHttp;
    }
    
    console.log(`✅ Found HTTP model: ${asset.id} with endpoint ${asset.execution_endpoint}`);
    return true;
  }

  private processHttpModels(assets: any[]): BenchmarkAsset[] {
    return assets
      .map(asset => {
        // New flat structure from /v3/models/executable
        if (asset.execution_endpoint) {
          return {
            id: asset.id,
            name: asset.name || asset.id,
            task: asset.task || 'unknown',
            subtask: asset.subtask || '',
            algorithm: asset.algorithm || 'unknown',
            inputSchema: asset.input_features || null,
            dataAddress: {
              type: 'HttpData',
              baseUrl: asset.execution_endpoint,
              method: asset.execution_method || 'POST'
            }
          };
        }
        
        // Fallback to old JSON-LD structure
        const properties = asset['edc:properties'] || asset.properties || {};
        const mlMetadata = properties['ml:metadata'] || properties.ml_metadata || {};
        const dataAddress = asset['edc:dataAddress'] || asset.dataAddress;
        const inputSchema = mlMetadata.inputFeatures || mlMetadata.input_features || null;

        return {
          id: asset['@id'] || asset.id,
          name: properties['asset:prop:name'] || asset.name || asset['@id'],
          task: mlMetadata.task || 'unknown',
          subtask: mlMetadata.subtask || '',
          algorithm: mlMetadata.algorithm || 'unknown',
          inputSchema: inputSchema,
          dataAddress: dataAddress
        };
      })
      .sort((a, b) => {
        // Sort by task first, then by name
        if (a.task !== b.task) {
          return a.task.localeCompare(b.task);
        }
        return a.name.localeCompare(b.name);
      });
  }

  toggleAssetSelection(asset: BenchmarkAsset): void {
    if (this.isAssetSelected(asset)) {
      this.selectedAssetIds = this.selectedAssetIds.filter(id => id !== asset.id);
    } else {
      const currentlySelectedModels = this.modelPoolAssets.filter(model => this.selectedAssetIds.includes(model.id));
      if (currentlySelectedModels.length > 0) {
        const referenceModel = currentlySelectedModels[0];
        if (!this.areInputsCompatible(referenceModel, asset)) {
          this.notificationService.showWarning(
            `No permitido: ${asset.name} no tiene el formato de input requerido para realizar el benchmark.`
          );
          return;
        }
      }

      this.selectedAssetIds = [...this.selectedAssetIds, asset.id];
    }

    // Update detected task and metrics when selection changes
    this.updateTaskAndMetrics();
  }

  isAssetSelected(asset: BenchmarkAsset): boolean {
    return this.selectedAssetIds.includes(asset.id);
  }

  private updateTaskAndMetrics(): void {
    if (this.selectedAssetIds.length === 0) {
      this.detectedTask = null;
      this.availableMetrics = [];
      this.selectedMetrics = [];
      this.validationDatasetRows = [];
      this.validationDatasetFileName = '';
      this.sampleInput = '';
      this.standardizedInputFields = [];
      this.standardizedInputValues = {};
      this.modelInputOutputs = [];
      this.outputMode = null;
      this.outputStatusMessage = 'No outputs generated yet.';
      return;
    }

    const selectedModels = this.modelPoolAssets.filter(m => 
      this.selectedAssetIds.includes(m.id)
    );
    console.log('🎯 Selected models:', selectedModels);

    // Only configure task and metrics on FIRST selection
    // After that, keep configuration locked until Run Benchmark
    const isFirstSelection = this.selectedAssetIds.length === 1;
    
    if (isFirstSelection || !this.detectedTask) {
      // Detect task type from selected models (including output schema analysis)
      this.detectedTask = this.detectModelTask(selectedModels);
      console.log('🎯 Detected task:', this.detectedTask);
      
      // Set available metrics based on task
      this.availableMetrics = this.metricsConfig[this.detectedTask];
      console.log('📊 Available metrics:', this.availableMetrics);
      
      // Auto-select default metrics
      if (this.selectedMetrics.length === 0) {
        this.selectedMetrics = this.availableMetrics.slice(0, 3);
      }

      // Set recommendation metric to first selected metric
      if (!this.recommendationMetric && this.selectedMetrics.length > 0) {
        this.recommendationMetric = this.selectedMetrics[0];
      }

      console.log('✅ Metrics configuration locked. Will remain until Run Benchmark is clicked.');
    }

    // Always sync a standardized single-input schema from selected models
    this.initializeStandardizedSingleInput(selectedModels);

    // Re-validate manual benchmark dataset against currently selected schema
    if (this.validationDatasetRows.length > 0) {
      this.revalidateLoadedValidationDataset(selectedModels);
    }
  }

  /**
   * Filter model pool by search keyword and active filter
   */
  filterModelPool(): void {
    let filtered = [...this.modelPoolAssets];
    
    // Apply search filter
    if (this.searchKeyword && this.searchKeyword.trim()) {
      const keyword = this.searchKeyword.toLowerCase().trim();
      filtered = filtered.filter(model => {
        const name = model.name.toLowerCase();
        const task = model.task.toLowerCase();
        const subtask = model.subtask?.toLowerCase() || '';
        const algorithm = model.algorithm.toLowerCase();
        
        return name.includes(keyword) || 
               task.includes(keyword) || 
               subtask.includes(keyword) || 
               algorithm.includes(keyword);
      });
    }
    
    // Apply task type filter
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(model => {
        const task = model.task.toLowerCase();
        
        switch (this.activeFilter) {
          case 'classification':
            return task.includes('classif');
          case 'regression':
            return task.includes('regress');
          case 'nlp':
            return task.includes('nlp') || task.includes('natural language') || 
                   task.includes('text') || task.includes('sentiment');
          case 'vision':
            return task.includes('vision') || task.includes('image') || 
                   task.includes('detection') || task.includes('computer vision');
          default:
            return true;
        }
      });
    }
    
    this.filteredModelPoolAssets = filtered;
    console.log('🔍 Filtered models:', this.filteredModelPoolAssets.length, 
                'from', this.modelPoolAssets.length);
  }

  /**
   * Set active filter and apply filtering
   */
  setFilter(filter: 'all' | 'classification' | 'regression' | 'nlp' | 'vision'): void {
    this.activeFilter = filter;
    this.filterModelPool();
  }

  /**
   * Clear search keyword and reset filter
   */
  clearSearch(): void {
    this.searchKeyword = '';
    this.filterModelPool();
  }

  /**
   * Get input schema field names from a model
   */
  private getInputFields(model: BenchmarkAsset): string[] {
    return this.getSchemaFieldsFromModel(model).map(field => field.name).sort();
  }

  /**
   * Check if two models have compatible input schemas
   */
  areInputsCompatible(model1: BenchmarkAsset, model2: BenchmarkAsset): boolean {
    const fields1 = this.getSchemaFieldsFromModel(model1);
    const fields2 = this.getSchemaFieldsFromModel(model2);

    if (fields1.length === 0 || fields2.length === 0) {
      return false;
    }

    return this.areSchemaFieldsEquivalent(fields1, fields2);
  }

  getSingleFieldInputType(field: SchemaField): string {
    if (field.type === 'number' || field.type === 'integer') {
      return 'number';
    }
    return 'text';
  }

  onSingleFieldValueChange(field: SchemaField, value: any): void {
    let normalizedValue: any = value;

    if (field.type === 'number' || field.type === 'integer') {
      if (value === '' || value === null || value === undefined) {
        normalizedValue = '';
      } else {
        const numericValue = Number(value);
        normalizedValue = Number.isNaN(numericValue)
          ? ''
          : field.type === 'integer'
            ? Math.trunc(numericValue)
            : numericValue;
      }
    } else if (field.type === 'boolean') {
      normalizedValue = value === true || value === 'true';
    } else {
      normalizedValue = value ?? '';
    }

    this.standardizedInputValues[field.name] = normalizedValue;
    this.syncSampleInputFromStandardizedValues();
  }

  getFieldConstraintsText(field: SchemaField): string {
    const constraints: string[] = [];
    constraints.push(field.type);

    if (field.required) {
      constraints.push('required');
    }

    if (field.min !== undefined) {
      constraints.push(`min ${field.min}`);
    }

    if (field.max !== undefined) {
      constraints.push(`max ${field.max}`);
    }

    return constraints.join(' • ');
  }

  private loadValidationDatasets(taskType: ModelTask): void {
    console.log('📂 Loading validation datasets for task:', taskType);
    
    this.http.get<DatasetInfo[]>(`${this.apiUrl}/v3/validation-datasets?task_type=${taskType}`)
      .subscribe({
        next: (datasets) => {
          this.availableDatasets = datasets.map(ds => ({
            id: ds.id,
            name: ds.name,
            samples: ds.samples,
            taskType: ds.taskType,
            description: ds.description,
            featuresSchema: ds.featuresSchema,
            data: ds.data,
            labelsColumn: ds.labelsColumn
          }));
          
          console.log('✅ Loaded', this.availableDatasets.length, 'datasets:', this.availableDatasets.map(d => d.name));
          
          // Auto-select first dataset if none selected
          if (this.availableDatasets.length > 0 && !this.selectedDatasetId) {
            this.selectedDatasetId = this.availableDatasets[0].id;
          }
        },
        error: (error) => {
          console.warn('⚠️ Validation datasets endpoint not available, using mock data:', error);
          // Provide mock validation datasets when backend endpoint doesn't exist
          this.availableDatasets = this.getMockDatasetsForTask(taskType);
          console.log('✅ Using', this.availableDatasets.length, 'mock datasets:', this.availableDatasets.map(d => d.name));
          
          // Auto-select first dataset
          if (this.availableDatasets.length > 0 && !this.selectedDatasetId) {
            this.selectedDatasetId = this.availableDatasets[0].id;
          }
        }
      });
  }

  private getMockDatasetsForTask(taskType: ModelTask): DatasetInfo[] {
    const mockDatasets: { [key in ModelTask]: DatasetInfo[] } = {
      classification: [
        {
          id: 'mock-ds-clf-1',
          name: 'Classification Test Set',
          samples: 500,
          taskType: 'classification',
          description: 'Balanced test dataset for binary/multiclass classification'
        },
        {
          id: 'mock-ds-clf-2',
          name: 'Classification Validation Set',
          samples: 200,
          taskType: 'classification',
          description: 'Stratified validation set for model evaluation'
        }
      ],
      regression: [
        {
          id: 'mock-ds-reg-1',
          name: 'Regression Test Set',
          samples: 400,
          taskType: 'regression',
          description: 'Continuous target values for regression metrics'
        }
      ],
      nlp: [
        {
          id: 'mock-ds-nlp-1',
          name: 'NLP Evaluation Corpus',
          samples: 1000,
          taskType: 'nlp',
          description: 'Text samples with labels for NLP task evaluation'
        },
        {
          id: 'mock-ds-nlp-2',
          name: 'Sentiment Analysis Dataset',
          samples: 800,
          taskType: 'nlp',
          description: 'Customer reviews with sentiment labels'
        }
      ],
      vision: [
        {
          id: 'mock-ds-vis-1',
          name: 'Vision Test Images',
          samples: 300,
          taskType: 'vision',
          description: 'Annotated images for computer vision evaluation'
        }
      ],
      other: [
        {
          id: 'mock-ds-gen-1',
          name: 'General Test Dataset',
          samples: 250,
          taskType: 'other',
          description: 'Generic evaluation dataset'
        }
      ]
    };
    
    return mockDatasets[taskType] || mockDatasets.other;
  }

  private detectModelTask(models: BenchmarkAsset[]): ModelTask {
    const firstModel = models[0];
    const tasks = models.map(m => m.task.toLowerCase());
    console.log('🔍 Raw tasks from models:', models.map(m => m.task));
    
    // Try to detect from output schema first (most accurate)
    const outputType = this.detectOutputType(firstModel);
    console.log('🔍 Detected output type:', outputType);
    
    if (outputType === 'binary_probability') {
      console.log('✅ Binary classification detected from output schema');
      return 'classification';
    } else if (outputType === 'multiclass_probabilities') {
      console.log('✅ Multiclass classification detected from output schema');
      return 'classification';
    } else if (outputType === 'continuous_value') {
      console.log('✅ Regression detected from output schema');
      return 'regression';
    }
    
    // Fallback: Check if all models have the same task type
    const uniqueTasks = [...new Set(tasks)];
    console.log('🔍 Unique tasks:', uniqueTasks);
    
    if (uniqueTasks.length === 1) {
      const task = uniqueTasks[0];
      
      // Direct match for Regression
      if (task.includes('regress')) return 'regression';
      
      // Match for Classification
      if (task.includes('classif')) return 'classification';
      
      // Match for NLP - 'natural language processing' or 'nlp'
      if (task.includes('natural') && task.includes('language')) return 'nlp';
      if (task.includes('nlp') || task.includes('text') || task.includes('sentiment')) return 'nlp';
      
      // Match for Vision - 'computer vision' or 'vision'
      if (task.includes('computer') && task.includes('vision')) return 'vision';
      if (task.includes('vision') || task.includes('image') || task.includes('detection')) return 'vision';
      
      // For Tabular, try to infer from subtask or algorithm
      if (task.includes('tabular')) {
        const subtask = firstModel.subtask?.toLowerCase() || '';
        const algorithm = firstModel.algorithm?.toLowerCase() || '';
        
        console.log('🔍 Tabular model detected, checking subtask:', subtask, 'algorithm:', algorithm);
        
        // Check subtask or algorithm for classification indicators
        if (subtask.includes('classif') || algorithm.includes('classif')) {
          return 'classification';
        }
        // Check for regression indicators
        if (subtask.includes('regress') || algorithm.includes('regress')) {
          return 'regression';
        }
        
        // Default Tabular to classification if uncertain
        return 'classification';
      }
    }

    // If models have different tasks or unknown
    console.log('⚠️ Unable to detect specific task, defaulting to "other"');
    return 'other';
  }

  /**
   * Analyze model output schema to determine type
   * Returns: 'binary_probability' | 'multiclass_probabilities' | 'continuous_value' | 'unknown'
   */
  private detectOutputType(model: BenchmarkAsset): string {
    const inputSchema = model.inputSchema;
    if (!inputSchema) return 'unknown';
    
    // Check for output schema information
    const outputInfo = inputSchema.output || inputSchema.outputs || inputSchema.response;
    if (outputInfo) {
      // Check for probability field (binary classification)
      if (outputInfo.probability || outputInfo.score) {
        return 'binary_probability';
      }
      // Check for probabilities array (multiclass)
      if (outputInfo.probabilities || outputInfo.class_probabilities) {
        return 'multiclass_probabilities';
      }
      // Check for continuous value (regression)
      if (outputInfo.value || outputInfo.prediction) {
        const type = outputInfo.type || '';
        if (type.includes('float') || type.includes('number') || type.includes('continuous')) {
          return 'continuous_value';
        }
      }
    }
    
    // Infer from task name
    const task = model.task.toLowerCase();
    const subtask = model.subtask?.toLowerCase() || '';
    
    // Check for classification keywords
    if (task.includes('classif') || subtask.includes('classif') || 
        task.includes('detection') || task.includes('sentiment')) {
      // Try to determine binary vs multiclass
      if (subtask.includes('binary') || subtask.includes('two-class')) {
        return 'binary_probability';
      }
      return 'multiclass_probabilities';
    }
    
    // Check for regression keywords
    if (task.includes('regress') || subtask.includes('regress') ||
        task.includes('prediction') && (subtask.includes('numeric') || subtask.includes('continuous'))) {
      return 'continuous_value';
    }
    
    return 'unknown';
  }

  private generateSampleInput(models: BenchmarkAsset[]): void {
    // Use the first model's input schema as reference
    const firstModel = models[0];
    if (!firstModel.inputSchema) {
      this.sampleInput = '{\n  "feature_1": 0.5,\n  "feature_2": 1.0\n}';
      return;
    }

    const fields = firstModel.inputSchema.fields || firstModel.inputSchema.features || [];
    const sampleObj: any = {};

    fields.forEach((field: any) => {
      const name = field.name;
      const type = field.type;

      if (type === 'string' || type === 'text') {
        sampleObj[name] = 'sample text';
      } else if (type === 'int' || type === 'integer') {
        sampleObj[name] = field.min || 0;
      } else if (type === 'float' || type === 'number') {
        sampleObj[name] = field.min || 0.0;
      } else if (type === 'boolean' || type === 'bool') {
        sampleObj[name] = true;
      } else {
        sampleObj[name] = null;
      }
    });

    this.sampleInput = JSON.stringify(sampleObj, null, 2);
  }

  getAssetMeta(asset: BenchmarkAsset): string {
    const parts = [asset.task, asset.algorithm].filter(Boolean);
    if (parts.length === 0) return 'HTTP Model';
    return parts.join(' • ');
  }

  setInputMode(mode: InputMode): void {
    this.inputMode = mode;
  }

  async handleFileSelection(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.selectedFileName = file ? file.name : '';

    if (!file) {
      this.datasetBatchInputs = [];
      return;
    }

    try {
      const content = await this.readFileAsText(file);
      const parsed = this.parseBatchInputFile(file.name, content);

      if (parsed.length === 0) {
        throw new Error('The uploaded dataset has no rows.');
      }

      this.datasetBatchInputs = parsed;
      this.outputStatusMessage = `Dataset loaded: ${parsed.length} row(s) ready for validation/execution.`;
      this.notificationService.showSuccess(`Dataset loaded (${parsed.length} rows)`);
    } catch (error: any) {
      console.error('Dataset parsing error:', error);
      this.datasetBatchInputs = [];
      this.outputStatusMessage = 'Dataset parsing failed. Please upload a valid CSV, JSON, or JSONL file.';
      this.notificationService.showError(error?.message || 'Could not parse dataset file');
    }
  }

  async handleValidationDatasetSelection(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (this.selectedAssetIds.length === 0) {
      this.notificationService.showWarning('Selecciona al menos un modelo antes de cargar el validation dataset');
      input.value = '';
      return;
    }

    const selectedModels = this.modelPoolAssets.filter(model => this.selectedAssetIds.includes(model.id));
    try {
      const content = await this.readFileAsText(file);
      const parsedRows = this.parseBatchInputFile(file.name, content);

      if (parsedRows.length === 0) {
        throw new Error('El validation dataset no contiene filas.');
      }

      const validationErrors = this.validateValidationDatasetRows(parsedRows, selectedModels);
      if (validationErrors.length > 0) {
        const firstError = validationErrors[0];
        this.notificationService.showError(`Validation dataset inválido: ${firstError}`);
        this.statusMessage = `Validation dataset inválido: ${firstError}`;
        input.value = '';
        return;
      }

      this.validationDatasetRows = parsedRows;
      this.validationDatasetFileName = file.name;
      this.statusMessage = `Validation dataset cargado y validado (${parsedRows.length} filas).`;
      this.notificationService.showSuccess(`Validation dataset válido (${parsedRows.length} filas)`);
    } catch (error: any) {
      this.validationDatasetRows = [];
      this.validationDatasetFileName = '';
      this.notificationService.showError(error?.message || 'No se pudo cargar el validation dataset');
      this.statusMessage = 'No se pudo cargar el validation dataset.';
      input.value = '';
    }
  }

  toggleMetricSelection(metric: string): void {
    if (this.selectedMetrics.includes(metric)) {
      this.selectedMetrics = this.selectedMetrics.filter(m => m !== metric);
    } else {
      this.selectedMetrics = [...this.selectedMetrics, metric];
    }

    // Update recommendation metric if current one is deselected
    if (!this.selectedMetrics.includes(this.recommendationMetric) && this.selectedMetrics.length > 0) {
      this.recommendationMetric = this.selectedMetrics[0];
    }
  }

  validateSchema(): void {
    const validation = this.validateCurrentInput();

    if (validation.isValid) {
      this.statusMessage = 'Input validated successfully against selected model schema.';
      this.outputStatusMessage = 'Input validation passed. You can now obtain outputs.';
      this.notificationService.showSuccess('Input is valid for selected model(s)');
    } else {
      const firstError = validation.errors[0] || 'Invalid input.';
      const moreErrors = validation.errors.length > 1 ? ` (+${validation.errors.length - 1} more)` : '';
      this.statusMessage = `Input validation failed: ${firstError}${moreErrors}`;
      this.outputStatusMessage = `Input validation failed: ${firstError}${moreErrors}`;
      this.notificationService.showError(`Validation failed: ${firstError}`);
    }
  }

  async obtainOutputs(): Promise<void> {
    if (!this.canObtainOutputs) {
      this.notificationService.showWarning('Select model(s) and provide input data first');
      return;
    }

    const validation = this.validateCurrentInput();
    if (!validation.isValid) {
      const firstError = validation.errors[0] || 'Invalid input.';
      this.outputStatusMessage = `Cannot execute: ${firstError}`;
      this.notificationService.showError(`Validation failed: ${firstError}`);
      return;
    }

    const selectedModels = this.modelPoolAssets.filter(model => this.selectedAssetIds.includes(model.id));
    const normalizedInput = validation.normalizedInput;

    this.isObtainingOutputs = true;
    this.modelInputOutputs = [];
    this.outputMode = this.inputMode;
    this.datasetDownloadFormatByModel = {};
    this.outputStatusMessage = 'Executing selected model(s) with Benchmark Inputs...';

    try {
      for (const model of selectedModels) {
        const startTime = Date.now();

        if (this.inputMode === 'single') {
          try {
            const execution = await this.executeModel(model.id, normalizedInput);
            const output = this.extractExecutionOutput(execution);

            this.modelInputOutputs.push({
              modelId: model.id,
              modelName: model.name,
              status: 'success',
              latencyMs: Date.now() - startTime,
              processedInputs: 1,
              successfulOutputs: 1,
              failedOutputs: 0,
              output,
              outputPreview: this.buildOutputPreview(output)
            });
          } catch (error: any) {
            this.modelInputOutputs.push({
              modelId: model.id,
              modelName: model.name,
              status: 'error',
              latencyMs: Date.now() - startTime,
              processedInputs: 1,
              successfulOutputs: 0,
              failedOutputs: 1,
              output: null,
              outputPreview: 'Execution failed.',
              errorMessage: error?.error?.message || error?.message || 'Unknown execution error'
            });
          }
        } else {
          const rows = Array.isArray(normalizedInput) ? normalizedInput : [];
          const outputs: any[] = [];
          let successfulOutputs = 0;
          let failedOutputs = 0;
          let firstErrorMessage = '';

          for (const row of rows) {
            try {
              const execution = await this.executeModel(model.id, row);
              outputs.push(this.extractExecutionOutput(execution));
              successfulOutputs += 1;
            } catch (error: any) {
              failedOutputs += 1;
              if (!firstErrorMessage) {
                firstErrorMessage = error?.error?.message || error?.message || 'Unknown execution error';
              }
            }
          }

          const status: 'success' | 'partial' | 'error' =
            failedOutputs === 0 ? 'success' : successfulOutputs > 0 ? 'partial' : 'error';

          this.modelInputOutputs.push({
            modelId: model.id,
            modelName: model.name,
            status,
            latencyMs: Date.now() - startTime,
            processedInputs: rows.length,
            successfulOutputs,
            failedOutputs,
            output: outputs,
            outputPreview: this.buildOutputPreview(outputs),
            errorMessage: firstErrorMessage || undefined
          });
        }
      }

      const successCount = this.modelInputOutputs.filter(r => r.status === 'success').length;
      const partialCount = this.modelInputOutputs.filter(r => r.status === 'partial').length;
      const errorCount = this.modelInputOutputs.filter(r => r.status === 'error').length;

      this.outputStatusMessage = `Outputs ready. Success: ${successCount}, Partial: ${partialCount}, Errors: ${errorCount}.`;
      this.notificationService.showSuccess('Model outputs generated');
    } catch (error: any) {
      console.error('Obtain outputs error:', error);
      this.outputStatusMessage = `Output execution failed: ${error?.message || 'Unknown error'}`;
      this.notificationService.showError('Failed to obtain outputs');
    } finally {
      this.isObtainingOutputs = false;
    }
  }

  async runRanking(): Promise<void> {
    if (!this.canRunBenchmark) {
      this.notificationService.showWarning('Selecciona al menos 2 modelos, 1 métrica y un validation dataset válido');
      return;
    }

    if (this.validationDatasetRows.length === 0) {
      this.notificationService.showWarning('Carga un validation dataset manual antes de ejecutar el benchmark');
      return;
    }

    this.isRunning = true;
    this.statusMessage = 'Executing benchmark with validation dataset...';
    this.progress = 0;
    this.rankingRows = [];
    
    // Reset metrics configuration lock - allow reconfiguration after this run
    console.log('🔄 Benchmark starting - metrics will be reconfigurable after completion');

    const selectedModels = this.modelPoolAssets.filter(m => 
      this.selectedAssetIds.includes(m.id)
    );

    try {
      const results: RankingRow[] = [];
      const totalModels = selectedModels.length;
      const datasetRows = this.validationDatasetRows;

      const datasetValidationErrors = this.validateValidationDatasetRows(datasetRows, selectedModels);
      if (datasetValidationErrors.length > 0) {
        throw new Error(`Validation dataset inválido: ${datasetValidationErrors[0]}`);
      }

      for (let i = 0; i < selectedModels.length; i++) {
        const model = selectedModels[i];
        this.statusMessage = `Executing ${model.name} (${i + 1}/${totalModels}) with ${datasetRows.length} validation rows...`;

        try {
          const benchmarkResult = await this.executeBenchmarkRowsForModel(
            model,
            datasetRows,
            i,
            totalModels
          );

          results.push({
            rank: 0,
            modelId: model.id,
            modelName: model.name,
            metrics: benchmarkResult.metrics,
            latency: Math.round(benchmarkResult.averageLatency),
            cost: benchmarkResult.cost
          });

        } catch (error: any) {
          console.error(`Error executing model ${model.name}:`, error);
          // Add model with failed state
          results.push({
            rank: 0,
            modelId: model.id,
            modelName: model.name,
            metrics: {},
            latency: 0,
            cost: 0
          });
        }
      }

      // Calculate composite scores and rank
      this.rankingRows = this.rankResults(results);
      this.progress = 100;
      
      this.isRunning = false;
      this.statusMessage = `Benchmark completed successfully using ${datasetRows.length} validation rows!`;
      this.notificationService.showSuccess('Benchmark completed');

    } catch (error: any) {
      console.error('Benchmark error:', error);
      this.isRunning = false;
      this.statusMessage = 'Benchmark failed: ' + error.message;
      this.notificationService.showError('Benchmark failed');
    }
  }

  private async executeBenchmarkRowsForModel(
    model: BenchmarkAsset,
    datasetRows: any[],
    modelIndex: number,
    totalModels: number
  ): Promise<{ metrics: ModelMetrics; averageLatency: number; cost: number; successCount: number }> {
    const totalRows = datasetRows.length;
    const batchSize = Math.max(1, Math.min(this.benchmarkBatchSize, totalRows));
    const totalBatches = Math.ceil(totalRows / batchSize);

    let completedRows = 0;
    let successCount = 0;
    let totalLatency = 0;
    const predictions: any[] = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEndExclusive = Math.min(batchStart + batchSize, totalRows);
      const batchRows = datasetRows.slice(batchStart, batchEndExclusive);

      this.statusMessage = `Executing ${model.name} (${modelIndex + 1}/${totalModels}) - batch ${batchIndex + 1}/${totalBatches} rows ${batchStart + 1}-${batchEndExclusive}`;

      const settledBatch = await Promise.allSettled(
        batchRows.map(async (row, rowOffset) => {
          const startedAt = Date.now();
          try {
            const result = await this.executeModel(model.id, row, this.benchmarkRequestTimeoutMs);
            return {
              rowIndex: batchStart + rowOffset,
              success: true,
              output: this.extractExecutionOutput(result),
              latencyMs: Date.now() - startedAt
            };
          } catch {
            return {
              rowIndex: batchStart + rowOffset,
              success: false,
              output: null,
              latencyMs: Date.now() - startedAt
            };
          }
        })
      );

      settledBatch.forEach((settledResult) => {
        if (settledResult.status === 'fulfilled') {
          const item = settledResult.value;
          predictions[item.rowIndex] = item.output;
          totalLatency += item.latencyMs;
          if (item.success) {
            successCount += 1;
          }
        }
      });

      completedRows = batchEndExclusive;
      const baseProgress = modelIndex / totalModels;
      const modelProgress = (completedRows / totalRows) / totalModels;
      this.progress = Math.round((baseProgress + modelProgress) * 100);
    }

    const validPredictions = predictions.filter(prediction => prediction !== null);
    const metrics = this.calculateMetrics(
      {
        predictions: validPredictions,
        processedRows: totalRows,
        successCount
      },
      this.detectedTask!
    );

    return {
      metrics,
      averageLatency: totalRows > 0 ? totalLatency / totalRows : 0,
      cost: this.calculateCost(totalLatency),
      successCount
    };
  }

  private executeModel(assetId: string, input: any, requestTimeoutMs = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const subscription = this.executionService.executeModel({
        assetId,
        input,
        options: { timeout: requestTimeoutMs }
      }).subscribe({
        next: (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(clientTimeout);
          resolve(result);
        },
        error: (error: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(clientTimeout);
          reject(error);
        }
      });

      const clientTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscription.unsubscribe();
        reject(new Error(`Execution request timeout after ${requestTimeoutMs}ms`));
      }, requestTimeoutMs + 2000);
    });
  }

  private extractExecutionOutput(executionResponse: any): any {
    if (!executionResponse) {
      return null;
    }

    if (executionResponse.status && executionResponse.status !== 'success') {
      throw new Error(executionResponse.error?.message || 'Model execution failed');
    }

    return executionResponse.output ?? executionResponse;
  }

  private buildOutputPreview(output: any): string {
    if (output === undefined || output === null) {
      return 'No output returned.';
    }

    const serialized = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    if (serialized.length <= 360) {
      return serialized;
    }

    return `${serialized.slice(0, 360)}...`;
  }

  isSingleOutputMode(): boolean {
    return this.outputMode === 'single';
  }

  isDatasetOutputMode(): boolean {
    return this.outputMode === 'dataset';
  }

  getPrimaryOutputValue(result: InputExecutionResult): string {
    const primary = this.extractPrimaryOutputInfo(result.output);
    return primary.value;
  }

  getPrimaryOutputConfidence(result: InputExecutionResult): string {
    const primary = this.extractPrimaryOutputInfo(result.output);
    return primary.confidence;
  }

  getDatasetOutputSummary(result: InputExecutionResult): string {
    if (!Array.isArray(result.output) || result.output.length === 0) {
      return 'No dataset outputs';
    }

    const first = result.output[0];
    const preview = this.extractPrimaryOutputInfo(first).value;
    return `${result.output.length} rows • First: ${preview}`;
  }

  downloadDatasetModelOutput(result: InputExecutionResult): void {
    const format = this.getDatasetDownloadFormat(result.modelId);

    if (format === 'json') {
      this.downloadDatasetModelOutputAsJson(result);
      return;
    }

    if (!Array.isArray(result.output) || result.output.length === 0) {
      this.notificationService.showWarning('No dataset outputs available for this model');
      return;
    }

    const csv = this.convertObjectsToCsv(result.output);
    this.downloadContent(
      csv,
      `${this.sanitizeFileName(result.modelName)}-dataset-outputs-${Date.now()}.csv`,
      'text/csv;charset=utf-8;'
    );
  }

  downloadDatasetModelOutputAsJson(result: InputExecutionResult): void {
    if (!Array.isArray(result.output) || result.output.length === 0) {
      this.notificationService.showWarning('No dataset outputs available for this model');
      return;
    }

    this.downloadContent(
      JSON.stringify(result.output, null, 2),
      `${this.sanitizeFileName(result.modelName)}-dataset-outputs-${Date.now()}.json`,
      'application/json;charset=utf-8;'
    );
  }

  downloadAllDatasetOutputs(): void {
    if (!this.isDatasetOutputMode() || this.modelInputOutputs.length === 0) {
      this.notificationService.showWarning('No dataset outputs available to download');
      return;
    }

    if (this.globalDatasetDownloadFormat === 'csv') {
      this.downloadAllDatasetOutputsAsCsv();
      return;
    }

    this.downloadAllDatasetOutputsAsJson();
  }

  private downloadAllDatasetOutputsAsJson(): void {
    const allResults = this.modelInputOutputs.map(result => ({
      modelId: result.modelId,
      modelName: result.modelName,
      status: result.status,
      processedInputs: result.processedInputs,
      successfulOutputs: result.successfulOutputs,
      failedOutputs: result.failedOutputs,
      latencyMs: result.latencyMs,
      outputs: Array.isArray(result.output) ? result.output : []
    }));

    this.downloadContent(
      JSON.stringify(allResults, null, 2),
      `dataset-outputs-all-models-${Date.now()}.json`,
      'application/json;charset=utf-8;'
    );
  }

  private downloadAllDatasetOutputsAsCsv(): void {
    const flattenedRows: any[] = [];

    this.modelInputOutputs.forEach(result => {
      const outputs = Array.isArray(result.output) ? result.output : [];

      outputs.forEach((outputRow, index) => {
        if (outputRow && typeof outputRow === 'object' && !Array.isArray(outputRow)) {
          flattenedRows.push({
            modelId: result.modelId,
            modelName: result.modelName,
            status: result.status,
            rowIndex: index + 1,
            ...outputRow
          });
        } else {
          flattenedRows.push({
            modelId: result.modelId,
            modelName: result.modelName,
            status: result.status,
            rowIndex: index + 1,
            outputValue: outputRow
          });
        }
      });
    });

    const csv = this.convertObjectsToCsv(flattenedRows);
    this.downloadContent(
      csv,
      `dataset-outputs-all-models-${Date.now()}.csv`,
      'text/csv;charset=utf-8;'
    );
  }

  getDatasetDownloadFormat(modelId: string): DownloadFormat {
    return this.datasetDownloadFormatByModel[modelId] || 'csv';
  }

  setDatasetDownloadFormat(modelId: string, format: DownloadFormat): void {
    this.datasetDownloadFormatByModel[modelId] = format;
  }

  private extractPrimaryOutputInfo(output: any): PrimaryOutputInfo {
    if (output === undefined || output === null) {
      return { value: 'No output', confidence: '-' };
    }

    if (Array.isArray(output)) {
      if (output.length === 0) {
        return { value: '0 rows', confidence: '-' };
      }
      return this.extractPrimaryOutputInfo(output[0]);
    }

    if (typeof output !== 'object') {
      return { value: String(output), confidence: '-' };
    }

    const priorityKeys = [
      'prediction',
      'sentiment',
      'category',
      'risk_level',
      'fraud_type',
      'decision',
      'is_fraud',
      'bmi',
      'value'
    ];

    let value = '';
    for (const key of priorityKeys) {
      if (output[key] !== undefined && output[key] !== null) {
        value = `${key}: ${String(output[key])}`;
        break;
      }
    }

    if (!value) {
      const keys = Object.keys(output);
      if (keys.length === 0) {
        value = 'Empty object';
      } else {
        const firstKey = keys[0];
        value = `${firstKey}: ${String(output[firstKey])}`;
      }
    }

    const confidenceRaw = output.confidence ?? output.probability ?? output.score ?? null;
    const confidence = typeof confidenceRaw === 'number'
      ? confidenceRaw.toFixed(3)
      : confidenceRaw !== null
        ? String(confidenceRaw)
        : '-';

    return { value, confidence };
  }

  private convertObjectsToCsv(rows: any[]): string {
    if (!rows || rows.length === 0) {
      return 'index\n';
    }

    const normalizedRows = rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return { index: index + 1, value: row };
      }
      return { index: index + 1, ...row };
    });

    const headers: string[] = Array.from<string>(
      normalizedRows.reduce((set, row) => {
        Object.keys(row).forEach(key => set.add(key));
        return set;
      }, new Set<string>())
    );

    const csvRows: string[] = [headers.join(',')];

    normalizedRows.forEach(row => {
      const values = headers.map(header => this.escapeCsvValue(row[header]));
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  private escapeCsvValue(value: any): string {
    if (value === undefined || value === null) {
      return '""';
    }

    const normalized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const escaped = normalized.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private sanitizeFileName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'model';
  }

  private downloadContent(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private validateCurrentInput(): InputValidationResult {
    if (this.selectedAssetIds.length === 0) {
      return { isValid: false, errors: ['Select at least one model first.'] };
    }

    const selectedModels = this.modelPoolAssets.filter(model => this.selectedAssetIds.includes(model.id));
    const errors: string[] = [];

    let normalizedInput: any;
    if (this.inputMode === 'single') {
      if (this.standardizedInputFields.length > 0) {
        normalizedInput = { ...this.standardizedInputValues };
        this.syncSampleInputFromStandardizedValues();
      } else {
        if (!this.sampleInput.trim()) {
          return { isValid: false, errors: ['Single input is empty.'] };
        }

        try {
          normalizedInput = JSON.parse(this.sampleInput);
        } catch {
          return { isValid: false, errors: ['Single input must be valid JSON.'] };
        }

        if (!normalizedInput || typeof normalizedInput !== 'object' || Array.isArray(normalizedInput)) {
          return { isValid: false, errors: ['Single input must be a JSON object (key-value).'] };
        }
      }
    } else {
      if (this.datasetBatchInputs.length === 0) {
        return { isValid: false, errors: ['Dataset batch has no loaded rows. Upload a valid file first.'] };
      }

      normalizedInput = this.datasetBatchInputs;
      if (!Array.isArray(normalizedInput)) {
        return { isValid: false, errors: ['Dataset batch must be an array of JSON rows.'] };
      }
    }

    for (const model of selectedModels) {
      const schemaFields = this.getModelSchemaFields(model);
      if (schemaFields.length === 0) {
        continue;
      }

      if (this.inputMode === 'single') {
        errors.push(...this.validateRecordAgainstSchema(normalizedInput, schemaFields, `${model.name}`));
      } else {
        normalizedInput.forEach((row: any, index: number) => {
          errors.push(...this.validateRecordAgainstSchema(row, schemaFields, `${model.name} row #${index + 1}`));
        });
      }
    }

    const uniqueErrors = [...new Set(errors)];
    return {
      isValid: uniqueErrors.length === 0,
      errors: uniqueErrors,
      normalizedInput
    };
  }

  private getModelSchemaFields(model: BenchmarkAsset): SchemaField[] {
    return this.getSchemaFieldsFromModel(model);
  }

  private getSchemaFieldsFromModel(model: BenchmarkAsset): SchemaField[] {
    const schema = model.inputSchema;
    if (!schema) {
      return [];
    }

    const rawFields = schema.fields || schema.features;
    if (!Array.isArray(rawFields)) {
      return [];
    }

    return rawFields
      .filter((field: any) => !!field?.name)
      .map((field: any) => ({
        name: String(field.name),
        type: this.normalizeFieldType(field.type),
        required: field.required !== false,
        min: typeof field.min === 'number' ? field.min : undefined,
        max: typeof field.max === 'number' ? field.max : undefined,
        description: field.description ? String(field.description) : undefined
      }));
  }

  private areSchemaFieldsEquivalent(fields1: SchemaField[], fields2: SchemaField[]): boolean {
    if (fields1.length !== fields2.length) {
      return false;
    }

    const sorted1 = [...fields1].sort((a, b) => a.name.localeCompare(b.name));
    const sorted2 = [...fields2].sort((a, b) => a.name.localeCompare(b.name));

    return sorted1.every((field, index) => {
      const other = sorted2[index];
      return field.name === other.name &&
             field.type === other.type &&
             field.required === other.required &&
             field.min === other.min &&
             field.max === other.max;
    });
  }

  private initializeStandardizedSingleInput(models: BenchmarkAsset[]): void {
    if (!models || models.length === 0) {
      this.standardizedInputFields = [];
      this.standardizedInputValues = {};
      this.sampleInput = '';
      return;
    }

    const referenceFields = this.getSchemaFieldsFromModel(models[0]);
    if (referenceFields.length === 0) {
      this.standardizedInputFields = [];
      this.standardizedInputValues = {};
      this.generateSampleInput(models);
      return;
    }

    const hasIncompatibleSelection = models.some(model => {
      const fields = this.getSchemaFieldsFromModel(model);
      return !this.areSchemaFieldsEquivalent(referenceFields, fields);
    });

    if (hasIncompatibleSelection) {
      this.standardizedInputFields = [];
      this.standardizedInputValues = {};
      this.sampleInput = '';
      this.statusMessage = 'Selected models do not share a unified input schema.';
      return;
    }

    this.standardizedInputFields = referenceFields;

    const nextValues: Record<string, any> = {};
    referenceFields.forEach(field => {
      const existing = this.standardizedInputValues[field.name];
      const hasExistingValue = existing !== undefined && existing !== null && existing !== '';

      if (hasExistingValue) {
        nextValues[field.name] = existing;
      } else {
        nextValues[field.name] = this.getDefaultValueForSchemaField(field);
      }
    });

    this.standardizedInputValues = nextValues;
    this.syncSampleInputFromStandardizedValues();
  }

  private getDefaultValueForSchemaField(field: SchemaField): any {
    if (field.type === 'boolean') {
      return false;
    }

    if (field.type === 'integer') {
      if (field.min !== undefined) return Math.trunc(field.min);
      return 0;
    }

    if (field.type === 'number') {
      if (field.min !== undefined) return field.min;
      return 0;
    }

    return '';
  }

  private syncSampleInputFromStandardizedValues(): void {
    this.sampleInput = JSON.stringify(this.standardizedInputValues, null, 2);
  }

  private normalizeFieldType(type: any): string {
    const normalized = String(type || 'string').toLowerCase();
    if (normalized === 'float' || normalized === 'double' || normalized === 'number' || normalized === 'numeric') return 'number';
    if (normalized === 'int' || normalized === 'integer' || normalized === 'long') return 'integer';
    if (normalized === 'bool' || normalized === 'boolean') return 'boolean';
    return 'string';
  }

  private validateRecordAgainstSchema(record: any, schemaFields: SchemaField[], context: string): string[] {
    const errors: string[] = [];

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return [`${context}: input must be a JSON object.`];
    }

    for (const field of schemaFields) {
      const value = record[field.name];
      const hasValue = value !== undefined && value !== null && value !== '';

      if (field.required && !hasValue) {
        errors.push(`${context}: required field "${field.name}" is missing.`);
        continue;
      }

      if (!hasValue) {
        continue;
      }

      if (field.type === 'string' && typeof value !== 'string') {
        errors.push(`${context}: field "${field.name}" must be string.`);
      }

      if (field.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${context}: field "${field.name}" must be boolean.`);
      }

      if (field.type === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`${context}: field "${field.name}" must be number/float.`);
          continue;
        }

        if (field.min !== undefined && value < field.min) {
          errors.push(`${context}: field "${field.name}" must be >= ${field.min}.`);
        }

        if (field.max !== undefined && value > field.max) {
          errors.push(`${context}: field "${field.name}" must be <= ${field.max}.`);
        }
      }

      if (field.type === 'integer') {
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isInteger(value)) {
          errors.push(`${context}: field "${field.name}" must be integer.`);
          continue;
        }

        if (field.min !== undefined && value < field.min) {
          errors.push(`${context}: field "${field.name}" must be >= ${field.min}.`);
        }

        if (field.max !== undefined && value > field.max) {
          errors.push(`${context}: field "${field.name}" must be <= ${field.max}.`);
        }
      }
    }

    return errors;
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read file content.'));
      reader.readAsText(file);
    });
  }

  private parseBatchInputFile(fileName: string, content: string): any[] {
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.jsonl')) {
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => !!line)
        .map((line, index) => {
          try {
            return JSON.parse(line);
          } catch {
            throw new Error(`JSONL parse error at line ${index + 1}.`);
          }
        });
    }

    if (lowerName.endsWith('.json')) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) {
          return parsed.data;
        }
        return [parsed];
      }

      throw new Error('JSON dataset must be an object or an array of objects.');
    }

    if (lowerName.endsWith('.csv')) {
      return this.parseCsvToObjects(content);
    }

    throw new Error('Unsupported file format. Use CSV, JSON, or JSONL.');
  }

  private parseCsvToObjects(content: string): any[] {
    const lines = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => !!line);

    if (lines.length < 2) {
      throw new Error('CSV dataset must include header and at least one data row.');
    }

    const headers = this.splitCsvLine(lines[0]).map(h => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const columns = this.splitCsvLine(lines[i]);
      const row: any = {};

      headers.forEach((header, index) => {
        const rawValue = columns[index] ?? '';
        row[header] = this.coerceCsvValue(rawValue);
      });

      rows.push(row);
    }

    return rows;
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === ',' && !insideQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  private coerceCsvValue(rawValue: string): any {
    const trimmed = rawValue.trim();

    if (trimmed === '') return '';
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed !== '') {
      return numeric;
    }

    return trimmed;
  }

  private calculateCost(latencyMs: number): number {
    const seconds = latencyMs / 1000;
    return seconds * this.costPerSecond;
  }

  private calculateMetrics(result: any, taskType: ModelTask): ModelMetrics {
    // TODO: Use actual validation dataset to calculate real metrics
    // For now, using simulated metrics. Future implementation will:
    // 1. Get the selected validation dataset from this.availableDatasets
    // 2. Run predictions on all samples from dataset.data
    // 3. Compare predictions with ground truth (dataset.labelsColumn)
    // 4. Calculate real metrics (AUC, RMSE, Precision, etc.)
    
    const selectedDatasetName = this.validationDatasetFileName || 'manual validation dataset';
    console.log('📊 Calculating metrics for task:', taskType);
    console.log('📊 Selected metrics:', this.selectedMetrics);
    console.log('📊 Using dataset:', selectedDatasetName, 'with', this.validationDatasetRows.length, 'samples');
    
    // Simulated metrics - only calculate the ones that are selected
    const metrics: ModelMetrics = {};

    // Generate values for each selected metric
    this.selectedMetrics.forEach(metric => {
      switch (metric) {
        // Classification metrics
        case 'AUC':
          metrics['AUC'] = 0.85 + Math.random() * 0.10;
          break;
        case 'GINI':
          const auc = metrics['AUC'] || (0.85 + Math.random() * 0.10);
          metrics['GINI'] = 2 * auc - 1;
          break;
        case 'Precision':
          metrics['Precision'] = 0.80 + Math.random() * 0.15;
          break;
        case 'Recall':
          metrics['Recall'] = 0.75 + Math.random() * 0.20;
          break;
        case 'F1 Score':
          const precision = metrics['Precision'] || (0.80 + Math.random() * 0.15);
          const recall = metrics['Recall'] || (0.75 + Math.random() * 0.20);
          metrics['F1 Score'] = 2 * (precision * recall) / (precision + recall);
          break;
        
        // Regression metrics
        case 'RMSE':
          metrics['RMSE'] = 0.5 + Math.random() * 2.0;
          break;
        case 'MAE':
          metrics['MAE'] = 0.3 + Math.random() * 1.5;
          break;
        case 'MSE':
          const rmse = metrics['RMSE'] || (0.5 + Math.random() * 2.0);
          metrics['MSE'] = rmse ** 2;
          break;
        case 'R2':
          metrics['R2'] = 0.70 + Math.random() * 0.25;
          break;
        
        // NLP metrics
        case 'BLEU':
          metrics['BLEU'] = 0.40 + Math.random() * 0.30;
          break;
        case 'Perplexity':
          metrics['Perplexity'] = 20 + Math.random() * 30;
          break;
        case 'ROUGE':
          metrics['ROUGE'] = 0.50 + Math.random() * 0.35;
          break;
        
        // Vision metrics
        case 'mAP':
          metrics['mAP'] = 0.65 + Math.random() * 0.30;
          break;
        case 'IoU':
          metrics['IoU'] = 0.60 + Math.random() * 0.35;
          break;
        
        // Common metrics
        case 'Accuracy':
          metrics['Accuracy'] = 0.75 + Math.random() * 0.20;
          break;
        case 'Custom Score':
          metrics['Custom Score'] = Math.random();
          break;
        
        default:
          metrics[metric] = 0.70 + Math.random() * 0.25;
      }
    });

    console.log('✅ Generated metrics:', metrics);
    return metrics;
  }

  private rankResults(results: RankingRow[]): RankingRow[] {
    // Calculate composite score based on recommendation metric
    results.forEach(row => {
      const metricValue = row.metrics[this.recommendationMetric] || 0;
      
      // For metrics where lower is better (RMSE, MAE, MSE, Perplexity)
      const lowerIsBetter = ['RMSE', 'MAE', 'MSE', 'Perplexity'].includes(this.recommendationMetric);
      
      // Normalize latency and cost (lower is better)
      const maxLatency = Math.max(...results.map(r => r.latency));
      const normalizedLatency = 1 - (row.latency / maxLatency);
      
      const maxCost = Math.max(...results.map(r => r.cost));
      const normalizedCost = 1 - (row.cost / maxCost);
      
      // Composite score: 60% metric, 25% latency, 15% cost
      let normalizedMetric = metricValue;
      if (lowerIsBetter) {
        const maxMetric = Math.max(...results.map(r => r.metrics[this.recommendationMetric] || 0));
        normalizedMetric = 1 - (metricValue / maxMetric);
      }
      
      row.compositeScore = (normalizedMetric * 0.6) + (normalizedLatency * 0.25) + (normalizedCost * 0.15);
    });

    // Sort by composite score (higher is better)
    const sorted = results.sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0));
    
    // Assign ranks and mark top
    sorted.forEach((row, index) => {
      row.rank = index + 1;
      row.top = index === 0;
    });

    return sorted;
  }

  getTopModel(): RankingRow | null {
    return this.rankingRows.find(row => row.top) || null;
  }

  getBestModelByMetric(): RankingRow | null {
    if (this.rankingRows.length === 0) return null;
    
    // Sort by the selected recommendation metric
    const lowerIsBetter = ['RMSE', 'MAE', 'MSE', 'Perplexity'].includes(this.recommendationMetric);
    
    const sorted = [...this.rankingRows].sort((a, b) => {
      const aValue = a.metrics[this.recommendationMetric] || 0;
      const bValue = b.metrics[this.recommendationMetric] || 0;
      
      if (lowerIsBetter) {
        return aValue - bValue; // Menor es mejor
      } else {
        return bValue - aValue; // Mayor es mejor
      }
    });
    
    return sorted[0];
  }

  formatMetricValue(value: number, metric: string): string {
    if (['RMSE', 'MAE', 'MSE'].includes(metric)) {
      return value.toFixed(4);
    }
    return value.toFixed(3);
  }

  formatCost(cost: number): string {
    return `$${cost.toFixed(6)}`;
  }

  formatLatency(ms: number): string {
    return `${ms}ms`;
  }

  exportResults(): void {
    if (this.rankingRows.length === 0) {
      console.warn('⚠️ No ranking results to export');
      return;
    }

    // Build CSV header
    const headers = ['Rank', 'Model Name', 'Model ID'];
    this.selectedMetrics.forEach(metric => headers.push(metric));
    headers.push('Latency (ms)', 'Cost ($)', 'Composite Score');

    // Build CSV rows
    const csvRows: string[] = [headers.join(',')];
    
    this.rankingRows.forEach(row => {
      const rowData: string[] = [
        row.rank.toString(),
        `"${row.modelName}"`,
        `"${row.modelId}"`
      ];

      // Add metric values
      this.selectedMetrics.forEach(metric => {
        const value = row.metrics[metric];
        rowData.push(value !== undefined ? value.toFixed(4) : 'N/A');
      });

      // Add performance metrics
      rowData.push(row.latency.toFixed(2));
      rowData.push(row.cost.toFixed(6));
      rowData.push((row.compositeScore || 0).toFixed(4));

      csvRows.push(rowData.join(','));
    });

    // Add metadata footer
    csvRows.push('');
    csvRows.push(`Generated,${new Date().toISOString()}`);
    csvRows.push(`Task Type,${this.detectedTask || 'Unknown'}`);
    csvRows.push(`Dataset,${this.validationDatasetFileName || 'N/A'}`);
    csvRows.push(`Validation Rows,${this.validationDatasetRows.length}`);
    csvRows.push(`Models Compared,${this.rankingRows.length}`);

    // Create and download file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `model-benchmark-results-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ Benchmark results exported successfully');
  }

  private validateValidationDatasetRows(rows: any[], selectedModels: BenchmarkAsset[]): string[] {
    if (!Array.isArray(rows) || rows.length === 0) {
      return ['El validation dataset debe contener al menos una fila.'];
    }

    const errors: string[] = [];
    for (const model of selectedModels) {
      const schemaFields = this.getModelSchemaFields(model);
      if (schemaFields.length === 0) {
        continue;
      }

      rows.forEach((row, index) => {
        errors.push(...this.validateRecordAgainstSchema(row, schemaFields, `${model.name} row #${index + 1}`));
      });
    }

    return [...new Set(errors)];
  }

  private revalidateLoadedValidationDataset(selectedModels: BenchmarkAsset[]): void {
    const errors = this.validateValidationDatasetRows(this.validationDatasetRows, selectedModels);
    if (errors.length > 0) {
      this.validationDatasetRows = [];
      const previousFileName = this.validationDatasetFileName;
      this.validationDatasetFileName = '';
      this.notificationService.showWarning(
        `Se descartó el validation dataset (${previousFileName}) porque no coincide con el formato de input actual.`
      );
    }
  }
}
