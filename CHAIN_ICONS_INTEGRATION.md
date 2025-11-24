# Chain Icons Integration Guide

This guide explains how to use the `@thirdweb-dev/chain-icons` package in your Tempwallets.com project.

## 📦 Package Information

- **Package**: `@thirdweb-dev/chain-icons`
- **Version**: `1.0.5`
- **Repository**: https://github.com/thirdweb-dev/chain-icons
- **License**: Apache-2.0

## ✅ Installation Complete

The package has already been installed in your web app:

```bash
pnpm add @thirdweb-dev/chain-icons
```

Location: `/Users/monstu/Developer/Tempwallets.com/apps/web/package.json`

## 🚀 Usage

### Basic Import Pattern

Icons are imported individually from their specific paths:

```tsx
import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';
import Polygon from '@thirdweb-dev/chain-icons/dist/polygon';
import BinanceCoin from '@thirdweb-dev/chain-icons/dist/binance-coin';
```

### Example Component

A complete example component has been created at:
`/apps/web/components/crypto-icons-example.tsx`

### Basic Usage

```tsx
'use client';

import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';

export function MyComponent() {
  return (
    <div>
      <Ethereum /> {/* Default size */}
      <Ethereum className="w-8 h-8" /> {/* Custom size with Tailwind */}
    </div>
  );
}
```

### Styling with Tailwind

All icons accept standard SVG props and className:

```tsx
<Ethereum className="w-12 h-12 text-blue-500" />
<Polygon className="w-6 h-6 opacity-50" />
```

### Dynamic Icon Loading

For dynamic icon selection based on chain ID or name:

```tsx
import { ComponentType, SVGProps } from 'react';

const iconMap: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  ethereum: require('@thirdweb-dev/chain-icons/dist/ethereum').default,
  polygon: require('@thirdweb-dev/chain-icons/dist/polygon').default,
  avalanche: require('@thirdweb-dev/chain-icons/dist/avalanche').default,
};

export function DynamicChainIcon({ chain }: { chain: string }) {
  const Icon = iconMap[chain.toLowerCase()];
  
  if (!Icon) return <div>Icon not found</div>;
  
  return <Icon className="w-8 h-8" />;
}
```

## 🎨 Available Popular Icons

Here are some commonly used blockchain icons:

| Icon Name | Import Path |
|-----------|-------------|
| Ethereum | `@thirdweb-dev/chain-icons/dist/ethereum` |
| Polygon | `@thirdweb-dev/chain-icons/dist/polygon` |
| Binance Coin (BSC) | `@thirdweb-dev/chain-icons/dist/binance-coin` |
| Avalanche | `@thirdweb-dev/chain-icons/dist/avalanche` |
| Arbitrum | `@thirdweb-dev/chain-icons/dist/arbitrum` |
| Optimism | `@thirdweb-dev/chain-icons/dist/optimism` |
| Solana | `@thirdweb-dev/chain-icons/dist/solana` |
| Cardano | `@thirdweb-dev/chain-icons/dist/cardano` |
| Polkadot | `@thirdweb-dev/chain-icons/dist/polkadot` |
| Cosmos | `@thirdweb-dev/chain-icons/dist/cosmos` |
| Chainlink | `@thirdweb-dev/chain-icons/dist/chainlink` |
| Uniswap | `@thirdweb-dev/chain-icons/dist/uniswap` |
| Aave | `@thirdweb-dev/chain-icons/dist/aave` |
| Tether | `@thirdweb-dev/chain-icons/dist/tether` |
| USD Coin | `@thirdweb-dev/chain-icons/dist/usd-coin` |
| Bitcoin | `@thirdweb-dev/chain-icons/dist/bitcoin` |
| Litecoin | `@thirdweb-dev/chain-icons/dist/litecoin` |
| Dogecoin | `@thirdweb-dev/chain-icons/dist/dogecoin` |
| Ripple | `@thirdweb-dev/chain-icons/dist/ripple` |

## 📋 Finding All Available Icons

To see all available icons, check the package directory:

```bash
ls node_modules/.pnpm/@thirdweb-dev+chain-icons@1.0.5_react@19.2.0/node_modules/@thirdweb-dev/chain-icons/dist | grep "\.d\.ts$" | sed 's/\.d\.ts$//' | sort
```

Or check the SVG source files:

```bash
ls node_modules/.pnpm/@thirdweb-dev+chain-icons@1.0.5_react@19.2.0/node_modules/@thirdweb-dev/chain-icons/svg/
```

## 💡 Real-World Integration Examples

### 1. Wallet Card with Chain Icon

```tsx
'use client';

import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';

export function WalletCard({ address, balance, chain }: Props) {
  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="flex items-center gap-3 mb-4">
        <Ethereum className="w-10 h-10" />
        <div>
          <h3 className="font-rubik-bold">Ethereum</h3>
          <p className="text-sm text-gray-400">{address}</p>
        </div>
      </div>
      <p className="text-2xl font-rubik-bold">{balance} ETH</p>
    </div>
  );
}
```

### 2. Chain Selector

```tsx
'use client';

import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';
import Polygon from '@thirdweb-dev/chain-icons/dist/polygon';
import BinanceCoin from '@thirdweb-dev/chain-icons/dist/binance-coin';

const chains = [
  { id: 1, name: 'Ethereum', icon: Ethereum },
  { id: 137, name: 'Polygon', icon: Polygon },
  { id: 56, name: 'BSC', icon: BinanceCoin },
];

export function ChainSelector({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {chains.map(({ id, name, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#161616] hover:bg-[#202020] transition-colors"
        >
          <Icon className="w-12 h-12" />
          <span className="text-sm font-rubik-medium">{name}</span>
        </button>
      ))}
    </div>
  );
}
```

### 3. Transaction List Item with Token Icon

```tsx
'use client';

import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';
import Tether from '@thirdweb-dev/chain-icons/dist/tether';

export function TransactionItem({ tx }: Props) {
  const Icon = tx.tokenSymbol === 'ETH' ? Ethereum : Tether;
  
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[#161616]">
      <div className="flex items-center gap-3">
        <Icon className="w-8 h-8" />
        <div>
          <p className="font-rubik-medium">{tx.type}</p>
          <p className="text-sm text-gray-400">{tx.date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-rubik-bold">{tx.amount} {tx.tokenSymbol}</p>
        <p className="text-sm text-gray-400">${tx.usdValue}</p>
      </div>
    </div>
  );
}
```

## 🔧 TypeScript Support

The package includes TypeScript definitions. All icons accept `SVGProps<SVGSVGElement>`:

```tsx
import { SVGProps } from 'react';
import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';

interface Props {
  iconProps?: SVGProps<SVGSVGElement>;
}

export function MyComponent({ iconProps }: Props) {
  return <Ethereum {...iconProps} />;
}
```

## ⚡ Performance Tips

1. **Tree Shaking**: Import only the icons you need
2. **Dynamic Imports**: For large icon sets, consider lazy loading:

```tsx
const EthereumIcon = dynamic(() => import('@thirdweb-dev/chain-icons/dist/ethereum'), {
  loading: () => <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse" />,
});
```

## 🎯 Integration with Your Existing Components

### Update WalletInfo Component

You can add chain icons to your existing `wallet-info.tsx`:

```tsx
import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';

// In your component:
<div className="flex items-center gap-2">
  <Ethereum className="w-6 h-6" />
  <span className="font-rubik-medium">Ethereum</span>
</div>
```

### Update Dashboard

Add network selector to your dashboard:

```tsx
import Polygon from '@thirdweb-dev/chain-icons/dist/polygon';
import Ethereum from '@thirdweb-dev/chain-icons/dist/ethereum';

// Network switcher in header
<div className="flex gap-2">
  <button className="p-2 rounded-lg bg-[#161616]">
    <Ethereum className="w-5 h-5" />
  </button>
  <button className="p-2 rounded-lg bg-[#161616]">
    <Polygon className="w-5 h-5" />
  </button>
</div>
```

## 📝 Next Steps

1. ✅ Package is installed
2. ✅ Example component created (`components/crypto-icons-example.tsx`)
3. 🔄 Integrate icons into your existing components:
   - Wallet card header
   - Chain selector dropdown
   - Transaction list items
   - Quick action buttons
4. 🎨 Style them to match your design system (use Tailwind classes)
5. 🧪 Test on different screen sizes (icons are responsive with Tailwind)

## 🆘 Troubleshooting

### Icon not rendering?
- Check the import path matches the exact filename in `/dist/`
- Icon names use kebab-case (e.g., `binance-coin`, not `BinanceCoin`)

### TypeScript errors?
- The icons are default exports, not named exports
- Use: `import Ethereum from '...'` not `import { Ethereum } from '...'`

### Need a specific icon?
- Browse the full list: `node_modules/@thirdweb-dev/chain-icons/svg/`
- Or check the GitHub repo: https://github.com/thirdweb-dev/chain-icons

## 🔗 Resources

- [Package on NPM](https://www.npmjs.com/package/@thirdweb-dev/chain-icons)
- [GitHub Repository](https://github.com/thirdweb-dev/chain-icons)
- [Example Component](./apps/web/components/crypto-icons-example.tsx)
