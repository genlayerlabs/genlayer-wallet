/**
 * Structural contract for @genlayer/transaction-kit (core).
 *
 * The adapters are deliberately decoupled from the core package: the dapp
 * constructs the kit with `createTransactionKit(...)` from
 * `@genlayer/transaction-kit` and passes the instance in as a prop. These
 * types mirror the core's public API structurally — TypeScript checks
 * compatibility at the call site, no runtime import needed.
 */

export type Hex = `0x${string}`;

export type FeePreset = 'low' | 'standard' | 'high';

export type FeesDistributionInput = {
  leaderTimeunitsAllocation: bigint;
  validatorTimeunitsAllocation: bigint;
  appealRounds: bigint;
  executionBudgetPerRound: bigint;
  totalMessageFees: bigint;
  rotations: bigint[];
  maxPriceGenPerTimeUnit: bigint;
  storageFeeMaxGasPrice: bigint;
  receiptFeeMaxGasPrice: bigint;
};

export type PolicyInput = {
  preset?: FeePreset;
  overrides?: Partial<FeesDistributionInput>;
  userValue?: bigint;
};

export type PolicyQuote = {
  distribution: FeesDistributionInput & { executionConsumed: bigint };
  feeValue: bigint;
  userValue: bigint;
  total: bigint;
  breakdown: {
    timeUnitFees: bigint;
    executionBudget: bigint;
    messageFees: bigint;
  };
  caps: { genPerTimeUnit: bigint; storagePrice: bigint; receiptPrice: bigint };
  refundable: true;
};

export type SubmitInput =
  | { kind: 'deploy'; code: string; args?: unknown[]; leaderOnly?: boolean }
  | { kind: 'write'; address: Hex; method: string; args?: unknown[] };

export type TrackedPhase =
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'decided'
  | 'finalized';

export type TrackedStatus = {
  phase: TrackedPhase;
  statusName?: string;
  executionResultName?: string;
  successful?: boolean;
  genlayerTxId?: Hex;
  evmTxHash?: Hex;
  contractAddress?: Hex;
};

export type TransactionKit = {
  estimate(input: PolicyInput, tx?: SubmitInput): Promise<PolicyQuote>;
  submit(
    quote: PolicyQuote,
    tx: SubmitInput,
  ): Promise<{ genlayerTxId: Hex; evmTxHash?: Hex }>;
  track(
    genlayerTxId: Hex,
    onUpdate: (s: TrackedStatus) => void,
    opts?: { until?: 'decided' | 'finalized' },
  ): Promise<TrackedStatus>;
  verification(
    quote: PolicyQuote,
    tx: SubmitInput,
  ): { feeConfigHash: Hex; summary: Record<string, string> };
};
