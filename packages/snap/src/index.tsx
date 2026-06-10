import type {
  OnTransactionHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';

import type { AdvancedOptionsFormState } from './components';
import { AdvancedOptionsForm, TransactionConfig } from './components';
import { StateManager } from './libs/StateManager';
import {
  getTransactionStorageKey,
  parseGenLayerTransaction,
  type ParsedGenLayerTransaction,
} from './transactions/transaction';

const getTransactionSummaryStorageKey = (storageKey: string) =>
  `${storageKey}:transactionSummary`;

const getCurrentTransactionSummary = async () => {
  const currentStorageKey = await StateManager.get('currentStorageKey');
  if (!currentStorageKey) {
    return undefined;
  }

  return (await StateManager.get(
    getTransactionSummaryStorageKey(currentStorageKey),
  )) as ParsedGenLayerTransaction | undefined;
};

const toJsonTransactionSummary = (summary: ParsedGenLayerTransaction) =>
  JSON.parse(JSON.stringify(summary)) as ParsedGenLayerTransaction;

const NUMERIC_VALUE_PATTERN = /^(0x[0-9a-fA-F]+|\d+)$/u;

const parseTransactionValue = (value: unknown): bigint | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!NUMERIC_VALUE_PATTERN.test(trimmed)) {
    return undefined;
  }
  return BigInt(trimmed);
};

const withTransactionValue = (
  summary: ParsedGenLayerTransaction,
  value: unknown,
): ParsedGenLayerTransaction => {
  const totalValue = parseTransactionValue(value);
  if (totalValue === undefined) {
    return summary;
  }

  const userValue =
    summary.userValue === undefined ? 0n : BigInt(summary.userValue);
  const feeDeposit = totalValue > userValue ? totalValue - userValue : 0n;

  return {
    ...summary,
    totalValue: totalValue.toString(),
    feeDeposit: feeDeposit.toString(),
  };
};

export const onTransaction: OnTransactionHandler = async ({ transaction }) => {
  const storageKey = getTransactionStorageKey(transaction);
  const transactionSummary = withTransactionValue(
    parseGenLayerTransaction(transaction.data ?? ''),
    transaction.value,
  );
  const jsonTransactionSummary = toJsonTransactionSummary(transactionSummary);
  await StateManager.set('currentStorageKey', storageKey);
  await StateManager.set(
    getTransactionSummaryStorageKey(storageKey),
    jsonTransactionSummary,
  );

  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: <TransactionConfig summary={transactionSummary} />,
      context: {
        transaction,
        transactionSummary: jsonTransactionSummary as any,
      },
    },
  });

  return { id: interfaceId };
};

export const onUserInput: OnUserInputHandler = async ({ id, event }) => {
  if (
    event.type === UserInputEventType.InputChangeEvent &&
    event.name === 'number-of-appeals'
  ) {
    const currentStorageKey = await StateManager.get('currentStorageKey');
    const persistedData = (await StateManager.get(currentStorageKey)) || {};
    persistedData['number-of-appeals'] = event.value as string;

    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: <AdvancedOptionsForm values={persistedData || {}} />,
      },
    });
  }

  if (event.type === UserInputEventType.ButtonClickEvent) {
    switch (event.name) {
      case 'cancel_config':
        // eslint-disable-next-line no-case-declarations
        const transactionSummary = await getCurrentTransactionSummary();
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: <TransactionConfig summary={transactionSummary ?? null} />,
          },
        });
        break;

      case 'advanced_options':
        // eslint-disable-next-line no-case-declarations
        const currentStorageKey = await StateManager.get('currentStorageKey');
        // eslint-disable-next-line no-case-declarations
        const persistedData = (await StateManager.get(
          currentStorageKey,
        )) as AdvancedOptionsFormState;

        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: <AdvancedOptionsForm values={persistedData || {}} />,
          },
        });
        break;

      default:
        break;
    }
  }

  if (
    event.type === UserInputEventType.FormSubmitEvent &&
    event.name === 'advanced-options-form'
  ) {
    const currentStorageKey = await StateManager.get('currentStorageKey');
    const value = event.value as AdvancedOptionsFormState;
    const transactionSummary = await getCurrentTransactionSummary();
    await StateManager.set(currentStorageKey, value);

    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: <TransactionConfig summary={transactionSummary ?? null} />,
      },
    });
  }
};
