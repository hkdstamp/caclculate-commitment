// AWSコストデータのCSV行型定義
export interface AWSCostData {
  account_id: string;
  service: string;
  lineitem_resourceid: string;
  product_instancetype: string;
  lineitem_operation: string;
  lineitem_usagetype: string;
  product_region: string;
  lineitem_lineitemtype: string;
  pricing_publicondemandrate: number;
  lineitem_unblendedrate: number;
  ondemand_risk_cost: number;
  usage_amount: number;
}

// AWS予約サービス別割引データ型定義
export interface ReservationDiscount {
  service: string;
  contract_years: number; // 1 or 3
  payment_method: 'NoUpfront' | 'PartialUpfront' | 'AllUpfront';
  region: string;
  instance_type: string;
  unit_price: number;
  unit_price_unit: string; // 'per hour' など
  reservation_type: 'RI' | 'SP'; // Reserved Instance or Savings Plan
  tenancy?: 'Shared' | 'Dedicated' | 'Host'; // テナンシータイプ（オプション）
  upfront_fee?: number; // 初期費用（PartialUpfront/AllUpfrontの場合）
}

// コミットメントコスト計算結果
export interface CommitmentCostResult {
  // 元データ
  costData: AWSCostData;
  
  // RI計算結果
  ri_discount?: ReservationDiscount; // 30日保証用のdiscount
  ri_discount_1y?: ReservationDiscount; // 1年保証用のdiscount（RDS専用）
  ri_commitment_cost: number; // 30日保証のコミットメントコスト（後方互換性のため残す）
  ri_commitment_cost_30d: number; // 30日保証のコミットメントコスト
  ri_commitment_cost_1y: number; // 1年保証のコミットメントコスト
  ri_upfront_fee: number; // RI初期費用（30日保証）
  ri_upfront_fee_1y: number; // RI初期費用（1年保証）
  ri_applied_rate: number; // 適用率 0-1
  ri_cost_reduction: number; // 30日保証のコスト削減額（後方互換性のため残す）
  ri_cost_reduction_30d: number; // 30日保証のコスト削減額
  ri_cost_reduction_1y: number; // 1年保証のコスト削減額
  ri_refund: number; // 30日保証の返金額（後方互換性のため残す）
  ri_refund_30d: number; // 30日保証の返金額
  ri_refund_1y: number; // 1年保証の返金額
  ri_insurance_30d: number; // 30日保証保険料
  ri_insurance_1y: number; // 1年保証保険料
  ri_final_payment_30d: number; // 30日保証の最終支払額
  ri_final_payment_1y: number; // 1年保証の最終支払額
  ri_effective_discount_rate_30d: number; // 30日保証の実効割引率
  ri_effective_discount_rate_1y: number; // 1年保証の実効割引率
  
  // SP計算結果
  sp_discount?: ReservationDiscount;
  sp_commitment_cost: number;
  sp_upfront_fee: number; // SP初期費用
  sp_applied_rate: number;
  sp_cost_reduction: number;
  sp_refund: number;
  sp_insurance_30d: number;
  sp_insurance_1y: number;
  sp_final_payment_30d: number;
  sp_final_payment_1y: number;
  sp_effective_discount_rate_30d: number;
  sp_effective_discount_rate_1y: number;
}

// 計算パラメータ
export interface CalculationParams {
  ri_applied_rate: number; // RI適用率 0-1
  sp_applied_rate: number; // SP適用率 0-1
  insurance_rate_30d: number; // 30日保証の保険料率 (デフォルト 0.5)
  insurance_rate_1y: number; // 1年保証の保険料率 (デフォルト 0.3)
  reservation_type?: 'RI' | 'SP' | 'Mix'; // 予約タイプ（デフォルト: Mix）
}

// 集計結果
export interface AggregatedResult {
  total_ondemand_cost: number;
  total_current_cost: number; // 現在の総コスト（lineitem_unblendedrate × usage_amount）
  
  // RI集計
  ri_total_commitment_cost: number; // 30日保証のコミットメントコスト総計（後方互換性のため残す）
  ri_total_commitment_cost_30d: number; // 30日保証のコミットメントコスト総計
  ri_total_commitment_cost_1y: number; // 1年保証のコミットメントコスト総計
  ri_total_upfront_fee: number; // RI初期費用の総計（後方互換性のため残す）
  ri_total_upfront_fee_30d: number; // 30日保証のRI初期費用の総計
  ri_total_upfront_fee_1y: number; // 1年保証のRI初期費用の総計
  ri_total_cost_reduction: number; // 30日保証のコスト削減額総計（後方互換性のため残す）
  ri_total_cost_reduction_30d: number; // 30日保証のコスト削減額総計
  ri_total_cost_reduction_1y: number; // 1年保証のコスト削減額総計
  ri_total_refund: number; // 30日保証の返金額総計（後方互換性のため残す）
  ri_total_refund_30d: number; // 30日保証の返金額総計
  ri_total_refund_1y: number; // 1年保証の返金額総計
  ri_total_insurance_30d: number;
  ri_total_insurance_1y: number;
  ri_total_final_payment_30d: number;
  ri_total_final_payment_1y: number;
  ri_average_effective_discount_rate_30d: number;
  ri_average_effective_discount_rate_1y: number;
  
  // SP集計
  sp_total_commitment_cost: number;
  sp_total_upfront_fee: number; // SP初期費用の総計
  sp_total_cost_reduction: number;
  sp_total_refund: number;
  sp_total_insurance_30d: number;
  sp_total_insurance_1y: number;
  sp_total_final_payment_30d: number;
  sp_total_final_payment_1y: number;
  sp_average_effective_discount_rate_30d: number;
  sp_average_effective_discount_rate_1y: number;
  
  // Mix集計（SPがある場合はSP、ない場合はRI）
  mix_total_commitment_cost: number; // 30日保証のコミットメントコスト総計（後方互換性のため残す）
  mix_total_commitment_cost_30d: number; // 30日保証のコミットメントコスト総計
  mix_total_commitment_cost_1y: number; // 1年保証のコミットメントコスト総計
  mix_total_upfront_fee: number; // Mix初期費用の総計（後方互換性のため残す）
  mix_total_upfront_fee_30d: number; // 30日保証の初期費用の総計
  mix_total_upfront_fee_1y: number; // 1年保証の初期費用の総計
  mix_total_cost_reduction: number; // 30日保証のコスト削減額総計（後方互換性のため残す）
  mix_total_cost_reduction_30d: number; // 30日保証のコスト削減額総計
  mix_total_cost_reduction_1y: number; // 1年保証のコスト削減額総計
  mix_total_refund: number; // 30日保証の返金額総計（後方互換性のため残す）
  mix_total_refund_30d: number; // 30日保証の返金額総計
  mix_total_refund_1y: number; // 1年保証の返金額総計
  mix_total_insurance_30d: number;
  mix_total_insurance_1y: number;
  mix_total_final_payment_30d: number;
  mix_total_final_payment_1y: number;
  mix_average_effective_discount_rate_30d: number;
  mix_average_effective_discount_rate_1y: number;
  
  // 詳細結果
  details: CommitmentCostResult[];
}
