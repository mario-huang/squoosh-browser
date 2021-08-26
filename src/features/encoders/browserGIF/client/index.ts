import { canvasEncodeTest, canvasEncode } from '../../../../client/lazy-app/util/canvas';
import { EncodeOptions, mimeType } from '../shared/meta';

export const featureTest = () => canvasEncodeTest(mimeType);
export const browserGIFEncode = (
  imageData: ImageData,
  options: EncodeOptions,
) => canvasEncode(imageData, mimeType);
