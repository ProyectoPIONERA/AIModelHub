import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalAndAlertService } from '@eclipse-edc/dashboard-core';
import { CatalogService } from '@eclipse-edc/dashboard-core/catalog';
import { IdResponse } from '@think-it-labs/edc-connector-client';

@Component({
  selector: 'app-ml-negotiation-progress',
  standalone: true,
  imports: [NgClass],
  templateUrl: './ml-negotiation-progress.component.html',
})
export class MlNegotiationProgressComponent implements OnChanges, OnDestroy {
  private readonly catalogService = inject(CatalogService);
  private readonly modalAndAlertService = inject(ModalAndAlertService);
  private readonly router = inject(Router);

  @Input() negotiationId!: IdResponse;
  @Input() pullIntervalMs = 500;
  @Output() stateChanged = new EventEmitter<string>();

  polling = true;
  currentState?: string;
  stateHistory: string[] = [];
  happyPathStates: string[] = ['INITIAL', 'REQUESTED', 'OFFERED', 'ACCEPTED', 'AGREED', 'VERIFIED', 'FINALIZED'];
  happyPath = true;
  exceptionStates: string[] = ['TERMINATED'];
  errorMsg?: string;

  private statusJob?: ReturnType<typeof setInterval>;

  async ngOnChanges(): Promise<void> {
    if (!this.negotiationId?.id) {
      return;
    }

    this.currentState = (await this.catalogService.getNegotiationState(this.negotiationId.id)).state;
    this.emitState(this.currentState);
    if (this.stateHistory.length === 0) {
      this.stateHistory.push(this.currentState);
    }
    this.stopStatusJob();
    this.startStatusJob();
  }

  ngOnDestroy(): void {
    this.stopStatusJob();
  }

  navigateToContracts(): void {
    this.modalAndAlertService.closeModal();
    this.router.navigate(['/contracts']);
  }

  private startStatusJob(): void {
    this.statusJob = setInterval(() => {
      void this.pullStatus();
    }, this.pullIntervalMs);
    this.polling = true;
  }

  private stopStatusJob(): void {
    if (!this.statusJob) {
      return;
    }
    clearInterval(this.statusJob);
    this.statusJob = undefined;
    this.polling = false;
  }

  private async pullStatus(): Promise<void> {
    try {
      this.currentState = (await this.catalogService.getNegotiationState(this.negotiationId.id)).state;
      this.emitState(this.currentState);

      if (this.stateHistory.length !== 0 && this.stateHistory[this.stateHistory.length - 1] === this.currentState) {
        return;
      }

      this.stateHistory.push(this.currentState);
      if (this.happyPath) {
        if (this.exceptionStates.includes(this.currentState)) {
          this.happyPath = false;
          this.stopStatusJob();
        } else {
          this.stateHistory = this.happyPathStates.slice(0, this.happyPathStates.indexOf(this.currentState) + 1);
        }
      }

      if (this.currentState === 'FINALIZED') {
        this.stopStatusJob();
      }
    } catch (error) {
      this.errorMsg = (error as Error)?.message || 'Error fetching contract negotiation status.';
      this.stopStatusJob();
    }
  }

  private emitState(state?: string): void {
    if (state) {
      this.stateChanged.emit(state);
    }
  }
}
