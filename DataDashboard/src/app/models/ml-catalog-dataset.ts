import { JsonLdObject } from '@think-it-labs/edc-connector-client';
import { Policy } from '@think-it-labs/edc-connector-client/dist/src/entities/policy';

export interface MlCatalogDataset {
  id: string;
  participantId: string;
  assetId: string;
  dataset: JsonLdObject;
  offers: Map<string, Policy>;
  originator: string;
}
