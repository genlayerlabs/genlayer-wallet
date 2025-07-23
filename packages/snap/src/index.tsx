import type {
  OnTransactionHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';

import type { AdvancedOptionsFormState } from './components';
import { AdvancedOptionsForm, TransactionConfig } from './components';
import { StateManager } from './libs/StateManager';
import { getTransactionStorageKey } from './transactions/transaction';

export const onTransaction: OnTransactionHandler = async ({ transaction }) => {
  const storageKey = getTransactionStorageKey(transaction);
  await StateManager.set('currentStorageKey', storageKey);

  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: <TransactionConfig />,
      context: { transaction }, // here we need to change the context with the new modified transaction
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
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: <TransactionConfig />,
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
    await StateManager.set(currentStorageKey, value);

    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: <TransactionConfig />,
      },
    });
  }
};
