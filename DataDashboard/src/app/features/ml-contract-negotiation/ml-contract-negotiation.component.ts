import { AsyncPipe, NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonValue } from '@angular-devkit/core';
import { AlertComponent, JsonObjectTableComponent } from '@eclipse-edc/dashboard-core';
import { CatalogService } from '@eclipse-edc/dashboard-core/catalog';
import { BehaviorSubject } from 'rxjs';
import { compact, EdcConnectorClientError, IdResponse } from '@think-it-labs/edc-connector-client';
import { ContractNegotiationRequest } from '@think-it-labs/edc-connector-client/dist/src/entities';
import { MlCatalogDataset } from '../../models/ml-catalog-dataset';

@Component({
  selector: 'app-ml-contract-negotiation',
  standalone: true,
  imports: [FormsModule, AlertComponent, JsonObjectTableComponent, NgClass, AsyncPipe],
  templateUrl: './ml-contract-negotiation.component.html',
})
export class MlContractNegotiationComponent implements OnChanges {
  private readonly catalogService = inject(CatalogService);

  @Input() catalogDataset!: MlCatalogDataset;
  @Output() negotiationRequested = new EventEmitter<IdResponse>();

  dataset: Record<string, JsonValue> = {};
  catalog: Record<string, JsonValue> = {};
  errorMsg = '';
  offerId = '';
  selectedOffer = new BehaviorSubject<string[]>(['']);

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['catalogDataset']) {
      await this.loadDataset();
    }
  }

  startNegotiation(): void {
    const policy = this.catalogDataset.offers.get(this.offerId);

    if (!policy) {
      this.errorMsg = 'No offer selected!';
      return;
    }

    const request: ContractNegotiationRequest = {
      counterPartyAddress: this.catalogDataset.originator,
      policy,
    };

    this.catalogService
      .initiateNegotiation(request)
      .then((idResponse: IdResponse) => this.negotiationRequested.emit(idResponse))
      .catch((error: EdcConnectorClientError) => {
        this.errorMsg = error.message;
      });
  }

  showOfferDetails(selectedOfferId: string): void {
    const policy = this.catalogDataset.offers.get(selectedOfferId);

    if (!policy) {
      return;
    }

    const excludedProperties = ['@context', 'assigner', '@type', 'target'];
    const offer = JSON.stringify(
      policy,
      (key, value) => (excludedProperties.includes(key) ? undefined : value),
      2,
    ).split('\n');

    this.selectedOffer.next(offer);
  }

  get offerKeys(): string[] {
    return Array.from(this.catalogDataset.offers.keys());
  }

  private async loadDataset(): Promise<void> {
    try {
      this.dataset = await compact(this.catalogDataset.dataset);
      this.catalog = this.getCatalogAsRecord();
    } catch (error) {
      this.errorMsg = (error as Error)?.message || 'Failed to load catalog dataset details.';
    }
  }

  private getCatalogAsRecord(): Record<string, JsonValue> {
    return {
      id: this.catalogDataset.id,
      participantId: this.catalogDataset.participantId,
      originator: this.catalogDataset.originator,
    };
  }
}
