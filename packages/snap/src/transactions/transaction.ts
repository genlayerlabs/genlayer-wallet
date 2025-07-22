import type { BytesLike } from 'ethers';
import { decodeRlp, getBytes, Interface } from 'ethers';
import { abi, chains } from 'genlayer-js';

import { StateManager } from '../libs/StateManager';

/**
 * Transaction handling and storage key generation.
 */

/**
 * Fee configuration interface for contract methods.
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
 * Extracts contract address and method name from GenLayer transaction data.
 * @param data - The transaction data (hex string).
 * @returns Object with contractAddress and methodName, or defaults if extraction fails.
 */
export function parseGenLayerTransaction(data: string): {
  contractAddress: string;
  methodName: string;
} {
  try {
    const contractInterface = new Interface(
      chains.localnet.consensusMainContract?.abi as any,
    );
    const parsed = contractInterface.parseTransaction({ data });

    // Extract contract address from parsed.args[1]
    const contractAddress = parsed?.args[1];

    const decodedData = decodeRlp(parsed?.args[4]);

    const bytes = getBytes(decodedData[0] as BytesLike);

    const decoded = abi.calldata.decode(bytes) as Map<string, any>;

    const methodName = decoded?.get('method');

    const result = {
      contractAddress: contractAddress || 'default',
      methodName: methodName || 'unknown',
    };

    return result;
  } catch (error) {
    const result = {
      contractAddress: 'default',
      methodName: 'unknown',
    };

    return result;
  }
}

/**
 * Extracts the method name from GenLayer transaction data.
 * @param data - The transaction data (hex string).
 * @returns The method name.
 */
export function extractMethodSelector(data: string): string {
  const parsed = parseGenLayerTransaction(data);
  return parsed.methodName;
}

/**
 * Generates a composite storage key combining contract address and method selector.
 * @param contractAddress - The contract address (from parsed.args[1]).
 * @param methodSelector - The method name extracted from transaction data.
 * @returns Composite key in format: "address_selector".
 */
export function generateStorageKey(
  contractAddress: string,
  methodSelector: string,
): string {
  const normalizedAddress = contractAddress?.toLowerCase() ?? 'default';
  const compositeKey = `${normalizedAddress}_${methodSelector}`;

  return compositeKey;
}

/**
 * Generates storage key from transaction object using GenLayer parsing.
 * @param transaction - The transaction object.
 * @param transaction.to - The transaction recipient address.
 * @param transaction.data - The transaction data.
 * @returns Composite storage key.
 */
export function getTransactionStorageKey(transaction: {
  to?: string;
  data?: string;
}): string {
  const parsed = parseGenLayerTransaction(transaction.data ?? '');
  const storageKey = generateStorageKey(
    parsed.contractAddress,
    parsed.methodName,
  );

  return storageKey;
}

/**
 * Sets default fee configuration for a specific contract and method only if no previous config exists.
 * @param contractAddress - The contract address.
 * @param methodName - The method name.
 * @param config - The default fee configuration.
 * @returns True if config was set, false if a previous config already existed.
 */
export async function setDefaultFeeConfig(
  contractAddress: string,
  methodName: string,
  config: FeeConfig,
): Promise<boolean> {
  if (!contractAddress || !methodName) {
    throw new Error('Contract address and method name are required');
  }
  const storageKey = generateStorageKey(contractAddress, methodName);

  const existingConfig = await StateManager.get<FeeConfig>(storageKey);
  if (existingConfig) {
    return false;
  }

  const defaultConfig = {
    ...config
  };

  await StateManager.set(storageKey, defaultConfig);
  return true;
}
