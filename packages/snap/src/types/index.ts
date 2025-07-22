/**
 * Base fee configuration interface for contract methods.
 * This type is shared across the snap for consistency.
 */
export interface FeeConfig {
  'leader-timeout-input'?: string;
  'validator-timeout-input'?: string;
  'genlayer-storage-input'?: string;
  'rollup-storage-input'?: string;
  'message-gas-input'?: string;
  'number-of-appeals'?: string;
  [key: string]: string | undefined;
}

/**
 * Fee configuration state for form components.
 * Uses Required utility type to make all properties required.
 */
export type FeeConfigState = Required<FeeConfig>; 