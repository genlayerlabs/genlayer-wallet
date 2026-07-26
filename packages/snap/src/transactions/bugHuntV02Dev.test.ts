import {
  buildAddTransactionParams,
  estimateFees,
  makeDefaultForm,
} from '../../../site/src/prototype/transaction';

describe('v0.2-dev bug hunt regressions', () => {
  it('preserves uint256 form values beyond JavaScript safe-integer precision', () => {
    const saltNonce = '9007199254740993';

    const params = buildAddTransactionParams({
      ...makeDefaultForm(),
      saltNonce,
    });

    expect(params.saltNonce).toBe(BigInt(saltNonce));
  });

  it('includes appeal tribunals and appealed rounds in timeout fees', () => {
    const estimate = estimateFees({
      sender: '0x0000000000000000000000000000000000000000',
      recipient: '0x0000000000000000000000000000000000000001',
      numOfInitialValidators: 5n,
      maxRotations: 2n,
      validUntil: 0n,
      saltNonce: 0n,
      userValue: 0n,
      txCalldata: '0x',
      messageAllocations: [],
      feesDistribution: {
        leaderTimeunitsAllocation: 10n,
        validatorTimeunitsAllocation: 1n,
        appealRounds: 1n,
        executionBudgetPerRound: 0n,
        executionConsumed: 0n,
        totalMessageFees: 0n,
        rotations: [0n, 1n],
        maxPriceGenPerTimeUnit: 2n,
        storageFeeMaxGasPrice: 0n,
        receiptFeeMaxGasPrice: 0n,
      },
    });

    // 5 validators once, 7-validator appeal tribunal once, then 11
    // validators for two rotations: (15 + 17 + 42) * 2.
    expect(estimate.timeoutFees).toBe(148n);
    expect(estimate.totalFees).toBe(148n);
  });
});
