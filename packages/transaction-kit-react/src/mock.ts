import type {
  Hex,
  PolicyInput,
  PolicyQuote,
  SubmitInput,
  TrackedStatus,
  TransactionKit,
} from './contract';

const PRESET_APPEALS: Record<string, bigint> = { low: 0n, standard: 1n, high: 2n };
const GEN_PER_TIME_UNIT = 10n ** 15n;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deterministic mock kit for demos and component tests. Mirrors the shapes
 * the real @genlayer/transaction-kit core produces; no network access.
 */
export function createMockKit(opts?: {
  failWith?: string;
  outcome?: { statusName: string; executionResultName: string };
  delays?: { estimate?: number; submit?: number; step?: number };
}): TransactionKit {
  const delays = { estimate: 350, submit: 500, step: 600, ...opts?.delays };
  return {
    async estimate(input: PolicyInput): Promise<PolicyQuote> {
      await sleep(delays.estimate);
      const appeals = PRESET_APPEALS[input.preset ?? 'standard'] ?? 1n;
      const rotations = Array.from({ length: Number(appeals) + 1 }, () => 0n);
      const leaderRounds = BigInt(rotations.length) + appeals;
      const timeUnits = (100n + 5n * 200n) * (appeals * 2n + 1n);
      const timeUnitFees = timeUnits * GEN_PER_TIME_UNIT;
      const budgetPerRound = input.overrides?.executionBudgetPerRound ?? 76_548_000_000_000n;
      const executionBudget = budgetPerRound * leaderRounds;
      const messageFees = input.overrides?.totalMessageFees ?? 0n;
      const userValue = input.userValue ?? 0n;
      const feeValue = timeUnitFees + executionBudget + messageFees;
      return {
        distribution: {
          leaderTimeunitsAllocation: 100n,
          validatorTimeunitsAllocation: 200n,
          appealRounds: appeals,
          executionBudgetPerRound: budgetPerRound,
          executionConsumed: 0n,
          totalMessageFees: messageFees,
          rotations,
          maxPriceGenPerTimeUnit: (GEN_PER_TIME_UNIT * 12n) / 10n,
          storageFeeMaxGasPrice: 12n,
          receiptFeeMaxGasPrice: 300_000_000n,
        },
        feeValue,
        userValue,
        total: feeValue + userValue,
        breakdown: { timeUnitFees, executionBudget, messageFees },
        caps: {
          genPerTimeUnit: (GEN_PER_TIME_UNIT * 12n) / 10n,
          storagePrice: 12n,
          receiptPrice: 300_000_000n,
        },
        refundable: true,
      };
    },

    async submit(): Promise<{ genlayerTxId: Hex; evmTxHash?: Hex }> {
      await sleep(delays.submit);
      if (opts?.failWith) throw new Error(opts.failWith);
      return {
        genlayerTxId: ('0x' + 'ab'.repeat(32)) as Hex,
        evmTxHash: ('0x' + 'cd'.repeat(32)) as Hex,
      };
    },

    async track(genlayerTxId, onUpdate): Promise<TrackedStatus> {
      const outcome = opts?.outcome ?? {
        statusName: 'ACCEPTED',
        executionResultName: 'FINISHED_WITH_RETURN',
      };
      const steps: TrackedStatus[] = [
        { phase: 'pending', genlayerTxId },
        { phase: 'processing', genlayerTxId },
        {
          phase: 'decided',
          genlayerTxId,
          statusName: outcome.statusName,
          executionResultName: outcome.executionResultName,
          successful:
            ['ACCEPTED', 'FINALIZED'].includes(outcome.statusName.toUpperCase()) &&
            outcome.executionResultName.toUpperCase() === 'FINISHED_WITH_RETURN',
          contractAddress: ('0x' + '12'.repeat(20)) as Hex,
        },
      ];
      let last: TrackedStatus = { phase: 'submitted', genlayerTxId };
      for (const step of steps) {
        await sleep(delays.step);
        last = step;
        onUpdate(step);
      }
      return last;
    },

    verification(quote: PolicyQuote, tx: SubmitInput) {
      const fingerprint = [
        quote.feeValue,
        quote.distribution.appealRounds,
        quote.distribution.executionBudgetPerRound,
        tx.kind,
      ].join('|');
      let hash = 0n;
      for (const char of fingerprint) hash = (hash * 31n + BigInt(char.charCodeAt(0))) % 2n ** 160n;
      return {
        feeConfigHash: (`0x${hash.toString(16).padStart(40, '0')}`) as Hex,
        summary: { total: quote.total.toString(), kind: tx.kind },
      };
    },
  };
}
