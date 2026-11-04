import type {Media} from '../native/contracts';
import {TryOnError} from './errors';

/** S11 approval covers the native exporter, GPS removal, watermark and metadata preservation together. */
export type ProvenanceApproval = Readonly<{
  evidencePath: string;
  exporterVersion: string;
  gpsRemoved: true;
  watermarkPreserved: true;
  provenancePreserved: true;
}>;
export type ResultExportPolicy = Readonly<{
  enabled: boolean;
  exporterVersion: string;
  approval: ProvenanceApproval | null;
}>;
export const resultExportPolicy: ResultExportPolicy = Object.freeze({enabled: false, exporterVersion: 'unverified', approval: null});

export function createResultExporter(media: Pick<Media, 'exportResult'>, policy: ResultExportPolicy = resultExportPolicy) {
  // Capture an immutable approval. Later mutation cannot silently enable downloads.
  const approved = policy.approval;
  const enabled = policy.enabled;
  const verified = !!approved && !!approved.evidencePath.trim() &&
    approved.exporterVersion === policy.exporterVersion && policy.exporterVersion !== 'unverified' &&
    approved.gpsRemoved === true && approved.watermarkPreserved === true && approved.provenancePreserved === true;
  return async (resultId: string): Promise<{uri: string}> => {
    if (!enabled) throw new TryOnError('result_download_disabled');
    if (!verified) throw new TryOnError('provenance_unverified');
    return media.exportResult({resultId});
  };
}
