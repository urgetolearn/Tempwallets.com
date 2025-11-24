/**
 * Balance formatting and manipulation utilities
 */

/**
 * Format a balance from smallest units to human-readable format
 * @param balance - Balance in smallest units (wei, satoshi, lamports, etc.)
 * @param decimals - Token decimals
 * @param maxDecimals - Maximum decimal places to show (default: 6)
 * @returns Formatted balance string
 */
export function formatBalance(
  balance: string | bigint,
  decimals: number,
  maxDecimals: number = 6,
): string {
  try {
    const balanceBigInt = typeof balance === 'string' ? BigInt(balance) : balance;
    
    // Handle zero balance
    if (balanceBigInt === 0n) {
      return '0';
    }
    
    // Convert to decimal string
    const divisor = BigInt(10 ** decimals);
    const integerPart = balanceBigInt / divisor;
    const remainderPart = balanceBigInt % divisor;
    
    // If no remainder, return just the integer part
    if (remainderPart === 0n) {
      return integerPart.toString();
    }
    
    // Format the remainder with leading zeros
    const remainderStr = remainderPart.toString().padStart(decimals, '0');
    
    // Trim trailing zeros and apply maxDecimals
    let trimmedRemainder = remainderStr.replace(/0+$/, '');
    if (trimmedRemainder.length > maxDecimals) {
      trimmedRemainder = trimmedRemainder.slice(0, maxDecimals);
    }
    
    // Return formatted balance
    if (trimmedRemainder.length === 0) {
      return integerPart.toString();
    }
    
    return `${integerPart}.${trimmedRemainder}`;
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0';
  }
}

/**
 * Format USD value with proper currency formatting
 * @param value - USD value as number
 * @param includeSymbol - Whether to include $ symbol (default: true)
 * @param minDecimals - Minimum decimal places (default: 2)
 * @param maxDecimals - Maximum decimal places (default: 2)
 * @returns Formatted USD string
 */
export function formatUSD(
  value: number | undefined | null,
  includeSymbol: boolean = true,
  minDecimals: number = 2,
  maxDecimals: number = 2,
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return includeSymbol ? '$0.00' : '0.00';
  }
  
  try {
    // Handle very small values
    if (value > 0 && value < 0.01) {
      return includeSymbol ? '< $0.01' : '< 0.01';
    }
    
    // Handle very large values (use K, M, B notation)
    if (value >= 1_000_000_000) {
      const billions = value / 1_000_000_000;
      return includeSymbol 
        ? `$${billions.toFixed(2)}B` 
        : `${billions.toFixed(2)}B`;
    }
    
    if (value >= 1_000_000) {
      const millions = value / 1_000_000;
      return includeSymbol 
        ? `$${millions.toFixed(2)}M` 
        : `${millions.toFixed(2)}M`;
    }
    
    if (value >= 10_000) {
      const thousands = value / 1_000;
      return includeSymbol 
        ? `$${thousands.toFixed(2)}K` 
        : `${thousands.toFixed(2)}K`;
    }
    
    // Format with proper decimals
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
    
    return includeSymbol ? `$${formatted}` : formatted;
  } catch (error) {
    console.error('Error formatting USD:', error);
    return includeSymbol ? '$0.00' : '0.00';
  }
}

/**
 * Format token amount with symbol
 * @param balance - Balance in smallest units
 * @param decimals - Token decimals
 * @param symbol - Token symbol
 * @param maxDecimals - Maximum decimal places (default: 6)
 * @returns Formatted token amount with symbol
 */
export function formatTokenAmount(
  balance: string | bigint,
  decimals: number,
  symbol: string,
  maxDecimals: number = 6,
): string {
  const formattedBalance = formatBalance(balance, decimals, maxDecimals);
  return `${formattedBalance} ${symbol}`;
}

/**
 * Parse a human-readable balance to smallest units (BigInt)
 * @param humanBalance - Human-readable balance (e.g., "1.5")
 * @param decimals - Token decimals
 * @returns Balance in smallest units as BigInt
 */
export function parseBigNumber(humanBalance: string, decimals: number): bigint {
  try {
    // Remove any whitespace
    const cleaned = humanBalance.trim();
    
    // Handle empty or invalid input
    if (!cleaned || cleaned === '.' || cleaned === '0.') {
      return 0n;
    }
    
    // Split into integer and decimal parts
    const parts = cleaned.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] || '';
    
    // Validate parts contain only digits
    if (!/^\d+$/.test(integerPart) || (decimalPart && !/^\d+$/.test(decimalPart))) {
      throw new Error('Invalid number format');
    }
    
    // Pad or truncate decimal part to match decimals
    let paddedDecimal = decimalPart.padEnd(decimals, '0');
    if (paddedDecimal.length > decimals) {
      paddedDecimal = paddedDecimal.slice(0, decimals);
    }
    
    // Combine parts and convert to BigInt
    const combined = integerPart + paddedDecimal;
    return BigInt(combined);
  } catch (error) {
    console.error('Error parsing balance:', error);
    return 0n;
  }
}

/**
 * Check if balance is cached and still valid
 * @param lastUpdated - Last update timestamp
 * @param cacheTTL - Cache time-to-live in milliseconds (default: 60000 = 1 minute)
 * @returns True if cache is valid
 */
export function isBalanceCacheValid(
  lastUpdated: Date | undefined,
  cacheTTL: number = 60000,
): boolean {
  if (!lastUpdated) {
    return false;
  }
  
  const now = new Date();
  const timeDiff = now.getTime() - lastUpdated.getTime();
  return timeDiff < cacheTTL;
}

/**
 * Calculate total USD value from token balances
 * @param native - Native token balance
 * @param tokens - Token balances array
 * @returns Total USD value
 */
export function calculateTotalUSD(
  native: { usdValue?: number } | null,
  tokens: { usdValue?: number }[],
): number {
  let total = 0;
  
  // Add native token USD value
  if (native?.usdValue) {
    total += native.usdValue;
  }
  
  // Add all token USD values
  tokens.forEach((token) => {
    if (token.usdValue) {
      total += token.usdValue;
    }
  });
  
  return total;
}

/**
 * Format balance with smart decimals (show more decimals for small values)
 * @param balance - Balance in smallest units
 * @param decimals - Token decimals
 * @returns Formatted balance with smart decimals
 */
export function formatBalanceSmart(
  balance: string | bigint,
  decimals: number,
): string {
  const balanceBigInt = typeof balance === 'string' ? BigInt(balance) : balance;
  
  // For zero, always show 0
  if (balanceBigInt === 0n) {
    return '0';
  }
  
  // Convert to number to check magnitude
  const formatted = formatBalance(balance, decimals, 18); // Get full precision
  const numValue = parseFloat(formatted);
  
  // Very small values: show up to 8 decimals
  if (numValue < 0.001) {
    return formatBalance(balance, decimals, 8);
  }
  
  // Small values: show up to 6 decimals
  if (numValue < 1) {
    return formatBalance(balance, decimals, 6);
  }
  
  // Medium values: show up to 4 decimals
  if (numValue < 1000) {
    return formatBalance(balance, decimals, 4);
  }
  
  // Large values: show up to 2 decimals
  return formatBalance(balance, decimals, 2);
}

/**
 * Abbreviate large token amounts
 * @param balance - Balance in smallest units
 * @param decimals - Token decimals
 * @param symbol - Token symbol
 * @returns Abbreviated token amount (e.g., "1.5K ETH")
 */
export function abbreviateTokenAmount(
  balance: string | bigint,
  decimals: number,
  symbol: string,
): string {
  const formatted = formatBalance(balance, decimals, 18);
  const numValue = parseFloat(formatted);
  
  if (numValue >= 1_000_000_000) {
    return `${(numValue / 1_000_000_000).toFixed(2)}B ${symbol}`;
  }
  
  if (numValue >= 1_000_000) {
    return `${(numValue / 1_000_000).toFixed(2)}M ${symbol}`;
  }
  
  if (numValue >= 10_000) {
    return `${(numValue / 1_000).toFixed(2)}K ${symbol}`;
  }
  
  // For smaller amounts, use smart formatting
  return `${formatBalanceSmart(balance, decimals)} ${symbol}`;
}

/**
 * Compare two balances
 * @param a - First balance
 * @param b - Second balance
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareBalances(
  a: string | bigint,
  b: string | bigint,
): number {
  const aBigInt = typeof a === 'string' ? BigInt(a) : a;
  const bBigInt = typeof b === 'string' ? BigInt(b) : b;
  
  if (aBigInt < bBigInt) return -1;
  if (aBigInt > bBigInt) return 1;
  return 0;
}

/**
 * Check if balance is zero
 * @param balance - Balance to check
 * @returns True if balance is zero
 */
export function isZeroBalance(balance: string | bigint): boolean {
  const balanceBigInt = typeof balance === 'string' ? BigInt(balance) : balance;
  return balanceBigInt === 0n;
}

/**
 * Get balance percentage change color class
 * @param change - Percentage change
 * @returns Tailwind color class
 */
export function getBalanceChangeColor(change: number): string {
  if (change > 0) return 'text-green-500';
  if (change < 0) return 'text-red-500';
  return 'text-gray-500';
}
