import {
  WalletAddresses,
  WalletAddressMetadataMap,
  UiWalletPayload,
  UiWalletEntry,
  WalletAddressKey,
  WalletAddressKind,
  SmartAccountSummary,
} from '../interfaces/wallet.interfaces.js';
import {
  EOA_CHAIN_KEYS,
  NON_EVM_CHAIN_KEYS,
  SMART_ACCOUNT_CHAIN_KEYS,
  UI_SMART_ACCOUNT_LABEL,
} from '../constants/wallet.constants.js';

export class WalletMapper {
  public buildUiWalletPayload(
    metadata: WalletAddressMetadataMap,
  ): UiWalletPayload {
    // The frontend expects smart-account chain keys like `baseErc4337`.
    // Values come from the canonical EVM keys (ethereum/base/...) which may
    // represent either EOA or smart-account addresses depending on enablement.
    const chainsRecord = {
      ethereumErc4337: metadata.ethereum?.address ?? null,
      baseErc4337: metadata.base?.address ?? null,
      arbitrumErc4337: metadata.arbitrum?.address ?? null,
      polygonErc4337: metadata.polygon?.address ?? null,
      avalancheErc4337: metadata.avalanche?.address ?? null,
    };

    const canonicalChainKey = SMART_ACCOUNT_CHAIN_KEYS.find((key) => {
      const address = metadata[key]?.address;
      if (!address) return false;
      // Only treat as "smart account" when the backend marked it as such.
      return metadata[key]?.kind === 'erc4337';
    });

    const canonicalAddress = canonicalChainKey
      ? (metadata[canonicalChainKey]?.address ?? null)
      : null;
    const canonicalChain = canonicalChainKey
      ? (`${canonicalChainKey}Erc4337` as const)
      : null;

    const smartAccount: SmartAccountSummary | null = canonicalAddress
      ? {
          key: 'evmSmartAccount',
          label: UI_SMART_ACCOUNT_LABEL,
          canonicalChain,
          address: canonicalAddress,
          chains: chainsRecord,
        }
      : null;

    const auxiliary = this.buildAuxiliaryWalletEntries(metadata);

    return {
      smartAccount,
      auxiliary,
    };
  }
  private buildAuxiliaryWalletEntries(
    metadata: WalletAddressMetadataMap,
  ): UiWalletEntry[] {
    const entries: UiWalletEntry[] = [];

    // EVM EOA chains (standard EVM wallets)
    const eoaChains: WalletAddressKey[] = [
      'ethereum',
      'base',
      'arbitrum',
      'polygon',
      'avalanche',
    ];
    eoaChains.forEach((chain) => {
      const entry = metadata[chain];
      if (entry?.visible && entry.address) {
        entries.push({
          key: chain,
          label: entry.label,
          chain,
          address: entry.address,
          category: 'evm',
        });
      }
    });

    // Polkadot EVM chains
    const polkadotEvmChains: WalletAddressKey[] = [
      'moonbeamTestnet',
      'astarShibuya',
      'paseoPassetHub',
    ];
    polkadotEvmChains.forEach((chain) => {
      const entry = metadata[chain];
      if (entry?.visible && entry.address) {
        entries.push({
          key: chain,
          label: entry.label,
          chain,
          address: entry.address,
          category: 'polkadot-evm',
        });
      }
    });

    // Substrate chains
    // const substrateChains: WalletAddressKey[] = [
    //   'polkadot',
    //   'hydrationSubstrate',
    //   'bifrostSubstrate',
    //   'uniqueSubstrate',
    //   'paseo',
    //   'paseoAssethub',
    // ];
    // substrateChains.forEach((chain) => {
    //   const entry = metadata[chain];
    //   if (entry?.visible && entry.address) {
    //     entries.push({
    //       key: chain,
    //       label: entry.label,
    //       chain,
    //       address: entry.address,
    //       category: 'substrate',
    //     });
    //   }
    // });

    // Non-EVM chains
    // NON_EVM_CHAIN_KEYS.forEach((chain) => {
    //   const entry = metadata[chain];
    //   if (entry?.visible && entry.address) {
    //     // Determine category based on chain
    //     let category: string | undefined;
    //     if (chain === 'tron' || chain === 'bitcoin' || chain === 'solana') {
    //       category = 'non-evm';
    //     }

    //     entries.push({
    //       key: chain,
    //       label: entry.label,
    //       chain,
    //       address: entry.address,
    //       category,
    //     });
    //   }
    // });

    return entries;
  }
  public buildMetadataSnapshot(
    partial: Partial<Record<WalletAddressKey, string | null>> | WalletAddresses,
  ): WalletAddressMetadataMap {
    const metadata = {} as WalletAddressMetadataMap;

    const assign = (
      chain: WalletAddressKey,
      kind: WalletAddressKind,
      visible: boolean,
    ) => {
      metadata[chain] = {
        chain,
        address: partial[chain] ?? null,
        kind,
        visible,
        label: this.getLabelForChain(chain, kind),
      };
    };

    // Standard EOA chains (not visible by default)
    const standardEoaChains = EOA_CHAIN_KEYS.filter(
      (chain) =>
        ![
          'moonbeamTestnet',
          'astarShibuya',
          'paseoPassetHub',
          'hydration',
          'unique',
          'bifrost',
          'bifrostTestnet',
        ].includes(chain),
    );
    standardEoaChains.forEach((chain) => assign(chain, 'eoa', false));

    // Polkadot EVM chains (visible)
    const polkadotEvmChains: WalletAddressKey[] = [
      'moonbeamTestnet',
      'astarShibuya',
      'paseoPassetHub',
      'hydration',
      'unique',
      'bifrost',
      'bifrostTestnet',
    ];
    polkadotEvmChains.forEach((chain) => assign(chain, 'eoa', true));
    SMART_ACCOUNT_CHAIN_KEYS.forEach((chain) => assign(chain, 'eoa', true));
    //NON_EVM_CHAIN_KEYS.forEach((chain) => assign(chain, 'nonEvm', true));

    // Substrate chains (visible)
    // const substrateChains: WalletAddressKey[] = [
    //   'polkadot',
    //   'hydrationSubstrate',
    //   'bifrostSubstrate',
    //   'uniqueSubstrate',
    //   'paseo',
    //   'paseoAssethub',
    // ];
    // substrateChains.forEach((chain) => assign(chain, 'substrate', true));

    return metadata;
  }

  public isVisibleChain(chain: WalletAddressKey): boolean {
    // Substrate chains
    // const SUBSTRATE_CHAIN_KEYS: Array<
    //   | 'polkadot'
    //   | 'hydrationSubstrate'
    //   | 'bifrostSubstrate'
    //   | 'uniqueSubstrate'
    //   | 'paseo'
    //   | 'paseoAssethub'
    // > = [
    //   'polkadot',
    //   // 'hydrationSubstrate',
    //   // 'bifrostSubstrate',
    //   // 'uniqueSubstrate',
    //   'paseo',
    //   'paseoAssethub',
    // ];

    // Polkadot EVM chains
    const POLKADOT_EVM_CHAIN_KEYS: Array<
      'moonbeamTestnet' | 'astarShibuya' | 'paseoPassetHub'
    > = ['moonbeamTestnet', 'astarShibuya', 'paseoPassetHub'];

    return (
      SMART_ACCOUNT_CHAIN_KEYS.includes(
        chain as (typeof SMART_ACCOUNT_CHAIN_KEYS)[number],
      ) ||
      NON_EVM_CHAIN_KEYS.includes(
        chain as (typeof NON_EVM_CHAIN_KEYS)[number],
      ) ||
      // SUBSTRATE_CHAIN_KEYS.includes(
      //   chain as (typeof SUBSTRATE_CHAIN_KEYS)[number],
      // ) ||
      POLKADOT_EVM_CHAIN_KEYS.includes(
        chain as (typeof POLKADOT_EVM_CHAIN_KEYS)[number],
      ) ||
      EOA_CHAIN_KEYS.includes(chain as (typeof EOA_CHAIN_KEYS)[number])
    );
  }
  private getLabelForChain(
    chain: WalletAddressKey,
    kind: WalletAddressKind,
  ): string {
    const baseLabels: Partial<Record<WalletAddressKey, string>> = {
      ethereum: 'Ethereum',
      base: 'Base',
      arbitrum: 'Arbitrum',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
      // tron: 'Tron',
      // bitcoin: 'Bitcoin',
      // solana: 'Solana',
      moonbeamTestnet: 'Moonbeam Testnet',
      astarShibuya: 'Astar Shibuya',
      paseoPassetHub: 'Paseo PassetHub',
      hydration: 'Hydration',
      unique: 'Unique',
      bifrost: 'Bifrost Mainnet',
      bifrostTestnet: 'Bifrost Testnet',
    };

    const label = baseLabels[chain];
    if (label) {
      if (kind === 'eoa') {
        return `${label} (EOA)`;
      }
      return label;
    }
    return chain;
  }
}
