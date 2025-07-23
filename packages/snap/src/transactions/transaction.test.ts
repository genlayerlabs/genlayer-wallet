import { decodeRlp, getBytes } from 'ethers';

import {
  extractMethodSelector,
  generateStorageKey,
  getTransactionStorageKey,
  parseGenLayerTransaction,
} from './transaction';

// Mock the genlayer-js and ethers dependencies
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

// Import and cast the mocked modules
const { Interface: MockedInterface } = jest.requireMock('ethers');

const { abi: mockedAbi } = jest.requireMock('genlayer-js');

const mockedDecodeRlp = decodeRlp as jest.MockedFunction<typeof decodeRlp>;
const mockedGetBytes = getBytes as jest.MockedFunction<typeof getBytes>;

describe('Transaction Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGenLayerTransaction', () => {
    it('should extract contract address and method name from valid GenLayer transaction', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [
            null,
            '0x1234567890123456789012345678901234567890',
            null,
            null,
            'encodedData',
          ],
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', 'transfer');
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const result = parseGenLayerTransaction('0xabcdef123456');

      expect(result).toStrictEqual({
        contractAddress: '0x1234567890123456789012345678901234567890',
        methodName: 'transfer',
      });
    });

    it('should return defaults when GenLayer parsing fails', () => {
      MockedInterface.mockImplementation(() => {
        throw new Error('Parsing failed');
      });

      const result = parseGenLayerTransaction('0x1234567890');

      expect(result).toStrictEqual({
        contractAddress: 'default',
        methodName: 'unknown',
      });
    });

    it('should handle invalid contract address in args[1]', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [null, null, null, null, 'encodedData'], // args[1] is null
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', 'transfer');
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const result = parseGenLayerTransaction('0xabcdef123456');

      expect(result).toStrictEqual({
        contractAddress: 'default',
        methodName: 'transfer',
      });
    });

    it('should handle invalid method name', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [
            null,
            '0x1234567890123456789012345678901234567890',
            null,
            null,
            'encodedData',
          ],
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', null); // Invalid method
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const result = parseGenLayerTransaction('0xabcdef123456');

      expect(result).toStrictEqual({
        contractAddress: '0x1234567890123456789012345678901234567890',
        methodName: 'unknown',
      });
    });
  });

  describe('extractMethodSelector', () => {
    it('should extract method name using GenLayer parsing', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [
            null,
            '0x1234567890123456789012345678901234567890',
            null,
            null,
            'encodedData',
          ],
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', 'approve');
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const result = extractMethodSelector('0xabcdef123456');
      expect(result).toBe('approve');
    });

    it('should return "unknown" when parsing fails', () => {
      MockedInterface.mockImplementation(() => {
        throw new Error('Parsing failed');
      });

      const result = extractMethodSelector('0xabcdef123456');
      expect(result).toBe('unknown');
    });

    it('should return "unknown" for invalid method name', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [
            null,
            '0x1234567890123456789012345678901234567890',
            null,
            null,
            'encodedData',
          ],
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', null); // Invalid method
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const result = extractMethodSelector('0xabcdef123456');
      expect(result).toBe('unknown');
    });
  });

  describe('generateStorageKey', () => {
    it('should generate composite key with contract address and method name', () => {
      const contractAddress = '0x1234567890123456789012345678901234567890';
      const methodName = 'transfer';
      const result = generateStorageKey(contractAddress, methodName);
      expect(result).toBe(
        '0x1234567890123456789012345678901234567890_transfer',
      );
    });

    it('should handle uppercase contract address by converting to lowercase', () => {
      const contractAddress = '0xc361Fc33b99F88612257ac8cC2d852A5CEe0E217';
      const methodName = 'approve';
      const result = generateStorageKey(contractAddress, methodName);
      expect(result).toBe('0xc361fc33b99f88612257ac8cc2d852a5cee0e217_approve');
    });

    it('should use "default" for undefined contract address', () => {
      const contractAddress = undefined as any;
      const methodName = 'mint';
      const result = generateStorageKey(contractAddress, methodName);
      expect(result).toBe('default_mint');
    });

    it('should use "default" for empty contract address', () => {
      const contractAddress = '';
      const methodName = 'burn';
      const result = generateStorageKey(contractAddress, methodName);
      expect(result).toBe('default_burn');
    });
  });

  describe('getTransactionStorageKey', () => {
    it('should generate storage key using GenLayer parsing', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [
            null,
            '0x1234567890123456789012345678901234567890',
            null,
            null,
            'encodedData',
          ],
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', 'transfer');
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const transaction = {
        to: '0xConsensusContract', // This is ignored now
        data: '0xabcdef123456',
      };

      const result = getTransactionStorageKey(transaction);
      expect(result).toBe(
        '0x1234567890123456789012345678901234567890_transfer',
      );
    });

    it('should return default storage key when parsing fails', () => {
      MockedInterface.mockImplementation(() => {
        throw new Error('Parsing failed');
      });

      const transaction = {
        to: '0xConsensusContract',
        data: '0xabcdef123456',
      };

      const result = getTransactionStorageKey(transaction);
      expect(result).toBe('default_unknown');
    });

    it('should handle transaction without data', () => {
      MockedInterface.mockImplementation(() => {
        throw new Error('No data');
      });

      const transaction = {
        to: '0xConsensusContract',
      };

      const result = getTransactionStorageKey(transaction);
      expect(result).toBe('default_unknown');
    });

    it('should handle empty transaction object', () => {
      MockedInterface.mockImplementation(() => {
        throw new Error('No data');
      });

      const transaction = {};
      const result = getTransactionStorageKey(transaction);
      expect(result).toBe('default_unknown');
    });

    it('should handle different contract and method combinations', () => {
      const mockInterface = {
        parseTransaction: jest.fn().mockReturnValue({
          args: [
            null,
            '0xA0b86a33E6441D95A9C1A3b4e9b3B9b0D6b4c4B4',
            null,
            null,
            'encodedData',
          ],
        }),
      };

      MockedInterface.mockReturnValue(mockInterface as any);
      mockedDecodeRlp.mockReturnValue(['decodedCalldata']);
      mockedGetBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));

      const mockDecoded = new Map();
      mockDecoded.set('method', 'approve');
      mockedAbi.calldata.decode.mockReturnValue(mockDecoded);

      const transaction = {
        to: '0xConsensusContract',
        data: '0x095ea7b3000000000000000000000000742d35cc67d8b72ae90db9b9e4b0c7c4b4b7f2e7',
      };

      const result = getTransactionStorageKey(transaction);
      expect(result).toBe('0xa0b86a33e6441d95a9c1a3b4e9b3b9b0d6b4c4b4_approve');
    });
  });
});
