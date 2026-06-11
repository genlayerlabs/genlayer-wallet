# How to Connect to GenLayer Localnet via MetaMask

## Branching

See [docs/BRANCHING.md](docs/BRANCHING.md) for the release-train model used by
this repo.

Follow these steps to add the GenLayer Localnet as a custom network in MetaMask:

## Step 1: Open MetaMask

1. Unlock your MetaMask wallet or install MetaMask if you haven’t already.

## Step 2: Open the Network Settings

1. Click the **network dropdown** in the top-left corner of the MetaMask interface.
2. Scroll to the bottom of the list and click **"Add a custom network"**.

## Step 3: Fill in the Custom Network Details

Fill out the fields with the following information:

- **Network Name**: `GenLayer Localnet`
- **RPC URL**: `http://127.0.0.1:4000/api`
- **Chain ID**: `61999`
- **Currency Symbol**: `GEN`
- **Block Explorer URL**: Leave this blank for now.

## Step 4: Save the Network

1. Click on **"Save"** to confirm and add the network to your MetaMask.
2. Once saved, you will be automatically switched to the **GenLayer Localnet** network.

## Step 5: Verify the Network

1. Confirm that the **GenLayer Localnet** is selected in the network dropdown.

#### Notes

- Ensure the GenLayer Localnet is running and accessible at `http://127.0.0.1:4000/api`.
- If you encounter issues, double-check the Chain ID and RPC URL.

## Getting Started with Genlayer Wallet

Clone this repository and set up the development environment:

```shell
yarn install && yarn start
```

#### Notes

To interact with Genlayer Wallet locally, you will need to install [MetaMask Flask](https://metamask.io/flask/),
a canary distribution for developers.
