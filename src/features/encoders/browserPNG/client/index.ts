import { canvasEncode } from '../../../../client/lazy-app/util/canvas';
import { EncodeOptions, mimeType } from '../shared/meta';

export const browserPNGEncode = (
  imageData: ImageData,
  options: EncodeOptions,
) => canvasEncode(imageData, mimeType);
