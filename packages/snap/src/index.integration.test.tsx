import { UserInputEventType } from '@metamask/snaps-sdk';
import { abi } from 'genlayer-js';

import { onTransaction, onUserInput } from '.';
import { buildFeeAwareAddTransactionData } from './transactions/transactionTestFixtures';

jest.mock('genlayer-js', () => ({
  abi: {
    calldata: {
      decode: jest.fn(),
    },
  },
}));

const mockedDecode = abi.calldata.decode as jest.Mock;

describe('Snap transaction insight flow', () => {
  let state: Record<string, unknown>;
  let createInterfaceParams: Record<string, any> | undefined;
  let updateInterfaceParams: Record<string, any> | undefined;
  let requestMock: jest.Mock;

  beforeEach(() => {
    state = {};
    createInterfaceParams = undefined;
    updateInterfaceParams = undefined;
    mockedDecode.mockReturnValue(new Map([['method', 'claim']]));

    requestMock = jest.fn(async ({ method, params }) => {
      if (method === 'snap_manageState') {
        if (params.operation === 'get') {
          return state;
        }
        if (params.operation === 'update') {
          state = params.newState;
          return null;
        }
        if (params.operation === 'clear') {
          state = {};
          return null;
        }
      }
      if (method === 'snap_createInterface') {
        createInterfaceParams = params;
        return 'interface-id';
      }
      if (method === 'snap_updateInterface') {
        updateInterfaceParams = params;
        return null;
      }
      throw new Error(`unexpected snap request: ${String(method)}`);
    });

    (globalThis as any).snap = { request: requestMock };
  });

  afterEach(() => {
    delete (globalThis as any).snap;
  });

  it('creates a fee-aware insight interface and stores the parsed policy', async () => {
    const result = await onTransaction({
      transaction: {
        to: '0x0000000000000000000000000000000000000000',
        value: '0x2f',
        data: buildFeeAwareAddTransactionData(),
      },
    } as Parameters<typeof onTransaction>[0]);

    expect(result).toStrictEqual({ id: 'interface-id' });
    expect(state.currentStorageKey).toBe(
      '0x1234567890123456789012345678901234567890_claim',
    );

    const transactionSummary = createInterfaceParams?.context
      ?.transactionSummary as Record<string, unknown>;
    expect(transactionSummary.kind).toBe('fee-aware');
    expect(transactionSummary.messageAllocationMode).toBe('mode-2');
    expect(transactionSummary.messageAllocationsCount).toBe(2);
    expect(transactionSummary).toStrictEqual(
      state[
        '0x1234567890123456789012345678901234567890_claim:transactionSummary'
      ],
    );
  });

  it('returns from advanced options without losing the parsed fee policy', async () => {
    await onTransaction({
      transaction: {
        to: '0x0000000000000000000000000000000000000000',
        value: '0x2f',
        data: buildFeeAwareAddTransactionData(),
      },
    } as Parameters<typeof onTransaction>[0]);

    await onUserInput({
      id: 'interface-id',
      event: {
        type: UserInputEventType.ButtonClickEvent,
        name: 'advanced_options',
      },
    } as Parameters<typeof onUserInput>[0]);

    await onUserInput({
      id: 'interface-id',
      event: {
        type: UserInputEventType.ButtonClickEvent,
        name: 'cancel_config',
      },
    } as Parameters<typeof onUserInput>[0]);

    expect(updateInterfaceParams?.ui).toStrictEqual(expect.any(Object));
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'snap_updateInterface' }),
    );
  });
});
