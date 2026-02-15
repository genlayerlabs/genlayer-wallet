/**
 * Base fee configuration interface for contract methods.
 * This type is shared across the snap for consistency.
 */
export type FeeConfig = {
  'leader-timeout-input'?: string;
  'validator-timeout-input'?: string;
  'genlayer-storage-input'?: string;
  'rollup-storage-input'?: string;
  'message-gas-input'?: string;
  'number-of-appeals'?: string;
  [key: string]: string | undefined;
};

/**
 * Fee configuration state for form components.
 * JSON-compatible version of FeeConfig with all properties required.
 */
export type FeeConfigState = {
  [K in keyof FeeConfig]: string;
} & {
  [key: string]: string;
};
