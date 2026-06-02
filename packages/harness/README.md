# GenLayer Wallet Harness

Local EVM harness for testing the fee-aware GenLayer wallet flow before the
fee-aware consensus interface is deployed on Bradbury.

## Run

Start Anvil:

```sh
yarn workspace harness anvil
```

Deploy the shim and gateway:

```sh
yarn workspace harness deploy
```

The deploy script writes `packages/site/static/harness.local.json`, which the
site loads with the **Load local harness** button.

Optional CLI smoke test:

```sh
yarn workspace harness smoke
```

The smoke test submits both paths:

- direct `GenLayerFeeShim.addTransaction(AddTransactionParams)`
- signed EIP-712 intent through `GenLayerIntentGateway.submitIntent(...)`

After running the smoke test, deploy again if you want the browser flow to start
from gateway nonce `0`.
