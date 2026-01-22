import {
  PricingClient,
  GetProductsCommand,
  GetProductsCommandInput,
} from '@aws-sdk/client-pricing';
import { ReservationDiscount } from './types';
import { normalizeServiceName } from './reservation-catalog';

/**
 * AWS Pricing APIクライアントの初期化
 */
function getPricingClient(): PricingClient | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';
  const enableApi = process.env.ENABLE_AWS_PRICE_API === 'true';

  if (!enableApi || !accessKeyId || !secretAccessKey) {
    console.log('AWS Price List API is disabled or credentials not configured');
    return null;
  }

  return new PricingClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * サービスコードをAWS Price List APIの形式に変換
 */
function getServiceCode(service: string): string {
  const normalizedService = normalizeServiceName(service);
  
  const serviceCodeMap: Record<string, string> = {
    'Amazon Elastic Compute Cloud': 'AmazonEC2',
    'Amazon Relational Database Service': 'AmazonRDS',
    'Amazon ElastiCache': 'AmazonElastiCache',
  };

  return serviceCodeMap[normalizedService] || service;
}

/**
 * リージョンコードをAWS Price List APIの形式に変換
 */
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

/**
 * AWS Price List APIからEC2のRI価格を取得
 */
async function fetchEC2RIPricing(
  instanceType: string,
  region: string
): Promise<ReservationDiscount[]> {
  const client = getPricingClient();
  if (!client) return [];

  const regionDescription = getRegionDescription(region);
  const discounts: ReservationDiscount[] = [];

  try {
    // 1年契約の価格を取得
    for (const paymentOption of ['No Upfront', 'Partial Upfront', 'All Upfront']) {
      const input: GetProductsCommandInput = {
        ServiceCode: 'AmazonEC2',
        Filters: [
          {
            Type: 'TERM_MATCH',
            Field: 'instanceType',
            Value: instanceType,
          },
          {
            Type: 'TERM_MATCH',
            Field: 'location',
            Value: regionDescription,
          },
          {
            Type: 'TERM_MATCH',
            Field: 'tenancy',
            Value: 'Shared',
          },
          {
            Type: 'TERM_MATCH',
            Field: 'operatingSystem',
            Value: 'Linux',
          },
          {
            Type: 'TERM_MATCH',
            Field: 'preInstalledSw',
            Value: 'NA',
          },
        ],
        MaxResults: 100,
      };

      const command = new GetProductsCommand(input);
      const response = await client.send(command);

      if (response.PriceList) {
        for (const priceItem of response.PriceList) {
          const price = JSON.parse(priceItem as string);
          
          // Reserved Instanceの情報を抽出
          if (price.terms && price.terms.Reserved) {
            for (const reservedTerm of Object.values(price.terms.Reserved) as any[]) {
              const attributes = reservedTerm.termAttributes;
              
              if (attributes.PurchaseOption === paymentOption) {
                const leaseContractLength = attributes.LeaseContractLength;
                const contractYears = leaseContractLength === '1yr' ? 1 : 3;
                
                // 時間単価を取得
                const priceDimensions = Object.values(reservedTerm.priceDimensions) as any[];
                if (priceDimensions.length > 0) {
                  const pricePerUnit = parseFloat(priceDimensions[0].pricePerUnit.USD);
                  
                  if (pricePerUnit > 0) {
                    discounts.push({
                      service: 'Amazon Elastic Compute Cloud',
                      contract_years: contractYears,
                      payment_method: paymentOption.replace(' ', '') as 'NoUpfront' | 'PartialUpfront' | 'AllUpfront',
                      region,
                      instance_type: instanceType,
                      unit_price: pricePerUnit,
                      unit_price_unit: 'per hour',
                      reservation_type: 'RI',
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching EC2 RI pricing:', error);
  }

  return discounts;
}

/**
 * AWS Price List APIからRDSのRI価格を取得
 */
async function fetchRDSRIPricing(
  instanceType: string,
  region: string
): Promise<ReservationDiscount[]> {
  const client = getPricingClient();
  if (!client) return [];

  const regionDescription = getRegionDescription(region);
  const discounts: ReservationDiscount[] = [];

  try {
    for (const paymentOption of ['No Upfront', 'Partial Upfront', 'All Upfront']) {
      const input: GetProductsCommandInput = {
        ServiceCode: 'AmazonRDS',
        Filters: [
          {
            Type: 'TERM_MATCH',
            Field: 'instanceType',
            Value: instanceType,
          },
          {
            Type: 'TERM_MATCH',
            Field: 'location',
            Value: regionDescription,
          },
          {
            Type: 'TERM_MATCH',
            Field: 'databaseEngine',
            Value: 'Any',
          },
        ],
        MaxResults: 100,
      };

      const command = new GetProductsCommand(input);
      const response = await client.send(command);

      if (response.PriceList) {
        for (const priceItem of response.PriceList) {
          const price = JSON.parse(priceItem as string);
          
          if (price.terms && price.terms.Reserved) {
            for (const reservedTerm of Object.values(price.terms.Reserved) as any[]) {
              const attributes = reservedTerm.termAttributes;
              
              if (attributes.PurchaseOption === paymentOption) {
                const leaseContractLength = attributes.LeaseContractLength;
                const contractYears = leaseContractLength === '1yr' ? 1 : 3;
                
                const priceDimensions = Object.values(reservedTerm.priceDimensions) as any[];
                if (priceDimensions.length > 0) {
                  const pricePerUnit = parseFloat(priceDimensions[0].pricePerUnit.USD);
                  
                  if (pricePerUnit > 0) {
                    discounts.push({
                      service: 'Amazon Relational Database Service',
                      contract_years: contractYears,
                      payment_method: paymentOption.replace(' ', '') as 'NoUpfront' | 'PartialUpfront' | 'AllUpfront',
                      region,
                      instance_type: instanceType,
                      unit_price: pricePerUnit,
                      unit_price_unit: 'per hour',
                      reservation_type: 'RI',
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching RDS RI pricing:', error);
  }

  return discounts;
}

/**
 * AWS Price List APIから価格を取得
 */
export async function fetchPricingFromAWS(
  service: string,
  instanceType: string,
  region: string
): Promise<ReservationDiscount[]> {
  const serviceCode = getServiceCode(service);

  if (serviceCode === 'AmazonEC2') {
    return await fetchEC2RIPricing(instanceType, region);
  } else if (serviceCode === 'AmazonRDS') {
    return await fetchRDSRIPricing(instanceType, region);
  }

  return [];
}

/**
 * キャッシュキーを生成
 */
export function generateCacheKey(
  service: string,
  instanceType: string,
  region: string
): string {
  return `${service}:${instanceType}:${region}`;
}
