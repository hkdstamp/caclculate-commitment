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

  // EC2 Compute Savings Plan - Tokyo Region
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'NoUpfront',
    region: 'ap-northeast-1',
    instance_type: '', // SPはインスタンスタイプ不問
    unit_price: 0.0400,
    unit_price_unit: 'per hour per dollar commitment',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 1,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: '',
    unit_price: 0.0360,
    unit_price_unit: 'per hour per dollar commitment',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'NoUpfront',
    region: 'ap-northeast-1',
    instance_type: '',
    unit_price: 0.0300,
    unit_price_unit: 'per hour per dollar commitment',
    reservation_type: 'SP',
  },
  {
    service: 'Amazon Elastic Compute Cloud',
    contract_years: 3,
    payment_method: 'AllUpfront',
    region: 'ap-northeast-1',
    instance_type: '',
    unit_price: 0.0240,
    unit_price_unit: 'per hour per dollar commitment',
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
 * 指定された条件に一致する予約割引を検索する
 */
export function findReservationDiscounts(
  service: string,
  region: string,
  instanceType?: string,
  reservationType?: 'RI' | 'SP'
): ReservationDiscount[] {
  return reservationCatalog.filter((discount) => {
    // サービス名の部分一致（柔軟な検索）
    const serviceMatch = discount.service.toLowerCase().includes(service.toLowerCase()) ||
                        service.toLowerCase().includes(discount.service.toLowerCase());
    
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
