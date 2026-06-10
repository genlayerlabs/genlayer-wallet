import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  state: FlowState;
  preset: FeePreset;
  setPreset: (p: FeePreset) => void;
  overrides: PolicyInput['overrides'];
  setOverrides: (o: PolicyInput['overrides']) => void;
  quote: PolicyQuote | undefined;
  verification: { feeConfigHash: string; summary: Record<string, string> } | undefined;
  approve: () => Promise<void>;
  reset: () => void;
};

/**
 * Headless state machine for the approve-and-sign flow.
 * estimating → review → signing → tracking → done | error
 * Changing the preset or overrides re-estimates and returns to review.
 */
export function useTransactionFlow(opts: {
  kit: TransactionKit;
  tx: SubmitInput;
  userValue?: bigint;
  trackUntil?: 'decided' | 'finalized';
}): TransactionFlow {
  const { kit, tx, userValue, trackUntil = 'decided' } = opts;
  const [preset, setPreset] = useState<FeePreset>('standard');
  const [overrides, setOverrides] = useState<PolicyInput['overrides']>(undefined);
  const [state, setState] = useState<FlowState>({ step: 'estimating', preset: 'standard' });
  const generation = useRef(0);

  const estimate = useCallback(async () => {
    const gen = ++generation.current;
    setState({ step: 'estimating', preset });
    try {
      const quote = await kit.estimate({ preset, overrides, userValue }, tx);
      if (generation.current !== gen) return;
      setState({ step: 'review', preset, quote });
    } catch (error) {
      if (generation.current !== gen) return;
      setState({
        step: 'error',
        preset,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, preset, overrides, userValue, tx]);

  useEffect(() => {
    void estimate();
  }, [estimate]);

  const quote = 'quote' in state ? state.quote : undefined;

  const verification = useMemo(() => {
    if (!quote) return undefined;
    try {
      return kit.verification(quote, tx);
    } catch {
      return undefined;
    }
  }, [kit, quote, tx]);

  const approve = useCallback(async () => {
    if (state.step !== 'review') return;
    const { quote: approvedQuote } = state;
    setState({ step: 'signing', preset, quote: approvedQuote });
    try {
      const { genlayerTxId, evmTxHash } = await kit.submit(approvedQuote, tx);
      let last: TrackedStatus = { phase: 'submitted', genlayerTxId, evmTxHash };
      setState({ step: 'tracking', preset, quote: approvedQuote, status: last });
      last = await kit.track(
        genlayerTxId,
        (status) => {
          last = { evmTxHash, ...status };
          setState({ step: 'tracking', preset, quote: approvedQuote, status: last });
        },
        { until: trackUntil },
      );
      setState({ step: 'done', preset, quote: approvedQuote, status: { evmTxHash, ...last } });
    } catch (error) {
      setState({
        step: 'error',
        preset,
        quote: approvedQuote,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [kit, state, preset, tx, trackUntil]);

  const reset = useCallback(() => {
    void estimate();
  }, [estimate]);

  return { state, preset, setPreset, overrides, setOverrides, quote, verification, approve, reset };
}
