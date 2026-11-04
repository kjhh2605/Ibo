import type {FileRef, ResultPieceSnapshot} from '../native/contracts';
import type {RelayRequest} from '../relay/client';
import type {UploadImageReader} from '../relay/selfPhoto';
import {TryOnError} from './errors';

export type PreparedResult = {draftId: string; targetSnapshot: ResultPieceSnapshot; companionSnapshots: ResultPieceSnapshot[]};
export type TryOnRequest = RelayRequest<'/v1/tryon'>;

/** No raw self, head mask, shop, coordinate, or local identifier enters the wire object. */
export async function serializeTryOn(
  maskedFile: FileRef,
  prepared: PreparedResult,
  readImage: UploadImageReader,
  signal: AbortSignal,
): Promise<TryOnRequest> {
  const pieces = [prepared.targetSnapshot, ...prepared.companionSnapshots];
  if (pieces[0].origin !== 'shop' || pieces.length > 6 ||
      new Set(pieces.map(piece => piece.pieceId)).size !== pieces.length) {
    throw new TryOnError('invalid_composition');
  }
  signal.throwIfAborted();
  const selfPhoto = {image: await readImage(maskedFile, signal), headMasked: true as const};
  const convert = async (piece: ResultPieceSnapshot, index: number) => {
    signal.throwIfAborted();
    const image = await readImage(piece.cutoutFile, signal);
    signal.throwIfAborted();
    return {pieceRef: `garment_${index}`, image, label: piece.label, category: piece.category, origin: piece.origin};
  };
  // Sequential reads bound peak decode memory on the reference device.
  const target = await convert(pieces[0], 0);
  const companions: TryOnRequest['companions'] = [];
  for (let index = 1; index < pieces.length; index++) companions.push(await convert(pieces[index], index));
  signal.throwIfAborted();
  return {selfPhoto, target, companions};
}
