/**
 * Metrics Service for Frontend Observability
 * 
 * Separates metrics from logs for better observability.
 * Use this for:
 * - Counting events (requests, errors, successes)
 * - Measuring performance (duration, latency)
 * - Tracking values (balance, queue size)
 * 
 * DO NOT use logs for these purposes - use metrics instead!
 */

interface MetricData {
  [key: string]: string | number | boolean;
}

interface TimerData {
  startTime: number;
  metricName: string;
}

class MetricsService {
  private endpoint: string | null;
  private enabled: boolean;
  private buffer: Array<any> = [];
  private flushInterval: number = 10000; // 10 seconds
  private maxBufferSize: number = 100;

  constructor() {
    this.endpoint = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_METRICS_ENDPOINT || null
      : null;
    
    this.enabled = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_ENABLE_METRICS !== 'false'
      : false;

    if (this.enabled && typeof window !== 'undefined') {
      this.startFlushTimer();
    }
  }

  private startFlushTimer(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private addToBuffer(type: string, name: string, value: number, tags: MetricData): void {
    if (!this.enabled) return;

    this.buffer.push({
      type,
      name,
      value,
      tags,
      timestamp: Date.now()
    });

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.endpoint) return;

    const metricsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics: metricsToSend }),
      });
    } catch (error) {
      // Silently fail - don't pollute logs with metrics errors
      // In production, you'd want to handle this more gracefully
      console.debug('Failed to send metrics:', error);
    }
  }

  /**
   * Increment a counter by 1 (or specified value)
   * Use for: counting events, requests, errors
   * 
   * @example
   * ```ts
   * metrics.increment('api.request.count', { endpoint: '/balance', status: 200 });
   * metrics.increment('wallet.connected', { chain: 'ethereum' });
   * metrics.increment('error.count', { type: 'network' });
   * ```
   */
  increment(name: string, tags: MetricData = {}, value: number = 1): void {
    this.addToBuffer('counter', name, value, tags);
    
    // Also log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[METRIC] Counter: ${name} +${value}`, tags);
    }
  }

  /**
   * Set a gauge value (current state)
   * Use for: tracking current values like balance, queue size, active connections
   * 
   * @example
   * ```ts
   * metrics.gauge('wallet.balance.usd', 1234.56, { walletAddress: '0x...' });
   * metrics.gauge('websocket.connections', 5);
   * metrics.gauge('cache.size', 1024, { cacheType: 'balance' });
   * ```
   */
  gauge(name: string, value: number, tags: MetricData = {}): void {
    this.addToBuffer('gauge', name, value, tags);
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[METRIC] Gauge: ${name} = ${value}`, tags);
    }
  }

  /**
   * Record a histogram value (for distributions)
   * Use for: measuring durations, request sizes, response times
   * 
   * @example
   * ```ts
   * metrics.histogram('api.request.duration', 123.45, { endpoint: '/balance' });
   * metrics.histogram('websocket.message.size', 1024, { type: 'balance_update' });
   * ```
   */
  histogram(name: string, value: number, tags: MetricData = {}): void {
    this.addToBuffer('histogram', name, value, tags);
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[METRIC] Histogram: ${name} = ${value}`, tags);
    }
  }

  /**
   * Start a timer for measuring operation duration
   * Returns a function to call when the operation completes
   * 
   * @example
   * ```ts
   * const endTimer = metrics.startTimer('api.fetch_balance');
   * try {
   *   await fetchBalance();
   *   endTimer({ success: true });
   * } catch (error) {
   *   endTimer({ success: false, error: error.message });
   * }
   * ```
   */
  startTimer(metricName: string): (tags?: MetricData) => void {
    const startTime = performance.now();
    
    return (tags: MetricData = {}) => {
      const duration = performance.now() - startTime;
      this.histogram(`${metricName}.duration`, duration, tags);
    };
  }

  /**
   * Record timing of an async operation
   * 
   * @example
   * ```ts
   * await metrics.time('api.fetch_balance', async () => {
   *   return await fetchBalance();
   * }, { walletAddress: '0x...' });
   * ```
   */
  async time<T>(
    metricName: string,
    operation: () => Promise<T>,
    tags: MetricData = {}
  ): Promise<T> {
    const endTimer = this.startTimer(metricName);
    try {
      const result = await operation();
      endTimer({ ...tags, success: true });
      return result;
    } catch (error) {
      endTimer({ ...tags, success: false });
      throw error;
    }
  }

  /**
   * Manually flush buffered metrics
   * Useful before page unload or navigation
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }
}

// Singleton instance
export const metrics = new MetricsService();

// Flush metrics before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    metrics.forceFlush();
  });
}

// React hook for using metrics in components
export function useMetrics() {
  return metrics;
}
