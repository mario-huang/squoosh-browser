import {
    blobToImg,
    blobToText,
    builtinDecode,
    sniffMimeType,
    canDecodeImageType,
    ImageMimeTypes,
} from '../util';
import {
    PreprocessorState,
  ProcessorState,
  EncoderState,
  encoderMap,
  defaultPreprocessorState,
  defaultProcessorState,
  EncoderType,
  EncoderOptions,
} from '../feature-meta';
import { cleanMerge, cleanSet } from '../util/clean-modify';
import WorkerBridge from '../worker-bridge';
import { drawableToImageData } from '../util/canvas';

export interface SourceImage {
    file: File;
    decoded: ImageData;
    preprocessed: ImageData;
    vectorImage?: HTMLImageElement;
}

interface Setting {
    processorState: ProcessorState;
    encoderState?: EncoderState;
}

interface MainJob {
    file: File;
    preprocessorState: PreprocessorState;
  }
  
  interface SideJob {
    processorState: ProcessorState;
    encoderState?: EncoderState;
  }

// 解码
async function decodeImage(
    blob: Blob,
    workerBridge: WorkerBridge,
): Promise<ImageData> {
    const mimeType = await sniffMimeType(blob);
    const canDecode = await canDecodeImageType(mimeType);
    if (!canDecode) {
        // 用外置解码
        if (mimeType === 'image/avif') {
            return await workerBridge.avifDecode(blob);
        }
        if (mimeType === 'image/webp') {
            return await workerBridge.webpDecode(blob);
        }
        if (mimeType === 'image/jxl') {
            return await workerBridge.jxlDecode(blob);
        }
        if (mimeType === 'image/webp2') {
            return await workerBridge.wp2Decode(blob);
        }

    }
    // Otherwise fall through and try built-in decoding for a laugh.
    // 用内置解码
    return await builtinDecode(blob, mimeType);
}

// 加工
async function processImage(
    source: SourceImage,
    processorState: ProcessorState,
    workerBridge: WorkerBridge,
): Promise<ImageData> {
    let result = source.preprocessed;

    if (processorState.quantize.enabled) {
        result = await workerBridge.quantize(
            result,
            processorState.quantize,
        );
    }
    return result;
}

// 编码
async function compressImage(
    image: ImageData,
    encodeData: EncoderState,
    sourceFilename: string,
    workerBridge: WorkerBridge,
): Promise<File> {
    const encoder = encoderMap[encodeData.type];
    const compressedData = await encoder.encode(
        workerBridge,
        image,
        // The type of encodeData.options is enforced via the previous line
        encodeData.options as any,
    );

    // This type ensures the image mimetype is consistent with our mimetype sniffer
    const type: ImageMimeTypes = encoder.meta.mimeType;

    return new File(
        [compressedData],
        sourceFilename.replace(/.[^.]*$/, `.${encoder.meta.extension}`),
        { type },
    );
}

// 特殊处理SVG
async function processSvg(
    blob: Blob,
): Promise<HTMLImageElement> {
    // Firefox throws if you try to draw an SVG to canvas that doesn't have width/height.
    // In Chrome it loads, but drawImage behaves weirdly.
    // This function sets width/height if it isn't already set.
    const parser = new DOMParser();
    const text = await blobToText(blob);
    const document = parser.parseFromString(text, 'image/svg+xml');
    const svg = document.documentElement!;

    if (svg.hasAttribute('width') && svg.hasAttribute('height')) {
        return blobToImg(blob);
    }

    const viewBox = svg.getAttribute('viewBox');
    if (viewBox === null) throw Error('SVG must have width/height or viewBox');

    const viewboxParts = viewBox.split(/\s+/);
    svg.setAttribute('width', viewboxParts[2]);
    svg.setAttribute('height', viewboxParts[3]);

    const serializer = new XMLSerializer();
    const newSource = serializer.serializeToString(document);
    return blobToImg(new Blob([newSource], { type: 'image/svg+xml' }));
}

/**
 * If two processors are disabled, they're considered equivalent, otherwise
 * equivalence is based on ===
 */
function processorStateEquivalent(a: ProcessorState, b: ProcessorState) {
    // Quick exit
    if (a === b) return true;

    // All processors have the same keys
    for (const key of Object.keys(a) as Array<keyof ProcessorState>) {
        // If both processors are disabled, they're the same.
        if (!a[key].enabled && !b[key].enabled) continue;
        if (a !== b) return false;
    }

    return true;
}

export default class Compress {

    private readonly workerBridge = new WorkerBridge();
    // 需要处理的文件
    private file: File;
    // ？？
    private processed?: ImageData;
    // 编码设置
    private setting: Setting = { "encoderState": undefined, "processorState": defaultProcessorState };

    constructor(file: File, setting?: Setting) {
        this.file = file;
    }

    // 处理
    async process(): Promise<void> {
        return await this.updateImage();
    }

    /**
     * Perform image processing.
     *
     * This function is a monster, but I didn't want to break it up, because it
     * never gets partially called. Instead, it looks at the current state, and
     * decides which steps can be skipped, and which can be cached.
     */
    private async updateImage() {
        let decoded: ImageData;
        let vectorImage: HTMLImageElement | undefined;

        // 解码
        if (this.file.type.startsWith('image/svg+xml')) {
            vectorImage = await processSvg(this.file);
            decoded = drawableToImageData(vectorImage);
        } else {
            decoded = await decodeImage(this.file, this.workerBridge);
        }

        // 预处理
        const preprocessed = await preprocessImage(
            decoded,
            mainJobState.preprocessorState,
            // Either worker is good enough here.
            this.workerBridges[0],
          );

        // 加工
        // If there's no encoder state, this is "original image", which also
        // doesn't allow processing.
        const file = this.file;
        const source: SourceImage = {file,decoded,vectorImage};
        processed = await processImage();


        file = await compressImage(
            processed,
            jobState.encoderState,
            source.file.name,
            workerBridge,
        );
        data = await decodeImage(signal, file, workerBridge);
    }
}
