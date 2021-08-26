import { canvasEncode } from '../../../../client/lazy-app/util/canvas';
import { mimeType, EncodeOptions } from '../shared/meta';

export const browserJPEGEncode = (
  imageData: ImageData,
  options: EncodeOptions,
) => canvasEncode(imageData, mimeType, options.quality);

