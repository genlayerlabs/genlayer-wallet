import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeesDistribution, GenLayerChain } from 'genlayer-js/types';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  isSuccessful: vi.fn((transaction: Record<string, unknown>) => {
    return (
      transaction.statusName === 'ACCEPTED' &&
      transaction.txExecutionResultName === 'FINISHED_WITH_RETURN'
    );
  }),
}));

vi.mock('genlayer-js', () => ({
  createClient: mocks.createClient,
  isSuccessful: mocks.isSuccessful,
  transactionsStatusNumberToName: {
    '0': 'UNINITIALIZED',
    '1': 'PENDING',
    '2': 'PROPOSING',
    '3': 'COMMITTING',
    '4': 'REVEALING',
    '5': 'ACCEPTED',
    '6': 'UNDETERMINED',
    '7': 'FINALIZED',
    '8': 'CANCELED',
    '12': 'VALIDATORS_TIMEOUT',
    '13': 'LEADER_TIMEOUT',
  },
  executionResultNumberToName: {
    '0': 'NOT_VOTED',
    '1': 'FINISHED_WITH_RETURN',
    '2': 'FINISHED_WITH_ERROR',
    '3': 'TIMEOUT',
    '4': 'NONDET_DISAGREE',
  },
}));

const chain = {
  id: 61999,
  name: 'GenLayer Studio',
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  isStudio: true,
} as unknown as GenLayerChain;

const distribution = (overrides: Partial<FeesDistribution> = {}) =>
  ({
    leaderTimeunitsAllocation: 10n,
    validatorTimeunitsAllocation: 20n,
    appealRounds: 1n,
    executionBudgetPerRound: 100n,
    executionConsumed: 0n,
    totalMessageFees: 20n,
    rotations: [0n, 0n],
    maxPriceGenPerTimeUnit: 3n,
    storageFeeMaxGasPrice: 4n,
    receiptFeeMaxGasPrice: 5n,
    ...overrides,
  }) satisfies FeesDistribution;

const provider = (hash = `0x${'a'.repeat(64)}`) => ({
  request: vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_sendTransaction') {
      return hash;
    }
    return undefined;
  }),
});

describe('transaction kit core', () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.isSuccessful.mockClear();
  });

  it('returns coherent policy quotes and uses the standard preset by default', async () => {
    const client = {
      estimateTransactionFees: vi.fn(async () => ({
        distribution: distribution(),
        feeValue: 350n,
        policy: {
          enabled: true,
          genPerTimeUnit: 3n,
          storageUnitPrice: 4n,
          receiptGasPrice: 5n,
          executionBudgetFloor: 0n,
        },
      })),
    };
    mocks.createClient.mockReturnValue(client);

    const { createTransactionKit } = await import('../src/index');
    const kit = createTransactionKit({
      chain,
      provider: provider(),
      account: `0x${'1'.repeat(40)}`,
    });

    const quote = await kit.estimate({ userValue: 7n });

    expect(client.estimateTransactionFees).toHaveBeenCalledWith({
      appealRounds: 1n,
      rotations: [0n, 0n],
    });
    expect(quote.total).toBe(357n);
    expect(quote.breakdown.executionBudget).toBe(300n);
    expect(quote.breakdown.messageFees).toBe(20n);
    expect(quote.breakdown.timeUnitFees).toBe(30n);
    expect(
      quote.breakdown.executionBudget +
        quote.breakdown.messageFees +
        quote.breakdown.timeUnitFees,
    ).toBeLessThanOrEqual(quote.feeValue);
    expect(quote.refundable).toBe(true);
  });

  it('uses write-targeted estimation when a write transaction is supplied', async () => {
    const client = {
      estimateTransactionFeesForWrite: vi.fn(async () => ({
        distribution: distribution({ appealRounds: 2n, rotations: [0n, 0n, 0n] }),
        feeValue: 600n,
        policy: {
          enabled: true,
          genPerTimeUnit: 3n,
          storageUnitPrice: 4n,
          receiptGasPrice: 5n,
          executionBudgetFloor: 0n,
        },
      })),
      estimateTransactionFees: vi.fn(),
    };
    mocks.createClient.mockReturnValue(client);

    const { createTransactionKit } = await import('../src/index');
    const kit = createTransactionKit({
      chain,
      provider: provider(),
      account: `0x${'1'.repeat(40)}`,
    });

    await kit.estimate(
      { preset: 'high', userValue: 9n },
      {
        kind: 'write',
        address: `0x${'2'.repeat(40)}`,
        method: 'update_storage',
        args: ['value'],
      },
    );

    expect(client.estimateTransactionFeesForWrite).toHaveBeenCalledWith({
      appealRounds: 2n,
      rotations: [0n, 0n, 0n],
      address: `0x${'2'.repeat(40)}`,
      functionName: 'update_storage',
      args: ['value'],
      value: 9n,
    });
    expect(client.estimateTransactionFees).not.toHaveBeenCalled();
  });

  it('submits through the SDK provider path and returns the captured EVM hash', async () => {
    const evmTxHash = `0x${'b'.repeat(64)}` as const;
    const injected = provider(evmTxHash);
    let sdkProvider: typeof injected | undefined;
    const client = {
      writeContract: vi.fn(async () => {
        await sdkProvider?.request({
          method: 'eth_sendTransaction',
          params: [{ to: `0x${'3'.repeat(40)}` }],
        });
        return `0x${'c'.repeat(64)}`;
      }),
    };
    mocks.createClient.mockImplementation((config) => {
      sdkProvider = config.provider;
      return client;
    });

    const { createTransactionKit } = await import('../src/index');
    const kit = createTransactionKit({
      chain,
      provider: injected,
      account: `0x${'1'.repeat(40)}`,
    });
    const quote = {
      distribution: distribution(),
      feeValue: 350n,
      userValue: 11n,
      total: 361n,
      breakdown: {
        timeUnitFees: 30n,
        executionBudget: 300n,
        messageFees: 20n,
      },
      caps: {
        genPerTimeUnit: 3n,
        storagePrice: 4n,
        receiptPrice: 5n,
      },
      refundable: true,
    } as const;

    const result = await kit.submit(quote, {
      kind: 'write',
      address: `0x${'2'.repeat(40)}`,
      method: 'store',
      args: ['x'],
    });

    expect(client.writeContract).toHaveBeenCalledWith({
      fees: {
        distribution: quote.distribution,
        feeValue: 350n,
      },
      value: 11n,
      address: `0x${'2'.repeat(40)}`,
      functionName: 'store',
      args: ['x'],
    });
    expect(injected.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: [{ to: `0x${'3'.repeat(40)}` }],
    });
    expect(result).toEqual({
      genlayerTxId: `0x${'c'.repeat(64)}`,
      evmTxHash,
    });
  });

  it('tracks submitted to decided and maps successful transactions', async () => {
    const client = {
      getTransaction: vi.fn(async () => ({
        statusName: 'ACCEPTED',
        txExecutionResultName: 'FINISHED_WITH_RETURN',
        txId: `0x${'d'.repeat(64)}`,
      })),
    };
    mocks.createClient.mockReturnValue(client);

    const { createTransactionKit } = await import('../src/index');
    const kit = createTransactionKit({
      chain,
      provider: provider(),
      account: `0x${'1'.repeat(40)}`,
    });
    const updates: unknown[] = [];

    const final = await kit.track(
      `0x${'d'.repeat(64)}`,
      (status) => updates.push(status),
      { until: 'decided' },
    );

    expect(updates).toMatchObject([
      { phase: 'submitted' },
      {
        phase: 'decided',
        statusName: 'ACCEPTED',
        executionResultName: 'FINISHED_WITH_RETURN',
        successful: true,
      },
    ]);
    expect(final.successful).toBe(true);
  });

  it('does not mark UNDETERMINED plus FINISHED_WITH_RETURN as successful', async () => {
    const client = {
      getTransaction: vi.fn(async () => ({
        statusName: 'UNDETERMINED',
        txExecutionResultName: 'FINISHED_WITH_RETURN',
        txId: `0x${'e'.repeat(64)}`,
      })),
    };
    mocks.createClient.mockReturnValue(client);

    const { createTransactionKit } = await import('../src/index');
    const kit = createTransactionKit({
      chain,
      provider: provider(),
      account: `0x${'1'.repeat(40)}`,
    });

    const final = await kit.track(
      `0x${'e'.repeat(64)}`,
      () => undefined,
      { until: 'decided' },
    );

    expect(final).toMatchObject({
      phase: 'decided',
      statusName: 'UNDETERMINED',
      executionResultName: 'FINISHED_WITH_RETURN',
      successful: false,
    });
  });

  it('returns a stable verification hash for identical quotes', async () => {
    mocks.createClient.mockReturnValue({});

    const { createTransactionKit } = await import('../src/index');
    const kit = createTransactionKit({
      chain,
      provider: provider(),
      account: `0x${'1'.repeat(40)}`,
    });
    const quote = {
      distribution: distribution(),
      feeValue: 350n,
      userValue: 0n,
      total: 350n,
      breakdown: {
        timeUnitFees: 30n,
        executionBudget: 300n,
        messageFees: 20n,
      },
      caps: {
        genPerTimeUnit: 3n,
        storagePrice: 4n,
        receiptPrice: 5n,
      },
      refundable: true,
    } as const;
    const tx = {
      kind: 'deploy',
      code: 'class Contract: pass',
      args: [],
    } as const;

    const first = kit.verification(quote, tx);
    const second = kit.verification(quote, tx);

    expect(first.feeConfigHash).toBe(second.feeConfigHash);
    expect(first.feeConfigHash).toMatch(/^0x[0-9a-f]{64}$/u);
    expect(first.summary.total).toBe('350');
  });
});
