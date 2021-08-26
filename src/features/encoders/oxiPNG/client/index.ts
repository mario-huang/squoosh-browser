import { canvasEncode } from '../../../../client/lazy-app/util/canvas';
import {
  abortable,
  blobToArrayBuffer,
  inputFieldChecked,
} from '../../../../client/lazy-app/util';
import { EncodeOptions } from '../shared/meta';
import { inputFieldValueAsNumber, preventDefault } from '../../../../client/lazy-app/util';
import encode from '../worker/oxipngEncode';

export async function oxiPNGEncode(
  imageData: ImageData,
  options: EncodeOptions,
) {
  const pngBlob = await canvasEncode(imageData, 'image/png');
  const pngBuffer = await blobToArrayBuffer(pngBlob);
  return encode(pngBuffer, options);
}

type Props = {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
};
