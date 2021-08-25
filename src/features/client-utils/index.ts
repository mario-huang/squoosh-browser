interface EncodeOptions {
  quality: number;
}

interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}

interface QualityOptionArg {
  min?: number;
  max?: number;
  step?: number;
}

type Constructor<T extends {} = {}> = new (...args: any[]) => T;

// TypeScript requires an exported type for returned classes. This serves as the
// type for the class returned by `qualityOption`.