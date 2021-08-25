import { canvasEncode } from '../../../../client/lazy-app/util/canvas';
import {
  abortable,
  blobToArrayBuffer,
  inputFieldChecked,
} from '../../../../client/lazy-app/util';
import { EncodeOptions } from '../shared/meta';
import type WorkerBridge from '../../../../client/lazy-app/worker-bridge';
import { inputFieldValueAsNumber, preventDefault } from '../../../../client/lazy-app/util';

export async function encode(
  signal: AbortSignal,
  workerBridge: WorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) {
  const pngBlob = await abortable(signal, canvasEncode(imageData, 'image/png'));
  const pngBuffer = await abortable(signal, blobToArrayBuffer(pngBlob));
  return workerBridge.oxipngEncode(signal, pngBuffer, options);
}

type Props = {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
};
