import {
  AbiCoder,
  Interface,
  TypedDataEncoder,
  formatUnits,
  getAddress,
  hexlify,
  isAddress,
  keccak256,
  parseUnits,
  toBeHex,
  toUtf8Bytes,
} from 'ethers';

export type FeeProfile = 'low' | 'standard' | 'high' | 'custom';
export type MessageMode = 'none' | 'mode1' | 'mode2';
export type ValidityUnit = 'minutes' | 'hours' | 'days';

export type PrototypeForm = {
  consensusAddress: string;
  gatewayAddress: string;
  chainId: string;
  sender: string;
  recipient: string;
  methodName: string;
  userValue: string;
  numInitialValidators: string;
  maxRotations: string;
  validUntil: string;
  validityDuration: string;
  validityUnit: ValidityUnit;
  maxValidUntilDays: string;
  queueDepth: string;
  maxQueueSize: string;
  saltNonce: string;
  gatewayNonce: string;
  profile: FeeProfile;
  leaderTimeoutFee: string;
  validatorsTimeoutFee: string;
  appealRounds: string;
  rollupUnifiedBudgetPerRound: string;
  totalMessageFees: string;
  rotations: string;
  maxPriceGenPerTimeUnit: string;
  messageMode: MessageMode;
  messageRecipient: string;
  messageSelector: string;
  messageBudget: string;
  messageLeaderTimeunits: string;
  messageValidatorTimeunits: string;
  messageAppealRounds: string;
  messageRollupBudget: string;
  messageRotations: string;
};

export type FeesDistribution = {
  leaderTimeoutFee: bigint;
  validatorsTimeoutFee: bigint;
  appealRounds: bigint;
  rollupUnifiedBudgetPerRound: bigint;
  rollupUnifiedConsumed: bigint;
  totalMessageFees: bigint;
  rotations: bigint[];
  maxPriceGenPerTimeUnit: bigint;
};

export type MessageFeeParams = {
  leaderTimeunitsAllocation: bigint;
  validatorTimeunitsAllocation: bigint;
  appealRounds: bigint;
  rollupUnifiedBudgetPerRound: bigint;
  rotations: bigint[];
};

export type MessageFeeAllocationNode = {
  parentIndex: bigint;
  recipient: string;
  functionSelector: string;
  budget: bigint;
  feeParams: MessageFeeParams;
};

export type AddTransactionParams = {
  sender: string;
  recipient: string;
  numOfInitialValidators: bigint;
  maxRotations: bigint;
  validUntil: bigint;
  saltNonce: bigint;
  userValue: bigint;
  feesDistribution: FeesDistribution;
  txCalldata: string;
  messageAllocations: MessageFeeAllocationNode[];
};

export type FeeEstimate = {
  rounds: number;
  timeoutFees: bigint;
  rollupBudget: bigint;
  appealBudget: bigint;
  messageBudget: bigint;
  totalFees: bigint;
  totalMsgValue: bigint;
};

export type BuiltTransaction = {
  params: AddTransactionParams;
  addTransactionCalldata: string;
  feeConfigHash: string;
  txRequest: {
    to: string;
    data: string;
    value: string;
  };
  estimate: FeeEstimate;
  intent: {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    value: Record<string, unknown>;
    hash: string;
  };
};

export type RpcReceiptLog = {
  address: string;
  data: string;
  topics: string[];
};

export type ParsedHarnessEvent =
  | {
      name: 'GenLayerTransactionCreated';
      txId: string;
      sender: string;
      recipient: string;
      feeConfigHash: string;
      userValue: string;
      msgValue: string;
    }
  | {
      name: 'FeeConfigSubmitted';
      txId: string;
      numOfInitialValidators: string;
      maxRotations: string;
      appealRounds: string;
      rotationsCount: string;
      messageAllocationsCount: string;
      maxPriceGenPerTimeUnit: string;
      txCalldataHash: string;
    }
  | {
      name: 'IntentSubmitted';
      intentHash: string;
      signer: string;
      txId: string;
      maxTotalFee: string;
      msgValue: string;
    };

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ROOT_ALLOCATION_PARENT = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
);

export const CONSENSUS_MAIN_WITH_FEES_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'sender', type: 'address' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          {
            internalType: 'uint256',
            name: 'numOfInitialValidators',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'maxRotations', type: 'uint256' },
          { internalType: 'uint256', name: 'validUntil', type: 'uint256' },
          { internalType: 'uint256', name: 'saltNonce', type: 'uint256' },
          { internalType: 'uint256', name: 'userValue', type: 'uint256' },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'leaderTimeoutFee',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'validatorsTimeoutFee',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'appealRounds',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'rollupUnifiedBudgetPerRound',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'rollupUnifiedConsumed',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'totalMessageFees',
                type: 'uint256',
              },
              {
                internalType: 'uint256[]',
                name: 'rotations',
                type: 'uint256[]',
              },
              {
                internalType: 'uint256',
                name: 'maxPriceGenPerTimeUnit',
                type: 'uint256',
              },
            ],
            internalType: 'struct IFeeManager.FeesDistribution',
            name: 'feesDistribution',
            type: 'tuple',
          },
          { internalType: 'bytes', name: 'txCalldata', type: 'bytes' },
          {
            components: [
              { internalType: 'uint256', name: 'parentIndex', type: 'uint256' },
              { internalType: 'address', name: 'recipient', type: 'address' },
              {
                internalType: 'bytes4',
                name: 'functionSelector',
                type: 'bytes4',
              },
              { internalType: 'uint256', name: 'budget', type: 'uint256' },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'leaderTimeunitsAllocation',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'validatorTimeunitsAllocation',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'appealRounds',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'rollupUnifiedBudgetPerRound',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256[]',
                    name: 'rotations',
                    type: 'uint256[]',
                  },
                ],
                internalType: 'struct IMessages.MessageFeeParams',
                name: 'feeParams',
                type: 'tuple',
              },
            ],
            internalType: 'struct IMessages.MessageFeeAllocationNode[]',
            name: 'messageAllocations',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IConsensusMainWithFees.AddTransactionParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'addTransaction',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

const addTransactionParamsInput = CONSENSUS_MAIN_WITH_FEES_ABI[0].inputs[0];

export const GENLAYER_INTENT_GATEWAY_ABI = [
  {
    inputs: [
      {
        ...addTransactionParamsInput,
        name: 'params',
      },
      { internalType: 'uint256', name: 'maxTotalFee', type: 'uint256' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
    ],
    name: 'submitIntent',
    outputs: [{ internalType: 'bytes32', name: 'txId', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'signer', type: 'address' }],
    name: 'nonces',
    outputs: [{ internalType: 'uint256', name: 'nonce', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export const GENLAYER_HARNESS_EVENTS_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'txId', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'feeConfigHash',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'userValue',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'msgValue',
        type: 'uint256',
      },
    ],
    name: 'GenLayerTransactionCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'txId', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'numOfInitialValidators',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxRotations',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'appealRounds',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'rotationsCount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'messageAllocationsCount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxPriceGenPerTimeUnit',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'txCalldataHash',
        type: 'bytes32',
      },
    ],
    name: 'FeeConfigSubmitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'signer',
        type: 'address',
      },
      { indexed: true, internalType: 'bytes32', name: 'txId', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxTotalFee',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'msgValue',
        type: 'uint256',
      },
    ],
    name: 'IntentSubmitted',
    type: 'event',
  },
];

const consensusInterface = new Interface(CONSENSUS_MAIN_WITH_FEES_ABI);
const gatewayInterface = new Interface(GENLAYER_INTENT_GATEWAY_ABI);
const harnessEventsInterface = new Interface(GENLAYER_HARNESS_EVENTS_ABI);
const abiCoder = AbiCoder.defaultAbiCoder();

export const makeDefaultForm = (): PrototypeForm => ({
  consensusAddress: '',
  gatewayAddress: '',
  chainId: '4221',
  sender: ZERO_ADDRESS,
  recipient: '0x1111111111111111111111111111111111111111',
  methodName: 'ask_llm',
  userValue: '0',
  numInitialValidators: '5',
  maxRotations: '2',
  validUntil: String(Math.floor(Date.now() / 1000) + 60 * 60),
  validityDuration: '1',
  validityUnit: 'hours',
  maxValidUntilDays: '14',
  queueDepth: '0',
  maxQueueSize: '1000',
  saltNonce: '0',
  gatewayNonce: '0',
  profile: 'standard',
  leaderTimeoutFee: '0.001',
  validatorsTimeoutFee: '0.002',
  appealRounds: '1',
  rollupUnifiedBudgetPerRound: '0.01',
  totalMessageFees: '0.02',
  rotations: '0,1',
  maxPriceGenPerTimeUnit: '120',
  messageMode: 'mode1',
  messageRecipient: '0x2222222222222222222222222222222222222222',
  messageSelector: '0x00000000',
  messageBudget: '0.02',
  messageLeaderTimeunits: '0.001',
  messageValidatorTimeunits: '0.002',
  messageAppealRounds: '1',
  messageRollupBudget: '0.005',
  messageRotations: '0',
});

export const stringifyBigints = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2,
  );

export const shortHex = (value: string, chars = 10): string => {
  if (value.length <= chars * 2) {
    return value;
  }
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
};

export const formatGen = (value: bigint): string => {
  const formatted = formatUnits(value, 18);
  return formatted.replace(/\.0+$/u, '').replace(/(\.\d*?)0+$/u, '$1');
};

export const toQuantity = (value: bigint): string => toBeHex(value);

export const isZeroAddress = (address: string): boolean =>
  address.toLowerCase() === ZERO_ADDRESS;

export const isUsableAddress = (address: string): boolean =>
  isAddress(address) && !isZeroAddress(address);

const parseGen = (value: string): bigint => {
  if (!value.trim()) {
    return 0n;
  }
  return parseUnits(value.trim(), 18);
};

const parseUint = (value: string): bigint => {
  const parsed = Number.parseInt(value.trim() || '0', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0n;
  }
  return BigInt(parsed);
};

const parseRotations = (value: string): bigint[] => {
  const rotations = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseUint);

  return rotations.length > 0 ? rotations : [0n];
};

const normalizeAddress = (address: string, fallback = ZERO_ADDRESS): string => {
  if (!address.trim()) {
    return fallback;
  }
  if (!isAddress(address)) {
    return fallback;
  }
  return getAddress(address);
};

const normalizeBytes4 = (value: string): string => {
  if (/^0x[0-9a-fA-F]{8}$/u.test(value)) {
    return value;
  }
  return '0x00000000';
};

const buildTxCalldata = (methodName: string): string => {
  const payload = {
    method: methodName || 'unknown',
    args: [],
    prototype: true,
  };

  return hexlify(toUtf8Bytes(JSON.stringify(payload)));
};

const toFeeTuple = (fees: FeesDistribution): unknown[] => [
  fees.leaderTimeoutFee,
  fees.validatorsTimeoutFee,
  fees.appealRounds,
  fees.rollupUnifiedBudgetPerRound,
  fees.rollupUnifiedConsumed,
  fees.totalMessageFees,
  fees.rotations,
  fees.maxPriceGenPerTimeUnit,
];

const toMessageFeeTuple = (feeParams: MessageFeeParams): unknown[] => [
  feeParams.leaderTimeunitsAllocation,
  feeParams.validatorTimeunitsAllocation,
  feeParams.appealRounds,
  feeParams.rollupUnifiedBudgetPerRound,
  feeParams.rotations,
];

const toMessageAllocationTuple = (
  node: MessageFeeAllocationNode,
): unknown[] => [
  node.parentIndex,
  node.recipient,
  node.functionSelector,
  node.budget,
  toMessageFeeTuple(node.feeParams),
];

const toAddTransactionTuple = (params: AddTransactionParams): unknown[] => [
  params.sender,
  params.recipient,
  params.numOfInitialValidators,
  params.maxRotations,
  params.validUntil,
  params.saltNonce,
  params.userValue,
  toFeeTuple(params.feesDistribution),
  params.txCalldata,
  params.messageAllocations.map(toMessageAllocationTuple),
];

export const buildFeesDistribution = (
  form: PrototypeForm,
): FeesDistribution => {
  const totalMessageFees =
    form.messageMode === 'none' ? 0n : parseGen(form.totalMessageFees);

  return {
    leaderTimeoutFee: parseGen(form.leaderTimeoutFee),
    validatorsTimeoutFee: parseGen(form.validatorsTimeoutFee),
    appealRounds: parseUint(form.appealRounds),
    rollupUnifiedBudgetPerRound: parseGen(form.rollupUnifiedBudgetPerRound),
    rollupUnifiedConsumed: 0n,
    totalMessageFees,
    rotations: parseRotations(form.rotations),
    maxPriceGenPerTimeUnit: parseUint(form.maxPriceGenPerTimeUnit),
  };
};

export const buildMessageAllocations = (
  form: PrototypeForm,
): MessageFeeAllocationNode[] => {
  if (form.messageMode !== 'mode2') {
    return [];
  }

  return [
    {
      parentIndex: ROOT_ALLOCATION_PARENT,
      recipient: normalizeAddress(form.messageRecipient),
      functionSelector: normalizeBytes4(form.messageSelector),
      budget: parseGen(form.messageBudget),
      feeParams: {
        leaderTimeunitsAllocation: parseGen(form.messageLeaderTimeunits),
        validatorTimeunitsAllocation: parseGen(form.messageValidatorTimeunits),
        appealRounds: parseUint(form.messageAppealRounds),
        rollupUnifiedBudgetPerRound: parseGen(form.messageRollupBudget),
        rotations: parseRotations(form.messageRotations),
      },
    },
  ];
};

export const estimateFees = (params: AddTransactionParams): FeeEstimate => {
  const rounds = Math.max(params.feesDistribution.rotations.length, 1);
  const validators = params.numOfInitialValidators;
  const leaderPerRound = params.feesDistribution.leaderTimeoutFee;
  const validatorsPerRound =
    params.feesDistribution.validatorsTimeoutFee * validators;
  const rollupPerRound = params.feesDistribution.rollupUnifiedBudgetPerRound;
  const timeoutFees = BigInt(rounds) * (leaderPerRound + validatorsPerRound);
  const rollupBudget = BigInt(rounds) * rollupPerRound;
  const appealBudget =
    params.feesDistribution.appealRounds *
    (leaderPerRound + validatorsPerRound + rollupPerRound);
  const messageBudget = params.feesDistribution.totalMessageFees;
  const totalFees = timeoutFees + rollupBudget + appealBudget + messageBudget;

  return {
    rounds,
    timeoutFees,
    rollupBudget,
    appealBudget,
    messageBudget,
    totalFees,
    totalMsgValue: totalFees + params.userValue,
  };
};

export const buildAddTransactionParams = (
  form: PrototypeForm,
): AddTransactionParams => ({
  sender: normalizeAddress(form.sender),
  recipient: normalizeAddress(form.recipient),
  numOfInitialValidators: parseUint(form.numInitialValidators),
  maxRotations: parseUint(form.maxRotations),
  validUntil: parseUint(form.validUntil),
  saltNonce: parseUint(form.saltNonce),
  userValue: parseGen(form.userValue),
  feesDistribution: buildFeesDistribution(form),
  txCalldata: buildTxCalldata(form.methodName),
  messageAllocations: buildMessageAllocations(form),
});

const hashFeeConfig = (params: AddTransactionParams): string =>
  keccak256(
    abiCoder.encode(
      [
        'tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256[],uint256)',
        'tuple(uint256,address,bytes4,uint256,tuple(uint256,uint256,uint256,uint256,uint256[]))[]',
      ],
      [
        toFeeTuple(params.feesDistribution),
        params.messageAllocations.map(toMessageAllocationTuple),
      ],
    ),
  );

const buildIntent = (
  form: PrototypeForm,
  params: AddTransactionParams,
  feeConfigHash: string,
  estimate: FeeEstimate,
) => {
  const chainId = Number.parseInt(form.chainId || '0', 10) || 0;
  const gatewayAddress = normalizeAddress(form.gatewayAddress);
  const domain = {
    name: 'GenLayerIntent',
    version: '0.1',
    chainId,
    verifyingContract: gatewayAddress,
  };
  const types = {
    GenLayerIntent: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'txDataHash', type: 'bytes32' },
      { name: 'numInitialValidators', type: 'uint256' },
      { name: 'maxRotations', type: 'uint256' },
      { name: 'validUntil', type: 'uint256' },
      { name: 'maxTotalFee', type: 'uint256' },
      { name: 'feeConfigHash', type: 'bytes32' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };
  const value = {
    sender: params.sender,
    recipient: params.recipient,
    value: params.userValue,
    txDataHash: keccak256(params.txCalldata),
    numInitialValidators: params.numOfInitialValidators,
    maxRotations: params.maxRotations,
    validUntil: params.validUntil,
    maxTotalFee: estimate.totalFees,
    feeConfigHash,
    nonce: parseUint(form.gatewayNonce),
    deadline: params.validUntil,
  };

  return {
    domain,
    types,
    value,
    hash: TypedDataEncoder.hash(domain, types, value),
  };
};

export const buildTransaction = (form: PrototypeForm): BuiltTransaction => {
  const params = buildAddTransactionParams(form);
  const addTransactionCalldata = consensusInterface.encodeFunctionData(
    'addTransaction',
    [toAddTransactionTuple(params)],
  );
  const estimate = estimateFees(params);
  const feeConfigHash = hashFeeConfig(params);

  return {
    params,
    addTransactionCalldata,
    feeConfigHash,
    txRequest: {
      to: normalizeAddress(form.consensusAddress),
      data: addTransactionCalldata,
      value: toQuantity(estimate.totalMsgValue),
    },
    estimate,
    intent: buildIntent(form, params, feeConfigHash, estimate),
  };
};

export const buildGatewaySubmissionCalldata = (
  form: PrototypeForm,
  signature: string,
): string => {
  const built = buildTransaction(form);

  return gatewayInterface.encodeFunctionData('submitIntent', [
    toAddTransactionTuple(built.params),
    built.estimate.totalFees,
    parseUint(form.gatewayNonce),
    built.params.validUntil,
    signature,
  ]);
};

export const buildGatewayNonceCalldata = (sender: string): string =>
  gatewayInterface.encodeFunctionData('nonces', [normalizeAddress(sender)]);

export const decodeGatewayNonceResult = (result: string): string =>
  gatewayInterface.decodeFunctionResult('nonces', result)[0].toString();

export const parseHarnessReceiptEvents = (
  logs: RpcReceiptLog[],
): ParsedHarnessEvent[] =>
  logs.flatMap((log) => {
    try {
      const parsed = harnessEventsInterface.parseLog({
        data: log.data,
        topics: log.topics,
      });

      if (!parsed) {
        return [];
      }

      if (parsed.name === 'GenLayerTransactionCreated') {
        return [
          {
            name: parsed.name,
            txId: parsed.args.txId as string,
            sender: parsed.args.sender as string,
            recipient: parsed.args.recipient as string,
            feeConfigHash: parsed.args.feeConfigHash as string,
            userValue: parsed.args.userValue.toString(),
            msgValue: parsed.args.msgValue.toString(),
          },
        ];
      }

      if (parsed.name === 'FeeConfigSubmitted') {
        return [
          {
            name: parsed.name,
            txId: parsed.args.txId as string,
            numOfInitialValidators:
              parsed.args.numOfInitialValidators.toString(),
            maxRotations: parsed.args.maxRotations.toString(),
            appealRounds: parsed.args.appealRounds.toString(),
            rotationsCount: parsed.args.rotationsCount.toString(),
            messageAllocationsCount:
              parsed.args.messageAllocationsCount.toString(),
            maxPriceGenPerTimeUnit:
              parsed.args.maxPriceGenPerTimeUnit.toString(),
            txCalldataHash: parsed.args.txCalldataHash as string,
          },
        ];
      }

      if (parsed.name === 'IntentSubmitted') {
        return [
          {
            name: parsed.name,
            intentHash: parsed.args.intentHash as string,
            signer: parsed.args.signer as string,
            txId: parsed.args.txId as string,
            maxTotalFee: parsed.args.maxTotalFee.toString(),
            msgValue: parsed.args.msgValue.toString(),
          },
        ];
      }

      return [];
    } catch (_error) {
      return [];
    }
  });
