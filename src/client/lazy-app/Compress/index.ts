import {
    blobToImg,
    blobToText,
    builtinDecode,
    sniffMimeType,
    canDecodeImageType,
    abortable,
    assertSignal,
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
import ResultCache from './result-cache';
import { cleanMerge, cleanSet } from '../util/clean-modify';
import './custom-els/MultiPanel';
import WorkerBridge from '../worker-bridge';
import { resize } from '../../../features/processors/resize/client';
import { drawableToImageData } from '../util/canvas';

export type OutputType = EncoderType | 'identity';

export interface SourceImage {
    file: File;
    decoded: ImageData;
    preprocessed: ImageData;
    vectorImage?: HTMLImageElement;
}

interface SideSettings {
    processorState: ProcessorState;
    encoderState?: EncoderState;
}

interface Side {
    processed?: ImageData;
    file?: File;
    downloadUrl?: string;
    data?: ImageData;
    latestSettings: SideSettings;
    encodedSettings?: SideSettings;
    loading: boolean;
}

interface Props {
    file: File;
    onBack: () => void;
}

interface State {
    source?: SourceImage;
    sides: [Side, Side];
    /** Source image load */
    loading: boolean;
    preprocessorState: PreprocessorState;
    encodedPreprocessorState?: PreprocessorState;
  }

interface MainJob {
    file: File;
    preprocessorState: PreprocessorState;
}

interface SideJob {
    processorState: ProcessorState;
    encoderState?: EncoderState;
}

async function decodeImage(
    signal: AbortSignal,
    blob: Blob,
    workerBridge: WorkerBridge,
): Promise<ImageData> {
    assertSignal(signal);
    const mimeType = await abortable(signal, sniffMimeType(blob));
    const canDecode = await abortable(signal, canDecodeImageType(mimeType));

    try {
        if (!canDecode) {
            if (mimeType === 'image/avif') {
                return await workerBridge.avifDecode(signal, blob);
            }
            if (mimeType === 'image/webp') {
                return await workerBridge.webpDecode(signal, blob);
            }
            if (mimeType === 'image/jxl') {
                return await workerBridge.jxlDecode(signal, blob);
            }
            if (mimeType === 'image/webp2') {
                return await workerBridge.wp2Decode(signal, blob);
            }
        }
        // Otherwise fall through and try built-in decoding for a laugh.
        return await builtinDecode(signal, blob, mimeType);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.log(err);
        throw Error("Couldn't decode image");
    }
}

async function preprocessImage(
    signal: AbortSignal,
    data: ImageData,
    preprocessorState: PreprocessorState,
    workerBridge: WorkerBridge,
): Promise<ImageData> {
    assertSignal(signal);
    let processedData = data;

    if (preprocessorState.rotate.rotate !== 0) {
        processedData = await workerBridge.rotate(
            signal,
            processedData,
            preprocessorState.rotate,
        );
    }

    return processedData;
}

async function processImage(
    signal: AbortSignal,
    source: SourceImage,
    processorState: ProcessorState,
    workerBridge: WorkerBridge,
): Promise<ImageData> {
    assertSignal(signal);
    let result = source.preprocessed;

    if (processorState.resize.enabled) {
        result = await resize(signal, source, processorState.resize, workerBridge);
    }
    if (processorState.quantize.enabled) {
        result = await workerBridge.quantize(
            signal,
            result,
            processorState.quantize,
        );
    }
    return result;
}

async function compressImage(
    signal: AbortSignal,
    image: ImageData,
    encodeData: EncoderState,
    sourceFilename: string,
    workerBridge: WorkerBridge,
): Promise<File> {
    assertSignal(signal);

    const encoder = encoderMap[encodeData.type];
    const compressedData = await encoder.encode(
        signal,
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

function stateForNewSourceData(state: State): State {
    let newState = { ...state };

    for (const i of [0, 1]) {
        // Ditch previous encodings
        const downloadUrl = state.sides[i].downloadUrl;
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);

        newState = cleanMerge(state, `sides.${i}`, {
            preprocessed: undefined,
            file: undefined,
            downloadUrl: undefined,
            data: undefined,
            encodedSettings: undefined,
        });
    }

    return newState;
}

async function processSvg(
    signal: AbortSignal,
    blob: Blob,
): Promise<HTMLImageElement> {
    assertSignal(signal);
    // Firefox throws if you try to draw an SVG to canvas that doesn't have width/height.
    // In Chrome it loads, but drawImage behaves weirdly.
    // This function sets width/height if it isn't already set.
    const parser = new DOMParser();
    const text = await abortable(signal, blobToText(blob));
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
    return abortable(
        signal,
        blobToImg(new Blob([newSource], { type: 'image/svg+xml' })),
    );
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

    state: State = {
        source: undefined,
        loading: false,
        preprocessorState: defaultPreprocessorState,
        sides: [
            {
                latestSettings: {
                    processorState: defaultProcessorState,
                    encoderState: undefined,
                },
                loading: false,
            },
            {
                latestSettings: {
                    processorState: defaultProcessorState,
                    encoderState: {
                        type: 'mozJPEG',
                        options: encoderMap.mozJPEG.meta.defaultOptions,
                    },
                },
                loading: false,
            },
        ],
    };

    private readonly encodeCache = new ResultCache();
    // One for each side
    private readonly workerBridges = [new WorkerBridge(), new WorkerBridge()];
    /** Abort controller for actions that impact both sites, like source image decoding and preprocessing */
    private mainAbortController = new AbortController();
    // And again one for each side
    private sideAbortControllers = [new AbortController(), new AbortController()];
    /** For debouncing calls to updateImage for each side. */
    private updateImageTimeout?: number;

    constructor(props: Props) {
        this.sourceFile = props.file;
        this.queueUpdateImage({ immediate: true });
    }

    private onEncoderTypeChange = (index: 0 | 1, newType: OutputType): void => {
        this.state.sides = cleanSet(
            this.state.sides,
            `${index}.latestSettings.encoderState`,
            newType === 'identity'
                ? undefined
                : {
                    type: newType,
                    options: encoderMap[newType].meta.defaultOptions,
                },
        )
    };

    private onProcessorOptionsChange = (
        index: 0 | 1,
        options: ProcessorState,
    ): void => {
        this.state.sides = cleanSet(
            this.state.sides,
            `${index}.latestSettings.processorState`,
            options,
        )
    }

    private onEncoderOptionsChange = (
        index: 0 | 1,
        options: EncoderOptions,
    ): void => {
        this.state.sides = cleanSet(
            this.state.sides,
            `${index}.latestSettings.encoderState.options`,
            options,
        )
    };

    // 放弃处理
    abort(): void {
        this.mainAbortController.abort();
        for (const controller of this.sideAbortControllers) {
            controller.abort();
        }
    }

    // 处理
    process(): void {
        this.queueUpdateImage();
    }

    /**
     * Debounce the heavy lifting of updateImage.
     * Otherwise, the thrashing causes jank, and sometimes crashes iOS Safari.
     */
    private queueUpdateImage({ immediate }: { immediate?: boolean } = {}): void {
        // Call updateImage after this delay, unless queueUpdateImage is called
        // again, in which case the timeout is reset.
        const delay = 100;

        clearTimeout(this.updateImageTimeout);
        if (immediate) {
            this.updateImage();
        } else {
            this.updateImageTimeout = setTimeout(() => this.updateImage(), delay);
        }
    }

    private sourceFile: File;
    /** The in-progress job for decoding and preprocessing */
    private activeMainJob?: MainJob;
    /** The in-progress job for each side (processing and encoding) */
    private activeSideJobs: [SideJob?, SideJob?] = [undefined, undefined];

    /**
     * Perform image processing.
     *
     * This function is a monster, but I didn't want to break it up, because it
     * never gets partially called. Instead, it looks at the current state, and
     * decides which steps can be skipped, and which can be cached.
     */
    private async updateImage() {
        const currentState = this.state;

        // State of the last completed job, or ongoing job
        const latestMainJobState: Partial<MainJob> = this.activeMainJob || {
            file: currentState.source && currentState.source.file,
            preprocessorState: currentState.encodedPreprocessorState,
        };
        const latestSideJobStates: Partial<SideJob>[] = currentState.sides.map(
            (side, i) =>
                this.activeSideJobs[i] || {
                    processorState:
                        side.encodedSettings && side.encodedSettings.processorState,
                    encoderState:
                        side.encodedSettings && side.encodedSettings.encoderState,
                },
        );

        // State for this job
        const mainJobState: MainJob = {
            file: this.sourceFile,
            preprocessorState: currentState.preprocessorState,
        };
        const sideJobStates: SideJob[] = currentState.sides.map((side) => ({
            // If there isn't an encoder selected, we don't process either
            processorState: side.latestSettings.encoderState
                ? side.latestSettings.processorState
                : defaultProcessorState,
            encoderState: side.latestSettings.encoderState,
        }));

        // Figure out what needs doing:
        const needsDecoding = latestMainJobState.file != mainJobState.file;
        const needsPreprocessing =
            needsDecoding ||
            latestMainJobState.preprocessorState !== mainJobState.preprocessorState;
        const sideWorksNeeded = latestSideJobStates.map((latestSideJob, i) => {
            const needsProcessing =
                needsPreprocessing ||
                !latestSideJob.processorState ||
                // If we're going to or from 'original image' we should reprocess
                !!latestSideJob.encoderState !== !!sideJobStates[i].encoderState ||
                !processorStateEquivalent(
                    latestSideJob.processorState,
                    sideJobStates[i].processorState,
                );

            return {
                processing: needsProcessing,
                encoding:
                    needsProcessing ||
                    latestSideJob.encoderState !== sideJobStates[i].encoderState,
            };
        });

        let jobNeeded = false;

        // Abort running tasks & cycle the controllers
        if (needsDecoding || needsPreprocessing) {
            this.mainAbortController.abort();
            this.mainAbortController = new AbortController();
            jobNeeded = true;
            this.activeMainJob = mainJobState;
        }
        for (const [i, sideWorkNeeded] of sideWorksNeeded.entries()) {
            if (sideWorkNeeded.processing || sideWorkNeeded.encoding) {
                this.sideAbortControllers[i].abort();
                this.sideAbortControllers[i] = new AbortController();
                jobNeeded = true;
                this.activeSideJobs[i] = sideJobStates[i];
            }
        }

        if (!jobNeeded) return;

        const mainSignal = this.mainAbortController.signal;
        const sideSignals = this.sideAbortControllers.map((ac) => ac.signal);

        let decoded: ImageData;
        let vectorImage: HTMLImageElement | undefined;

        // Handle decoding
        if (needsDecoding) {
            try {
                assertSignal(mainSignal);
                this.state.source = undefined;
                this.state.loading = true;

                // Special-case SVG. We need to avoid createImageBitmap because of
                // https://bugs.chromium.org/p/chromium/issues/detail?id=606319.
                // Also, we cache the HTMLImageElement so we can perform vector resizing later.
                if (mainJobState.file.type.startsWith('image/svg+xml')) {
                    vectorImage = await processSvg(mainSignal, mainJobState.file);
                    decoded = drawableToImageData(vectorImage);
                } else {
                    decoded = await decodeImage(
                        mainSignal,
                        mainJobState.file,
                        // Either worker is good enough here.
                        this.workerBridges[0],
                    );
                }

                // Set default resize values
                if (!mainSignal.aborted) {
                    const sides = this.state.sides.map((side) => {
                        const resizeState: Partial<ProcessorState['resize']> = {
                            width: decoded.width,
                            height: decoded.height,
                            method: vectorImage ? 'vector' : 'lanczos3',
                            // Disable resizing, to make it clearer to the user that something changed here
                            enabled: false,
                        };
                        return cleanMerge(
                            side,
                            'latestSettings.processorState.resize',
                            resizeState,
                        );
                    }) as [Side, Side];
                    this.state.sides = sides;
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                throw err;
            }
        } else {
            ({ decoded, vectorImage } = currentState.source!);
        }

        let source: SourceImage;

        // Handle preprocessing
        if (needsPreprocessing) {
            try {
                assertSignal(mainSignal);
                this.state.loading = true;

                const preprocessed = await preprocessImage(
                    mainSignal,
                    decoded,
                    mainJobState.preprocessorState,
                    // Either worker is good enough here.
                    this.workerBridges[0],
                );

                source = {
                    decoded,
                    vectorImage,
                    preprocessed,
                    file: mainJobState.file,
                };

                // Update state for process completion, including intermediate render
                if (!mainSignal.aborted) {
                    let newState: State = {
                        ...this.state,
                        loading: false,
                        source,
                        encodedPreprocessorState: mainJobState.preprocessorState,
                        sides: this.state.sides.map((side) => {
                            if (side.downloadUrl) URL.revokeObjectURL(side.downloadUrl);

                            const newSide: Side = {
                                ...side,
                                // Intermediate render
                                data: preprocessed,
                                processed: undefined,
                                encodedSettings: undefined,
                            };
                            return newSide;
                        }) as [Side, Side],
                    };
                    newState = stateForNewSourceData(newState);
                    this.state = newState;
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                this.state.loading = false;
                throw err;
            }
        } else {
            source = currentState.source!;
        }

        // That's the main part of the job done.
        this.activeMainJob = undefined;

        // Allow side jobs to happen in parallel
        sideWorksNeeded.forEach(async (sideWorkNeeded, sideIndex) => {
            try {
                // If processing is true, encoding is always true.
                if (!sideWorkNeeded.encoding) return;

                const signal = sideSignals[sideIndex];
                const jobState = sideJobStates[sideIndex];
                const workerBridge = this.workerBridges[sideIndex];
                let file: File;
                let data: ImageData;
                let processed: ImageData | undefined = undefined;

                // If there's no encoder state, this is "original image", which also
                // doesn't allow processing.
                if (!jobState.encoderState) {
                    file = source.file;
                    data = source.preprocessed;
                } else {
                    const cacheResult = this.encodeCache.match(
                        source.preprocessed,
                        jobState.processorState,
                        jobState.encoderState,
                    );

                    if (cacheResult) {
                        ({ file, processed, data } = cacheResult);
                    } else {
                        // Set loading state for this side
                        if (!signal.aborted) {
                            const sides = cleanMerge(this.state.sides, sideIndex, {
                                loading: true,
                            });
                            this.state.sides = sides;
                        }
                        if (sideWorkNeeded.processing) {
                            processed = await processImage(
                                signal,
                                source,
                                jobState.processorState,
                                workerBridge,
                            );

                            // Update state for process completion, including intermediate render
                            if (!signal.aborted) {
                                const currentSide = this.state.sides[sideIndex];
                                const side: Side = {
                                    ...currentSide,
                                    processed,
                                    // Intermediate render
                                    data: processed,
                                    encodedSettings: {
                                        ...currentSide.encodedSettings,
                                        processorState: jobState.processorState,
                                    },
                                };
                                const sides = cleanSet(currentState.sides, sideIndex, side);
                                this.state.sides = sides;
                             }
                        } else {
                            processed = currentState.sides[sideIndex].processed!;
                        }

                        file = await compressImage(
                            signal,
                            processed,
                            jobState.encoderState,
                            source.file.name,
                            workerBridge,
                        );
                        data = await decodeImage(signal, file, workerBridge);

                        this.encodeCache.add({
                            data,
                            processed,
                            file,
                            preprocessed: source.preprocessed,
                            encoderState: jobState.encoderState,
                            processorState: jobState.processorState,
                        });
                    }
                }

                if (!signal.aborted) {
                    const currentSide = this.state.sides[sideIndex];

                    if (currentSide.downloadUrl) {
                        URL.revokeObjectURL(currentSide.downloadUrl);
                    }

                    const side: Side = {
                        ...currentSide,
                        data,
                        file,
                        downloadUrl: URL.createObjectURL(file),
                        loading: false,
                        processed,
                        encodedSettings: {
                            processorState: jobState.processorState,
                            encoderState: jobState.encoderState,
                        },
                    };
                    const sides = cleanSet(currentState.sides, sideIndex, side);
                    this.state.sides = sides;
                }

                this.activeSideJobs[sideIndex] = undefined;
            } catch (err) {
                if (err.name === 'AbortError') return;
                const sides = cleanMerge(currentState.sides, sideIndex, {
                    loading: false,
                });
                this.state.sides = sides;
                throw err;
            }
        });
    }
}
