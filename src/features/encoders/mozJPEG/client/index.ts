import { EncodeOptions, MozJpegColorSpace } from '../shared/meta';
import type WorkerBridge from '../../../../client/lazy-app/worker-bridge';
import {
  inputFieldChecked,
  inputFieldValueAsNumber,
  preventDefault,
} from '../../../../client/lazy-app/util';

export function encode(
  workerBridge: WorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) {
  return workerBridge.mozjpegEncode(imageData, options);
}

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface State {
  showAdvanced: boolean;
}
