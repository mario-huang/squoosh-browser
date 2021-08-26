import { EncodeOptions, defaultOptions, AVIFTune } from '../shared/meta';
import encode from '../worker/avifEncode';


export const avifEncode = (
  imageData: ImageData,
  options: EncodeOptions,
) => encode(imageData, options);

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
