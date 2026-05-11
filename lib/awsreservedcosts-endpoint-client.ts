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

const cacheDuration = parseInt(process.env.CC_PRICE_CACHE_DURATION || '86400', 10) * 1000;
const reservedApiCache = new Map<string, CacheEntry<ReservedCostResponse>>();
const spApiCache = new Map<string, CacheEntry<SavingsPlanCostResponse>>();

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

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T[]): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
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
  setCached(reservedApiCache, cacheKey, rows);
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
  setCached(spApiCache, cacheKey, rows);
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
