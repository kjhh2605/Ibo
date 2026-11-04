import {isGarmentSlot} from '../category';
import type {GarmentSlot} from '../category';
import type {FileRef, ResultPieceSnapshot} from '../native/contracts';
import type {RelayRequest} from '../relay/client';
import type {UploadImageReader} from '../relay/selfPhoto';
import {TryOnError} from './errors';

export type PreparedResult = {draftId: string; targetSnapshot: ResultPieceSnapshot; companionSnapshots: ResultPieceSnapshot[]};
export type TryOnRequest = RelayRequest<'/v1/tryon'>;

/** No raw self, head mask, shop, origin, coordinate, or local identifier enters the wire object. */
export async function serializeTryOn(
  maskedFile: FileRef,
  prepared: PreparedResult,
  readImage: UploadImageReader,
  signal: AbortSignal,
): Promise<TryOnRequest> {
  const pieces = [prepared.targetSnapshot, ...prepared.companionSnapshots];
  const slots = pieces.map(piece => piece.category);
  // One mannequin outfit: 1–3 garments, each in its own slot.
  if (pieces.length > 3 || !slots.every(isGarmentSlot) || new Set(slots).size !== slots.length ||
      new Set(pieces.map(piece => piece.pieceId)).size !== pieces.length) {
    throw new TryOnError('invalid_composition');
  }
  signal.throwIfAborted();
  const selfPhoto = {image: await readImage(maskedFile, signal), headMasked: true as const};
  const garments: TryOnRequest['pieces'] = [];
  // Sequential reads bound peak decode memory on the reference device.
  for (const [index, piece] of pieces.entries()) {
    signal.throwIfAborted();
    const image = await readImage(piece.cutoutFile, signal);
    signal.throwIfAborted();
    garments.push({pieceRef: `garment_${index}`, image, label: piece.label, category: piece.category as GarmentSlot});
  }
  signal.throwIfAborted();
  return {selfPhoto, pieces: garments};
}
