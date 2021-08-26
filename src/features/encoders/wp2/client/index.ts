import { EncodeOptions, UVMode, Csp } from '../shared/meta';
import { defaultOptions } from '../shared/meta';
import { preventDefault, shallowEqual } from '../../../../client/lazy-app/util';
import encode from '../worker/wp2Encode';

export const wp2Encode = (
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
