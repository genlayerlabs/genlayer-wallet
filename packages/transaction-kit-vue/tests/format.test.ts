import { describe, expect, it } from 'vitest';
import { describeError, describeOutcome, formatGen } from '../src/format';

describe('formatGen', () => {
  it('formats zero and whole values', () => {
    expect(formatGen(0n)).toBe('0');
    expect(formatGen(2n * 10n ** 18n)).toBe('2');
  });
  it('anchors significant digits for tiny values', () => {
    expect(formatGen(1_234_500_000_000_000n)).toBe('0.001234');
    expect(formatGen(7n)).toBe('0.000000000000000007');
  });
});

describe('describeOutcome', () => {
  it('treats UNDETERMINED + leader return as NOT successful', () => {
    const outcome = describeOutcome('UNDETERMINED', 'FINISHED_WITH_RETURN');
    expect(outcome.tone).toBe('warn');
    expect(outcome.title).toBe('Undetermined');
  });
  it('accepted + return is success', () => {
    expect(describeOutcome('ACCEPTED', 'FINISHED_WITH_RETURN').tone).toBe('success');
  });
  it('accepted + error is an execution failure', () => {
    expect(describeOutcome('ACCEPTED', 'FINISHED_WITH_ERROR').tone).toBe('error');
  });
});

describe('describeError', () => {
  it('names MaxPriceExceeded', () => {
    expect(describeError('reverted: MaxPriceExceeded(1,2)').title).toBe('Price moved above your cap');
  });
  it('names the selector-only FeeValueMustBeNonZero case', () => {
    expect(describeError('custom error FeeValueMustBeNonZero: 6').title).toBe(
      'Incomplete fee configuration',
    );
  });
});
