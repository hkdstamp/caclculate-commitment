import { ReservationDiscount } from './types';

interface CacheEntry {
  data: ReservationDiscount[];
  timestamp: number;
}

/**
 * メモリ内価格キャッシュ
 */
class PricingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDuration: number;

  constructor() {
    // 環境変数からキャッシュ期間を取得（デフォルト: 24時間）
    this.cacheDuration = parseInt(
      process.env.CC_PRICE_CACHE_DURATION || '86400',
      10
    ) * 1000;
  }

  /**
   * キャッシュから価格を取得
   */
  get(key: string): ReservationDiscount[] | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // キャッシュの有効期限をチェック
    const now = Date.now();
    if (now - entry.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 価格をキャッシュに保存
   */
  set(key: string, data: ReservationDiscount[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * キャッシュサイズを取得
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 期限切れのキャッシュを削除
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        this.cache.delete(key);
      }
    }
  }
}

// シングルトンインスタンス
export const pricingCache = new PricingCache();

// 定期的に期限切れキャッシュをクリーンアップ（1時間ごと）
if (typeof window === 'undefined') {
  // サーバーサイドのみ
  setInterval(() => {
    pricingCache.cleanExpired();
  }, 3600000); // 1時間
}
