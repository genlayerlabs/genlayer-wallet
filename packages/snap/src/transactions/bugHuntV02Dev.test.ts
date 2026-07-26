import {
  buildAddTransactionParams,
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
});
