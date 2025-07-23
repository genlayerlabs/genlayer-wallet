export class StateManager {
  static async get<ValueType = any>(
    key = 'default',
  ): Promise<ValueType | null> {
    const state = (await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    })) as Record<string, any> | null;
    return state && key in state ? state[key] : null;
  }

  static async set(key: string, value: any): Promise<void> {
    const currentState = (await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    })) as Record<string, any> | null;

    const newState = {
      ...(currentState ?? {}),
      [key]: value,
    };

    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState,
      },
    });
  }

  static async remove(key: string): Promise<void> {
    const currentState = (await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    })) as Record<string, any> | null;

    if (currentState && key in currentState) {
      const { [key]: _, ...newState } = currentState;

      await snap.request({
        method: 'snap_manageState',
        params: {
          operation: 'update',
          newState,
        },
      });
    }
  }

  static async clear(): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'clear',
      },
    });
  }
}
