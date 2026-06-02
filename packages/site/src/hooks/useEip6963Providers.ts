import { useEffect, useMemo, useState } from 'react';

type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
};

export type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: {
    request?: (args: {
      method: string;
      params?: unknown[];
    }) => Promise<unknown>;
    isMetaMask?: boolean;
  };
};

type Eip6963AnnounceEvent = CustomEvent<Eip6963ProviderDetail>;

const KNOWN_CLEAR_SIGNING_RDNS = ['com.ledger'];

export const isKnownClearSigningWallet = (
  provider?: Eip6963ProviderDetail,
): boolean => {
  if (!provider) {
    return false;
  }

  const rdns = provider.info.rdns?.toLowerCase() ?? '';
  const walletName = provider.info.name.toLowerCase();

  return (
    KNOWN_CLEAR_SIGNING_RDNS.some((known) => rdns.includes(known)) ||
    walletName.includes('ledger')
  );
};

export const useEip6963Providers = () => {
  const [providers, setProviders] = useState<Eip6963ProviderDetail[]>([]);

  useEffect(() => {
    const onProvider = (providerEvent: Event) => {
      const announcedProvider = (providerEvent as Eip6963AnnounceEvent).detail;

      setProviders((currentProviders) => {
        const exists = currentProviders.some(
          (provider) => provider.info.uuid === announcedProvider.info.uuid,
        );

        if (exists) {
          return currentProviders;
        }

        return [...currentProviders, announcedProvider];
      });
    };

    window.addEventListener('eip6963:announceProvider', onProvider);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', onProvider);
    };
  }, []);

  return useMemo(
    () => ({
      providers,
      clearSigningProvider: providers.find(isKnownClearSigningWallet),
    }),
    [providers],
  );
};
