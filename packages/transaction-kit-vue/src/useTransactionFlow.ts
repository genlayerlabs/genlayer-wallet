import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import type {
  FeePreset,
  PolicyInput,
  PolicyQuote,
  SubmitInput,
  TrackedStatus,
  TransactionKit,
} from './contract';

export type FlowState =
  | { step: 'estimating'; preset: FeePreset }
  | { step: 'review'; preset: FeePreset; quote: PolicyQuote }
  | { step: 'signing'; preset: FeePreset; quote: PolicyQuote }
  | { step: 'tracking'; preset: FeePreset; quote: PolicyQuote; status: TrackedStatus }
  | { step: 'done'; preset: FeePreset; quote: PolicyQuote; status: TrackedStatus }
  | { step: 'error'; preset: FeePreset; quote?: PolicyQuote; message: string };

export type TransactionFlow = {
  state: Ref<FlowState>;
  preset: Ref<FeePreset>;
  overrides: Ref<PolicyInput['overrides']>;
  quote: ComputedRef<PolicyQuote | undefined>;
  verification: ComputedRef<{ feeConfigHash: string; summary: Record<string, string> } | undefined>;
  approve: () => Promise<void>;
  reset: () => void;
};

/** Vue composition mirror of the React useTransactionFlow state machine. */
export function useTransactionFlow(opts: {
  kit: TransactionKit;
  tx: SubmitInput;
  userValue?: bigint;
  trackUntil?: 'decided' | 'finalized';
}): TransactionFlow {
  const { kit, tx, userValue, trackUntil = 'decided' } = opts;
  const preset = ref<FeePreset>('standard');
  const overrides = shallowRef<PolicyInput['overrides']>(undefined);
  const state = shallowRef<FlowState>({ step: 'estimating', preset: 'standard' }) as Ref<FlowState>;
  let generation = 0;

  async function estimate(): Promise<void> {
    const gen = ++generation;
    state.value = { step: 'estimating', preset: preset.value };
    try {
      const quote = await kit.estimate(
        { preset: preset.value, overrides: overrides.value, userValue },
        tx,
      );
      if (generation !== gen) return;
      state.value = { step: 'review', preset: preset.value, quote };
    } catch (error) {
      if (generation !== gen) return;
      state.value = {
        step: 'error',
        preset: preset.value,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  watch([preset, overrides], () => void estimate(), { immediate: true });

  const quote = computed(() => ('quote' in state.value ? state.value.quote : undefined));

  const verification = computed(() => {
    const current = quote.value;
    if (!current) return undefined;
    try {
      return kit.verification(current, tx);
    } catch {
      return undefined;
    }
  });

  async function approve(): Promise<void> {
    const current = state.value;
    if (current.step !== 'review') return;
    const approvedQuote = current.quote;
    state.value = { step: 'signing', preset: preset.value, quote: approvedQuote };
    try {
      const { genlayerTxId, evmTxHash } = await kit.submit(approvedQuote, tx);
      let last: TrackedStatus = { phase: 'submitted', genlayerTxId, evmTxHash };
      state.value = { step: 'tracking', preset: preset.value, quote: approvedQuote, status: last };
      last = await kit.track(
        genlayerTxId,
        (status) => {
          last = { evmTxHash, ...status };
          state.value = {
            step: 'tracking',
            preset: preset.value,
            quote: approvedQuote,
            status: last,
          };
        },
        { until: trackUntil },
      );
      state.value = {
        step: 'done',
        preset: preset.value,
        quote: approvedQuote,
        status: { evmTxHash, ...last },
      };
    } catch (error) {
      state.value = {
        step: 'error',
        preset: preset.value,
        quote: approvedQuote,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    state,
    preset,
    overrides,
    quote,
    verification,
    approve,
    reset: () => void estimate(),
  };
}
