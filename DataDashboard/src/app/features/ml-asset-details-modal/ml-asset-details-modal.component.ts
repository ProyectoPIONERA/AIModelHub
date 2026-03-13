import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { JsonldViewerComponent } from '@eclipse-edc/dashboard-core';
import { Dataset, JsonLdObject, expand } from '@think-it-labs/edc-connector-client';
import { CatalogService } from '@eclipse-edc/dashboard-core/catalog';
import { MlGuiAsset } from '../../models/ml-gui-asset';

@Component({
  selector: 'app-ml-asset-details-modal',
  standalone: true,
  imports: [CommonModule, JsonldViewerComponent],
  templateUrl: './ml-asset-details-modal.component.html',
})
export class MlAssetDetailsModalComponent implements OnChanges {
  private readonly catalogService = inject(CatalogService);

  @Input() asset?: MlGuiAsset;

  selectedTab: 'overview' | 'offers' | 'raw' = 'overview';
  rawJsonLdPayload: JsonLdObject = new JsonLdObject();

  asJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  get offers(): unknown[] {
    return Array.isArray(this.asset?.contractOffers) ? this.asset!.contractOffers! : [];
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (!changes['asset']) {
      return;
    }

    this.rawJsonLdPayload = await this.resolveRawPayload();
  }

  private async resolveRawPayload(): Promise<JsonLdObject> {
    const fallbackPayload = (this.asset?.assetData || this.asset?.rawProperties || {}) as Record<string, unknown>;

    if (!this.asset || this.asset.isLocal || !this.asset.counterPartyAddress) {
      return this.expandFallbackPayload(fallbackPayload);
    }

    try {
      const catalogDatasets = await this.catalogService.getCatalogDataset({
        counterPartyAddress: this.asset.counterPartyAddress,
      });
      const matchedCatalogDataset = catalogDatasets.find(catalogDataset => catalogDataset.assetId === this.asset?.id);
      if (matchedCatalogDataset?.dataset) {
        return matchedCatalogDataset.dataset as unknown as JsonLdObject;
      }
    } catch {
      // Falls back to local payload expansion below.
    }

    return this.expandFallbackPayload(fallbackPayload);
  }

  private async expandFallbackPayload(payload: Record<string, unknown>): Promise<JsonLdObject> {
    try {
      return await expand(payload, () => new Dataset());
    } catch {
      return payload as unknown as JsonLdObject;
    }
  }
}
