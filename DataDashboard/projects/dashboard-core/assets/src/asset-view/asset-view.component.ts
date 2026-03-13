/*
 *  Copyright (c) 2025 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.
 *
 *  This program and the accompanying materials are made available under the
 *  terms of the Apache License, Version 2.0 which is available at
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 *  SPDX-License-Identifier: Apache-2.0
 *
 *  Contributors:
 *       Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V. - initial API and implementation
 *
 */

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AssetService } from '../asset.service';
import { AsyncPipe } from '@angular/common';
import { Asset, IdResponse } from '@think-it-labs/edc-connector-client';
import { from, map, Observable, of, Subject, takeUntil } from 'rxjs';
import {
  DashboardStateService,
  DeleteConfirmComponent,
  FilterInputComponent,
  ItemCountSelectorComponent,
  JsonldViewerComponent,
  ModalAndAlertService,
  PaginationComponent,
} from '@eclipse-edc/dashboard-core';
import { AssetCreateComponent } from '../asset-create/asset-create.component';
import { AssetCardComponent } from '../asset-card/asset-card.component';

const DAIMO_FILTER_KEYS = [
  'daimo:short_description',
  'https://pionera.ai/edc/daimo#short_description',
  'daimo:model_version',
  'https://pionera.ai/edc/daimo#model_version',
  'daimo:pipeline_tag',
  'https://pionera.ai/edc/daimo#pipeline_tag',
  'daimo:modality',
  'https://pionera.ai/edc/daimo#modality',
  'daimo:tags',
  'https://pionera.ai/edc/daimo#tags',
  'daimo:license',
  'https://pionera.ai/edc/daimo#license',
  'daimo:maturity_status',
  'https://pionera.ai/edc/daimo#maturity_status',
  'daimo:library_name',
  'https://pionera.ai/edc/daimo#library_name',
  'daimo:language',
  'https://pionera.ai/edc/daimo#language',
  'daimo:architecture_family',
  'https://pionera.ai/edc/daimo#architecture_family',
  'daimo:base_model',
  'https://pionera.ai/edc/daimo#base_model',
  'daimo:format',
  'https://pionera.ai/edc/daimo#format',
  'daimo:inference_path',
  'https://pionera.ai/edc/daimo#inference_path',
  'daimo:parameter_count',
  'https://pionera.ai/edc/daimo#parameter_count',
  'daimo:artifact_size_mb',
  'https://pionera.ai/edc/daimo#artifact_size_mb',
  'daimo:quantization',
  'https://pionera.ai/edc/daimo#quantization',
  'daimo:performance_metric',
  'https://pionera.ai/edc/daimo#performance_metric',
  'daimo:performance_dataset',
  'https://pionera.ai/edc/daimo#performance_dataset',
  'daimo:datasets',
  'https://pionera.ai/edc/daimo#datasets',
  'daimo:performance_report',
  'https://pionera.ai/edc/daimo#performance_report',
  'daimo:intended_use',
  'https://pionera.ai/edc/daimo#intended_use',
  'daimo:limitations',
  'https://pionera.ai/edc/daimo#limitations',
  'daimo:pii_safe',
  'https://pionera.ai/edc/daimo#pii_safe',
  'daimo:regulated_domain',
  'https://pionera.ai/edc/daimo#regulated_domain',
  'daimo:human_in_the_loop_required',
  'https://pionera.ai/edc/daimo#human_in_the_loop_required',
  'daimo:latency_p95_ms',
  'https://pionera.ai/edc/daimo#latency_p95_ms',
  'daimo:throughput_rps',
  'https://pionera.ai/edc/daimo#throughput_rps',
  'daimo:rate_limits',
  'https://pionera.ai/edc/daimo#rate_limits',
  'daimo:availability_tier',
  'https://pionera.ai/edc/daimo#availability_tier',
];

@Component({
  selector: 'lib-asset-view',
  standalone: true,
  imports: [AsyncPipe, FilterInputComponent, PaginationComponent, AssetCardComponent, ItemCountSelectorComponent],
  templateUrl: './asset-view.component.html',
  styleUrl: './asset-view.component.css',
})
export class AssetViewComponent implements OnInit, OnDestroy {
  private readonly assetService = inject(AssetService);
  private readonly modalAndAlertService = inject(ModalAndAlertService);
  private readonly stateService = inject(DashboardStateService);

  private readonly destroy$ = new Subject<void>();

  assets$: Observable<Asset[]> = of([]);
  filteredAssets$: Observable<Asset[]> = of([]);
  pageAssets$: Observable<Asset[]> = of([]);
  fetched = false;
  pageItemCount = 15;

  constructor() {
    this.stateService.currentEdcConfig$.pipe(takeUntil(this.destroy$)).subscribe(this.fetchAssets.bind(this));
  }

  async ngOnInit() {
    this.fetchAssets();
  }

  filter(searchText: string) {
    if (searchText) {
      const lower = searchText.toLowerCase();
      this.filteredAssets$ = this.assets$.pipe(
        map(assets =>
          assets.filter(asset => this.matchesFilter(asset, lower)),
        ),
      );
    } else {
      this.filteredAssets$ = this.assets$;
    }
  }

  paginationEvent(pageItems: Asset[]) {
    this.pageAssets$ = of(pageItems);
  }

  createAsset() {
    const callbacks = {
      created: (id: IdResponse) => {
        this.modalAndAlertService.closeModal();
        this.modalAndAlertService.showAlert(`Asset with ID '${id.id}'`, 'created successfully', 'success', 5);
        this.fetchAssets();
      },
    };
    this.modalAndAlertService.openModal(AssetCreateComponent, undefined, callbacks);
  }

  editAsset(asset: Asset) {
    const callbacks = {
      updated: () => {
        this.modalAndAlertService.closeModal();
        this.modalAndAlertService.showAlert(`Asset with ID '${asset.id}'`, 'updated successfully', 'success', 5);
        this.fetchAssets();
      },
    };
    this.modalAndAlertService.openModal(AssetCreateComponent, { asset: asset }, callbacks);
  }

  deleteAsset(asset: Asset) {
    this.modalAndAlertService.openModal(
      DeleteConfirmComponent,
      {
        customText: 'Do you really want to delete this Asset?',
        componentType: AssetCardComponent,
        componentInputs: { asset: asset, showButtons: false },
      },
      {
        canceled: () => this.modalAndAlertService.closeModal(),
        confirm: () => {
          this.modalAndAlertService.closeModal();
          this.assetService
            .deleteAsset(asset.id)
            .then(() => {
              const msg = `Asset '${asset.id}' deleted successfully`;
              this.modalAndAlertService.showAlert(msg, undefined, 'success', 5);
              this.fetchAssets();
            })
            .catch(error => {
              console.error(error);
              const msg = `Deletion of asset '${asset.id}' failed`;
              this.modalAndAlertService.showAlert(msg, undefined, 'error', 5);
            });
        },
      },
    );
  }

  openDetails(asset: Asset) {
    this.modalAndAlertService.openModal(JsonldViewerComponent, { jsonLdObject: asset });
  }

  private fetchAssets() {
    this.fetched = false;
    this.assets$ = this.filteredAssets$ = of([]);
    this.assets$ = this.filteredAssets$ = from(this.assetService.getAllAssets().finally(() => (this.fetched = true)));
  }

  private matchesFilter(asset: Asset, lowerQuery: string): boolean {
    const id = (asset.id || '').toLowerCase();
    const name = (asset.properties.optionalValue<string>('edc', 'name') || '').toLowerCase();
    const contentType = (asset.properties.optionalValue<string>('edc', 'contenttype') || '').toLowerCase();
    const dataAddressType = (asset.dataAddress.mandatoryValue<string>('edc', 'type') || '').toLowerCase();
    if (
      id.includes(lowerQuery) ||
      name.includes(lowerQuery) ||
      contentType.includes(lowerQuery) ||
      dataAddressType.includes(lowerQuery)
    ) {
      return true;
    }

    const mlMetadata = this.getMlMetadataValues(asset);
    return mlMetadata.some(value => value.toLowerCase().includes(lowerQuery));
  }

  private getMlMetadataValues(asset: Asset): string[] {
    const properties = asset.properties as unknown as Record<string, unknown>;
    const values: string[] = [];
    DAIMO_FILTER_KEYS.forEach(key => {
      values.push(...this.extractStrings(properties[key]));
    });
    return values;
  }

  private extractStrings(value: unknown): string[] {
    if (value == null) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap(item => this.extractStrings(item));
    }
    if (typeof value === 'string') {
      return value.trim().length > 0 ? [value.trim()] : [];
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return [String(value)];
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record['@value'] !== undefined) {
        return this.extractStrings(record['@value']);
      }
      return [];
    }
    return [];
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
