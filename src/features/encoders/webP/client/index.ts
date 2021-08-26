import { EncodeOptions } from '../shared/meta';
import {
  inputFieldCheckedAsNumber,
  inputFieldValueAsNumber,
  preventDefault,
} from '../../../../client/lazy-app/util';
import encode from '../worker/webpEncode';

export const webPEncode = (
  imageData: ImageData,
  options: EncodeOptions,
) => encode(imageData, options);

const enum WebPImageHint {
  WEBP_HINT_DEFAULT, // default preset.
  WEBP_HINT_PICTURE, // digital picture, like portrait, inner shot
  WEBP_HINT_PHOTO, // outdoor photograph, with natural lighting
  WEBP_HINT_GRAPH, // Discrete tone image (graph, map-tile etc).
}

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface State {
  showAdvanced: boolean;
}

// From kLosslessPresets in config_enc.c
// The format is [method, quality].
const losslessPresets: [number, number][] = [
  [0, 0],
  [1, 20],
  [2, 25],
  [3, 30],
  [3, 50],
  [4, 50],
  [4, 75],
  [4, 90],
  [5, 90],
  [6, 100],
];
const losslessPresetDefault = 6;

function determineLosslessQuality(quality: number, method: number): number {
  const index = losslessPresets.findIndex(
    ([presetMethod, presetQuality]) =>
      presetMethod === method && presetQuality === quality,
  );
  if (index !== -1) return index;
  // Quality doesn't match one of the presets.
  // This can happen when toggling 'lossless'.
  return losslessPresetDefault;
}
