import { EncodeOptions, UVMode, Csp } from '../shared/meta';
import { defaultOptions } from '../shared/meta';
import type WorkerBridge from '../../../../client/lazy-app/worker-bridge';
import { preventDefault, shallowEqual } from '../../../../client/lazy-app/util';

export const encode = (
  signal: AbortSignal,
  workerBridge: WorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) => workerBridge.wp2Encode(signal, imageData, options);

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface State {
  options: EncodeOptions;
  effort: number;
  quality: number;
  alphaQuality: number;
  passes: number;
  sns: number;
  uvMode: number;
  lossless: boolean;
  slightLoss: number;
  colorSpace: number;
  errorDiffusion: number;
  useRandomMatrix: boolean;
  showAdvanced: boolean;
  separateAlpha: boolean;
}
