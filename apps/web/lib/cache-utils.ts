/**
 * Cache utilities for localStorage with TTL support
 * Handles safe JSON parsing and timestamp validation
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached data with TTL validation
 * @param key Cache key
 * @returns Cached data or null if expired/missing/invalid
 */
export function getCache<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') {
      return null; // SSR safety
    }

    const cached = localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const parsed: CacheEntry<T> = JSON.parse(cached);
    
    // Validate structure
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('timestamp' in parsed)) {
      localStorage.removeItem(key);
      return null;
    }

    // Check if expired (TTL is checked by caller, but we validate timestamp exists)
    if (typeof parsed.timestamp !== 'number' || isNaN(parsed.timestamp)) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    // Invalid JSON or other error - remove corrupted cache
    console.warn(`Cache read error for key "${key}":`, error);
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore removal errors
    }
    return null;
  }
}

/**
 * Set cached data with timestamp
 * @param key Cache key
 * @param data Data to cache
 * @param ttl TTL in milliseconds (not stored, checked by caller)
 */
export function setCache<T>(key: string, data: T, ttl: number): void {
  try {
    if (typeof window === 'undefined') {
      return; // SSR safety
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    // Quota exceeded or other storage error - fail gracefully
    console.warn(`Cache write error for key "${key}":`, error);
  }
}

/**
 * Check if cached data is still fresh (within TTL)
 * @param key Cache key
 * @param ttl TTL in milliseconds
 * @returns true if cache exists and is fresh, false otherwise
 */
export function isCacheFresh(key: string, ttl: number): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const cached = localStorage.getItem(key);
    if (!cached) {
      return false;
    }

    const parsed: CacheEntry<unknown> = JSON.parse(cached);
    
    if (!parsed || typeof parsed.timestamp !== 'number') {
      return false;
    }

    const age = Date.now() - parsed.timestamp;
    return age < ttl;
  } catch {
    return false;
  }
}

/**
 * Generate cache key based on fingerprint and data type
 * @param fingerprint User fingerprint
 * @param dataType Type of data (e.g., 'balances', 'transactions')
 * @returns Cache key string
 */
export function getCacheKey(fingerprint: string, dataType: string): string {
  return `wallet_data_${dataType}_${fingerprint}`;
}

/**
 * Clear cache for a specific fingerprint and data type
 * @param fingerprint User fingerprint
 * @param dataType Type of data (e.g., 'balances', 'transactions')
 */
export function clearCache(fingerprint: string, dataType: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(getCacheKey(fingerprint, dataType));
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all wallet data cache for a fingerprint
 * @param fingerprint User fingerprint
 */
export function clearAllCache(fingerprint: string): void {
  clearCache(fingerprint, 'balances');
  clearCache(fingerprint, 'transactions');
}

