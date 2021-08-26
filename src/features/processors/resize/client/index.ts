import {
  builtinResize,
  BuiltinResizeMethod,
  drawableToImageData,
} from '../../../../client/lazy-app/util/canvas';
import {
  BrowserResizeOptions,
  VectorResizeOptions,
  WorkerResizeOptions,
  Options as ResizeOptions,
  workerResizeMethods,
} from '../shared/meta';
import { getContainOffsets } from '../shared/util';
import type { SourceImage } from '../../../../client/lazy-app/Compress';

import resize from '../worker/resize';


/**
 * Return whether a set of options are worker resize options.
 *
 * @param opts
 */
function isWorkerOptions(opts: ResizeOptions): opts is WorkerResizeOptions {
  return (workerResizeMethods as string[]).includes(opts.method);
}

function browserResize(data: ImageData, opts: BrowserResizeOptions): ImageData {
  let sx = 0;
  let sy = 0;
  let sw = data.width;
  let sh = data.height;

  if (opts.fitMethod === 'contain') {
    ({ sx, sy, sw, sh } = getContainOffsets(sw, sh, opts.width, opts.height));
  }

  return builtinResize(
    data,
    sx,
    sy,
    sw,
    sh,
    opts.width,
    opts.height,
    opts.method.slice('browser-'.length) as BuiltinResizeMethod,
  );
}

function vectorResize(
  data: HTMLImageElement,
  opts: VectorResizeOptions,
): ImageData {
  let sx = 0;
  let sy = 0;
  let sw = data.width;
  let sh = data.height;

  if (opts.fitMethod === 'contain') {
    ({ sx, sy, sw, sh } = getContainOffsets(sw, sh, opts.width, opts.height));
  }

  return drawableToImageData(data, {
    sx,
    sy,
    sw,
    sh,
    width: opts.width,
    height: opts.height,
  });
}

export async function resizeImage(
  source: SourceImage,
  options: ResizeOptions,
) {
  if (options.method === 'vector') {
    if (!source.vectorImage) throw Error('No vector image available');
    return vectorResize(source.vectorImage, options);
  }
  if (isWorkerOptions(options)) {
    return resize(source.preprocessed, options);
  }
  return browserResize(source.preprocessed, options);
}

interface Props {
  isVector: Boolean;
  inputWidth: number;
  inputHeight: number;
  options: ResizeOptions;
  onChange(newOptions: ResizeOptions): void;
}

interface State {
  maintainAspect: boolean;
}

const sizePresets = [0.25, 0.3333, 0.5, 1, 2, 3, 4];
