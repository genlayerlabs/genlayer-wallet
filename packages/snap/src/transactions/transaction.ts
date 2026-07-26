import type { BytesLike } from 'ethers';
import { decodeRlp, getBytes, Interface } from 'ethers';
import { abi } from 'genlayer-js';

/**
 * Transaction handling and storage key generation.
 */

type TransactionKind =
  | 'legacy'
  | 'fee-aware'
  | 'deploy-salted'
  | 'top-up-fees'
  | 'submit-appeal'
  | 'top-up-and-submit-appeal'
  | 'unknown';
type MessageAllocationMode = 'none' | 'mode-1' | 'mode-2' | 'unknown';
type TupleLike = Record<string, unknown> & Record<number, unknown>;

const protocolName = (...parts: string[]): string => parts.join('');
const FIELD_VALIDATOR_TIMEUNITS_ALLOCATION = protocolName(
  'validator',
  'Timeunits',
  'Allocation',
);
const FIELD_TOTAL_MESSAGE_FEES = protocolName('total', 'Message', 'Fees');
const FIELD_FEES_DISTRIBUTION = protocolName('fees', 'Distribution');
const FUNCTION_TOP_UP_AND_SUBMIT_APPEAL = protocolName(
  'topUp',
  'And',
  'Submit',
  'Appeal',
);

export type ParsedMessageFeeAllocation = {
  messageType: string;
  onAcceptance: boolean;
  parentIndex: string;
  recipient: string;
  callKey: string;
  budget: string;
  feeParams: string;
};

export type ParsedFeesDistribution = {
  leaderTimeunitsAllocation: string;
  validatorTimeunitsAllocation: string;
  appealRounds: string;
  executionBudgetPerRound: string;
  executionConsumed: string;
  totalMessageFees: string;
  rotations: string[];
  maxPriceGenPerTimeUnit: string;
  storageFeeMaxGasPrice: string;
  receiptFeeMaxGasPrice: string;
};

export type ParsedGenLayerTransaction = {
  contractAddress: string;
  methodName: string;
  kind: TransactionKind;
  txId?: string | undefined;
  totalValue?: string | undefined;
  feeDeposit?: string | undefined;
  userValue?: string | undefined;
  validUntil?: string | undefined;
  saltNonce?: string | undefined;
  feesDistribution?: ParsedFeesDistribution | undefined;
  messageAllocationMode?: MessageAllocationMode | undefined;
  messageAllocations?: ParsedMessageFeeAllocation[] | undefined;
  messageAllocationsCount?: number | undefined;
};

const DEFAULT_PARSED_TRANSACTION: ParsedGenLayerTransaction = {
  contractAddress: 'default',
  methodName: 'unknown',
  kind: 'unknown',
};

const FEES_DISTRIBUTION_COMPONENTS = [
  { name: 'leaderTimeunitsAllocation', type: 'uint256' },
  { name: FIELD_VALIDATOR_TIMEUNITS_ALLOCATION, type: 'uint256' },
  { name: 'appealRounds', type: 'uint256' },
  { name: 'executionBudgetPerRound', type: 'uint256' },
  { name: 'executionConsumed', type: 'uint256' },
  { name: FIELD_TOTAL_MESSAGE_FEES, type: 'uint256' },
  { name: 'rotations', type: 'uint256[]' },
  { name: 'maxPriceGenPerTimeUnit', type: 'uint256' },
  { name: 'storageFeeMaxGasPrice', type: 'uint256' },
  { name: 'receiptFeeMaxGasPrice', type: 'uint256' },
];

const MESSAGE_FEE_ALLOCATION_COMPONENTS = [
  { name: 'messageType', type: 'uint8' },
  { name: 'onAcceptance', type: 'bool' },
  { name: 'parentIndex', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'callKey', type: 'bytes32' },
  { name: 'budget', type: 'uint256' },
  { name: 'feeParams', type: 'bytes' },
];

const ADD_TRANSACTION_PARAMS_COMPONENTS = [
  { name: 'sender', type: 'address' },
  { name: 'recipient', type: 'address' },
  { name: 'numOfInitialValidators', type: 'uint256' },
  { name: 'maxRotations', type: 'uint256' },
  { name: 'validUntil', type: 'uint256' },
  { name: 'saltNonce', type: 'uint256' },
  { name: 'userValue', type: 'uint256' },
  {
    name: FIELD_FEES_DISTRIBUTION,
    type: 'tuple',
    components: FEES_DISTRIBUTION_COMPONENTS,
  },
  { name: 'txCalldata', type: 'bytes' },
  {
    name: 'messageAllocations',
    type: 'tuple[]',
    components: MESSAGE_FEE_ALLOCATION_COMPONENTS,
  },
];

const CONSENSUS_TRANSACTION_ABI = [
  {
    type: 'function',
    name: 'addTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: '_sender', type: 'address' },
      { name: '_recipient', type: 'address' },
      { name: '_numOfInitialValidators', type: 'uint256' },
      { name: '_maxRotations', type: 'uint256' },
      { name: '_txData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: '_sender', type: 'address' },
      { name: '_recipient', type: 'address' },
      { name: '_numOfInitialValidators', type: 'uint256' },
      { name: '_maxRotations', type: 'uint256' },
      { name: '_txData', type: 'bytes' },
      { name: '_validUntil', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addTransaction',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_params',
        type: 'tuple',
        components: ADD_TRANSACTION_PARAMS_COMPONENTS,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deploySalted',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_params',
        type: 'tuple',
        components: ADD_TRANSACTION_PARAMS_COMPONENTS,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'topUpFees',
    stateMutability: 'payable',
    inputs: [
      { name: '_txId', type: 'bytes32' },
      {
        name: '_feesDistribution',
        type: 'tuple',
        components: FEES_DISTRIBUTION_COMPONENTS,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitAppeal',
    stateMutability: 'payable',
    inputs: [{ name: '_txId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: FUNCTION_TOP_UP_AND_SUBMIT_APPEAL,
    stateMutability: 'payable',
    inputs: [
      { name: '_txId', type: 'bytes32' },
      {
        name: '_feesDistribution',
        type: 'tuple',
        components: FEES_DISTRIBUTION_COMPONENTS,
      },
    ],
    outputs: [],
  },
];

const getConsensusInterface = (): Interface =>
  new Interface(CONSENSUS_TRANSACTION_ABI);

const getTupleValue = <TValue>(
  tuple: TupleLike | undefined,
  namedKey: string,
  positionalIndex: number,
  fallback?: TValue,
): TValue | undefined => {
  return (tuple?.[namedKey] ?? tuple?.[positionalIndex] ?? fallback) as
    | TValue
    | undefined;
};

const stringifyUint = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    typeof value === 'bigint' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value.toString();
  }
  const stringifier = (value as { toString?: () => string }).toString;
  if (stringifier && stringifier !== Object.prototype.toString) {
    return stringifier.call(value);
  }
  return undefined;
};

const stringifyBytes = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) {
    return `0x${Array.from(value, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')}`;
  }
  return value?.toString?.() ?? '0x';
};

const stringifyAddress = (value: unknown): string => {
  return typeof value === 'string' ? value : value?.toString?.() ?? 'unknown';
};

const stringifyMessageType = (value: unknown): string => {
  const normalized = stringifyUint(value);
  if (normalized === '0') {
    return 'External';
  }
  if (normalized === '1') {
    return 'Internal';
  }
  return normalized ?? 'unknown';
};

const parseBoolean = (value: unknown): boolean => {
  return value === true || value === 'true' || value === 1 || value === 1n;
};

const parseFeesDistribution = (
  feesDistribution: TupleLike | undefined,
): ParsedFeesDistribution | undefined => {
  if (!feesDistribution) {
    return undefined;
  }

  return {
    leaderTimeunitsAllocation:
      stringifyUint(
        getTupleValue(feesDistribution, 'leaderTimeunitsAllocation', 0),
      ) ?? '0',
    validatorTimeunitsAllocation:
      stringifyUint(
        getTupleValue(
          feesDistribution,
          FIELD_VALIDATOR_TIMEUNITS_ALLOCATION,
          1,
        ),
      ) ?? '0',
    appealRounds:
      stringifyUint(getTupleValue(feesDistribution, 'appealRounds', 2)) ?? '0',
    executionBudgetPerRound:
      stringifyUint(
        getTupleValue(feesDistribution, 'executionBudgetPerRound', 3),
      ) ?? '0',
    executionConsumed:
      stringifyUint(getTupleValue(feesDistribution, 'executionConsumed', 4)) ??
      '0',
    totalMessageFees:
      stringifyUint(
        getTupleValue(feesDistribution, FIELD_TOTAL_MESSAGE_FEES, 5),
      ) ?? '0',
    rotations: Array.from(
      getTupleValue<unknown[]>(feesDistribution, 'rotations', 6, []) ?? [],
    ).map((rotation) => rotation?.toString() ?? '0'),
    maxPriceGenPerTimeUnit:
      stringifyUint(
        getTupleValue(feesDistribution, 'maxPriceGenPerTimeUnit', 7),
      ) ?? '0',
    storageFeeMaxGasPrice:
      stringifyUint(
        getTupleValue(feesDistribution, 'storageFeeMaxGasPrice', 8),
      ) ?? '0',
    receiptFeeMaxGasPrice:
      stringifyUint(
        getTupleValue(feesDistribution, 'receiptFeeMaxGasPrice', 9),
      ) ?? '0',
  };
};

const parseMessageAllocations = (
  messageAllocations: TupleLike[] | undefined,
): ParsedMessageFeeAllocation[] => {
  return Array.from(messageAllocations ?? []).map((allocation) => ({
    messageType: stringifyMessageType(
      getTupleValue(allocation, 'messageType', 0),
    ),
    onAcceptance: parseBoolean(getTupleValue(allocation, 'onAcceptance', 1)),
    parentIndex:
      stringifyUint(getTupleValue(allocation, 'parentIndex', 2)) ?? '0',
    recipient: stringifyAddress(getTupleValue(allocation, 'recipient', 3)),
    callKey: stringifyBytes(getTupleValue(allocation, 'callKey', 4)),
    budget: stringifyUint(getTupleValue(allocation, 'budget', 5)) ?? '0',
    feeParams: stringifyBytes(getTupleValue(allocation, 'feeParams', 6)),
  }));
};

const getMessageAllocationMode = (
  feesDistribution: ParsedFeesDistribution | undefined,
  messageAllocations: ParsedMessageFeeAllocation[],
): MessageAllocationMode => {
  if (!feesDistribution) {
    return 'unknown';
  }

  const totalMessageFees = BigInt(feesDistribution.totalMessageFees);
  if (totalMessageFees === 0n) {
    return 'none';
  }
  return messageAllocations.length === 0 ? 'mode-1' : 'mode-2';
};

const decodeMethodNameFromCalldata = (txCalldata: BytesLike): string => {
  try {
    const decodedData = decodeRlp(txCalldata);
    const bytes = getBytes(decodedData[0] as BytesLike);
    const decoded = abi.calldata.decode(bytes) as Map<string, unknown>;
    const method = decoded?.get('method');
    return typeof method === 'string' ? method : 'unknown';
  } catch {
    return 'unknown';
  }
};

const parseFeeManagementTransaction = (
  name: string,
  args: TupleLike,
): ParsedGenLayerTransaction | undefined => {
  if (
    name !== 'topUpFees' &&
    name !== 'submitAppeal' &&
    name !== FUNCTION_TOP_UP_AND_SUBMIT_APPEAL
  ) {
    return undefined;
  }

  const feesDistribution =
    name === 'submitAppeal'
      ? undefined
      : parseFeesDistribution(getTupleValue(args, '_feesDistribution', 1));
  const messageAllocations: ParsedMessageFeeAllocation[] = [];
  let kind: ParsedGenLayerTransaction['kind'] = 'submit-appeal';
  if (name === 'topUpFees') {
    kind = 'top-up-fees';
  } else if (name === FUNCTION_TOP_UP_AND_SUBMIT_APPEAL) {
    kind = 'top-up-and-submit-appeal';
  }

  return {
    contractAddress: 'consensus',
    methodName: name,
    kind,
    txId: stringifyBytes(getTupleValue(args, '_txId', 0)),
    feesDistribution,
    messageAllocationMode: feesDistribution
      ? getMessageAllocationMode(feesDistribution, messageAllocations)
      : undefined,
    messageAllocations: feesDistribution ? messageAllocations : undefined,
    messageAllocationsCount: feesDistribution ? 0 : undefined,
  };
};

/**
 * Extracts contract address, method name, and fee policy from GenLayer
 * consensus transaction data.
 * @param data - The transaction data (hex string).
 * @returns Parsed transaction summary, or defaults if extraction fails.
 */
export function parseGenLayerTransaction(
  data: string,
): ParsedGenLayerTransaction {
  try {
    const parsed = getConsensusInterface().parseTransaction({ data });
    if (!parsed) {
      return DEFAULT_PARSED_TRANSACTION;
    }

    if (
      (parsed.name === 'addTransaction' || parsed.name === 'deploySalted') &&
      parsed.args.length === 1
    ) {
      const params = parsed.args[0];
      const txCalldata = getTupleValue<BytesLike>(params, 'txCalldata', 8);
      const feesDistribution = parseFeesDistribution(
        getTupleValue(params, FIELD_FEES_DISTRIBUTION, 7),
      );
      const messageAllocations = parseMessageAllocations(
        getTupleValue<TupleLike[]>(params, 'messageAllocations', 9, []),
      );
      return {
        contractAddress:
          getTupleValue<string>(params, 'recipient', 1) ?? 'default',
        methodName: txCalldata
          ? decodeMethodNameFromCalldata(txCalldata)
          : 'unknown',
        kind: parsed.name === 'deploySalted' ? 'deploy-salted' : 'fee-aware',
        userValue: stringifyUint(getTupleValue(params, 'userValue', 6)),
        validUntil: stringifyUint(getTupleValue(params, 'validUntil', 4)),
        saltNonce: stringifyUint(getTupleValue(params, 'saltNonce', 5)),
        feesDistribution,
        messageAllocationMode: getMessageAllocationMode(
          feesDistribution,
          messageAllocations,
        ),
        messageAllocations,
        messageAllocationsCount: messageAllocations.length,
      };
    }

    const feeManagementSummary = parseFeeManagementTransaction(
      parsed.name,
      parsed.args,
    );
    if (feeManagementSummary) {
      return feeManagementSummary;
    }

    const txCalldata = parsed.args[4] as BytesLike;
    return {
      contractAddress: parsed.args[1] || 'default',
      methodName: decodeMethodNameFromCalldata(txCalldata),
      kind: 'legacy',
      validUntil: stringifyUint(parsed.args[5]),
    };
  } catch {
    return DEFAULT_PARSED_TRANSACTION;
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
  const normalizedAddress = contractAddress?.toLowerCase() || 'default';
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
