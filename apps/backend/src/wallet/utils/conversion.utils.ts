/**
 * Conversion utilities for token amounts
 */

/**
 * Convert human-readable amount to smallest units (BigInt)
 * @param humanAmount - Human-readable amount string (e.g., "1.5")
 * @param decimals - Number of decimal places
 * @returns BigInt representing the amount in smallest units
 */
export function convertToSmallestUnits(
  humanAmount: string,
  decimals: number,
): bigint {
  const [wholeRaw = '0', fracRaw = ''] = humanAmount.trim().split('.');
  const whole = wholeRaw.replace(/^0+/, '') || '0';
  const fracPadded = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  const combined = (whole + fracPadded).replace(/^0+/, '') || '0';
  return BigInt(combined);
}

/**
 * Convert smallest units to human-readable amount
 * @param smallestUnits - Amount in smallest units (string or bigint)
 * @param decimals - Number of decimal places
 * @returns Human-readable amount string
 */
export function convertSmallestToHuman(
  smallestUnits: string | bigint,
  decimals: number,
): string {
  const smallestBigInt =
    typeof smallestUnits === 'string' ? BigInt(smallestUnits) : smallestUnits;
  const divisor = BigInt(10 ** decimals);
  const whole = smallestBigInt / divisor;
  const remainder = smallestBigInt % divisor;

  if (remainder === 0n) {
    return whole.toString();
  }

  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedRemainder = remainderStr.replace(/0+$/, '');
  return `${whole}.${trimmedRemainder}`;
}

/**
 * Format balance for display
 * @param balance - Balance in smallest units
 * @param decimals - Token decimals
 * @param maxDecimals - Maximum decimal places to display (default: 4)
 * @returns Formatted balance string
 */
export function formatBalance(
  balance: string | bigint,
  decimals: number,
  maxDecimals: number = 4,
): string {
  const human = convertSmallestToHuman(balance, decimals);
  const [whole = '0', frac] = human.split('.');

  if (!frac) {
    return whole;
  }

  const truncatedFrac = frac.slice(0, maxDecimals).replace(/0+$/, '');
  return truncatedFrac ? `${whole}.${truncatedFrac}` : whole;
}

/**
 * Parse amount with proper decimal handling
 * @param amount - Amount string (could be in various formats)
 * @returns Normalized amount string
 */
export function normalizeAmount(amount: string): string {
  // Remove any non-numeric characters except decimal point
  const cleaned = amount.replace(/[^0-9.]/g, '');

  // Handle multiple decimal points - keep only the first one
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`;
  }

  return cleaned;
}
