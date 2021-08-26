import { EncodeOptions, MozJpegColorSpace } from '../shared/meta';
import encode from '../worker/mozjpegEncode';

export function mozJPEGEncode(
  imageData: ImageData,
  options: EncodeOptions,
) {
  return encode(imageData, options);
}

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface State {
  showAdvanced: boolean;
}
