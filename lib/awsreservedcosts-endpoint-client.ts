import fs from 'fs';
import path from 'path';
import { ReservationDiscount } from './types';
import {
  listReservedCosts,
  listSavingsPlansCosts,
  ReservedCost as ReservedCostResponse,
  SavingsPlanCost as SavingsPlanCostResponse,
} from './awsreservedcosts';

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

type SerializedCache<T> = Record<string, CacheEntry<T>>;

const cacheDuration = parseInt(process.env.CC_PRICE_CACHE_DURATION || '86400', 10) * 1000;
// Debounce delay before writing cache to disk (ms). Default: 10 seconds.
const persistDebounceMs = parseInt(process.env.CC_PRICE_PERSIST_DEBOUNCE || '10000', 10);

const CACHE_DIR = process.env.CC_PRICE_CACHE_DIR
  ? process.env.CC_PRICE_CACHE_DIR
  : path.join(process.cwd(), '.cache', 'pricing');
const RI_CACHE_FILE = path.join(CACHE_DIR, 'reserved-costs.json');
const SP_CACHE_FILE = path.join(CACHE_DIR, 'savings-plans.json');

// ── File persistence helpers ─────────────────────────────────────────────────

function ensureCacheDir(): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function loadCacheFromFile<T>(filePath: string): Map<string, CacheEntry<T>> {
  const map = new Map<string, CacheEntry<T>>();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const serialized: SerializedCache<T> = JSON.parse(raw);
    const now = Date.now();
    for (const [key, entry] of Object.entries(serialized)) {
      // Drop entries that have already expired so stale data is never used.
      if (now - entry.timestamp <= cacheDuration) {
        map.set(key, entry);
      }
    }
    console.log(`[pricing-cache] Loaded ${map.size} entries from ${path.basename(filePath)}`);
  } catch {
    // File missing or unreadable – start with empty cache.
  }
  return map;
}

function saveCacheToFile<T>(filePath: string, cache: Map<string, CacheEntry<T>>): void {
  try {
    ensureCacheDir();
    const serialized: SerializedCache<T> = {};
    for (const [key, entry] of cache) {
      serialized[key] = entry;
    }
    fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[pricing-cache] Failed to persist ${path.basename(filePath)}:`, err);
  }
}

// ── In-memory caches (pre-populated from disk on module load) ─────────────────

ensureCacheDir();
const reservedApiCache = loadCacheFromFile<ReservedCostResponse>(RI_CACHE_FILE);
const spApiCache = loadCacheFromFile<SavingsPlanCostResponse>(SP_CACHE_FILE);

// Debounce timers for flushing each cache to disk.
let riPersistTimer: ReturnType<typeof setTimeout> | null = null;
let spPersistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistRi(): void {
  if (riPersistTimer) clearTimeout(riPersistTimer);
  riPersistTimer = setTimeout(() => {
    saveCacheToFile(RI_CACHE_FILE, reservedApiCache);
    riPersistTimer = null;
  }, persistDebounceMs);
}

function schedulePersistSp(): void {
  if (spPersistTimer) clearTimeout(spPersistTimer);
  spPersistTimer = setTimeout(() => {
    saveCacheToFile(SP_CACHE_FILE, spApiCache);
    spPersistTimer = null;
  }, persistDebounceMs);
}

function getRegionDescription(regionCode: string): string {
  const regionMap: Record<string, string> = {
    'ap-northeast-1': 'Asia Pacific (Tokyo)',
    'ap-northeast-3': 'Asia Pacific (Osaka)',
    'us-east-1': 'US East (N. Virginia)',
    'us-west-2': 'US West (Oregon)',
    'eu-west-1': 'EU (Ireland)',
  };
  return regionMap[regionCode] || regionCode;
}

function normalizeServiceForApi(service: string, reservationType: 'RI' | 'SP'): string {
  const lower = service.toLowerCase();
  if (lower.includes('ec2') || lower.includes('elastic compute cloud')) {
    return 'ec2';
  }
  if (lower.includes('rds') || lower.includes('relational database')) {
    return reservationType === 'SP' ? 'rds' : 'rds';
  }
  if (lower.includes('elasticache')) {
    return 'elasticache';
  }
  if (lower.includes('redshift')) {
    return 'redshift';
  }
  if (lower.includes('opensearch') || lower.includes('elasticsearch') || lower.includes('es')) {
    return 'es';
  }
  return service;
}

function mapPurchaseOption(option: string): 'NoUpfront' | 'PartialUpfront' | 'AllUpfront' {
  if (option === 'No Upfront') return 'NoUpfront';
  if (option === 'Partial Upfront') return 'PartialUpfront';
  return 'AllUpfront';
}

function parseContractYears(value: string): number {
  if (value.includes('3')) return 3;
  return 1;
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T[] | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.timestamp > cacheDuration) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedRi(key: string, data: ReservedCostResponse[]): void {
  reservedApiCache.set(key, { data, timestamp: Date.now() });
  schedulePersistRi();
}

function setCachedSp(key: string, data: SavingsPlanCostResponse[]): void {
  spApiCache.set(key, { data, timestamp: Date.now() });
  schedulePersistSp();
}

async function fetchReservedCostsFromApi(
  service: string,
  region: string,
  instanceType: string | undefined,
  tenancy?: 'Shared' | 'Dedicated' | 'Host',
  operatingSystem?: string,
  deploymentOption?: string
): Promise<ReservedCostResponse[]> {
  const locationName = getRegionDescription(region);
  const cacheKey = `ri:${service}:${locationName}:${instanceType || ''}:${tenancy || ''}:${operatingSystem || ''}:${deploymentOption || ''}`;
  const cached = getCached(reservedApiCache, cacheKey);
  if (cached) {
    return cached;
  }

  const rows = await listReservedCosts({
    service,
    locationName,
    instanceType,
    tenancy,
    operatingSystem,
    deploymentOption,
  });
  setCachedRi(cacheKey, rows);
  return rows;
}

async function fetchSavingsPlansFromApi(service: string, region: string): Promise<SavingsPlanCostResponse[]> {
  const locationName = getRegionDescription(region);
  const cacheKey = `sp:${service}:${locationName}`;
  const cached = getCached(spApiCache, cacheKey);
  if (cached) {
    return cached;
  }

  const rows = await listSavingsPlansCosts({
    service,
    locationName,
  });
  setCachedSp(cacheKey, rows);
  return rows;
}

export async function fetchPricingFromReservedCostsApi(
  service: string,
  instanceType: string | undefined,
  region: string,
  reservationType: 'RI' | 'SP',
  tenancy?: 'Shared' | 'Dedicated' | 'Host',
  operatingSystem?: string,
  _databaseEngine?: string,
  _databaseEdition?: string,
  deploymentOption?: string,
  _licenseModel?: string
): Promise<ReservationDiscount[]> {
  const apiService = normalizeServiceForApi(service, reservationType);

  if (reservationType === 'RI') {
    if (!instanceType) {
      return [];
    }

    const tenancyFilter = apiService === 'ec2' ? tenancy : undefined;

    const rows = await fetchReservedCostsFromApi(
      apiService,
      region,
      instanceType,
      tenancyFilter,
      operatingSystem,
      deploymentOption
    );

    return rows.map((row) => ({
      service,
      contract_years: parseContractYears(row.lease_contract_length),
      payment_method: mapPurchaseOption(row.purchase_option),
      region,
      instance_type: row.instance_type,
      unit_price: Number(row.hourly_cost) || 0,
      unit_price_unit: 'per hour',
      reservation_type: 'RI',
      tenancy: row.tenancy as 'Shared' | 'Dedicated' | 'Host' | undefined,
      operating_system: row.operating_system || undefined,
      deployment_option: row.deployment_option || undefined,
      upfront_fee: Number(row.upfront_cost) || 0,
    }));
  }

  const rows = await fetchSavingsPlansFromApi(apiService, region);
  return rows.map((row) => ({
    service,
    contract_years: parseContractYears(row.lease_contract_length),
    payment_method: mapPurchaseOption(row.purchase_option),
    region,
    instance_type: '',
    unit_price: Number(row.discounted_rate) || 0,
    unit_price_unit: 'per hour',
    reservation_type: 'SP',
    tenancy: row.tenancy as 'Shared' | 'Dedicated' | 'Host' | undefined,
    operating_system: row.operating_system || undefined,
    upfront_fee: 0,
  }));
}

export function generateCacheKey(
  service: string,
  instanceType: string | undefined,
  region: string,
  reservationType: 'RI' | 'SP',
  tenancy?: 'Shared' | 'Dedicated' | 'Host'
): string {
  const tenancyStr = tenancy ? `:${tenancy}` : '';
  return `${service}:${instanceType || 'SP'}:${region}:${reservationType}${tenancyStr}`;
}

/**
 * メモリキャッシュとファイルキャッシュを両方クリアします。
 * デバウンスタイマーが残っていればキャンセルし、空のファイルを即時書き込みます。
 */
export function clearPricingCache(): { riCount: number; spCount: number } {
  const riCount = reservedApiCache.size;
  const spCount = spApiCache.size;

  reservedApiCache.clear();
  spApiCache.clear();

  if (riPersistTimer) {
    clearTimeout(riPersistTimer);
    riPersistTimer = null;
  }
  if (spPersistTimer) {
    clearTimeout(spPersistTimer);
    spPersistTimer = null;
  }

  saveCacheToFile(RI_CACHE_FILE, reservedApiCache);
  saveCacheToFile(SP_CACHE_FILE, spApiCache);

  console.log(`[pricing-cache] Cache cleared (ri=${riCount}, sp=${spCount})`);
  return { riCount, spCount };
}
