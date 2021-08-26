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
} from '../feature-meta';
import { drawableToImageData } from '../util/canvas';

import avifDecode from '../../../features/decoders/avif/worker/avifDecode';
import jxlDecode from '../../../features/decoders/jxl/worker/jxlDecode';
import webpDecode from '../../../features/decoders/webp/worker/webpDecode';
import wp2Decode from '../../../features/decoders/wp2/worker/wp2Decode';
import avifEncode from '../../../features/encoders/avif/worker/avifEncode';
import jxlEncode from '../../../features/encoders/jxl/worker/jxlEncode';
import mozjpegEncode from '../../../features/encoders/mozJPEG/worker/mozjpegEncode';
import oxipngEncode from '../../../features/encoders/oxiPNG/worker/oxipngEncode';
import webpEncode from '../../../features/encoders/webP/worker/webpEncode';
import wp2Encode from '../../../features/encoders/wp2/worker/wp2Encode';
import rotate from '../../../features/preprocessors/rotate/worker/rotate';
import quantize from '../../../features/processors/quantize/worker/quantize';
import resize from '../../../features/processors/resize/worker/resize';
import { browserGIFEncode } from '../../../features/encoders/browserGIF/client';
import { browserJPEGEncode } from '../../../features/encoders/browserJPEG/client';
import { browserPNGEncode } from 'features/encoders/browserPNG/client';
import mozJPEGEncode from '../../../features/encoders/mozJPEG/worker/mozjpegEncode';

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
): Promise<ImageData> {
    const mimeType = await sniffMimeType(blob);
    const canDecode = await canDecodeImageType(mimeType);
    if (!canDecode) {
        // 用外置解码
        switch (mimeType) {
            case 'image/avif':
                return await avifDecode(blob);
            case 'image/webp':
                return await webpDecode(blob);
            case 'image/jxl':
                return await jxlDecode(blob);
            case 'image/webp2':
                return await wp2Decode(blob);
            default:
                break;
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
): Promise<ImageData> {
    let processedData = data;

    if (preprocessorState.rotate.rotate !== 0) {
        processedData = await rotate(
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
): Promise<ImageData> {
    let result = source.preprocessed;

    if (processorState.quantize.enabled) {
        result = await quantize(
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
): Promise<File> {
    const encoder = encoderMap[encodeData.type];
    let compressedData: Blob | ArrayBuffer;
    switch (encodeData.type) {
        case "avif":
            compressedData = await avifEncode(image, encodeData.options)
            break;
        case "browserGIF":
            compressedData = await browserGIFEncode(image, encodeData.options)
            break;
        case "browserJPEG":
            compressedData = await browserJPEGEncode(image, encodeData.options)
            break;
        case "browserPNG":
            compressedData = await browserPNGEncode(image, encodeData.options)
            break;
        case "jxl":
            compressedData = await jxlEncode(image, encodeData.options)
            break;
        case "mozJPEG":
            compressedData = await mozJPEGEncode(image, encodeData.options)
            break;
        case "oxiPNG":
            compressedData = await oxiPNGEncode(image, encodeData.options)
            break;
        case "mozJPEG":
            compressedData = await mozJPEGEncode(image, encodeData.options)
            break;
        case "mozJPEG":
            compressedData = await mozJPEGEncode(image, encodeData.options)
            break;
        default:
            break;
    }

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
            decoded = await decodeImage(this.file);
        }

        // 预处理
        const preprocessed = await preprocessImage(decoded, this.setting.preprocessorState);

        // 加工
        const source: SourceImage = { "file": this.file, decoded, vectorImage, preprocessed };
        const processed = await processImage(source, this.setting.processorState);

        // 编码
        const file = await compressImage(
            processed,
            this.setting.encoderState,
            source.file.name,
        );

        return file;
    }
}
