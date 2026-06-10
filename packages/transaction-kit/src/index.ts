import { AbiCoder, keccak256 } from 'ethers';
import {
  createClient,
  isSuccessful as sdkIsSuccessful,
} from 'genlayer-js';
import type {
  FeesDistribution,
  FeesDistributionInput,
  GenLayerChain,
  GenLayerTransaction,
  TransactionFeeEstimate,
} from 'genlayer-js/types';

export type {
  FeesDistribution,
  FeesDistributionInput,
  GenLayerChain,
} from 'genlayer-js/types';

export type FeePreset = 'low' | 'standard' | 'high';

export type PolicyInput = {
  preset?: FeePreset;
  overrides?: Partial<FeesDistributionInput>;
  userValue?: bigint;
};

export type PolicyQuote = {
  distribution: FeesDistribution;
  feeValue: bigint;
  userValue: bigint;
  total: bigint;
  breakdown: {
    timeUnitFees: bigint;
    executionBudget: bigint;
    messageFees: bigint;
  };
  caps: {
    genPerTimeUnit: bigint;
    storagePrice: bigint;
    receiptPrice: bigint;
  };
  refundable: true;
};

export type SubmitInput =
  | { kind: 'deploy'; code: string; args?: unknown[]; leaderOnly?: boolean }
  | {
      kind: 'write';
      address: `0x${string}`;
      method: string;
      args?: unknown[];
    };

export type TrackedStatus = {
  phase: 'submitted' | 'pending' | 'processing' | 'decided' | 'finalized';
  statusName?: string;
  executionResultName?: string;
  successful?: boolean;
  genlayerTxId?: `0x${string}`;
  evmTxHash?: `0x${string}`;
  contractAddress?: `0x${string}`;
};

export type TransactionKit = {
  estimate(input: PolicyInput, tx?: SubmitInput): Promise<PolicyQuote>;
  submit(
    quote: PolicyQuote,
    tx: SubmitInput,
  ): Promise<{ genlayerTxId: `0x${string}`; evmTxHash?: `0x${string}` }>;
  track(
    genlayerTxId: `0x${string}`,
    onUpdate: (s: TrackedStatus) => void,
    opts?: { until?: 'decided' | 'finalized' },
  ): Promise<TrackedStatus>;
  verification(
    quote: PolicyQuote,
    tx: SubmitInput,
  ): { feeConfigHash: `0x${string}`; summary: Record<string, string> };
};

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type Client = {
  estimateTransactionFeesForWrite?: (
    args: Record<string, unknown>,
  ) => Promise<TransactionFeeEstimate>;
  estimateTransactionFees: (
    args?: Record<string, unknown>,
  ) => Promise<TransactionFeeEstimate>;
  writeContract(args: Record<string, unknown>): Promise<`0x${string}`>;
  deployContract(args: Record<string, unknown>): Promise<`0x${string}`>;
  getTransaction(args: { hash: `0x${string}` }): Promise<GenLayerTransaction>;
  waitForTransactionReceipt?: (args: {
    hash: `0x${string}`;
    waitUntil?: 'decided' | 'finalized';
    fullTransaction?: boolean;
  }) => Promise<GenLayerTransaction>;
};

const abiCoder = AbiCoder.defaultAbiCoder();

const TRANSACTION_STATUS_NUMBER_TO_NAME = {
  '0': 'UNINITIALIZED',
  '1': 'PENDING',
  '2': 'PROPOSING',
  '3': 'COMMITTING',
  '4': 'REVEALING',
  '5': 'ACCEPTED',
  '6': 'UNDETERMINED',
  '7': 'FINALIZED',
  '8': 'CANCELED',
  '9': 'APPEAL_REVEALING',
  '10': 'APPEAL_COMMITTING',
  '11': 'READY_TO_FINALIZE',
  '12': 'VALIDATORS_TIMEOUT',
  '13': 'LEADER_TIMEOUT',
  '14': 'LEADER_REVEALING',
} as const;

const EXECUTION_RESULT_NUMBER_TO_NAME = {
  '0': 'NOT_VOTED',
  '1': 'FINISHED_WITH_RETURN',
  '2': 'FINISHED_WITH_ERROR',
  '3': 'TIMEOUT',
  '4': 'NONDET_DISAGREE',
} as const;

const PRESETS: Record<FeePreset, FeesDistributionInput> = {
  low: {
    appealRounds: 0n,
    rotations: [0n],
  },
  standard: {
    appealRounds: 1n,
    rotations: [0n, 0n],
  },
  high: {
    appealRounds: 2n,
    rotations: [0n, 0n, 0n],
  },
};

const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 300;

const toCalldataArgs = (args: unknown[] | undefined): unknown[] | undefined =>
  args;

const max = (value: bigint, floor: bigint): bigint =>
  value > floor ? value : floor;

const leaderRounds = (distribution: FeesDistribution): bigint =>
  distribution.rotations.reduce(
    (sum, rotations) => sum + rotations + 1n,
    distribution.appealRounds,
  );

const buildBreakdown = (
  estimate: TransactionFeeEstimate,
): PolicyQuote['breakdown'] => {
  const messageFees = estimate.distribution.totalMessageFees;
  const executionBudget =
    estimate.distribution.executionBudgetPerRound *
    leaderRounds(estimate.distribution);
  const timeUnitFees = max(estimate.feeValue - messageFees - executionBudget, 0n);

  return {
    timeUnitFees,
    executionBudget,
    messageFees,
  };
};

const toPolicyQuote = (
  estimate: TransactionFeeEstimate,
  userValue: bigint,
): PolicyQuote => ({
  distribution: estimate.distribution,
  feeValue: estimate.feeValue,
  userValue,
  total: estimate.feeValue + userValue,
  breakdown: buildBreakdown(estimate),
  caps: {
    genPerTimeUnit: estimate.distribution.maxPriceGenPerTimeUnit,
    storagePrice: estimate.distribution.storageFeeMaxGasPrice,
    receiptPrice: estimate.distribution.receiptFeeMaxGasPrice,
  },
  refundable: true,
});

const buildFeeOptions = (input: PolicyInput): Record<string, unknown> => ({
  ...PRESETS[input.preset ?? 'standard'],
  ...(input.overrides ?? {}),
});

const captureProviderTxHash = (provider: Eip1193Provider) => {
  let lastEvmTxHash: `0x${string}` | undefined;
  const wrapped: Eip1193Provider = {
    async request(args) {
      const result = await provider.request(args);
      if (
        args.method === 'eth_sendTransaction' &&
        typeof result === 'string' &&
        result.startsWith('0x')
      ) {
        lastEvmTxHash = result as `0x${string}`;
      }
      return result;
    },
  };

  return {
    provider: wrapped,
    getLastEvmTxHash: () => lastEvmTxHash,
  };
};

const feeTuple = (fees: FeesDistribution): unknown[] => [
  fees.leaderTimeunitsAllocation,
  fees.validatorTimeunitsAllocation,
  fees.appealRounds,
  fees.executionBudgetPerRound,
  fees.executionConsumed,
  fees.totalMessageFees,
  fees.rotations,
  fees.maxPriceGenPerTimeUnit,
  fees.storageFeeMaxGasPrice,
  fees.receiptFeeMaxGasPrice,
];

const hashFeeConfig = (distribution: FeesDistribution): `0x${string}` =>
  keccak256(
    abiCoder.encode(
      [
        'tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256[],uint256,uint256,uint256)',
        'tuple(uint8,bool,uint256,address,bytes32,uint256,bytes)[]',
      ],
      [feeTuple(distribution), []],
    ),
  ) as `0x${string}`;

const asStringRecord = (quote: PolicyQuote, tx: SubmitInput) => ({
  kind: tx.kind,
  feeValue: quote.feeValue.toString(),
  userValue: quote.userValue.toString(),
  total: quote.total.toString(),
  appealRounds: quote.distribution.appealRounds.toString(),
  rotations: quote.distribution.rotations.map(String).join(','),
  leaderTimeunitsAllocation:
    quote.distribution.leaderTimeunitsAllocation.toString(),
  validatorTimeunitsAllocation:
    quote.distribution.validatorTimeunitsAllocation.toString(),
  executionBudgetPerRound:
    quote.distribution.executionBudgetPerRound.toString(),
  totalMessageFees: quote.distribution.totalMessageFees.toString(),
  maxPriceGenPerTimeUnit:
    quote.distribution.maxPriceGenPerTimeUnit.toString(),
  storageFeeMaxGasPrice:
    quote.distribution.storageFeeMaxGasPrice.toString(),
  receiptFeeMaxGasPrice:
    quote.distribution.receiptFeeMaxGasPrice.toString(),
});

const statusNameOf = (transaction: GenLayerTransaction): string | undefined => {
  if (transaction.statusName) {
    return transaction.statusName;
  }
  if (typeof transaction.status === 'string') {
    const status = transaction.status as string;
    return /^\d+$/u.test(status)
      ? TRANSACTION_STATUS_NUMBER_TO_NAME[
          status as keyof typeof TRANSACTION_STATUS_NUMBER_TO_NAME
        ]
      : status;
  }
  if (typeof transaction.status === 'number') {
    return TRANSACTION_STATUS_NUMBER_TO_NAME[
      String(transaction.status) as keyof typeof TRANSACTION_STATUS_NUMBER_TO_NAME
    ];
  }
  return undefined;
};

const executionResultNameOf = (
  transaction: GenLayerTransaction,
): string | undefined => {
  if (transaction.txExecutionResultName) {
    return transaction.txExecutionResultName;
  }
  if (transaction.txExecutionResult === undefined) {
    return undefined;
  }
  return EXECUTION_RESULT_NUMBER_TO_NAME[
    String(
      transaction.txExecutionResult,
    ) as keyof typeof EXECUTION_RESULT_NUMBER_TO_NAME
  ];
};

const isFinalized = (statusName: string | undefined): boolean =>
  statusName === 'FINALIZED';

const isDecided = (statusName: string | undefined): boolean =>
  [
    'ACCEPTED',
    'UNDETERMINED',
    'FINALIZED',
    'CANCELED',
    'LEADER_TIMEOUT',
    'VALIDATORS_TIMEOUT',
  ].includes(statusName ?? '');

const phaseOf = (
  transaction: GenLayerTransaction,
): TrackedStatus['phase'] => {
  const statusName = statusNameOf(transaction);
  if (isFinalized(statusName)) {
    return 'finalized';
  }
  if (isDecided(statusName)) {
    return 'decided';
  }
  if (
    [
      'PROPOSING',
      'COMMITTING',
      'REVEALING',
      'APPEAL_REVEALING',
      'APPEAL_COMMITTING',
      'LEADER_REVEALING',
      'READY_TO_FINALIZE',
    ].includes(statusName ?? '')
  ) {
    return 'processing';
  }
  return 'pending';
};

const mapTrackedStatus = (
  genlayerTxId: `0x${string}`,
  transaction: GenLayerTransaction,
): TrackedStatus => {
  const statusName = statusNameOf(transaction);
  const executionResultName = executionResultNameOf(transaction);
  const phase = phaseOf(transaction);
  const contractAddress = (transaction.txDataDecoded as Record<string, unknown>)
    ?.contractAddress;

  const status: TrackedStatus = {
    phase,
    genlayerTxId: transaction.txId ?? transaction.hash ?? genlayerTxId,
  };

  if (statusName !== undefined) {
    status.statusName = statusName;
  }
  if (executionResultName !== undefined) {
    status.executionResultName = executionResultName;
  }
  if (isDecided(statusName)) {
    status.successful = sdkIsSuccessful(transaction);
  }
  if (typeof contractAddress === 'string' && contractAddress.startsWith('0x')) {
    status.contractAddress = contractAddress as `0x${string}`;
  }

  return status;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function createTransactionKit(opts: {
  chain: GenLayerChain;
  provider: Eip1193Provider;
  account?: `0x${string}`;
}): TransactionKit {
  const captured = captureProviderTxHash(opts.provider);
  const client = createClient({
    chain: opts.chain,
    provider: captured.provider,
    ...(opts.account ? { account: opts.account } : {}),
  } as never) as unknown as Client;

  const estimate = async (
    input: PolicyInput,
    tx?: SubmitInput,
  ): Promise<PolicyQuote> => {
    const userValue = input.userValue ?? 0n;
    const feeOptions = buildFeeOptions(input);
    const sdkEstimate =
      tx?.kind === 'write' && client.estimateTransactionFeesForWrite
        ? await client.estimateTransactionFeesForWrite({
            ...feeOptions,
            address: tx.address,
            functionName: tx.method,
            args: toCalldataArgs(tx.args),
            value: userValue,
          })
        : await client.estimateTransactionFees(feeOptions);

    return toPolicyQuote(sdkEstimate, userValue);
  };

  const submit = async (
    quote: PolicyQuote,
    tx: SubmitInput,
  ): Promise<{ genlayerTxId: `0x${string}`; evmTxHash?: `0x${string}` }> => {
    const fees = {
      distribution: quote.distribution,
      feeValue: quote.feeValue,
    };
    const common = {
      fees,
      value: quote.userValue,
    };
    const genlayerTxId =
      tx.kind === 'deploy'
        ? await client.deployContract({
            ...common,
            code: tx.code,
            args: toCalldataArgs(tx.args),
            leaderOnly: tx.leaderOnly,
          })
        : await client.writeContract({
            ...common,
            address: tx.address,
            functionName: tx.method,
            args: toCalldataArgs(tx.args),
          });

    const result: { genlayerTxId: `0x${string}`; evmTxHash?: `0x${string}` } = {
      genlayerTxId,
    };
    const evmTxHash = captured.getLastEvmTxHash();
    if (evmTxHash !== undefined) {
      result.evmTxHash = evmTxHash;
    }
    return result;
  };

  const track = async (
    genlayerTxId: `0x${string}`,
    onUpdate: (s: TrackedStatus) => void,
    opts?: { until?: 'decided' | 'finalized' },
  ): Promise<TrackedStatus> => {
    const until = opts?.until ?? 'finalized';
    const submitted: TrackedStatus = {
      phase: 'submitted',
      genlayerTxId,
    };
    onUpdate(submitted);

    for (let poll = 0; poll < MAX_POLLS; poll++) {
      const transaction = await client.getTransaction({ hash: genlayerTxId });
      const status = mapTrackedStatus(genlayerTxId, transaction);
      onUpdate(status);

      if (
        status.phase === 'finalized' ||
        (until === 'decided' && status.phase === 'decided')
      ) {
        return status;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Timed out tracking GenLayer transaction ${genlayerTxId}`);
  };

  return {
    estimate,
    submit,
    track,
    verification(quote: PolicyQuote, tx: SubmitInput) {
      return {
        feeConfigHash: hashFeeConfig(quote.distribution),
        summary: asStringRecord(quote, tx),
      };
    },
  };
}
