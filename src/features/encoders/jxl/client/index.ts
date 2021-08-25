import { EncodeOptions } from '../shared/meta';
import { preventDefault, shallowEqual } from '../../../../client/lazy-app/util';
import WorkerBridge from '../../../../client/lazy-app/worker-bridge';

export const encode = (
  signal: AbortSignal,
  workerBridge: WorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) => workerBridge.jxlEncode(signal, imageData, options);

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface State {
  options: EncodeOptions;
  effort: number;
  quality: number;
  progressive: boolean;
  edgePreservingFilter: number;
  lossless: boolean;
  slightLoss: boolean;
  autoEdgePreservingFilter: boolean;
  decodingSpeedTier: number;
}

const maxSpeed = 7;
