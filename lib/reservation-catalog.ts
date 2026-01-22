import { ReservationDiscount } from './types';

/**
 * AWS予約サービス別割引データのサンプルカタログ
 * 実際の運用では、データベースまたはAWS Price List APIから取得する
 */
export const reservationCatalog: ReservationDiscount[] = [
  // EC2 RI - Tokyo Region (ap-northeast-1)
  // t3.medium
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'NoUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.medium',
    unit_price: 0.0336,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'PartialUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.medium',
    unit_price: 0.0312,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.medium',
    unit_price: 0.0288,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'NoUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.medium',
    unit_price: 0.0240,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'PartialUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.medium',
    unit_price: 0.0216,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.medium',
    unit_price: 0.0192,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  
  // t3.large
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.large',
    unit_price: 0.0576,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 't3.large',
    unit_price: 0.0384,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m5.large
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm5.large',
    unit_price: 0.0720,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm5.large',
    unit_price: 0.0480,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m5.xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm5.xlarge',
    unit_price: 0.144,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm5.xlarge',
    unit_price: 0.096,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m5.2xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm5.2xlarge',
    unit_price: 0.288,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm5.2xlarge',
    unit_price: 0.192,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m6i.large
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm6i.large',
    unit_price: 0.072,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm6i.large',
    unit_price: 0.048,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m6i.xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm6i.xlarge',
    unit_price: 0.144,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm6i.xlarge',
    unit_price: 0.096,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m6i.2xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm6i.2xlarge',
    unit_price: 0.288,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm6i.2xlarge',
    unit_price: 0.192,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // m7i.xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm7i.xlarge',
    unit_price: 0.148,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'm7i.xlarge',
    unit_price: 0.099,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // r5.large
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.large',
    unit_price: 0.096,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.large',
    unit_price: 0.064,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // r5.xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.xlarge',
    unit_price: 0.192,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.xlarge',
    unit_price: 0.128,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // r5.2xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.2xlarge',
    unit_price: 0.384,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.2xlarge',
    unit_price: 0.256,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // r5.4xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.4xlarge',
    unit_price: 0.768,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'r5.4xlarge',
    unit_price: 0.512,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // c5.xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'c5.xlarge',
    unit_price: 0.128,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'c5.xlarge',
    unit_price: 0.085,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // c6a.2xlarge
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'c6a.2xlarge',
    unit_price: 0.252,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'c6a.2xlarge',
    unit_price: 0.168,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // c5.xlarge for ap-northeast-3
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-3',
    instance_type: 'c5.xlarge',
    unit_price: 0.132,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-3',
    instance_type: 'c5.xlarge',
    unit_price: 0.088,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // EC2 Compute Savings Plan - Tokyo Region
  // SPのunit_priceは割引率を表す（1 - 割引率 = 支払い率）
  // 例: 0.6 = 40%割引（オンデマンドの60%を支払う）
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'NoUpfront',
    region: 'ap-northeast-1',
    instance_type: '', // SPはインスタンスタイプ不問
    unit_price: 0.66, // 34%割引
    unit_price_unit: 'discount rate',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: '',
    unit_price: 0.60, // 40%割引
    unit_price_unit: 'discount rate',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'NoUpfront',
    region: 'ap-northeast-1',
    instance_type: '',
    unit_price: 0.54, // 46%割引
    unit_price_unit: 'discount rate',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: '',
    unit_price: 0.40, // 60%割引
    unit_price_unit: 'discount rate',
    reservation_type: 'SP',
  },

  // EC2 Compute Savings Plan - ap-northeast-3
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-3',
    instance_type: '',
    unit_price: 0.60, // 40%割引
    unit_price_unit: 'discount rate',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-3',
    instance_type: '',
    unit_price: 0.40, // 60%割引
    unit_price_unit: 'discount rate',
    reservation_type: 'SP',
  },

  // RDS RI - Tokyo Region
  // db.t3.medium
  {
    service: 'Amazon Relational Database Service',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.t3.medium',
    unit_price: 0.0480,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Relational Database Service',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.t3.medium',
    unit_price: 0.0320,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // db.m5.large
  {
    service: 'Amazon Relational Database Service',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.m5.large',
    unit_price: 0.1200,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Relational Database Service',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.m5.large',
    unit_price: 0.0800,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // db.r5.xlarge
  {
    service: 'Amazon Relational Database Service',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.r5.xlarge',
    unit_price: 0.372,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Relational Database Service',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.r5.xlarge',
    unit_price: 0.248,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // db.r5.2xlarge
  {
    service: 'Amazon Relational Database Service',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.r5.2xlarge',
    unit_price: 0.744,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Relational Database Service',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.r5.2xlarge',
    unit_price: 0.496,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // db.r5.4xlarge
  {
    service: 'Amazon Relational Database Service',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.r5.4xlarge',
    unit_price: 1.488,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon Relational Database Service',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'db.r5.4xlarge',
    unit_price: 0.992,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },

  // ElastiCache RI - Tokyo Region
  // cache.t3.medium
  {
    service: 'Amazon ElastiCache',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'cache.t3.medium',
    unit_price: 0.0400,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
  {
    service: 'Amazon ElastiCache',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: 'cache.t3.medium',
    unit_price: 0.0267,
    unit_price_unit: 'per hour',
    reservation_type: 'RI',
  },
];

/**
 * サービス名を正規化する（AmazonEC2 → Amazon Elastic Compute Cloud）
 */
export function normalizeServiceName(service: string): string {
  const serviceMap: Record<string, string> = {
    'AmazonEC2': 'Amazon Elastic Compute Cloud',
    'AmazonRDS': 'Amazon Relational Database Service',
    'AmazonElastiCache': 'Amazon ElastiCache',
    'Amazon EC2': 'Amazon Elastic Compute Cloud',
    'Amazon RDS': 'Amazon Relational Database Service',
  };
  
  return serviceMap[service] || service;
}

/**
 * 指定された条件に一致する予約割引を検索する
 */
export function findReservationDiscounts(
  service: string,
  region: string,
  instanceType?: string,
  reservationType?: 'RI' | 'SP'
): ReservationDiscount[] {
  // サービス名を正規化
  const normalizedService = normalizeServiceName(service);
  
  return reservationCatalog.filter((discount) => {
    // サービス名の部分一致（柔軟な検索）
    const serviceMatch = discount.service.toLowerCase().includes(normalizedService.toLowerCase()) ||
                        normalizedService.toLowerCase().includes(discount.service.toLowerCase());
    
    // リージョンの一致
    const regionMatch = discount.region === region;
    
    // 予約タイプの一致
    const typeMatch = !reservationType || discount.reservation_type === reservationType;
    
    // インスタンスタイプの一致（SPの場合は空文字列）
    let instanceMatch = true;
    if (instanceType && discount.reservation_type === 'RI') {
      instanceMatch = discount.instance_type === instanceType;
    }
    
    return serviceMatch && regionMatch && typeMatch && instanceMatch;
  });
}

/**
 * 最も安い予約割引を取得する（3年優先、同じ契約年数なら最安単価）
 */
export function getBestReservationDiscount(
  discounts: ReservationDiscount[]
): ReservationDiscount | undefined {
  if (discounts.length === 0) return undefined;

  // 3年契約を優先、同じ契約年数なら最安単価
  return discounts.sort((a, b) => {
    // 契約年数が異なる場合は3年を優先
    if (a.contract_years !== b.contract_years) {
      return b.contract_years - a.contract_years;
    }
    // 契約年数が同じ場合は単価が安い方を優先
    return a.unit_price - b.unit_price;
  })[0];
}
