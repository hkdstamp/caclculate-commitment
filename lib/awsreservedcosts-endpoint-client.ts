import fs from 'fs';
import path from 'path';
import { ReservationDiscount } from './types';
import {
  listReservedCosts,
  ReservedCost as ReservedCostResponse,
} from './awsreservedcosts';
import {
  SavingsplansClient,
  DescribeSavingsPlansOfferingRatesCommand,
  SavingsPlanType,
  SavingsPlanProductType,
  SavingsPlanRateServiceCode,
} from '@aws-sdk/client-savingsplans';

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
const spApiCache = loadCacheFromFile<ReservationDiscount>(SP_CACHE_FILE);

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

let savingsPlansClient: SavingsplansClient | null = null;

function getSavingsPlansClient(): SavingsplansClient | null {
  if (savingsPlansClient) return savingsPlansClient;
  const accessKeyId = process.env.CC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CC_AWS_SECRET_ACCESS_KEY;
  const region = process.env.CC_AWS_REGION || 'us-east-1';
  if (!accessKeyId || !secretAccessKey) return null;
  savingsPlansClient = new SavingsplansClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return savingsPlansClient;
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
    // EC2のSPはCompute Savings Plansテーブルを優先して参照する。
    return reservationType === 'SP' ? 'compute' : 'ec2';
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

function setCachedSp(key: string, data: ReservationDiscount[]): void {
  spApiCache.set(key, { data, timestamp: Date.now() });
  schedulePersistSp();
}

async function fetchReservedCostsFromApi(
  service: string,
  region: string,
  instanceType: string | undefined,
  tenancy?: 'Shared' | 'Dedicated' | 'Host',
  operatingSystem?: string,
  deploymentOption?: string,
  usageType?: string,
  operation?: string
): Promise<ReservedCostResponse[]> {
  const locationName = getRegionDescription(region);
  const cacheKey = `ri:${service}:${locationName}:${instanceType || ''}:${tenancy || ''}:${operatingSystem || ''}:${deploymentOption || ''}:${usageType || ''}:${operation || ''}`;
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
    usageType,
    operation,
  });
  setCachedRi(cacheKey, rows);
  return rows;
}

async function fetchSavingsPlansFromAwsApi(
  usageType: string,
  operation: string,
  region: string
): Promise<ReservationDiscount[]> {
  const cacheKey = `sp:${usageType}:${operation}`;
  const cached = getCached(spApiCache, cacheKey);
  if (cached) {
    console.log(`[pricing-cache] SP cache hit: ${cacheKey}`);
    return cached;
  }

  const client = getSavingsPlansClient();
  if (!client) {
    console.warn('[SP] AWS credentials not configured, skipping DescribeSavingsPlansOfferingRates');
    return [];
  }

  const results: ReservationDiscount[] = [];
  let nextToken: string | undefined;

  do {
    const cmd = new DescribeSavingsPlansOfferingRatesCommand({
      savingsPlanTypes: [SavingsPlanType.COMPUTE],
      products: [SavingsPlanProductType.EC2],
      serviceCodes: [SavingsPlanRateServiceCode.EC2],
      usageTypes: [usageType],
      operations: [operation],
      nextToken,
      maxResults: 100,
    });
    const res = await client.send(cmd);
    for (const r of res.searchResults ?? []) {
      const durationSeconds = r.savingsPlanOffering?.durationSeconds ?? 0;
      const contractYears = durationSeconds >= 90000000 ? 3 : 1;
      const paymentOption = r.savingsPlanOffering?.paymentOption ?? '';
      const paymentMethod =
        paymentOption === 'No Upfront' ? 'NoUpfront' as const :
        paymentOption === 'Partial Upfront' ? 'PartialUpfront' as const :
        'AllUpfront' as const;
      const props: Record<string, string> = {};
      for (const p of r.properties ?? []) {
        props[p.name ?? ''] = p.value ?? '';
      }
      results.push({
        service: 'Amazon Elastic Compute Cloud',
        contract_years: contractYears,
        payment_method: paymentMethod,
        region,
        instance_type: '',
        unit_price: parseFloat(r.rate ?? '0'),
        unit_price_unit: 'per hour',
        reservation_type: 'SP',
        tenancy: props['tenancy'] as 'Shared' | 'Dedicated' | 'Host' | undefined,
        operating_system: props['productDescription'] || undefined,
        upfront_fee: 0,
        usage_type: r.usageType || undefined,
        operation: r.operation || undefined,
      });
    }
    nextToken = res.nextToken;
  } while (nextToken);

  setCachedSp(cacheKey, results);
  return results;
}

export async function fetchPricingFromReservedCostsApi(
  service: string,
  instanceType: string | undefined,
  region: string,
  reservationType: 'RI' | 'SP',
  tenancy?: 'Shared' | 'Dedicated' | 'Host',
  operatingSystem?: string,
  databaseEngine?: string,
  databaseEdition?: string,
  deploymentOption?: string,
  _licenseModel?: string,
  lineitemOperation?: string,
  lineitemUsageType?: string
): Promise<ReservationDiscount[]> {
  const apiService = normalizeServiceForApi(service, reservationType);

  if (reservationType === 'RI') {
    if (!instanceType) {
      return [];
    }

    const tenancyFilter = apiService === 'ec2' ? tenancy : undefined;

    // RDSの場合: databaseEngine + databaseEdition から os_db フィルタ値を構築
    // (例: 'Oracle' + 'Standard Two' → 'Oracle Standard Two')
    const osDbFilter = apiService === 'rds' && databaseEngine
      ? [databaseEngine, databaseEdition].filter(Boolean).join(' ')
      : operatingSystem;

    // RDSの場合: lineitem_usagetype で usage_id フィルタ（License included vs BYOL の区別）
    // lineitem_operation で operation フィルタ（さらに絞り込み）
    const usageTypeFilter = apiService === 'rds' ? lineitemUsageType : undefined;
    const operationFilter = apiService === 'rds' ? lineitemOperation : undefined;

    const rows = await fetchReservedCostsFromApi(
      apiService,
      region,
      instanceType,
      tenancyFilter,
      osDbFilter,
      deploymentOption,
      usageTypeFilter,
      operationFilter
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

  if (!lineitemUsageType) {
    console.warn('[SP] lineitemUsageType is empty, cannot query DescribeSavingsPlansOfferingRates');
    return [];
  }

  return await fetchSavingsPlansFromAwsApi(
    lineitemUsageType,
    lineitemOperation ?? '',
    region
  );
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
