const WEI = 10n ** 18n;

/** Split a wei amount into whole-GEN and an 18-digit fractional string. */
export function splitGen(wei: bigint): { whole: string; fraction: string } {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = (abs / WEI).toString();
  const fraction = (abs % WEI).toString().padStart(18, '0');
  return { whole: negative ? `-${whole}` : whole, fraction };
}

/**
 * Human GEN amount: at least 4 significant fractional digits, anchored at the
 * first non-zero digit for tiny values, trailing zeros trimmed.
 * 1234500000000000n → "0.0012345"
 */
export function formatGen(wei: bigint): string {
  if (wei === 0n) return '0';
  const { whole, fraction } = splitGen(wei);
  if (fraction === '0'.repeat(18)) return whole;
  const firstSignificant = fraction.search(/[1-9]/u);
  const keep = Math.min(18, Math.max(4, firstSignificant + 4));
  const trimmed = fraction.slice(0, keep).replace(/0+$/u, '');
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}

/** Group long digit runs with thin spaces for readability: 1234567 → 1 234 567 */
export function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/gu, ' ');
}

export function formatWei(wei: bigint): string {
  return `${groupDigits(wei.toString())} wei`;
}

export function shortHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/**
 * Consensus fee errors, translated for humans. Keyed by error name; matched
 * by substring against whatever the SDK surfaces.
 */
const ERROR_COPY: Array<[pattern: RegExp, title: string, detail: string]> = [
  [
    /InsufficientFees/iu,
    'Deposit too small',
    'The attached deposit does not cover the quoted fees. Nothing was charged — re-estimate and try again.',
  ],
  [
    /MaxPriceExceeded/iu,
    'Price moved above your cap',
    'The network price rose past the maximum you authorized. Nothing was charged. Re-estimate to quote at the current price.',
  ],
  [
    /BudgetTooLow|RollupBudgetBelowFloor/iu,
    'Execution budget below the network minimum',
    'The per-round execution budget cannot fit even the smallest receipt. Increase the budget and resubmit.',
  ],
  [
    /FeeValueMustBeNonZero/iu,
    'Incomplete fee configuration',
    'Every fee field and price cap must be set above zero. This is usually a client bug — re-estimate to rebuild the policy.',
  ],
  [
    /ExecutionBudgetExceeded/iu,
    'Execution budget exhausted',
    'The transaction consumed more storage and receipt budget than you allocated. Unused funds are refunded; increase the budget and retry.',
  ],
  [
    /MessageBudgetExceeded|MessageDeclaredBudgetInsufficient/iu,
    'Message budget exhausted',
    'The messages this transaction emits need more budget than was reserved. Increase the message bucket and retry.',
  ],
  [
    /AppealBondTooLow|InvalidAppealBond/iu,
    'Appeal bond below the minimum',
    'The appeal bond does not meet the required minimum for this round.',
  ],
  [
    /user rejected|denied|4001/iu,
    'Signature declined',
    'The request was declined in your wallet. Nothing was submitted.',
  ],
];

export function describeError(raw: string): { title: string; detail: string; raw: string } {
  for (const [pattern, title, detail] of ERROR_COPY) {
    if (pattern.test(raw)) return { title, detail, raw };
  }
  return {
    title: 'Transaction failed',
    detail: 'The transaction could not be completed. The raw error is below.',
    raw,
  };
}

/** Outcome copy for decided-but-not-successful consensus states. */
export function describeOutcome(statusName?: string, executionResultName?: string): {
  tone: 'success' | 'warn' | 'error';
  title: string;
  detail: string;
} {
  const status = (statusName ?? '').toUpperCase();
  const result = (executionResultName ?? '').toUpperCase();
  if ((status === 'ACCEPTED' || status === 'FINALIZED') && result === 'FINISHED_WITH_RETURN') {
    return {
      tone: 'success',
      title: status === 'FINALIZED' ? 'Finalized' : 'Accepted',
      detail: 'Validators agreed and the execution succeeded.',
    };
  }
  if (status === 'UNDETERMINED') {
    return {
      tone: 'warn',
      title: 'Undetermined',
      detail:
        'Validators could not reach a majority. The leader produced a result, but it was not confirmed — treat this transaction as not executed.',
    };
  }
  if (result === 'FINISHED_WITH_ERROR') {
    return {
      tone: 'error',
      title: 'Execution failed',
      detail:
        'Consensus accepted the transaction, but the contract execution ended in an error. You pay only for the work performed; the rest is refunded.',
    };
  }
  if (status === 'LEADER_TIMEOUT' || status === 'VALIDATORS_TIMEOUT') {
    return {
      tone: 'warn',
      title: status === 'LEADER_TIMEOUT' ? 'Leader timed out' : 'Validators timed out',
      detail: 'The round timed out before completion. Unused fees are refunded at finalization.',
    };
  }
  if (status === 'CANCELED') {
    return {
      tone: 'error',
      title: 'Canceled',
      detail: 'The transaction was canceled before execution. Fees were refunded.',
    };
  }
  return {
    tone: 'warn',
    title: status || 'Unknown outcome',
    detail: 'The transaction reached a terminal state that could not be classified.',
  };
}
