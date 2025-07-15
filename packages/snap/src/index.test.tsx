import { installSnap } from '@metamask/snaps-jest';
import { UserInputEventType } from '@metamask/snaps-sdk';

import { onTransaction, onUserInput } from '.';
import type { AdvancedOptionsFormState } from './components';
import { StateManager } from './libs/StateManager';
import { getTransactionStorageKey } from './transactions/transaction';

jest.mock('./libs/StateManager');
jest.mock('./transactions/transaction');

describe('Snap Handlers', () => {
  let snap: any;

  beforeAll(async () => {
    snap = await installSnap();
    // eslint-disable-next-line no-restricted-globals
    (global as any).snap = snap;
  });

  afterAll(() => {
    // eslint-disable-next-line no-restricted-globals
    delete (global as any).snap;
  });

  describe('onTransaction handler', () => {
    it('should set currentStorageKey and return the interface id', async () => {
      const transaction = { to: '0x123456', value: '0xabc', data: '0xa9059cbb00000000' };
      const mockStorageKey = '0x123456_a9059cbb';
      
      (getTransactionStorageKey as jest.Mock).mockReturnValue(mockStorageKey);
      (StateManager.set as jest.Mock).mockResolvedValue(undefined);
      jest.spyOn(snap, 'request').mockResolvedValue('test-interface-id');
      
      const result = await onTransaction({ transaction } as Parameters<
        typeof onTransaction
      >[0]);
      
      expect(getTransactionStorageKey).toHaveBeenCalledWith(transaction);
      expect(StateManager.set).toHaveBeenCalledWith(
        'currentStorageKey',
        mockStorageKey,
      );
      expect(result).toEqual({ id: 'test-interface-id' });
    });
  });

  describe('onUserInput handler', () => {
    it('should handle an InputChangeEvent for "number-of-appeals"', async () => {
      const interfaceId = 'interface-id-2';
      const mockStorageKey = '0xabcdef_a9059cbb';
      const event = {
        type: UserInputEventType.InputChangeEvent,
        name: 'number-of-appeals',
        value: '4',
      };
      const getMock = jest
        .spyOn(StateManager, 'get')
        .mockImplementation(async (key: string | undefined) => {
          if (key === 'currentStorageKey') {
            return mockStorageKey;
          }
          if (key === mockStorageKey) {
            return { 'number-of-appeals': '2' };
          }
          return {};
        });
      const requestMock = jest
        .spyOn(snap, 'request')
        .mockResolvedValue(undefined);
      await onUserInput({ id: interfaceId, event } as Parameters<
        typeof onUserInput
      >[0]);
      expect(getMock).toHaveBeenCalledWith('currentStorageKey');
      expect(getMock).toHaveBeenCalledWith(mockStorageKey);
      expect(requestMock).toHaveBeenCalledWith({
        method: 'snap_updateInterface',
        params: {
          id: interfaceId,
          ui: expect.any(Object),
        },
      });
      getMock.mockRestore();
      requestMock.mockRestore();
    });

    it('should handle a FormSubmitEvent for "advanced-options-form"', async () => {
      const interfaceId = 'interface-id-3';
      const mockStorageKey = '0xabcdef_a9059cbb';
      const advancedOptionsData: AdvancedOptionsFormState = {
        'leader-timeout-input': '60',
        'validator-timeout-input': '30',
        'genlayer-storage-input': '12',
        'rollup-storage-input': '12',
        'message-gas-input': '{"gas": "value"}',
        'number-of-appeals': '2',
      };
      const event = {
        type: UserInputEventType.FormSubmitEvent,
        name: 'advanced-options-form',
        value: advancedOptionsData,
      };
      const getMock = jest
        .spyOn(StateManager, 'get')
        .mockImplementation(async (key: string | undefined) => {
          if (key === 'currentStorageKey') {
            return mockStorageKey;
          }
          return {};
        });
      const setMock = jest
        .spyOn(StateManager, 'set')
        .mockResolvedValue(undefined);
      const requestMock = jest
        .spyOn(snap, 'request')
        .mockResolvedValue(undefined);
      await onUserInput({ id: interfaceId, event } as unknown as Parameters<
        typeof onUserInput
      >[0]);
      expect(getMock).toHaveBeenCalledWith('currentStorageKey');
      expect(setMock).toHaveBeenCalledWith(mockStorageKey, advancedOptionsData);
      expect(requestMock).toHaveBeenCalledWith({
        method: 'snap_updateInterface',
        params: {
          id: interfaceId,
          ui: expect.any(Object),
        },
      });
      getMock.mockRestore();
      setMock.mockRestore();
      requestMock.mockRestore();
    });
  });
});
