import type {DeviceError} from '../native/contracts';

const messages: Record<string, string> = {
  invalid_composition: 'Choose one saved shop piece and up to five different companion pieces.',
  companion_limit: 'Up to 5 companion pieces. Remove one to add another.',
  invalid_reference: 'A selected piece is no longer available.',
  self_photo_required: 'Add your photo before generating a look.',
  masking_failed: 'Retake your photo with your full head and body visible.',
  self_photo_changed: 'Your photo changed. Please generate again.',
  unsafe_output: 'This look could not be safely displayed. Please try again.',
  busy: 'Please wait for the current operation to finish.',
  offline: 'Connect to the internet to generate a look.',
  cancelled: 'Generation cancelled.',
  content_policy_violation: 'This request could not be generated under the image policy.',
  result_download_disabled: 'Result downloads are not available yet.',
  provenance_unverified: 'Result download preservation has not been verified.',
  io_error: 'An image could not be read or saved.',
};

export class TryOnError extends Error implements DeviceError {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable = false) {
    super(messages[code] ?? 'The look could not be generated. Please try again.');
    this.name = 'TryOnError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function safeError(error: unknown): DeviceError {
  const code = typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string' && /^[a-z_]{1,64}$/.test(error.code) ? error.code : 'io_error';
  const retryable = typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === true;
  const safe = new TryOnError(code, retryable);
  return {code: safe.code, message: safe.message, retryable: safe.retryable};
}
