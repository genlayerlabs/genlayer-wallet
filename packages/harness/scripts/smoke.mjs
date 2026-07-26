import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  encodeRlp,
  hexlify,
  keccak256,
  parseEther,
  parseUnits,
  toUtf8Bytes,
} from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const harnessRoot = resolve(__dirname, '..');
const repoRoot = resolve(harnessRoot, '..', '..');

const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const privateKey =
  process.env.PRIVATE_KEY ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const deploymentPath =
  process.env.HARNESS_OUTPUT ??
  resolve(repoRoot, 'packages/site/static/harness.local.json');

const readArtifact = (contractName) => {
  const path = resolve(harnessRoot, 'out', `${contractName}.sol`, `${contractName}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
};

const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const deployment = JSON.parse(readFileSync(deploymentPath, 'utf8'));
const shimArtifact = readArtifact('GenLayerFeeShim');
const gatewayArtifact = readArtifact('GenLayerIntentGateway');
const shim = new Contract(deployment.contracts.shim.address, shimArtifact.abi, wallet);
const gateway = new Contract(
  deployment.contracts.gateway.address,
  gatewayArtifact.abi,
  wallet,
);
const events = new Interface([...shimArtifact.abi, ...gatewayArtifact.abi]);

const now = Math.floor(Date.now() / 1000);
const params = {
  sender: await wallet.getAddress(),
  recipient: '0x1111111111111111111111111111111111111111',
  numOfInitialValidators: 5n,
  maxRotations: 2n,
  validUntil: BigInt(now + 3600),
  saltNonce: 1n,
  userValue: parseEther('0.01'),
  feesDistribution: {
    leaderTimeunitsAllocation: 100n,
    validatorTimeunitsAllocation: 200n,
    appealRounds: 1n,
    executionBudgetPerRound: parseEther('0.01'),
    executionConsumed: 0n,
    totalMessageFees: parseEther('0.02'),
    rotations: [0n, 1n],
    maxPriceGenPerTimeUnit: parseEther('0.00000012'),
    storageFeeMaxGasPrice: parseUnits('24', 'gwei'),
    receiptFeeMaxGasPrice: parseUnits('24', 'gwei'),
  },
  txCalldata: encodeRlp([
    hexlify(
      toUtf8Bytes(JSON.stringify({ method: 'ask_llm', args: [], prototype: true })),
    ),
  ]),
  messageAllocations: [
    {
      messageType: 1,
      onAcceptance: true,
      parentIndex:
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
      recipient: '0x2222222222222222222222222222222222222222',
      callKey:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      budget: parseEther('0.02'),
      feeParams: '0x',
    },
  ],
};

const parseKnownEvents = (receipt) =>
  receipt.logs.flatMap((log) => {
    try {
      const parsed = events.parseLog(log);

      if (!parsed) {
        return [];
      }

      if (parsed.name === 'GenLayerTransactionCreated') {
        return [
          {
            name: parsed.name,
            txId: parsed.args.txId,
            sender: parsed.args.sender,
            recipient: parsed.args.recipient,
            feeConfigHash: parsed.args.feeConfigHash,
          },
        ];
      }

      if (parsed.name === 'IntentSubmitted') {
        return [
          {
            name: parsed.name,
            intentHash: parsed.args.intentHash,
            signer: parsed.args.signer,
            txId: parsed.args.txId,
          },
        ];
      }

      return [{ name: parsed.name }];
    } catch (_error) {
      return [];
    }
  });

const maxTotalFee = parseEther('0.061');
const msgValue = params.userValue + maxTotalFee;

const directTx = await shim.addTransaction(params, { value: msgValue });
const directReceipt = await directTx.wait();

const feeConfigHash = await shim.hashFeeConfig(params);
const nonce = await gateway.nonces(params.sender);
const domain = {
  name: 'GenLayerIntent',
  version: '0.1',
  chainId: deployment.chainId,
  verifyingContract: deployment.contracts.gateway.address,
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
  maxTotalFee,
  feeConfigHash,
  nonce,
  deadline: params.validUntil,
};
const signature = await wallet.signTypedData(domain, types, value);
const gatewayTx = await gateway.submitIntent(
  params,
  maxTotalFee,
  nonce,
  params.validUntil,
  signature,
  { value: msgValue },
);
const gatewayReceipt = await gatewayTx.wait();

console.log(
  JSON.stringify(
    {
      direct: {
        txHash: directTx.hash,
        events: parseKnownEvents(directReceipt),
      },
      gateway: {
        txHash: gatewayTx.hash,
        signature,
        events: parseKnownEvents(gatewayReceipt),
      },
    },
    null,
    2,
  ),
);
