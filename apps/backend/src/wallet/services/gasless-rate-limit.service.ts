import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PimlicoConfigService } from '../config/pimlico.config.js';

@Injectable()
export class GaslessRateLimitService {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(private readonly pimlicoConfig: PimlicoConfigService) {}

  check(userId: string, chain: string, flow: 'eip7702' | 'erc4337'): void {
    const { windowMs, maxRequests } = this.pimlicoConfig.getGaslessRateLimit();
    const key = `${userId}:${chain}:${flow}`;
    const now = Date.now();

    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (bucket.count + 1 > maxRequests) {
      const retryIn = Math.max(0, bucket.resetAt - now);
      throw new HttpException(
        `Gasless rate limit exceeded for ${chain}. Try again in ${Math.ceil(
          retryIn / 1000,
        )}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
  }
}
