import { EncodeOptions } from '../shared/meta';
import { preventDefault, shallowEqual } from '../../../../client/lazy-app/util';
import encode from '../worker/jxlEncode';

export const jxlEncode = (
  imageData: ImageData,
  options: EncodeOptions,
) => encode(imageData, options);

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
