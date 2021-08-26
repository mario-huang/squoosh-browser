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
    preprocessorState: PreprocessorState;
    processorState: ProcessorState;
    encoderState: EncoderState;
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

// 预处理
async function preprocessImage(
    data: ImageData,
    preprocessorState: PreprocessorState,
    workerBridge: WorkerBridge,
): Promise<ImageData> {
    let processedData = data;

    if (preprocessorState.rotate.rotate !== 0) {
        processedData = await workerBridge.rotate(
            processedData,
            preprocessorState.rotate,
        );
    }

    return processedData;
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


export default class Compress {

    private readonly workerBridge = new WorkerBridge();
    // 需要处理的文件
    private file: File;
    // 编码设置
    private setting: Setting = {
        "encoderState": {
            type: 'webP',
            options: encoderMap.webP.meta.defaultOptions,
        }, "processorState": defaultProcessorState, "preprocessorState": defaultPreprocessorState
    };

    constructor(file: File, setting?: Setting) {
        this.file = file;
        if (setting) {
            this.setting = setting;
        }
    }

    // 处理
    async process(): Promise<File> {
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
        const preprocessed = await preprocessImage(decoded, this.setting.preprocessorState, this.workerBridge);

        // 加工
        const source: SourceImage = { "file": this.file, decoded, vectorImage, preprocessed };
        const processed = await processImage(source, this.setting.processorState, this.workerBridge);

        // 编码
        const file = await compressImage(
            processed,
            this.setting.encoderState,
            source.file.name,
            this.workerBridge,
        );

        return file;
    }
}
