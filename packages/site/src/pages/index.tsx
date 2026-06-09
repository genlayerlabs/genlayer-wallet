import { useMemo, useState } from 'react';
import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';

import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
} from '../components';
import { defaultSnapOrigin } from '../config';
import {
  useEip6963Providers,
  useMetaMask,
  useMetaMaskContext,
  useRequest,
  useRequestSnap,
} from '../hooks';
import {
  buildGatewayNonceCalldata,
  buildGatewaySubmissionCalldata,
  buildTransaction,
  decodeGatewayNonceResult,
  formatGen,
  isUsableAddress,
  makeDefaultForm,
  parseHarnessReceiptEvents,
  shortHex,
  stringifyBigints,
} from '../prototype/transaction';
import type {
  FeeProfile,
  PrototypeForm,
  RpcReceiptLog,
  ValidityUnit,
} from '../prototype/transaction';
import { isLocalSnap, shouldDisplayReconnectButton } from '../utils';

const Container = styled.main`
  flex: 1;
  width: min(128rem, calc(100% - 4.8rem));
  margin: 3.2rem auto 6.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    width: calc(100% - 2.4rem);
    margin-top: 1.6rem;
    margin-bottom: 3.2rem;
  }
`;

const HeaderBlock = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2.4rem;
  align-items: start;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border?.default};
  padding-bottom: 2.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const Title = styled.h1`
  font-size: 3.2rem;
  line-height: 1.1;
  margin: 0 0 0.8rem;

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 2.8rem;
  }
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.text?.alternative};
  margin: 0;
  max-width: 78rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(34rem, 42rem) minmax(0, 1fr);
  gap: 2.4rem;
  margin-top: 2.4rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card?.default};
  padding: 1.6rem;
`;

const PanelTitle = styled.h2`
  font-size: 1.8rem;
  margin: 0 0 1.2rem;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const FullField = styled(Field)`
  grid-column: 1 / -1;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.background?.default};
  color: ${({ theme }) => theme.colors.text?.default};
  min-height: 4rem;
  padding: 0.9rem 1rem;
  font: inherit;
`;

const Select = styled.select`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.background?.default};
  color: ${({ theme }) => theme.colors.text?.default};
  min-height: 4rem;
  padding: 0.9rem 1rem;
  font: inherit;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: center;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

const routeBorderColor = (
  tone: 'good' | 'warn' | 'neutral',
  theme: DefaultTheme,
): string => {
  if (tone === 'good') {
    return '#188038';
  }
  if (tone === 'warn') {
    return theme.colors.error?.default ?? '#d73a49';
  }
  return theme.colors.border?.default ?? '#d0d7de';
};

const routeBackgroundColor = (tone: 'good' | 'warn' | 'neutral'): string => {
  if (tone === 'good') {
    return '#18803814';
  }
  if (tone === 'warn') {
    return '#d73a4919';
  }
  return 'transparent';
};

const RouteBadge = styled.div<{ tone: 'good' | 'warn' | 'neutral' }>`
  border-radius: 8px;
  padding: 1.2rem;
  border: 1px solid ${({ tone, theme }) => routeBorderColor(tone, theme)};
  background: ${({ tone }) => routeBackgroundColor(tone)};
`;

const BadgeTitle = styled.div`
  font-weight: 700;
  margin-bottom: 0.4rem;
`;

const Muted = styled.span`
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.2rem;

  ${({ theme }) => theme.mediaQueries.small} {
    grid-template-columns: 1fr 1fr;
  }
`;

const Stat = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  border-radius: 8px;
  padding: 1rem;
  min-width: 0;
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.text?.alternative};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const StatValue = styled.div`
  font-weight: 700;
  margin-top: 0.4rem;
  overflow-wrap: anywhere;
`;

const CodeBlock = styled.pre`
  margin: 0;
  max-height: 28rem;
  overflow: auto;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.background?.alternative};
  padding: 1.2rem;
  font-family: ${({ theme }) => theme.fonts.code};
  font-size: 1.2rem;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const CheckboxLabel = styled.label`
  display: inline-flex;
  gap: 0.8rem;
  align-items: center;
  color: ${({ theme }) => theme.colors.text?.alternative};
`;

const ErrorMessage = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.error?.default};
  background: ${({ theme }) => theme.colors.error?.muted};
  color: ${({ theme }) => theme.colors.error?.alternative};
  border-radius: 8px;
  padding: 1.2rem;
`;

const Notice = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border?.default};
  background: ${({ theme }) => theme.colors.background?.alternative};
  border-radius: 8px;
  padding: 1.2rem;
`;

const PROFILE_PRESETS: Record<
  FeeProfile,
  Partial<
    Pick<
      PrototypeForm,
      | 'leaderTimeunitsAllocation'
      | 'validatorTimeunitsAllocation'
      | 'appealRounds'
      | 'executionBudgetPerRound'
      | 'totalMessageFees'
      | 'rotations'
      | 'maxPriceGenPerTimeUnit'
      | 'storageFeeMaxGasPrice'
      | 'receiptFeeMaxGasPrice'
    >
  >
> = {
  low: {
    leaderTimeunitsAllocation: '50',
    validatorTimeunitsAllocation: '100',
    appealRounds: '0',
    executionBudgetPerRound: '0.004',
    totalMessageFees: '0',
    rotations: '0',
    maxPriceGenPerTimeUnit: '0.00000011',
    storageFeeMaxGasPrice: '22',
    receiptFeeMaxGasPrice: '22',
  },
  standard: {
    leaderTimeunitsAllocation: '100',
    validatorTimeunitsAllocation: '200',
    appealRounds: '1',
    executionBudgetPerRound: '0.01',
    totalMessageFees: '0.02',
    rotations: '0,1',
    maxPriceGenPerTimeUnit: '0.00000012',
    storageFeeMaxGasPrice: '24',
    receiptFeeMaxGasPrice: '24',
  },
  high: {
    leaderTimeunitsAllocation: '200',
    validatorTimeunitsAllocation: '400',
    appealRounds: '2',
    executionBudgetPerRound: '0.025',
    totalMessageFees: '0.05',
    rotations: '0,1,1',
    maxPriceGenPerTimeUnit: '0.00000015',
    storageFeeMaxGasPrice: '30',
    receiptFeeMaxGasPrice: '30',
  },
  custom: {},
};

type Route = {
  label: string;
  tone: 'good' | 'warn' | 'neutral';
  description: string;
};

type HarnessDeployment = {
  chainId: number;
  rpcUrl: string;
  deployedAt: string;
  contracts: {
    shim: {
      address: string;
      txHash: string | null;
    };
    gateway: {
      address: string;
      txHash: string | null;
    };
  };
};

type RpcTransactionReceipt = {
  transactionHash: string;
  status?: string;
  blockNumber?: string;
  logs: RpcReceiptLog[];
};

const LOCAL_HARNESS_CHAIN_ID = 31337;
const LOCAL_HARNESS_CHAIN_ID_HEX = '0x7a69';
const LOCAL_HARNESS_RPC_URL = 'http://127.0.0.1:8545';

const sleep = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const validityUnitSeconds: Record<ValidityUnit, number> = {
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
};

const parsePositiveNumber = (value: string): number => {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const buildValidUntil = (
  duration: string,
  unit: ValidityUnit,
  nowSeconds = Math.floor(Date.now() / 1000),
): string =>
  String(
    Math.floor(
      nowSeconds + parsePositiveNumber(duration) * validityUnitSeconds[unit],
    ),
  );

const formatUnixSeconds = (value: string): string => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 'Invalid timestamp';
  }

  return new Date(parsed * 1000).toLocaleString();
};

const getValidityWarning = (form: PrototypeForm): string | null => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const validUntil = Number.parseInt(form.validUntil, 10);
  const maxSeconds = parsePositiveNumber(form.maxValidUntilDays) * 24 * 60 * 60;

  if (!Number.isFinite(validUntil) || validUntil <= nowSeconds) {
    return 'This transaction is already expired or has an invalid expiry.';
  }

  if (maxSeconds > 0 && validUntil - nowSeconds > maxSeconds) {
    return `Expiry exceeds the configured ${form.maxValidUntilDays}-day maximum.`;
  }

  return null;
};

const getQueueWarning = (form: PrototypeForm): string | null => {
  const depth = parsePositiveNumber(form.queueDepth);
  const max = parsePositiveNumber(form.maxQueueSize);

  if (max <= 0) {
    return 'Queue max is not configured.';
  }

  if (depth >= max) {
    return 'Recipient queue is full; submission should be blocked.';
  }

  if (depth / max >= 0.8) {
    return 'Recipient queue is over 80% full.';
  }

  return null;
};

const buildRoute = ({
  hasClearSigning,
  hasSnap,
  hasSmartAccountHint,
}: {
  hasClearSigning: boolean;
  hasSnap: boolean;
  hasSmartAccountHint: boolean;
}): Route => {
  if (hasClearSigning) {
    return {
      label: 'Verified direct addTransaction',
      tone: 'good',
      description:
        'Use ConsensusMainWithFees.addTransaction directly. Wallet is treated as clear-signing capable.',
    };
  }

  if (hasSnap) {
    return {
      label: 'Snap-verified direct addTransaction',
      tone: 'good',
      description:
        'Use the direct consensus call and let the GenLayer Snap decode the fee struct in MetaMask Desktop.',
    };
  }

  if (hasSmartAccountHint) {
    return {
      label: 'Intent or smart-account gateway path',
      tone: 'neutral',
      description:
        'Use the EIP-712 intent and submit through a relayer, paymaster, or account abstraction flow.',
    };
  }

  return {
    label: 'Unverified wallet route',
    tone: 'warn',
    description:
      'Do not silently send high-value transactions. Use gateway intent, install Snap, or switch to a clear-signing wallet.',
  };
};

const includesSmartAccountHint = (capabilities: unknown): boolean => {
  const serialized = JSON.stringify(capabilities ?? {}).toLowerCase();
  return (
    serialized.includes('paymaster') ||
    serialized.includes('atomic') ||
    serialized.includes('wallet_sendcalls') ||
    serialized.includes('smart')
  );
};

const Index = () => {
  const [form, setForm] = useState<PrototypeForm>(() => makeDefaultForm());
  const [accounts, setAccounts] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<unknown>(null);
  const [sendResult, setSendResult] = useState<string>('');
  const [signResult, setSignResult] = useState<string>('');
  const [harnessStatus, setHarnessStatus] = useState<string>('');
  const [assumeClearSigning, setAssumeClearSigning] = useState(false);

  const { error } = useMetaMaskContext();
  const { isFlask, snapsDetected, installedSnap } = useMetaMask();
  const requestSnap = useRequestSnap();
  const request = useRequest();
  const { providers, clearSigningProvider } = useEip6963Providers();

  const builtResult = useMemo(() => {
    try {
      return { built: buildTransaction(form), error: null };
    } catch (buildError) {
      return { built: null, error: buildError as Error };
    }
  }, [form]);

  const route = buildRoute({
    hasClearSigning: assumeClearSigning || Boolean(clearSigningProvider),
    hasSnap: Boolean(installedSnap),
    hasSmartAccountHint: includesSmartAccountHint(capabilities),
  });
  const validityWarning = getValidityWarning(form);
  const queueWarning = getQueueWarning(form);

  const isMetaMaskReady = isLocalSnap(defaultSnapOrigin)
    ? isFlask
    : snapsDetected;

  const updateForm = <Key extends keyof PrototypeForm>(
    key: Key,
    value: PrototypeForm[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyProfile = (profile: FeeProfile) => {
    setForm((current) => ({
      ...current,
      profile,
      ...PROFILE_PRESETS[profile],
    }));
  };

  const applyValidityDuration = (
    duration: string,
    unit: ValidityUnit = form.validityUnit,
  ) => {
    setForm((current) => ({
      ...current,
      validityDuration: duration,
      validityUnit: unit,
      validUntil: buildValidUntil(duration, unit),
    }));
  };

  const waitForReceipt = async (
    txHash: string,
  ): Promise<RpcTransactionReceipt | null> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const receipt = (await request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      })) as RpcTransactionReceipt | null;

      if (receipt) {
        return receipt;
      }

      await sleep(1000);
    }

    return null;
  };

  const loadLocalHarness = async () => {
    try {
      setHarnessStatus('Loading local harness deployment...');
      const response = await fetch('/harness.local.json', {
        cache: 'no-store',
      });

      if (!response.ok) {
        setHarnessStatus(
          'No local harness deployment found. Start Anvil, then run yarn workspace harness deploy.',
        );
        return;
      }

      const deployment = (await response.json()) as HarnessDeployment;
      setForm((current) => ({
        ...current,
        chainId: String(deployment.chainId),
        consensusAddress: deployment.contracts.shim.address,
        gatewayAddress: deployment.contracts.gateway.address,
        validityDuration: '1',
        validityUnit: 'hours',
        validUntil: buildValidUntil('1', 'hours'),
        gatewayNonce: '0',
      }));
      setHarnessStatus(
        `Loaded ${deployment.contracts.shim.address} and ${deployment.contracts.gateway.address}`,
      );
    } catch (loadError) {
      setHarnessStatus((loadError as Error).message);
    }
  };

  const addLocalHarnessNetwork = async () => {
    await request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: LOCAL_HARNESS_CHAIN_ID_HEX,
          chainName: 'GenLayer Local Harness',
          nativeCurrency: {
            name: 'GEN Token',
            symbol: 'GEN',
            decimals: 18,
          },
          rpcUrls: [LOCAL_HARNESS_RPC_URL],
        },
      ],
    });
  };

  const connectWallet = async () => {
    const requestedAccounts = (await request({
      method: 'eth_requestAccounts',
      params: [],
    })) as string[] | null;

    if (requestedAccounts?.length) {
      setAccounts(requestedAccounts);
      setForm((current) => ({
        ...current,
        sender: requestedAccounts[0] ?? current.sender,
      }));
    }
  };

  const detectCapabilities = async () => {
    const account = accounts[0];
    const result = await request({
      method: 'wallet_getCapabilities',
      params: account ? [account] : [],
    });

    setCapabilities(result);
  };

  const refreshGatewayNonce = async () => {
    const account = accounts[0];

    if (!account || !isUsableAddress(form.gatewayAddress)) {
      return;
    }

    const result = (await request({
      method: 'eth_call',
      params: [
        {
          to: form.gatewayAddress,
          data: buildGatewayNonceCalldata(account),
        },
        'latest',
      ],
    })) as string | null;

    if (result) {
      updateForm('gatewayNonce', decodeGatewayNonceResult(result));
    }
  };

  const sendDirectTransaction = async () => {
    if (!builtResult.built || !accounts[0]) {
      return;
    }

    setSendResult('Submitting direct transaction...');

    const response = (await request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: accounts[0],
          ...builtResult.built.txRequest,
        },
      ],
    })) as string | null;

    if (!response) {
      return;
    }

    setSendResult(`Waiting for receipt: ${response}`);
    const receipt = await waitForReceipt(response);
    const parsedEvents = receipt ? parseHarnessReceiptEvents(receipt.logs) : [];

    setSendResult(
      stringifyBigints({
        txHash: response,
        receiptStatus: receipt?.status ?? 'pending',
        blockNumber: receipt?.blockNumber,
        parsedEvents,
      }),
    );
  };

  const signGatewayIntent = async () => {
    if (!builtResult.built || !accounts[0]) {
      return;
    }

    const payload = {
      domain: builtResult.built.intent.domain,
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...builtResult.built.intent.types,
      },
      primaryType: 'GenLayerIntent',
      message: builtResult.built.intent.value,
    };

    setSignResult('Requesting typed-data signature...');

    const signature = (await request({
      method: 'eth_signTypedData_v4',
      params: [accounts[0], stringifyBigints(payload)],
    })) as string | null;

    if (!signature) {
      return;
    }

    setSignResult('Submitting signed intent through gateway...');

    const txHash = (await request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: accounts[0],
          to: form.gatewayAddress,
          data: buildGatewaySubmissionCalldata(form, signature),
          value: builtResult.built.txRequest.value,
        },
      ],
    })) as string | null;

    if (!txHash) {
      setSignResult(
        stringifyBigints({
          signature,
          submitted: false,
        }),
      );
      return;
    }

    const receipt = await waitForReceipt(txHash);
    const parsedEvents = receipt ? parseHarnessReceiptEvents(receipt.logs) : [];

    setSignResult(
      stringifyBigints({
        signature,
        txHash,
        receiptStatus: receipt?.status ?? 'pending',
        blockNumber: receipt?.blockNumber,
        parsedEvents,
      }),
    );

    setForm((current) => ({
      ...current,
      gatewayNonce: String(
        Number.parseInt(current.gatewayNonce || '0', 10) + 1,
      ),
    }));
  };

  const runAsync = (action: () => Promise<unknown>) => () => {
    action().catch((actionError: unknown) => {
      setHarnessStatus(
        actionError instanceof Error
          ? actionError.message
          : String(actionError),
      );
    });
  };

  const canSendDirect =
    Boolean(accounts[0]) &&
    Boolean(builtResult.built) &&
    isUsableAddress(form.consensusAddress);
  const canSignIntent =
    Boolean(accounts[0]) &&
    Boolean(builtResult.built) &&
    isUsableAddress(form.gatewayAddress);

  return (
    <Container>
      <HeaderBlock>
        <div>
          <Title>GenLayer Transaction Prototype</Title>
          <Subtitle>
            Configure a fee-aware GenLayer transaction, inspect the exact
            consensus calldata, then route it through clear signing, Snap, or an
            intent gateway fallback.
          </Subtitle>
        </div>
        <Row>
          {!isMetaMaskReady && <InstallFlaskButton />}
          {isMetaMaskReady && !installedSnap && (
            <ConnectButton onClick={runAsync(requestSnap)}>
              Install Snap
            </ConnectButton>
          )}
          {shouldDisplayReconnectButton(installedSnap) && (
            <ReconnectButton onClick={runAsync(requestSnap)}>
              Reconnect Snap
            </ReconnectButton>
          )}
          <button onClick={runAsync(connectWallet)} type="button">
            Connect wallet
          </button>
        </Row>
      </HeaderBlock>

      <Grid>
        <Stack>
          {error && (
            <ErrorMessage>
              <strong>Wallet error:</strong> {error.message}
            </ErrorMessage>
          )}

          <Panel>
            <PanelTitle>1. Security and Fee Policy</PanelTitle>
            <FieldGrid>
              <FullField>
                Profile
                <Select
                  value={form.profile}
                  onChange={(changeEvent) =>
                    applyProfile(changeEvent.target.value as FeeProfile)
                  }
                >
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="custom">Custom</option>
                </Select>
              </FullField>
              <Field>
                Initial validators
                <Input
                  value={form.numInitialValidators}
                  onChange={(changeEvent) =>
                    updateForm('numInitialValidators', changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Max rotations
                <Input
                  value={form.maxRotations}
                  onChange={(changeEvent) =>
                    updateForm('maxRotations', changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Appeal rounds
                <Input
                  value={form.appealRounds}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm('appealRounds', changeEvent.target.value);
                  }}
                />
              </Field>
              <Field>
                Rotations array
                <Input
                  value={form.rotations}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm('rotations', changeEvent.target.value);
                  }}
                />
              </Field>
              <Field>
                Leader time units (seconds)
                <Input
                  value={form.leaderTimeunitsAllocation}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm('leaderTimeunitsAllocation', changeEvent.target.value);
                  }}
                />
              </Field>
              <Field>
                Validator time units (seconds)
                <Input
                  value={form.validatorTimeunitsAllocation}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm(
                      'validatorTimeunitsAllocation',
                      changeEvent.target.value,
                    );
                  }}
                />
              </Field>
              <Field>
                Execution budget / round (GEN)
                <Input
                  value={form.executionBudgetPerRound}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm(
                      'executionBudgetPerRound',
                      changeEvent.target.value,
                    );
                  }}
                />
              </Field>
              <Field>
                Max GEN/time-unit cap (price x 1.2 placeholder)
                <Input
                  value={form.maxPriceGenPerTimeUnit}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm(
                      'maxPriceGenPerTimeUnit',
                      changeEvent.target.value,
                    );
                  }}
                />
              </Field>
              <Field>
                Storage gas cap (gwei, price x 1.2 placeholder)
                <Input
                  value={form.storageFeeMaxGasPrice}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm(
                      'storageFeeMaxGasPrice',
                      changeEvent.target.value,
                    );
                  }}
                />
              </Field>
              <Field>
                Receipt gas cap (gwei, price x 1.2 placeholder)
                <Input
                  value={form.receiptFeeMaxGasPrice}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm(
                      'receiptFeeMaxGasPrice',
                      changeEvent.target.value,
                    );
                  }}
                />
              </Field>
              <Field>
                Message mode
                <Select
                  value={form.messageMode}
                  onChange={(changeEvent) =>
                    updateForm(
                      'messageMode',
                      changeEvent.target.value as PrototypeForm['messageMode'],
                    )
                  }
                >
                  <option value="none">None</option>
                  <option value="mode1">Mode 1: bucket only</option>
                  <option value="mode2">Mode 2: allocation tree</option>
                </Select>
              </Field>
              <Field>
                Total message fees
                <Input
                  value={form.totalMessageFees}
                  onChange={(changeEvent) => {
                    updateForm('profile', 'custom');
                    updateForm('totalMessageFees', changeEvent.target.value);
                  }}
                />
              </Field>
              {form.messageMode === 'mode2' && (
                <>
                  <FullField>
                    Message recipient
                    <Input
                      value={form.messageRecipient}
                      onChange={(changeEvent) =>
                        updateForm('messageRecipient', changeEvent.target.value)
                      }
                    />
                  </FullField>
                  <Field>
                    Call key (bytes32)
                    <Input
                      value={form.messageCallKey}
                      onChange={(changeEvent) =>
                        updateForm('messageCallKey', changeEvent.target.value)
                      }
                    />
                  </Field>
                  <Field>
                    Node budget
                    <Input
                      value={form.messageBudget}
                      onChange={(changeEvent) =>
                        updateForm('messageBudget', changeEvent.target.value)
                      }
                    />
                  </Field>
                </>
              )}
            </FieldGrid>
          </Panel>

          <Panel>
            <PanelTitle>2. Transaction Target</PanelTitle>
            <Notice style={{ marginBottom: '1.2rem' }}>
              <Row>
                <button onClick={runAsync(loadLocalHarness)} type="button">
                  Load local harness
                </button>
                <button
                  onClick={runAsync(addLocalHarnessNetwork)}
                  type="button"
                >
                  Add local chain
                </button>
                <button onClick={runAsync(refreshGatewayNonce)} type="button">
                  Refresh nonce
                </button>
              </Row>
              <p style={{ marginBottom: 0 }}>
                <Muted>
                  Local harness expects Anvil chain {LOCAL_HARNESS_CHAIN_ID} and
                  a generated <code>harness.local.json</code>.
                </Muted>
              </p>
              {harnessStatus && (
                <CodeBlock style={{ marginTop: '1.2rem' }}>
                  {harnessStatus}
                </CodeBlock>
              )}
            </Notice>
            <FieldGrid>
              <FullField>
                ConsensusMainWithFees
                <Input
                  placeholder="0x..."
                  value={form.consensusAddress}
                  onChange={(changeEvent) =>
                    updateForm('consensusAddress', changeEvent.target.value)
                  }
                />
              </FullField>
              <FullField>
                Gateway
                <Input
                  placeholder="0x..."
                  value={form.gatewayAddress}
                  onChange={(changeEvent) =>
                    updateForm('gatewayAddress', changeEvent.target.value)
                  }
                />
              </FullField>
              <Field>
                Chain ID
                <Input
                  value={form.chainId}
                  onChange={(changeEvent) =>
                    updateForm('chainId', changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Method
                <Input
                  value={form.methodName}
                  onChange={(changeEvent) =>
                    updateForm('methodName', changeEvent.target.value)
                  }
                />
              </Field>
              <FullField>
                Recipient
                <Input
                  value={form.recipient}
                  onChange={(changeEvent) =>
                    updateForm('recipient', changeEvent.target.value)
                  }
                />
              </FullField>
              <Field>
                User value
                <Input
                  value={form.userValue}
                  onChange={(changeEvent) =>
                    updateForm('userValue', changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Expires in
                <Input
                  value={form.validityDuration}
                  onChange={(changeEvent) =>
                    applyValidityDuration(changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Expiry unit
                <Select
                  value={form.validityUnit}
                  onChange={(changeEvent) =>
                    applyValidityDuration(
                      form.validityDuration,
                      changeEvent.target.value as ValidityUnit,
                    )
                  }
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </Select>
              </Field>
              <Field>
                Max expiry days
                <Input
                  value={form.maxValidUntilDays}
                  onChange={(changeEvent) =>
                    updateForm('maxValidUntilDays', changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Gateway nonce
                <Input
                  value={form.gatewayNonce}
                  onChange={(changeEvent) =>
                    updateForm('gatewayNonce', changeEvent.target.value)
                  }
                />
              </Field>
              <FullField>
                Raw validUntil timestamp
                <Input
                  value={form.validUntil}
                  onChange={(changeEvent) =>
                    updateForm('validUntil', changeEvent.target.value)
                  }
                />
              </FullField>
              <Field>
                Queue before you
                <Input
                  value={form.queueDepth}
                  onChange={(changeEvent) =>
                    updateForm('queueDepth', changeEvent.target.value)
                  }
                />
              </Field>
              <Field>
                Max queue size
                <Input
                  value={form.maxQueueSize}
                  onChange={(changeEvent) =>
                    updateForm('maxQueueSize', changeEvent.target.value)
                  }
                />
              </Field>
            </FieldGrid>
            <Notice style={{ marginTop: '1.2rem' }}>
              <div>
                <strong>Expiry:</strong> {formatUnixSeconds(form.validUntil)}
              </div>
              <div>
                <strong>Queue:</strong> {form.queueDepth} before you /{' '}
                {form.maxQueueSize} max
              </div>
              {(validityWarning || queueWarning) && (
                <p style={{ marginBottom: 0 }}>
                  <Muted>{validityWarning ?? queueWarning}</Muted>
                </p>
              )}
            </Notice>
          </Panel>
        </Stack>

        <Stack>
          <Panel>
            <PanelTitle>3. Wallet Route</PanelTitle>
            <RouteBadge tone={route.tone}>
              <BadgeTitle>{route.label}</BadgeTitle>
              <Muted>{route.description}</Muted>
            </RouteBadge>
            <Row style={{ marginTop: '1.2rem' }}>
              <CheckboxLabel>
                <input
                  checked={assumeClearSigning}
                  onChange={(changeEvent) =>
                    setAssumeClearSigning(changeEvent.target.checked)
                  }
                  type="checkbox"
                />
                Force ERC-7730 route for prototype testing
              </CheckboxLabel>
            </Row>
            <Row style={{ marginTop: '1.2rem' }}>
              <button onClick={runAsync(connectWallet)} type="button">
                Connect
              </button>
              <button onClick={runAsync(detectCapabilities)} type="button">
                Detect capabilities
              </button>
            </Row>
            <CodeBlock style={{ marginTop: '1.2rem' }}>
              {stringifyBigints({
                accounts,
                snapInstalled: Boolean(installedSnap),
                eip6963Providers: providers.map((provider) => ({
                  name: provider.info.name,
                  rdns: provider.info.rdns,
                  clearSigningKnown:
                    provider.info.uuid === clearSigningProvider?.info.uuid,
                })),
                capabilities,
              })}
            </CodeBlock>
          </Panel>

          {builtResult.error && (
            <ErrorMessage>
              <strong>Build error:</strong> {builtResult.error.message}
            </ErrorMessage>
          )}

          {builtResult.built && (
            <>
              <Panel>
                <PanelTitle>4. Cost Preview</PanelTitle>
                <StatGrid>
                  <Stat>
                    <StatLabel>Consensus fees</StatLabel>
                    <StatValue>
                      {formatGen(builtResult.built.estimate.totalFees)} GEN
                    </StatValue>
                  </Stat>
                  <Stat>
                    <StatLabel>User value</StatLabel>
                    <StatValue>
                      {formatGen(builtResult.built.params.userValue)} GEN
                    </StatValue>
                  </Stat>
                  <Stat>
                    <StatLabel>msg.value</StatLabel>
                    <StatValue>
                      {formatGen(builtResult.built.estimate.totalMsgValue)} GEN
                    </StatValue>
                  </Stat>
                  <Stat>
                    <StatLabel>Fee hash</StatLabel>
                    <StatValue>
                      {shortHex(builtResult.built.feeConfigHash)}
                    </StatValue>
                  </Stat>
                </StatGrid>
              </Panel>

              <Panel>
                <PanelTitle>5. Generated Payloads</PanelTitle>
                <Stack>
                  <div>
                    <Muted>AddTransactionParams</Muted>
                    <CodeBlock>
                      {stringifyBigints(builtResult.built.params)}
                    </CodeBlock>
                  </div>
                  <div>
                    <Muted>Direct EVM transaction</Muted>
                    <CodeBlock>
                      {stringifyBigints({
                        ...builtResult.built.txRequest,
                        data: shortHex(builtResult.built.txRequest.data, 18),
                      })}
                    </CodeBlock>
                  </div>
                  <div>
                    <Muted>Gateway EIP-712 intent</Muted>
                    <CodeBlock>
                      {stringifyBigints(builtResult.built.intent)}
                    </CodeBlock>
                  </div>
                </Stack>
              </Panel>

              <Panel>
                <PanelTitle>6. Execute</PanelTitle>
                <Row>
                  <button
                    disabled={!canSendDirect}
                    onClick={runAsync(sendDirectTransaction)}
                    type="button"
                  >
                    Send direct addTransaction
                  </button>
                  <button
                    disabled={!canSignIntent}
                    onClick={runAsync(signGatewayIntent)}
                    type="button"
                  >
                    Sign and submit gateway intent
                  </button>
                </Row>
                {!canSendDirect && (
                  <p>
                    <Muted>
                      Set a deployed consensus address and connect a wallet to
                      enable direct submission.
                    </Muted>
                  </p>
                )}
                {sendResult && (
                  <div>
                    <Muted>Direct tx result</Muted>
                    <CodeBlock>{sendResult}</CodeBlock>
                  </div>
                )}
                {signResult && (
                  <div>
                    <Muted>Intent signature</Muted>
                    <CodeBlock>{signResult}</CodeBlock>
                  </div>
                )}
              </Panel>
            </>
          )}
        </Stack>
      </Grid>
    </Container>
  );
};

export default Index;
