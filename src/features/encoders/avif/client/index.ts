import { EncodeOptions, defaultOptions, AVIFTune } from '../shared/meta';
import type WorkerBridge from '../../../../client/lazy-app/worker-bridge';
import { preventDefault, shallowEqual } from '../../../../client/lazy-app/util';


export const encode = (
  workerBridge: WorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) => workerBridge.avifEncode(imageData, options);

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface State {
  options: EncodeOptions;
  lossless: boolean;
  quality: number;
  showAdvanced: boolean;
  separateAlpha: boolean;
  alphaQuality: number;
  chromaDeltaQ: boolean;
  subsample: number;
  tileRows: number;
  tileCols: number;
  effort: number;
  sharpness: number;
  denoiseLevel: number;
  aqMode: number;
  tune: AVIFTune;
}

const maxQuant = 63;
const maxSpeed = 10;
