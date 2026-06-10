// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockKit } from '../src/mock';
import { useTransactionFlow } from '../src/useTransactionFlow';

const tx = { kind: 'deploy', code: 'class C: pass' } as const;
const fast = { estimate: 5, submit: 5, step: 5 };

describe('useTransactionFlow', () => {
  it('estimates into review, approves through tracking to done', async () => {
    const kit = createMockKit({ delays: fast });
    const { result } = renderHook(() => useTransactionFlow({ kit, tx }));
    await waitFor(() => expect(result.current.state.step).toBe('review'));
    expect(result.current.quote?.total).toBeGreaterThan(0n);
    await act(async () => {
      await result.current.approve();
    });
    await waitFor(() => expect(result.current.state.step).toBe('done'));
    const state = result.current.state;
    if (state.step !== 'done') throw new Error('expected done');
    expect(state.status.successful).toBe(true);
  });

  it('UNDETERMINED outcome lands as done but not successful', async () => {
    const kit = createMockKit({
      delays: fast,
      outcome: { statusName: 'UNDETERMINED', executionResultName: 'FINISHED_WITH_RETURN' },
    });
    const { result } = renderHook(() => useTransactionFlow({ kit, tx }));
    await waitFor(() => expect(result.current.state.step).toBe('review'));
    await act(async () => {
      await result.current.approve();
    });
    await waitFor(() => expect(result.current.state.step).toBe('done'));
    const state = result.current.state;
    if (state.step !== 'done') throw new Error('expected done');
    expect(state.status.successful).toBe(false);
  });

  it('wallet rejection surfaces as a named error', async () => {
    const kit = createMockKit({ delays: fast, failWith: 'user rejected the request (4001)' });
    const { result } = renderHook(() => useTransactionFlow({ kit, tx }));
    await waitFor(() => expect(result.current.state.step).toBe('review'));
    await act(async () => {
      await result.current.approve();
    });
    await waitFor(() => expect(result.current.state.step).toBe('error'));
  });
});
