# GenLayer Transaction and Wallet Architecture

## Goal

Give users a trustworthy way to send GenLayer transactions from wallets they
already use, on desktop and mobile, without requiring a new standalone wallet.

The core security requirement is that the user must not rely on dapp-controlled
UI for gas limits. The user signs or submits a wallet-visible commitment to:

- the GenLayer call
- the value being sent
- the gas policy
- either the actual fee/message configuration or an exact hash of any large
  nested configuration used in an intent flow

The control plane must live before the wallet prompt. The dapp transaction kit,
SDK, or an optional preflight wallet interaction can help the user choose a gas
policy, but the final wallet prompt is a verification surface. It must not be
treated as a place where the wallet or Snap can rewrite calldata, `msg.value`,
or fee limits after the dapp has submitted the transaction request.

The architecture should therefore be Snap-independent:

- transaction kit owns policy selection and editing
- `genlayer-js` builds direct transactions and typed intents
- ERC-7730 metadata and clear EIP-712 typed data provide standard wallet
  verification where wallets support them
- the Snap is an optional MetaMask Extension verifier, not the primary product
  flow or mobile strategy

## Current Baseline

Today this repo's `genlayer-js` integration builds a direct EVM transaction to
`ConsensusMain.addTransaction(...)` using the older positional ABI variants:

```solidity
addTransaction(
  address sender,
  address recipient,
  uint256 numOfInitialValidators,
  uint256 maxRotations,
  bytes calldata,
  uint256 validUntil
)
```

The current wallet Snap is a transaction-insight UI. It parses the older
positional `addTransaction` calldata and the v0.6 fee-aware
`addTransaction(AddTransactionParams)` / `deploySalted(AddTransactionParams)`
shape. It extracts the GenLayer recipient, nested method name, user value,
valid-until, fee distribution, message allocation mode, and message allocation
summary. It also decodes fee-management calls such as `topUpFees`,
`submitAppeal`, and `topUpAndSubmitAppeal`.

It still shows an advanced-options form whose values are persisted in Snap
state, but those options do not modify the transaction. The Snap is therefore a
verification surface, not the gas-policy control plane.

That limitation is structural for the transaction-insight role: `onTransaction`
can inspect and warn about the submitted transaction, but it should not be the
place where GenLayer users edit policy. Any editable Snap experience must happen
as an explicit preflight flow before transaction construction, for example via
`wallet_invokeSnap`, and the final `onTransaction` screen must then verify that
the built transaction matches the chosen policy or policy hash.

The fee-aware consensus interface on `genlayer-consensus` `v0.6` has
changed the shape to:

```solidity
function addTransaction(AddTransactionParams memory params) external payable;
function deploySalted(AddTransactionParams memory params) external payable;
```

with:

```solidity
struct AddTransactionParams {
  address sender;
  address recipient;
  uint256 numOfInitialValidators;
  uint256 maxRotations;
  uint256 validUntil;
  uint256 saltNonce;
  uint256 userValue;
  IFeeManager.FeesDistribution feesDistribution;
  bytes txCalldata;
  IMessages.MessageFeeAllocationNode[] messageAllocations;
}
```

`msg.value` is now the sum of consensus fees plus `userValue`. The user-facing
security and gas policy is mostly in `feesDistribution` and, for message-heavy
transactions, `messageAllocations`.

The GenLayer transaction id is created after submission inside consensus using
chain state, timestamp, randomness, and queue state. That means the pre-submit
object cannot know its final GenLayer tx id. Direct transactions should be
tracked first by the EVM transaction hash, then linked to the emitted GenLayer
`txId`. Gateway/relayed transactions should also have an `intentHash`.

## Consensus Fee Fields

The core fee/security struct is:

```solidity
struct FeesDistribution {
  uint leaderTimeunitsAllocation;
  uint validatorTimeunitsAllocation;
  uint appealRounds;
  uint executionBudgetPerRound;
  uint executionConsumed;
  uint totalMessageFees;
  uint[] rotations;
  uint maxPriceGenPerTimeUnit;
  uint storageFeeMaxGasPrice;
  uint receiptFeeMaxGasPrice;
}
```

For wallet UX, the important fields are:

- `leaderTimeunitsAllocation`: time-unit budget for the leader.
- `validatorTimeunitsAllocation`: time-unit budget for validators.
- `appealRounds`: number of appeal rounds pre-funded by the user.
- `executionBudgetPerRound`: per-round GenVM storage plus receipt/write budget.
- `executionConsumed`: protocol-managed counter; should not be presented as
  a user knob for initial submission.
- `totalMessageFees`: message-fee bucket for transactions that emit messages.
- `rotations`: array of pre-funded rounds; each value is the max rotations
  within that round.
- `maxPriceGenPerTimeUnit`: user cap on `FeeManager.GENPerTimeUnit`; `0` means
  uncapped legacy behavior.
- `storageFeeMaxGasPrice`: user cap on the locked GenVM storage unit price.
- `receiptFeeMaxGasPrice`: user cap on the locked receipt/write gas price.

Message-heavy transactions add a second layer:

```solidity
struct MessageFeeAllocationNode {
  uint256 parentIndex;
  uint8 messageType;
  bool onAcceptance;
  address recipient;
  bytes32 callKey;
  uint256 budget;
  bytes feeParams;
}

struct InternalMessageFeeParams {
  uint256 leaderTimeunitsAllocation;
  uint256 validatorTimeunitsAllocation;
  uint256 appealRounds;
  uint256 executionBudgetPerRound;
  uint256[] rotations;
}

struct ExternalMessageFeeParams {
  uint256 gasLimit;
  uint256 maxGasPrice;
}
```

There are two practical message modes:

- Mode 1: `totalMessageFees > 0` and `messageAllocations` is empty. The user
  caps the global message-fee bucket. The contract/SDK must provide each
  emitted message's `feeParams` and `declaredBudget` at the GenVM emission
  point; the leader must not invent message budgets after execution.
- Mode 2: `messageAllocations` is non-empty. The user pre-declares per-recipient
  and per-`callKey` budgets plus downstream fee params. Exact matches fall back
  to the per-recipient wildcard `callKey == bytes32(0)`. `messageType` and
  `onAcceptance` are pinned, and internal `feeParams` must match byte-for-byte.
  This is the stricter security mode and the one that creates the hardest
  wallet-display problem.

## Transaction Model

There are two transaction models and several verification layers. Policy
selection happens before either transaction model is built.

### Direct Consensus Transaction

For EOAs that can verify the transaction clearly, the preferred model is a
direct EVM transaction to:

```solidity
ConsensusMainWithFees.addTransaction(AddTransactionParams)
```

The wallet signs and submits the actual consensus transaction. The clear-signed
wallet screen is the final user verification surface for `feesDistribution`,
`messageAllocations`, `userValue`, validators, rotations, and valid-until.

### Gateway Intent

For wallets that cannot verify the direct consensus transaction clearly, use a
first-class `GenLayerIntent`:

```ts
type GenLayerIntent = {
  chainId: number;
  gateway: `0x${string}`;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  value: bigint;
  txDataHash: `0x${string}`;
  numInitialValidators: number;
  maxRotations: number;
  validUntil: bigint;
  gasPolicy: {
    profileId: string;
    maxTotalFee: bigint;
    gasConfigHash: `0x${string}`;
  };
  nonce: bigint;
  deadline: bigint;
};
```

This is mainly for relayed, smart-account, gas-sponsored, and mobile flows. A
signature over this intent does not move native value from an EOA by itself; it
requires sponsorship, deposit, permit-based payment, or smart-account execution.

The large nested message gas configuration should not be fully displayed on
small wallet screens. It should be canonicalized, hashed, and represented as:

- profile name
- max total fee
- high-level caps
- `gasConfigHash`

The app can render the full editor. The trusted object is either the direct
clear-signed `AddTransactionParams` or the signed gateway intent plus exact
config hash.

## Primary Wallet Insight Strategy

The primary wallet insight strategy should be:

1. ERC-7730 clear-signing metadata for direct consensus transactions and gateway
   transactions where wallets support it.
2. Clear EIP-712 typed `GenLayerIntent` signatures for mobile, gasless,
   unsupported-wallet, and relayed flows.
3. Wallet-native simulation/risk previews as advisory signals only.
4. GenLayer Snap as an optional MetaMask Extension verifier and development
   parser harness.

This makes the system useful across OKX, Rabby, Phantom, MetaMask, Ledger,
Trezor, WalletConnect, Privy, Reown AppKit, smart accounts, and future wallets
without depending on one wallet-specific extension surface.

### Clear Signing Metadata

GenLayer should publish ERC-7730 clear-signing metadata for direct consensus
transactions first, then gateway and intent types.

This helps wallets turn raw calldata or typed-data signing into a human-readable
confirmation such as:

```txt
Submit GenLayer transaction
Recipient: 0x...
Method: transfer
Value: 1.0 GEN
Initial validators: 5
Max rotations: 2
Appeal rounds: 1
Rollup budget per round: 0.02 GEN
Message fee budget: 0.01 GEN
Max GEN/time-unit price: 1.2x current
```

Clear signing is a verification layer over the data the user is actually
signing. For the direct EOA path, that means it can verify the actual
`AddTransactionParams` sent to consensus. For the gateway path, it can verify
the EIP-712 intent or gateway calldata.

Clear signing is not a wallet capability we can assume. The product must know
whether the active wallet can consume the metadata before routing a high-value
transaction to the direct path.

Current support should be treated as uneven. Ledger is the clearest live target
for ERC-7730-style descriptors, while broader browser/mobile wallet support is
still emerging. OKX, Rabby, and Phantom have useful proprietary transaction
simulation and risk-preview systems, but GenLayer should not assume those
wallets can render GenLayer fee semantics from ERC-7730 metadata today. Those
wallets should be routed through clear EIP-712 intents or explicitly marked as
simulation-only/unverified until verified support exists.

Required ERC-7730 files:

- `ConsensusMainWithFees.addTransaction(AddTransactionParams)` display
- `ConsensusMainWithFees.deploySalted(AddTransactionParams)` display
- `ConsensusMainWithFees.topUpFees(...)` display
- `ConsensusMainWithFees.topUpAndSubmitAppeal(...)` display
- `ConsensusMainWithFees.submitAppeal(...)` display
- ghost-contract relay display, if users enter GenLayer through ghosts
- `GenLayerGateway.submit(...)` EVM transaction display
- `GenLayerIntent` EIP-712 typed-data display
- smart-account `execute(...)` wrapper display where needed
- ERC-4337 `UserOperation` display where supported

These files must be tightly bound to chain ids, gateway addresses, EIP-712
domains, consensus addresses, ghost addresses, and deployed contract addresses
so a wallet does not apply GenLayer formatting to unrelated calldata.

## Supported Execution Paths

### 1. Clear-Signed Direct EOA Transaction

This is the preferred path when the active wallet can clearly display
GenLayer's fee/security parameters.

Flow:

1. Dapp transaction kit lets the user select a security profile or custom fee
   policy.
2. SDK estimates `FeesDistribution`, `userValue`, and `messageAllocations`.
3. SDK builds `ConsensusMainWithFees.addTransaction(AddTransactionParams)`.
4. Wallet displays the actual struct through ERC-7730 metadata or equivalent
   native support.
5. User sends the EVM transaction directly to consensus.
6. Explorer/indexer links EVM tx hash to emitted GenLayer `txId`.

This preserves native wallet value movement and does not require a gateway,
relayer, smart account, or intent signature.

### 2. Optional MetaMask Snap Verification

This is an optional MetaMask Extension enhancement when ERC-7730 support is
unavailable but the GenLayer Snap is installed. It is not the main control
plane, not the mobile strategy, and not required for the core architecture.

Flow:

1. Transaction kit and SDK choose the gas policy before building the
   transaction.
2. SDK builds the same direct `addTransaction(AddTransactionParams)` call.
3. Snap `onTransaction` decodes the final calldata and displays the GenLayer
   method, user value, fees distribution, message allocation mode, and key caps.
4. Snap warns if the transaction is undecodable, uncapped, has suspicious zero
   pricing, targets an unknown contract, or does not match a preflight policy
   hash.
5. User submits the EVM transaction from MetaMask.
6. Explorer links EVM tx hash to GenLayer `txId`.

The Snap cannot safely rewrite submitted calldata, `msg.value`, or fee limits
from the transaction-insight screen. If we keep a Snap-based editor, it must be
an explicit preflight interaction before the transaction request is created, and
the final `onTransaction` insight must verify that the submitted transaction
matches that preflight result.

This does not work on MetaMask Mobile while Snaps remain extension-only. Mobile
flows should use clear EIP-712 intents, smart accounts, deposits, sponsorship,
or wallet-call APIs instead.

### 3. Relayed Intent / Gateway

This is the mobile-friendly and gasless-capable path.

Flow:

1. User signs the EIP-712 `GenLayerIntent`.
2. App or relayer submits it to `GenLayerGateway`.
3. Gateway verifies the signature, nonce, deadline, calldata hash, value policy,
   and gas policy.
4. Gateway submits the GenLayer transaction.

Native value cannot be pulled from an EOA by signature alone. This path requires
one of:

- relayer sponsorship
- a prepaid user deposit in the gateway
- ERC-20 payment through permit or approval
- a smart account/paymaster path

The gateway path is only safer than direct `addTransaction` if the user signs a
clear EIP-712 intent, or if the smart-account wallet clearly displays the
operation. Blind-signing gateway calldata is not an improvement.

### 4. ERC-4337 Smart Account

This should use the same `GenLayerIntent` model, but package execution as a
`UserOperation` through a smart account.

Flow:

1. App builds intent and call to `GenLayerGateway.submit(...)`.
2. Smart account validates the user's authorization.
3. Bundler submits the `UserOperation`.
4. Paymaster can sponsor or charge another asset.
5. Gateway still emits the same intent and tx linkage events.

This keeps the GenLayer protocol surface unified. ERC-4337 changes the transport
and payment model, not the GenLayer intent semantics.

### 5. EIP-7702 / Wallet Call API

Where supported, wallets can expose batching/sponsorship features through
delegated EOAs or `wallet_sendCalls`. GenLayer should treat these as additional
transports for either the direct consensus call or the gateway call, not as
separate transaction semantics.

The SDK should probe capabilities and choose the best available path:

1. clear-signed direct consensus transaction
2. clear EIP-712 intent with gateway, deposit, sponsorship, permit, or smart
   account support
3. smart account / wallet call API with clear operation display
4. Snap-verified direct consensus transaction for MetaMask Extension users
5. unsafe fallback only with strong warning or user opt-in

## Wallet Verification Detection

There is no reliable generic RPC today for `wallet_supportsERC7730`.

The transaction kit should implement a conservative verifier:

```ts
type WalletVerification =
  | { kind: 'erc7730'; confidence: 'known'; wallet: string }
  | { kind: 'snap'; confidence: 'installed'; wallet: 'MetaMask' }
  | { kind: 'smart-account'; confidence: 'capability'; wallet: string }
  | { kind: 'intent'; confidence: 'typed-data'; wallet: string }
  | { kind: 'simulation-only'; confidence: 'wallet-specific'; wallet: string }
  | { kind: 'none'; confidence: 'unknown'; wallet?: string };
```

Detection inputs:

- EIP-6963 provider identity (`name`, `rdns`) for wallet identification only.
  EIP-6963 is not reliable feature detection by itself.
- A maintained GenLayer wallet capability matrix for known ERC-7730 support.
- MetaMask-specific Snap install checks for the GenLayer Snap.
- EIP-5792 `wallet_getCapabilities` for wallet-call, batching, paymaster, or
  smart-account capabilities. It does not currently prove ERC-7730 support.
- Runtime transaction simulation or preview APIs if a wallet vendor exposes
  them, but this is wallet-specific.

Routing rule:

```txt
known ERC-7730 support       -> direct addTransaction
clear EIP-712 available      -> GenLayerIntent + gateway/relayer
smart account/paymaster      -> UserOperation or wallet-call path
MetaMask Snap installed      -> direct addTransaction with Snap verification
simulation-only wallet       -> treat preview as advisory, prefer typed intent
unknown wallet               -> block or explicit blind-signing warning
```

## Stack Support

### `genlayer-consensus`

The direct path depends on the fee-aware interface staying ABI-readable and
wallet-displayable:

- keep `AddTransactionParams`, `FeesDistribution`, and
  `MessageFeeAllocationNode[]` as typed ABI data, not opaque `bytes`
- keep user-controlled caps at top level where possible
- make `maxPriceGenPerTimeUnit == 0` visibly mean uncapped
- keep `msg.value == totalFees + userValue` semantics explicit
- expose view helpers needed by SDKs to quote total fees and top-up deltas
- expose governance-configured maximum validity window
- expose governance-configured maximum queue size
- expose per-recipient queue depth before submission
- emit enough events for indexers to link EVM tx hash, sender, `userValue`,
  refunds, fee distribution, queue position, and GenLayer `txId`

The gateway is still useful, but it should not be required for normal EOA
transactions if direct clear signing is available.

For the optional gateway path:

- EIP-712 domain and type hashes for `GenLayerIntent`
- nonce and deadline replay protection
- validation of sender, recipient, value policy, calldata hash, fee config hash,
  `validUntil`, queue policy, and fee policy fields
- event linkage from `intentHash` to consensus `txId`
- support for sponsored, deposited, permit-paid, and smart-account submissions

### Fee, Execution, and GenVM

Fee/security policy must be enforced where spending actually happens.

Required support:

- canonical fee config construction for SDKs and wallet metadata
- validation that nested message allocations match the submitted tree
- support for Mode 1 and Mode 2 message-fee semantics
- execution-time stop/fail/refund rules when limits are reached
- final receipt fields for quoted max, actual spent, and refund

### `genlayer-js`

Make this the primary integration layer:

- `estimateFeesDistribution`
- `buildAddTransactionParams`
- `buildDeploySaltedParams`
- `sendClearSignedTransaction`
- `detectWalletVerification`
- `buildWriteIntent`
- `buildDeployIntent`
- `hashFeeConfig`
- `hashIntent`
- `signGenLayerIntent`
- `submitIntent`
- `getValidityPolicy`
- `buildValidUntil`
- `getRecipientQueueStatus`
- `writeContractWithPolicy`
- transport selection for clear-signed EOA, clear typed intent, relayed gateway,
  ERC-4337, wallet call APIs, optional Snap verification, and unsafe fallback
- return `{ intentHash, evmTxHash, genlayerTxId }`
- export ERC-7730 metadata artifacts or point wallets to their canonical
  registry location

The existing client already routes `eth_signTypedData_v4` to wallet providers,
so typed intent signing fits the current SDK shape.

### `genlayer-py`

Mirror the canonical hashing and signing APIs for bots, CLI, tests, and relayer
infrastructure:

- same gas config canonicalization
- same EIP-712 intent hash
- local account signing
- fee-aware `AddTransactionParams` builders
- gateway submit helpers

### `genlayer-node`

Expose RPC support for building safe wallet UI and tracking status:

- `gen_estimateTransactionCost`
- `gen_validateGasPolicy`
- `gen_simulateTransactionWithGasPolicy`
- `gen_getIntentStatus`
- `gen_getTransactionCostBreakdown`
- `gen_getValidityPolicy`
- `gen_getRecipientQueueStatus`
- `gen_getQueuePolicy`
- receipt fields for fee policy, message allocation mode, quoted max, actual
  spend, refund, validity policy, queue depth, and queue position
- optional `intentHash` fields for gateway/relayed flows

The current `gen_estimateGas` placeholder should become real or be replaced by
clearer GenLayer-specific estimation methods.

### Relayer

Provide an optional service, not a trust boundary:

- accepts signed intents
- validates them before submission
- handles sponsorship, deposits, or permit payment
- submits to gateway
- reports status by `intentHash`
- never gets authority beyond the signed intent

### `genlayer-wallet` Snap

Keep this as an optional MetaMask Extension verification layer and parser test
harness. It should not own gas policy selection, route selection, or mobile
coverage.

- maintain decoding for legacy positional `addTransaction`
- maintain decoding for fee-aware `addTransaction(AddTransactionParams)`
- maintain decoding for `deploySalted`, `topUpFees`, `submitAppeal`, and
  `topUpAndSubmitAppeal`
- decode `GenLayerGateway.submit(...)`
- show method, recipient, user value, validators, rotations, appeal rounds,
  execution budget, message-fee mode, `maxPriceGenPerTimeUnit`, and key caps
- reuse the same field labels and display semantics as the ERC-7730 metadata
- warn when a transaction cannot be decoded, includes uncapped fee settings,
  uses zero/suspicious pricing, targets an unknown contract, or has a stale
  validity window
- optionally support a preflight policy-selection RPC, but only if the final
  transaction insight compares the submitted transaction to the selected policy
  hash
- optionally show Snap home activity keyed by `intentHash` and `txId`

Snaps are not the mobile strategy because MetaMask Snaps are currently extension
only. If the Snap work competes with transaction kit, ERC-7730 metadata, or
gateway intent work, the Snap should be deprioritized.

### Explorer

Index and display the full transaction chain:

- EVM submission tx hash
- optional `intentHash`
- signer / sender
- submitter / relayer where different
- gateway address only for gateway flows
- GenLayer `txId`
- `FeesDistribution`
- message allocation mode and summary
- security profile
- `validUntil` / expiry window
- recipient queue depth and queue position at submission
- max fee / quoted budget
- actual spend
- refund

Address pages should distinguish signer from submitter. A relayed transaction
belongs to the signer even if the EVM transaction was sent by the relayer.

### Studio

Use the same model locally:

- gas policy editor
- simulation against gas policy
- local fee-aware consensus behavior
- optional local gateway or gateway-compatible RPC behavior
- transaction details that show EVM tx hash, GenLayer `txId`, fee policy, and
  actual cost

### CLI

Expose the same capabilities for developers:

- build and print an intent
- hash a gas config
- sign an intent
- submit an intent
- submit direct `AddTransactionParams`
- submit via relayer
- poll by `intentHash` or `txId`

## Product Surfaces

### Dapp Transaction Kit

This is the main developer-facing package.

Responsibilities:

- render gas policy editor
- call SDK estimators
- build `AddTransactionParams` or gateway intents
- pick transport based on wallet verification support
- submit or relay
- display progress from EVM tx hash or `intentHash` to GenLayer `txId` to final
  receipt

The kit is useful UX, but it is not the trust boundary. The trust boundary is
either the wallet-verified direct consensus transaction or the wallet-signed
gateway intent.

The kit should explicitly label the current route:

- verified direct: wallet can clear-sign GenLayer fee config
- Snap-verified direct: MetaMask Extension plus GenLayer Snap; optional and
  desktop-only
- verified intent: user signs EIP-712 and a relayer/smart account submits
- simulation-only: wallet shows a proprietary risk preview, but GenLayer has not
  verified clear fee-policy rendering
- unverified: wallet cannot display fee config; require warning or block

### Framework and Wallet Requirements

The transaction kit must be framework-agnostic at its core. React and Vue should
be thin adapters over the same transaction, gas policy, signing, submission, and
receipt parsing logic.

Minimum package shape:

```txt
@genlayer/transaction-kit/core   -> no React/Vue dependency
@genlayer/transaction-kit/react  -> hooks and optional React components
@genlayer/transaction-kit/vue    -> composables and optional Vue components
```

The core package should accept wallet access through standard adapters:

```ts
type GenLayerWallet =
  | { type: 'eip1193'; provider: EIP1193Provider }
  | { type: 'viem'; walletClient: WalletClient }
  | { type: 'wagmi'; config: WagmiConfig };
```

This keeps the plan compatible with MetaMask, WalletConnect, Privy, Reown
AppKit, injected wallets, and smart accounts. It also avoids a Privy React
dependency for Vue apps. A Vue app using Privy only needs to hand the core
package an EIP-1193 provider or viem wallet client.

The UI package should be headless-first:

- export state/controllers independent of DOM rendering
- provide optional React and Vue components
- expose CSS custom properties for quick theming
- expose slots/render props for app-owned layout
- avoid Shadow DOM in the default components so app styles can reach them
- let other frameworks use the core controller without wrapping React or Vue

Minimum wallet/provider requirements:

- direct path can call `eth_sendTransaction` or viem `sendTransaction`
- gateway path can call `eth_signTypedData_v4` or viem `signTypedData`
- smart-account path can verify ERC-1271 and ERC-6492 signatures at the gateway
- AppKit / smart-account path can optionally use `wallet_getCapabilities`,
  `wallet_sendCalls`, and `wallet_getCallsStatus`
- unknown wallets are allowed only through an explicit unverified route or the
  clear EIP-712 gateway intent route

### Clear UI Steps Proposal

The default UI should be a transaction sheet, not a marketing page. It should be
usable as a full page, modal, or embedded widget in React or Vue.

#### Step 1: Connect and Detect

Show:

- connected account
- detected wallet/provider
- chain
- route readiness

Actions:

- connect wallet
- switch/add chain
- detect capabilities
- install/connect Snap only as an optional MetaMask Extension enhancement

Route labels:

- **Verified direct**: clear-signing wallet can decode `AddTransactionParams`
- **Snap-verified direct**: MetaMask Extension plus GenLayer Snap can decode
  `AddTransactionParams`
- **Verified intent**: user will sign EIP-712 gateway intent
- **Smart account**: transaction will use wallet call / UserOperation semantics
- **Simulation-only**: wallet may preview transaction effects, but GenLayer fee
  policy rendering is not verified
- **Unverified**: wallet cannot show enough detail; block by default for
  high-risk transactions

#### Step 2: Pick Security Level

Show profiles first:

- Low
- Standard
- High
- Custom

Each profile maps to:

- initial validators
- rotations
- appeal rounds
- max GEN/time-unit cap
- execution budget
- message-fee mode

The UI should use plain language next to the profile:

- cheaper / faster
- balanced
- higher review budget

#### Step 3: Set Expiry and Queue Awareness

Show expiry as a user-facing duration first:

- 10 minutes
- 1 hour
- 1 day
- 1 week
- custom

Map the duration to the protocol's canonical `validUntil` representation. If
the protocol stores an absolute timestamp, the UI should still let users think
in "expires in" terms and show the resulting exact timestamp in the expanded
details.

The UI must load and display governance policy:

- maximum allowed `validUntil` window
- maximum queue size for the recipient contract

The queue preview should show:

- recipient contract queue depth
- maximum queue size
- queue fullness percentage
- whether this transaction would be accepted, warned, or blocked

Rules:

- block or require an explicit override when `validUntil` exceeds the governance
  max
- block when queue depth is at or above max queue size
- warn when queue depth is close to max, for example over 80%
- explain that queue depth is not a deterministic time estimate unless the
  target contract exposes better semantics

#### Step 4: Advanced Gas Policy

Collapsed by default. Expands into exact controls:

- leader timeout fee
- validator timeout fee
- execution budget per round
- rotations array
- max GEN/time-unit cap
- message mode
- message allocation tree for Mode 2

Rules:

- show `maxPriceGenPerTimeUnit == 0` as **uncapped**, never as "zero"
- show nested message budgets as caps, not estimates
- warn when a nested allocation is much larger than the parent-visible summary

#### Step 5: Transaction Review

Show the application-level transaction:

- method
- recipient / contract
- user value
- calldata summary
- valid-until
- expiry duration
- current queue depth
- max queue size
- nonce / salt

Then show the fee/security summary:

- max fee budget
- user value
- total `msg.value`
- fee config hash
- message allocation mode

The user should be able to expand raw payloads:

- `AddTransactionParams`
- direct EVM transaction request
- EIP-712 gateway intent

#### Step 6: Route Confirmation

The call to action depends on the selected route:

- **Send direct GenLayer transaction**
- **Sign and submit gateway intent**
- **Submit smart-account operation**
- **Continue with unverified transaction** only after an explicit warning and
  only for low-risk/local/dev contexts

Before opening the wallet, show one final short checklist:

- destination contract
- maximum spend
- security profile
- expiry
- queue status
- route type

#### Step 7: Wallet Prompt

Expected wallet behavior:

- clear-signed direct path shows decoded `addTransaction(AddTransactionParams)`
- gateway path shows EIP-712 typed data with fee hash, max spend, recipient,
  deadline, nonce, and chain/domain
- smart-account path shows wallet-call/UserOperation details where the wallet
  supports them
- optional Snap path shows the same fields in MetaMask transaction insights, but
  only after the transaction kit has already built the final transaction

If the wallet prompt cannot display enough detail, the app must keep the route
marked unverified after submission.

#### Step 8: Pending and Final Status

Show progress as separate identifiers:

- EVM tx hash or wallet-call id
- optional gateway `intentHash`
- GenLayer `txId`
- final receipt

Status timeline:

```txt
Preparing -> Wallet confirmation -> EVM submitted -> GenLayer tx created
-> Pending consensus -> Accepted/finalized -> Cost/refund complete
```

The final receipt should show:

- selected max budget
- actual spend
- refund
- validators / rotations used
- message budgets used
- links to EVM explorer and GenLayer explorer

### Wallet Confirmations

Clear-signed direct transaction:

- wallet shows a real EVM transaction with `userValue`, fee budget, message
  budget, and security level

Relayed intent:

- wallet shows EIP-712 signature
- explorer/app shows status
- value requires sponsorship, deposit, permit, or smart account

Smart account:

- wallet/smart account shows a UserOperation or wallet call
- gateway still emits the same events

## Trusted Direct Development Mode

Before gateway intents and broad wallet clear-signing support are ready, we can
test the user-side fee system through a trusted direct mode.

In this mode, the dapp transaction kit or SDK is treated as the trusted policy
source. It builds the final `AddTransactionParams`, including `userValue`,
`feesDistribution`, `messageAllocations`, `validUntil`, and fee deposit. The
wallet sends the direct consensus transaction, but the test does not require the
wallet to independently prove that it rendered every GenLayer fee field.

This is a development and CI mode, not the final user trust model. It is useful
because it exercises the same protocol and tooling payload that later wallet
verification will inspect:

- direct deploy/write with `feeValue` separate from `userValue`
- exact time-unit fee budgets and `maxPriceGenPerTimeUnit`
- top-up, cancel, appeal, and top-up-and-appeal flows
- Mode 1 message fee bucket behavior
- Mode 2 message allocation matching
- execution/storage/receipt budget accounting, spend, and refund reporting
- Studio and node parity for the same normal tooling scenarios

The e2e suite should therefore run these trusted direct scenarios against both
Studio and the real node backend. Later, when ERC-7730 metadata, EIP-712
intents, gateway routing, and transaction-kit wallet detection are ready, the
same scenario bodies should be reusable with only the route setup changed. The
assertions should stay focused on the canonical transaction payload and receipt
accounting rather than on one wallet-specific UI.

For pre-intents wallet coverage, the trusted route is:

1. SDK builds the same fee preset the dapp would recommend.
2. Studio `sim_call` runs the write with that preset and returns GenVM fee
   accounting without committing state.
3. The direct transaction is submitted with the same fee preset.
4. Tests assert that the submitted transaction records the fee deposit and that
   Studio/node state changes only after submission.

## Implementation Phases

### Phase 1: Fee-Aware Direct Transaction Spec

- lock `AddTransactionParams` and `FeesDistribution` assumptions
- define profile-to-`FeesDistribution` mapping
- define Mode 1 / Mode 2 message-fee UX rules
- define trusted direct mode as the pre-intents test route
- add JS/Python hashing test vectors
- add ERC-7730 clear-signing metadata for direct consensus functions
- add docs and examples

### Phase 2: SDK and Clear Direct Path

- update `genlayer-js` to build `AddTransactionParams`
- add estimators and fee profile helpers
- expose trusted direct submission for local/dev/test environments
- add wallet verification detection and routing
- ship direct clear-signed examples
- keep Snap decode support aligned with the same fixtures, but do not block the
  core SDK path on Snap availability

### Phase 3: Transaction Kit and Intent Path

- build framework-agnostic gas policy controller
- ship React and Vue adapters
- define `GenLayerIntent`
- add EIP-712 typed-data signing
- add canonical gas config hashing and test vectors
- add clear intent review UI and route labels

### Phase 4: Explorer and Node

- index fee/refund/top-up events
- expose direct transaction cost breakdown and status
- add estimate/validate/simulate RPCs
- show actual cost versus selected fee/security cap

### Phase 5: Gateway, Mobile, and Relayer

- deploy `GenLayerGateway`
- add nonce/deadline/signature verification
- relayer service
- deposit/sponsorship/payment model
- mobile WalletConnect flow
- transaction kit status UX

### Phase 6: Smart Accounts

- ERC-4337 packaging
- paymaster support
- capability probing for wallet call APIs
- optional EIP-7702 support where wallets expose it safely

### Phase 7: Optional Snap Hardening

- keep struct-based calldata decoding and warnings current with consensus ABI
- reuse ERC-7730 labels and examples as Snap fixtures
- add preflight policy-selection RPC only if the final insight can compare the
  transaction to a policy hash
- keep Snap work below transaction kit, ERC-7730, and gateway intent work in
  priority

## Critical Review

This plan is plausible, but it has real implementation risks.

### 1. ERC-7730 Adoption Is Uneven

Clear signing is the cleanest direct-path answer only in wallets that actually
consume ERC-7730 metadata for the target transaction. There is no standard
feature-detection RPC for this. The product needs a maintained compatibility
matrix and conservative routing. Unknown wallets should not silently get the
same UX label as verified wallets.

### 2. The Hard Part Is `messageAllocations`

`FeesDistribution` is small enough to display. `MessageFeeAllocationNode[]` can
be a nested budget tree with per-recipient, per-function, and descendant caps.
Even if ERC-7730 can technically describe the calldata, a hardware or mobile
wallet may not produce a useful human review for a large tree.

Mitigation:

- prefer bounded profiles for ordinary users
- show Mode 1 vs Mode 2 clearly
- show root-level caps and high-risk descendants
- consider adding a top-level summary/hash field if the raw tree becomes too
  large for wallet displays
- test on actual Ledger / ERC-7730 tooling before treating this as solved

### 3. SDK, Metadata, and Snap Must Stay Version-Aware

The SDK, ERC-7730 descriptors, and optional Snap parser must all handle protocol
versioning explicitly. We need version-aware builders and decoders for:

- legacy positional `ConsensusMain.addTransaction`
- fee-aware `ConsensusMainWithFees.addTransaction(AddTransactionParams)`
- `deploySalted`
- `topUpFees`
- `topUpAndSubmitAppeal`
- ghost relay paths

The same test fixtures should drive SDK encoding, ERC-7730 descriptor examples,
Snap parsing, CLI output, and e2e wallet/tooling tests so a consensus ABI change
does not silently desynchronize the stack.

### 4. Gateway Is Not Automatically Safer

If an unsupported wallet cannot clear-sign direct consensus calldata, sending an
opaque EVM transaction to a gateway does not improve the trust problem. Gateway
fallback only helps when the user signs a clear EIP-712 intent, uses a smart
account flow with clear operation display, or relies on sponsorship/deposit so
the final calldata is not the user's blind approval.

### 5. EOA Value Limits the Relayed Path

A relayer cannot pull native `userValue` from an EOA with only a signature. The
mobile/gateway path needs one of:

- sponsored value
- prepaid gateway deposit
- ERC-20 permit/approval payment
- smart account/paymaster execution
- a separate EVM transaction, which reintroduces wallet-display requirements

### 6. Fee Cap Semantics Need Careful UX

`maxPriceGenPerTimeUnit == 0` means uncapped legacy behavior. That is easy to
mislabel as "zero price" or "free". The transaction kit and wallet metadata must
call it "uncapped". Top-ups can raise a stored cap but cannot tighten it, so the
top-up UI must explain the resulting cap, not just the delta transaction.

### 7. Metadata Integrity Is Part of Security

ERC-7730 files must be bound to exact chain ids, consensus/gateway addresses,
EIP-712 domains, and proxy/ghost patterns. A stale or malicious metadata file
can make dangerous calldata look benign. GenLayer should publish metadata from
the same release pipeline as contract ABIs and maintain a public registry
history.

### 8. Interface Flux Requires Versioned Support

The fee docs are still draft and local consensus worktrees can differ from
`v0.6`. The SDK should use ABI feature detection and chain config
versions rather than assuming one final signature everywhere.

### 9. Expiry Is a User Policy, Not Just a Timestamp

Users should choose an expiry window in human terms, but the protocol may store
`validUntil` as an absolute timestamp. The SDK must map between the two and
enforce governance limits. Wallet and dapp UI should show both the friendly
duration and the exact resulting timestamp before signing.

### 10. Queue Status Is a Risk Signal, Not a Latency Estimate

Every recipient contract has a queue, but queue depth does not by itself predict
when a transaction will execute. Poorly designed apps can fill queues by not
checking pending work. The transaction kit should show queue depth and max queue
size, but avoid promising execution time unless the target contract or node
exposes stronger semantics.

### 11. Snap Is Redundant by Design

The Snap overlaps with ERC-7730, EIP-712 intents, and wallet-native previews. That
is acceptable only if we keep it optional. Its useful roles are MetaMask
Extension coverage, GenLayer-specific warnings, and parser test coverage. It
should not become the only editable gas UI, the only safe display path, or a
requirement for mobile support.

## Recommendation

Use **transaction kit + `genlayer-js` fee-aware builders as the control plane**.
Use **ERC-7730 clear signing as the primary direct-transaction verification
path** where wallets support it. Use **clear EIP-712 `GenLayerIntent` signatures
plus gateway / relayer / smart-account flows for mobile, gasless, sponsorship,
or wallets that cannot verify direct calldata**. Keep **Snap as optional
MetaMask Extension coverage only**.

Do not route unsupported wallets into a blind gateway transaction and call that
safer. Do not depend on Snap for gas policy editing. If a Snap preflight editor
is kept, the final transaction insight must verify the submitted calldata and
fee values against the preflight policy hash.

## References

- Clear Signing Alliance: https://clearsigning.org/
- ERC-7730 structured data clear-signing format: https://eips.ethereum.org/EIPS/eip-7730
- EIP-6963 provider discovery: https://eips.ethereum.org/EIPS/eip-6963
- ERC-4337 account abstraction: https://docs.erc4337.io/core-standards/erc-4337
- EIP-7702 delegated EOAs: https://eips.ethereum.org/EIPS/eip-7702
- EIP-5792 wallet call API: https://eips.ethereum.org/EIPS/eip-5792
- MetaMask Snaps FAQ: https://support.metamask.io/configure/snaps/metamask-snaps-faq/
