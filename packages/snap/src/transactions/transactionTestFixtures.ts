import { encodeRlp, Interface } from 'ethers';

const FEES_DISTRIBUTION_COMPONENTS = [
  { name: 'leaderTimeunitsAllocation', type: 'uint256' },
  { name: 'validatorTimeunitsAllocation', type: 'uint256' },
  { name: 'appealRounds', type: 'uint256' },
  { name: 'executionBudgetPerRound', type: 'uint256' },
  { name: 'executionConsumed', type: 'uint256' },
  { name: 'totalMessageFees', type: 'uint256' },
  { name: 'rotations', type: 'uint256[]' },
  { name: 'maxPriceGenPerTimeUnit', type: 'uint256' },
  { name: 'storageFeeMaxGasPrice', type: 'uint256' },
  { name: 'receiptFeeMaxGasPrice', type: 'uint256' },
];

const MESSAGE_FEE_ALLOCATION_COMPONENTS = [
  { name: 'messageType', type: 'uint8' },
  { name: 'onAcceptance', type: 'bool' },
  { name: 'parentIndex', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'callKey', type: 'bytes32' },
  { name: 'budget', type: 'uint256' },
  { name: 'feeParams', type: 'bytes' },
];

const ADD_TRANSACTION_PARAMS_COMPONENTS = [
  { name: 'sender', type: 'address' },
  { name: 'recipient', type: 'address' },
  { name: 'numOfInitialValidators', type: 'uint256' },
  { name: 'maxRotations', type: 'uint256' },
  { name: 'validUntil', type: 'uint256' },
  { name: 'saltNonce', type: 'uint256' },
  { name: 'userValue', type: 'uint256' },
  {
    name: 'feesDistribution',
    type: 'tuple',
    components: FEES_DISTRIBUTION_COMPONENTS,
  },
  { name: 'txCalldata', type: 'bytes' },
  {
    name: 'messageAllocations',
    type: 'tuple[]',
    components: MESSAGE_FEE_ALLOCATION_COMPONENTS,
  },
];

const CONSENSUS_TRANSACTION_ABI = [
  {
    type: 'function',
    name: 'addTransaction',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_params',
        type: 'tuple',
        components: ADD_TRANSACTION_PARAMS_COMPONENTS,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deploySalted',
    stateMutability: 'payable',
    inputs: [
      {
        name: '_params',
        type: 'tuple',
        components: ADD_TRANSACTION_PARAMS_COMPONENTS,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'topUpFees',
    stateMutability: 'payable',
    inputs: [
      { name: '_txId', type: 'bytes32' },
      {
        name: '_feesDistribution',
        type: 'tuple',
        components: FEES_DISTRIBUTION_COMPONENTS,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitAppeal',
    stateMutability: 'payable',
    inputs: [{ name: '_txId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'topUpAndSubmitAppeal',
    stateMutability: 'payable',
    inputs: [
      { name: '_txId', type: 'bytes32' },
      {
        name: '_feesDistribution',
        type: 'tuple',
        components: FEES_DISTRIBUTION_COMPONENTS,
      },
    ],
    outputs: [],
  },
];

const NODE_ROOT_SENTINEL =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

export const RECIPIENT_ADDRESS = '0x1234567890123456789012345678901234567890';
export const TX_ID =
  '0x9999999999999999999999999999999999999999999999999999999999999999';

const consensusInterface = new Interface(CONSENSUS_TRANSACTION_ABI);

const buildParams = (saltNonce: bigint) => ({
  sender: '0x3333333333333333333333333333333333333333',
  recipient: RECIPIENT_ADDRESS,
  numOfInitialValidators: 5n,
  maxRotations: 3n,
  validUntil: 123n,
  saltNonce,
  userValue: 7n,
  feesDistribution: {
    leaderTimeunitsAllocation: 10n,
    validatorTimeunitsAllocation: 20n,
    appealRounds: 1n,
    executionBudgetPerRound: 30n,
    executionConsumed: 0n,
    totalMessageFees: 40n,
    rotations: [0n, 1n],
    maxPriceGenPerTimeUnit: 50n,
    storageFeeMaxGasPrice: 60n,
    receiptFeeMaxGasPrice: 70n,
  },
  txCalldata: encodeRlp(['0x12345678']),
  messageAllocations: [
    {
      messageType: 1n,
      onAcceptance: true,
      parentIndex: NODE_ROOT_SENTINEL,
      recipient: '0x1111111111111111111111111111111111111111',
      callKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      budget: 25n,
      feeParams: '0x1234',
    },
    {
      messageType: 0n,
      onAcceptance: false,
      parentIndex: 0n,
      recipient: '0x2222222222222222222222222222222222222222',
      callKey:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      budget: 15n,
      feeParams: '0xabcd',
    },
  ],
});

const buildTopUpFeesDistribution = () => ({
  leaderTimeunitsAllocation: 0n,
  validatorTimeunitsAllocation: 0n,
  appealRounds: 0n,
  executionBudgetPerRound: 0n,
  executionConsumed: 0n,
  totalMessageFees: 25n,
  rotations: [0n],
  maxPriceGenPerTimeUnit: 50n,
  storageFeeMaxGasPrice: 60n,
  receiptFeeMaxGasPrice: 70n,
});

export const buildFeeAwareAddTransactionData = () =>
  consensusInterface.encodeFunctionData('addTransaction', [buildParams(0n)]);

export const buildDeploySaltedTransactionData = () =>
  consensusInterface.encodeFunctionData('deploySalted', [buildParams(99n)]);

export const buildTopUpFeesTransactionData = () =>
  consensusInterface.encodeFunctionData('topUpFees', [
    TX_ID,
    buildTopUpFeesDistribution(),
  ]);

export const buildSubmitAppealTransactionData = () =>
  consensusInterface.encodeFunctionData('submitAppeal', [TX_ID]);

export const buildTopUpAndSubmitAppealTransactionData = () =>
  consensusInterface.encodeFunctionData('topUpAndSubmitAppeal', [
    TX_ID,
    buildTopUpFeesDistribution(),
  ]);
