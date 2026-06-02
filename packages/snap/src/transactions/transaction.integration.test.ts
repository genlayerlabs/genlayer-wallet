import { abi } from 'genlayer-js';

import { parseGenLayerTransaction } from './transaction';
import {
  buildDeploySaltedTransactionData,
  buildFeeAwareAddTransactionData,
  buildSubmitAppealTransactionData,
  buildTopUpAndSubmitAppealTransactionData,
  buildTopUpFeesTransactionData,
  RECIPIENT_ADDRESS,
  TX_ID,
} from './transactionTestFixtures';

jest.mock('genlayer-js', () => ({
  abi: {
    calldata: {
      decode: jest.fn(),
    },
  },
}));

const mockedDecode = abi.calldata.decode as jest.Mock;

describe('Transaction Utilities integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDecode.mockReturnValue(new Map([['method', 'claim']]));
  });

  it('decodes real fee-aware addTransaction calldata built with the consensus ABI', () => {
    const result = parseGenLayerTransaction(buildFeeAwareAddTransactionData());

    expect(result).toStrictEqual({
      contractAddress: RECIPIENT_ADDRESS,
      methodName: 'claim',
      kind: 'fee-aware',
      userValue: '7',
      validUntil: '123',
      saltNonce: '0',
      feesDistribution: {
        leaderTimeunitsAllocation: '10',
        validatorTimeunitsAllocation: '20',
        appealRounds: '1',
        executionBudgetPerRound: '30',
        executionConsumed: '0',
        totalMessageFees: '40',
        rotations: ['0', '1'],
        maxPriceGenPerTimeUnit: '50',
        storageFeeMaxGasPrice: '60',
        receiptFeeMaxGasPrice: '70',
      },
      messageAllocationMode: 'mode-2',
      messageAllocations: [
        {
          messageType: 'Internal',
          onAcceptance: true,
          parentIndex:
            '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          recipient: '0x1111111111111111111111111111111111111111',
          callKey:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          budget: '25',
          feeParams: '0x1234',
        },
        {
          messageType: 'External',
          onAcceptance: false,
          parentIndex: '0',
          recipient: '0x2222222222222222222222222222222222222222',
          callKey:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          budget: '15',
          feeParams: '0xabcd',
        },
      ],
      messageAllocationsCount: 2,
    });
  });

  it('decodes deploySalted fee-aware calldata as a deploy transaction', () => {
    const result = parseGenLayerTransaction(buildDeploySaltedTransactionData());

    expect(result.kind).toBe('deploy-salted');
    expect(result.contractAddress).toBe(RECIPIENT_ADDRESS);
    expect(result.methodName).toBe('claim');
    expect(result.saltNonce).toBe('99');
    expect(result.messageAllocationMode).toBe('mode-2');
  });

  it('decodes topUpFees calldata as a fee-management transaction', () => {
    const result = parseGenLayerTransaction(buildTopUpFeesTransactionData());

    expect(result.kind).toBe('top-up-fees');
    expect(result.contractAddress).toBe('consensus');
    expect(result.methodName).toBe('topUpFees');
    expect(result.txId).toBe(TX_ID);
    expect(result.feesDistribution?.totalMessageFees).toBe('25');
    expect(result.feesDistribution?.maxPriceGenPerTimeUnit).toBe('50');
    expect(result.messageAllocationMode).toBe('mode-1');
    expect(result.messageAllocationsCount).toBe(0);
  });

  it('decodes submitAppeal calldata as an appeal transaction', () => {
    const result = parseGenLayerTransaction(buildSubmitAppealTransactionData());

    expect(result.kind).toBe('submit-appeal');
    expect(result.contractAddress).toBe('consensus');
    expect(result.methodName).toBe('submitAppeal');
    expect(result.txId).toBe(TX_ID);
    expect(result.feesDistribution).toBeUndefined();
  });

  it('decodes topUpAndSubmitAppeal calldata as a fee-management appeal transaction', () => {
    const result = parseGenLayerTransaction(
      buildTopUpAndSubmitAppealTransactionData(),
    );

    expect(result.kind).toBe('top-up-and-submit-appeal');
    expect(result.contractAddress).toBe('consensus');
    expect(result.methodName).toBe('topUpAndSubmitAppeal');
    expect(result.txId).toBe(TX_ID);
    expect(result.feesDistribution?.totalMessageFees).toBe('25');
    expect(result.feesDistribution?.receiptFeeMaxGasPrice).toBe('70');
  });
});
