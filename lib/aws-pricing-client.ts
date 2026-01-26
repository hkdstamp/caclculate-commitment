import {
  PricingClient,
  GetProductsCommand,
  GetProductsCommandInput,
} from '@aws-sdk/client-pricing';
import { ReservationDiscount } from './types';
import { normalizeServiceName } from './reservation-catalog';

/**
 * スリープ関数（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * エクスポネンシャルバックオフでリトライを実行
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // ThrottlingExceptionの場合のみリトライ
      if (error.name === 'ThrottlingException' || error.name === 'TooManyRequestsException') {
        const delay = initialDelay * Math.pow(2, attempt); // エクスポネンシャルバックオフ
        const jitter = Math.random() * 1000; // ジッターを追加
        const totalDelay = delay + jitter;
        
        console.log(`⚠️ ThrottlingException detected. Retrying in ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(totalDelay);
        continue;
      }
      
      // それ以外のエラーは即座にスロー
      throw error;
    }
  }
  
  throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${lastError?.message}`);
}

/**
 * AWS Pricing APIクライアントの初期化
 */
function getPricingClient(): PricingClient | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';
  const enableApi = process.env.ENABLE_AWS_PRICE_API === 'true';

  // デバッグ: 環境変数の読み込み状況を確認
  console.log('🔍 Environment Variables Check:', {
    ENABLE_AWS_PRICE_API: process.env.ENABLE_AWS_PRICE_API,
    enableApi,
    AWS_REGION: process.env.AWS_REGION,
    hasAccessKeyId: !!accessKeyId,
    hasSecretAccessKey: !!secretAccessKey,
  });

  if (!enableApi || !accessKeyId || !secretAccessKey) {
    console.log('⚠️ AWS Price List API is disabled or credentials not configured');
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
 * レート制限用の遅延（API呼び出し間隔）
 * 環境変数で設定可能。デフォルトは200ms
 */
const API_CALL_DELAY = parseInt(process.env.AWS_API_CALL_DELAY || '200', 10);

/**
 * リトライ最大回数
 * 環境変数で設定可能。デフォルトは5回
 */
const MAX_RETRIES = parseInt(process.env.AWS_API_MAX_RETRIES || '5', 10);

/**
 * リトライ初期遅延（ミリ秒）
 * 環境変数で設定可能。デフォルトは1000ms（1秒）
 */
const INITIAL_RETRY_DELAY = parseInt(process.env.AWS_API_INITIAL_RETRY_DELAY || '1000', 10);

/**
 * AWS Price List APIからEC2のRI価格を取得
 * tenancyパラメータでShared/Dedicated/Hostを指定可能
 */
async function fetchEC2RIPricing(
  instanceType: string,
  region: string,
  tenancy: 'Shared' | 'Dedicated' | 'Host' = 'Shared'
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
            Value: tenancy,
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
      
      // リトライロジック付きでAPI呼び出し
      const response = await retryWithBackoff(async () => {
        return await client.send(command);
      });
      
      // レート制限対策: API呼び出し間に遅延を追加
      await sleep(API_CALL_DELAY);

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
                      tenancy,
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
      
      // リトライロジック付きでAPI呼び出し
      const response = await retryWithBackoff(async () => {
        return await client.send(command);
      });
      
      // レート制限対策: API呼び出し間に遅延を追加
      await sleep(API_CALL_DELAY);

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
 * AWS Savings Plans APIからEC2の割引率を取得
 * 注意: Savings Plansの価格情報はPrice List APIから直接取得できないため、
 * 典型的な割引率を使用します（実際のSP価格はAWS Cost Explorerから取得する必要があります）
 */
async function fetchEC2SavingsPlansPricing(
  region: string
): Promise<ReservationDiscount[]> {
  const client = getPricingClient();
  if (!client) return [];

  const discounts: ReservationDiscount[] = [];

  try {
    // Savings PlansはCompute Savings Plansを想定
    // AWS Price List APIではSPの詳細な割引率が取得しにくいため、
    // 標準的な割引率を使用
    
    // 1年契約 NoUpfront: 約34%割引（支払い率66%）
    discounts.push({
      service: 'Amazon Elastic Compute Cloud',
      contract_years: 1,
      payment_method: 'NoUpfront',
      region,
      instance_type: '', // SPはインスタンスタイプ不問
      unit_price: 0.66, // 割引率: 34%割引
      unit_price_unit: 'discount rate',
      reservation_type: 'SP',
    });

    // 1年契約 AllUpfront: 約40%割引（支払い率60%）
    discounts.push({
      service: 'Amazon Elastic Compute Cloud',
      contract_years: 1,
      payment_method: 'AllUpfront',
      region,
      instance_type: '',
      unit_price: 0.60,
      unit_price_unit: 'discount rate',
      reservation_type: 'SP',
    });

    // 3年契約 NoUpfront: 約46%割引（支払い率54%）
    discounts.push({
      service: 'Amazon Elastic Compute Cloud',
      contract_years: 3,
      payment_method: 'NoUpfront',
      region,
      instance_type: '',
      unit_price: 0.54,
      unit_price_unit: 'discount rate',
      reservation_type: 'SP',
    });

    // 3年契約 AllUpfront: 約60%割引（支払い率40%）
    discounts.push({
      service: 'Amazon Elastic Compute Cloud',
      contract_years: 3,
      payment_method: 'AllUpfront',
      region,
      instance_type: '',
      unit_price: 0.40,
      unit_price_unit: 'discount rate',
      reservation_type: 'SP',
    });
  } catch (error) {
    console.error('Error creating Savings Plans pricing:', error);
  }

  return discounts;
}

/**
 * AWS Price List APIから価格を取得（RIとSP両方）
 */
export async function fetchPricingFromAWS(
  service: string,
  instanceType: string | undefined,
  region: string,
  reservationType: 'RI' | 'SP',
  tenancy: 'Shared' | 'Dedicated' | 'Host' = 'Shared'
): Promise<ReservationDiscount[]> {
  const serviceCode = getServiceCode(service);

  // Savings Plansの場合
  if (reservationType === 'SP') {
    if (serviceCode === 'AmazonEC2') {
      return await fetchEC2SavingsPlansPricing(region);
    }
    // RDSはSPをサポートしていないため空配列を返す
    return [];
  }

  // Reserved Instancesの場合
  if (!instanceType) return [];

  if (serviceCode === 'AmazonEC2') {
    return await fetchEC2RIPricing(instanceType, region, tenancy);
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
  instanceType: string | undefined,
  region: string,
  reservationType: 'RI' | 'SP',
  tenancy?: 'Shared' | 'Dedicated' | 'Host'
): string {
  const tenancyStr = tenancy ? `:${tenancy}` : '';
  return `${service}:${instanceType || 'SP'}:${region}:${reservationType}${tenancyStr}`;
}
