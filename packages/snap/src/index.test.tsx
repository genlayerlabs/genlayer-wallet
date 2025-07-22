
import { installSnap } from '@metamask/snaps-jest';

import { onRpcRequest, onTransaction, onUserInput } from '.';
import { StateManager } from './libs/StateManager';
import {
  setDefaultFeeConfig,
  getTransactionStorageKey,
} from './transactions/transaction';



jest.mock('genlayer-js', () => ({
  abi: {
    calldata: {
      decode: jest.fn(),
    },
  },
  chains: {
    localnet: {
      consensusMainContract: {
        abi: [],
      },
    },
  },
}));

jest.mock('ethers', () => ({
  Interface: jest.fn(),
  decodeRlp: jest.fn(),
  getBytes: jest.fn(),
}));

// Mock the transaction module
jest.mock('./transactions/transaction', () => ({
  ...jest.requireActual('./transactions/transaction'),
  setDefaultFeeConfig: jest.fn(),
  getTransactionStorageKey: jest.fn(),
}));

// Mock StateManager
jest.mock('./libs/StateManager', () => ({
  StateManager: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
}));

const mockedSetDefaultFeeConfig = setDefaultFeeConfig as jest.MockedFunction<
  typeof setDefaultFeeConfig
>;
const mockedGetTransactionStorageKey =
  getTransactionStorageKey as jest.MockedFunction<
    typeof getTransactionStorageKey
  >;
const mockedStateManager = StateManager as jest.Mocked<typeof StateManager>;

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onRpcRequest handler', () => {
    describe('setDefaultFeeConfig', () => {
      it('should successfully set default fee config when no previous config exists', async () => {
        const request = {
          method: 'setDefaultFeeConfig',
          params: {
            contractAddress: '0x1234567890123456789012345678901234567890',
            methodName: 'transfer',
            config: {
              'leader-timeout-input': '60',
              'validator-timeout-input': '30',
              'number-of-appeals': '2',
            },
          },
        };

        mockedSetDefaultFeeConfig.mockResolvedValue(true);

        const result = await onRpcRequest({ origin: 'test', request } as any);

        expect(mockedSetDefaultFeeConfig).toHaveBeenCalledWith(
          '0x1234567890123456789012345678901234567890',
          'transfer',
          {
            'leader-timeout-input': '60',
            'validator-timeout-input': '30',
            'number-of-appeals': '2',
          },
        );
        expect(result).toEqual({ success: true });
      });

      it('should return false when previous config already exists', async () => {
        const request = {
          method: 'setDefaultFeeConfig',
          params: {
            contractAddress: '0x1234567890123456789012345678901234567890',
            methodName: 'transfer',
            config: {
              'leader-timeout-input': '60',
            },
          },
        };

        mockedSetDefaultFeeConfig.mockResolvedValue(false);

        const result = await onRpcRequest({ origin: 'test', request } as any);

        expect(result).toEqual({ success: false });
      });

      it('should throw error when contract address is missing', async () => {
        const request = {
          method: 'setDefaultFeeConfig',
          params: {
            methodName: 'transfer',
            config: {
              'leader-timeout-input': '60',
            },
          },
        };

        await expect(
          onRpcRequest({ origin: 'test', request } as any),
        ).rejects.toThrow('Contract address and method name are required');
      });

      it('should throw error when method name is missing', async () => {
        const request = {
          method: 'setDefaultFeeConfig',
          params: {
            contractAddress: '0x1234567890123456789012345678901234567890',
            config: {
              'leader-timeout-input': '60',
            },
          },
        };

        await expect(
          onRpcRequest({ origin: 'test', request } as any),
        ).rejects.toThrow('Contract address and method name are required');
      });

          it('should handle missing config by passing undefined', async () => {
      const request = {
        method: 'setDefaultFeeConfig',
        params: {
          contractAddress: '0x1234567890123456789012345678901234567890',
          methodName: 'transfer',
        },
      };

      mockedSetDefaultFeeConfig.mockResolvedValue(false);

      const result = await onRpcRequest({ origin: 'test', request } as any);

      expect(mockedSetDefaultFeeConfig).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'transfer',
        undefined,
      );
      expect(result).toEqual({ success: false });
    });

      it('should handle errors from setDefaultFeeConfig', async () => {
        const request = {
          method: 'setDefaultFeeConfig',
          params: {
            contractAddress: '0x1234567890123456789012345678901234567890',
            methodName: 'transfer',
            config: {
              'leader-timeout-input': '60',
            },
          },
        };

        mockedSetDefaultFeeConfig.mockRejectedValue(new Error('Storage error'));

        await expect(
          onRpcRequest({ origin: 'test', request } as any),
        ).rejects.toThrow('Storage error');
      });
    });

    it('should throw error for unknown method', async () => {
      const request = {
        method: 'unknownMethod',
        params: {},
      };

      await expect(
        onRpcRequest({ origin: 'test', request } as any),
      ).rejects.toThrow('Method not found: unknownMethod');
    });
  });

  describe('onTransaction handler', () => {
    it('should set currentStorageKey and return the interface id', async () => {
      const transaction = {
        to: '0x123456',
        value: '0xabc',
        data: '0xa9059cbb00000000',
      };
      const mockStorageKey = '0x123456_a9059cbb';

      mockedGetTransactionStorageKey.mockReturnValue(mockStorageKey);
      mockedStateManager.set.mockResolvedValue(undefined);
      jest.spyOn(snap, 'request').mockResolvedValue('test-interface-id');

      const result = await onTransaction({ transaction } as Parameters<
        typeof onTransaction
      >[0]);

      expect(mockedGetTransactionStorageKey).toHaveBeenCalledWith(transaction);
      expect(mockedStateManager.set).toHaveBeenCalledWith(
        'currentStorageKey',
        mockStorageKey,
      );
      expect(result).toEqual({ id: 'test-interface-id' });
    });
  });

  describe('onUserInput handler', () => {
    it('should handle number-of-appeals input change event', async () => {
      const id = 'test-interface-id';
      const event = {
        type: 'InputChangeEvent',
        name: 'number-of-appeals',
        value: '3',
      };

      mockedStateManager.get
        .mockResolvedValueOnce('current-storage-key') // currentStorageKey
        .mockResolvedValueOnce({ 'number-of-appeals': '2' }); // persistedData

      jest.spyOn(snap, 'request').mockResolvedValue(undefined);

      await onUserInput({ id, event } as any);

      expect(mockedStateManager.get).toHaveBeenCalledWith('currentStorageKey');
      expect(mockedStateManager.get).toHaveBeenCalledWith(
        'current-storage-key',
      );
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: expect.any(Object),
        },
      });
    });

    it('should handle cancel_config button click event', async () => {
      const id = 'test-interface-id';
      const event = {
        type: 'ButtonClickEvent',
        name: 'cancel_config',
      };

      jest.spyOn(snap, 'request').mockResolvedValue(undefined);

      await onUserInput({ id, event } as any);

      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: expect.any(Object),
        },
      });
    });

    it('should handle advanced_options button click event', async () => {
      const id = 'test-interface-id';
      const event = {
        type: 'ButtonClickEvent',
        name: 'advanced_options',
      };

      mockedStateManager.get
        .mockResolvedValueOnce('current-storage-key') // currentStorageKey
        .mockResolvedValueOnce({ 'number-of-appeals': '2' }); // persistedData

      jest.spyOn(snap, 'request').mockResolvedValue(undefined);

      await onUserInput({ id, event } as any);

      expect(mockedStateManager.get).toHaveBeenCalledWith('currentStorageKey');
      expect(mockedStateManager.get).toHaveBeenCalledWith(
        'current-storage-key',
      );
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: expect.any(Object),
        },
      });
    });

    it('should handle advanced-options-form form submit event', async () => {
      const id = 'test-interface-id';
      const event = {
        type: 'FormSubmitEvent',
        name: 'advanced-options-form',
        value: {
          'leader-timeout-input': '60',
          'number-of-appeals': '2',
        },
      };

      mockedStateManager.get.mockResolvedValue('current-storage-key');
      mockedStateManager.set.mockResolvedValue(undefined);
      jest.spyOn(snap, 'request').mockResolvedValue(undefined);

      await onUserInput({ id, event } as any);

      expect(mockedStateManager.get).toHaveBeenCalledWith('currentStorageKey');
      expect(mockedStateManager.set).toHaveBeenCalledWith(
        'current-storage-key',
        event.value,
      );
      expect(snap.request).toHaveBeenCalledWith({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: expect.any(Object),
        },
      });
    });

    it('should handle unknown button click event', async () => {
      const id = 'test-interface-id';
      const event = {
        type: 'ButtonClickEvent',
        name: 'unknown_button',
      };

      jest.spyOn(snap, 'request').mockResolvedValue(undefined);

      await onUserInput({ id, event } as any);

      expect(snap.request).not.toHaveBeenCalled();
    });
  });
});
