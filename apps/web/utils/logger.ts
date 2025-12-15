/**
 * Centralized Logging Utility
 * 
 * Features:
 * - Environment-based log levels (debug, info, warn, error)
 * - Structured logging with context objects
 * - Log sampling for high-frequency events
 * - Trace ID propagation for distributed tracing
 * - Namespace filtering for component-level control
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface LoggerConfig {
  level: LogLevel;
  namespace: string;
  enableColors: boolean;
  sampleRate: number; // 0.0 to 1.0
  traceId?: string;
}

interface LogContext {
  [key: string]: any;
  traceId?: string;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private config: LoggerConfig;
  private colors = {
    debug: '#9CA3AF', // gray
    info: '#3B82F6',  // blue
    warn: '#F59E0B',  // orange
    error: '#EF4444', // red
    namespace: '#8B5CF6' // purple
  };

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private formatMessage(level: string, message: string, context?: LogContext): any[] {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.config.namespace}] [${level.toUpperCase()}]`;
    
    if (!this.config.enableColors) {
      return context 
        ? [prefix, message, context]
        : [prefix, message];
    }

    // Colorized output for browser console
    const levelColor = this.colors[level as keyof typeof this.colors] || this.colors.info;
    const namespaceColor = this.colors.namespace;

    return context
      ? [
          `%c[${this.config.namespace}]%c [${level.toUpperCase()}] ${message}`,
          `color: ${namespaceColor}; font-weight: bold`,
          `color: ${levelColor}`,
          context
        ]
      : [
          `%c[${this.config.namespace}]%c [${level.toUpperCase()}] ${message}`,
          `color: ${namespaceColor}; font-weight: bold`,
          `color: ${levelColor}`
        ];
  }

  private addTraceId(context?: LogContext): LogContext {
    const baseContext = context || {};
    if (this.config.traceId) {
      baseContext.traceId = this.config.traceId;
    }
    baseContext.timestamp = new Date().toISOString();
    return baseContext;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const enrichedContext = this.addTraceId(context);
    console.debug(...this.formatMessage('debug', message, enrichedContext));
  }

  debugSampled(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG) || !this.shouldSample()) return;
    const enrichedContext = this.addTraceId(context);
    console.debug(...this.formatMessage('debug', `[SAMPLED] ${message}`, enrichedContext));
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const enrichedContext = this.addTraceId(context);
    console.info(...this.formatMessage('info', message, enrichedContext));
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const enrichedContext = this.addTraceId(context);
    console.warn(...this.formatMessage('warn', message, enrichedContext));
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const enrichedContext = this.addTraceId(context);
    
    if (error) {
      enrichedContext.error = {
        message: error.message,
        stack: error.stack,
        ...error
      };
    }
    
    console.error(...this.formatMessage('error', message, enrichedContext));
  }

  group(label: string): void {
    if (typeof console.group === 'function') {
      console.group(`[${this.config.namespace}] ${label}`);
    }
  }

  groupEnd(): void {
    if (typeof console.groupEnd === 'function') {
      console.groupEnd();
    }
  }

  setTraceId(traceId: string): void {
    this.config.traceId = traceId;
  }
}

// Parse log level from environment
function getLogLevel(): LogLevel {
  if (typeof window === 'undefined') return LogLevel.INFO; // SSR default
  
  const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL?.toLowerCase();
  
  switch (envLevel) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    case 'none': return LogLevel.NONE;
    default:
      // Default to DEBUG in development, INFO in production
      return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
  }
}

function getSampleRate(): number {
  if (typeof window === 'undefined') return 1.0;
  
  const rate = parseFloat(process.env.NEXT_PUBLIC_LOG_SAMPLE_RATE || '1.0');
  return Math.max(0, Math.min(1, rate)); // Clamp between 0 and 1
}

function isNamespaceEnabled(namespace: string): boolean {
  if (typeof window === 'undefined') return true;
  
  const enabledNamespaces = process.env.NEXT_PUBLIC_LOG_NAMESPACES;
  if (!enabledNamespaces || enabledNamespaces === '*') return true;
  
  const namespaces = enabledNamespaces.split(',').map(ns => ns.trim());
  return namespaces.includes(namespace) || namespaces.includes('*');
}

/**
 * Factory function for creating namespaced loggers
 * 
 * @param namespace - Component or module name (e.g., 'wallet', 'auth', 'balances')
 * @param sampleRate - Optional sample rate override (0.0 to 1.0)
 * @returns Logger instance
 * 
 * @example
 * ```ts
 * const logger = createLogger('wallet-connect');
 * logger.info('Session established', { sessionId: '123' });
 * 
 * // High-frequency with sampling
 * const logger = createLogger('balances', 0.1); // 10% sampling
 * logger.debugSampled('Balance update', { value: 100 });
 * ```
 */
export const createLogger = (namespace: string, sampleRate?: number): Logger => {
  const config: LoggerConfig = {
    level: isNamespaceEnabled(namespace) ? getLogLevel() : LogLevel.NONE,
    namespace,
    enableColors: typeof window !== 'undefined',
    sampleRate: sampleRate ?? getSampleRate(),
  };

  return new Logger(config);
};

/**
 * Get or create a trace ID for request correlation
 * In browser: Checks sessionStorage, creates if missing
 * In SSR: Generates new trace ID
 * 
 * @returns Trace ID string
 */
export const getTraceId = (): string => {
  if (typeof window === 'undefined') {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  try {
    let traceId = sessionStorage.getItem('traceId');
    if (!traceId) {
      traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('traceId', traceId);
    }
    return traceId;
  } catch (e) {
    // Fallback if sessionStorage is not available
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

/**
 * Create a performance timer for measuring operation duration
 * 
 * @param logger - Logger instance to use
 * @param operation - Name of the operation being measured
 * @returns Function to call when operation completes
 * 
 * @example
 * ```ts
 * const logger = createLogger('api');
 * const endTimer = startTimer(logger, 'fetchBalance');
 * // ... do work
 * endTimer({ success: true, walletAddress: '0x...' });
 * ```
 */
export const startTimer = (
  logger: Logger,
  operation: string
): ((context?: LogContext) => void) => {
  const start = performance.now();
  
  return (context?: LogContext) => {
    const duration = performance.now() - start;
    logger.debug(`${operation} completed`, {
      ...context,
      durationMs: duration.toFixed(2)
    });
  };
};

// Default logger for quick usage
export const defaultLogger = createLogger('app');
