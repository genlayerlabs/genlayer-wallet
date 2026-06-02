import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const harnessRoot = resolve(__dirname, '..');
const repoRoot = resolve(harnessRoot, '..', '..');

const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const privateKey =
  process.env.PRIVATE_KEY ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const outputPath =
  process.env.HARNESS_OUTPUT ??
  resolve(repoRoot, 'packages/site/static/harness.local.json');

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const readArtifact = (contractName) => {
  const path = resolve(harnessRoot, 'out', `${contractName}.sol`, `${contractName}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
};

run('forge', ['build'], harnessRoot);

const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const network = await provider.getNetwork();

const deploy = async (contractName, args = []) => {
  const artifact = readArtifact(contractName);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
  const contract = await factory.deploy(...args);

  await contract.waitForDeployment();

  return {
    artifact,
    address: await contract.getAddress(),
    deploymentTransaction: contract.deploymentTransaction()?.hash ?? null,
  };
};

const shim = await deploy('GenLayerFeeShim');
const gateway = await deploy('GenLayerIntentGateway', [shim.address]);

const deployment = {
  chainId: Number(network.chainId),
  rpcUrl,
  deployedAt: new Date().toISOString(),
  deployer: await wallet.getAddress(),
  contracts: {
    shim: {
      address: shim.address,
      txHash: shim.deploymentTransaction,
    },
    gateway: {
      address: gateway.address,
      txHash: gateway.deploymentTransaction,
    },
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);

console.log(JSON.stringify(deployment, null, 2));
