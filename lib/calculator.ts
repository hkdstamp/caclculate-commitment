import {
  AWSCostData,
  CommitmentCostResult,
  CalculationParams,
  AggregatedResult,
  ReservationDiscount,
} from './types';
import {
  findReservationDiscounts,
  getBestReservationDiscount,
} from './reservation-catalog';

/**
 * RDSのMultiAZ判定
 * lineitem_usagetypeに"Multi-AZ"が含まれている場合、MultiAZと判定
 */
function isRDSMultiAZ(lineitemUsageType: string): boolean {
  return lineitemUsageType.toLowerCase().includes('multi-az');
}

/**
 * RDSのNode数を計算
 * Node数 = 利用額 / (オンデマンド単価 × 利用量)
 */
function calculateRDSNodeCount(
  ondemandCost: number,
  publicOndemandRate: number,
  usageAmount: number
): number {
  if (publicOndemandRate === 0 || usageAmount === 0) {
    return 1; // デフォルトは1ノード
  }
  const calculatedNodes = ondemandCost / (publicOndemandRate * usageAmount);
  return Math.max(1, Math.round(calculatedNodes)); // 最小1ノード、四捨五入
}

/**
 * サービスがRDSかどうかを判定
 */
function isRDSService(service: string): boolean {
  const normalizedService = service.toLowerCase();
  return normalizedService.includes('rds') || 
         normalizedService.includes('relational database');
}

/**
 * 単一のコストデータに対してコミットメントコストを計算（非同期版）
 */
export async function calculateCommitmentCost(
  costData: AWSCostData,
  params: CalculationParams
): Promise<CommitmentCostResult> {
  const ondemandCost = costData.ondemand_risk_cost;
  const usageAmount = costData.usage_amount;

  // RI割引の検索
  const riDiscounts = await findReservationDiscounts(
    costData.service,
    costData.product_region,
    costData.product_instancetype,
    'RI'
  );
  const riDiscount = getBestReservationDiscount(riDiscounts);

  // SP割引の検索
  const spDiscounts = await findReservationDiscounts(
    costData.service,
    costData.product_region,
    undefined, // SPはインスタンスタイプ不問
    'SP'
  );
  const spDiscount = getBestReservationDiscount(spDiscounts);

  // RI計算
  let riCommitmentCost: number;
  
  if (riDiscount) {
    // RDSの場合、MultiAZとNode数を考慮
    if (isRDSService(costData.service)) {
      const isMultiAZ = isRDSMultiAZ(costData.lineitem_usagetype);
      const nodeCount = calculateRDSNodeCount(
        ondemandCost,
        costData.pricing_publicondemandrate,
        usageAmount
      );
      
      // RDS RI単価をNode数で調整
      let adjustedUnitPrice = riDiscount.unit_price * nodeCount;
      
      // MultiAZの場合、さらに2倍（プライマリ + スタンバイ）
      if (isMultiAZ) {
        adjustedUnitPrice *= 2;
      }
      
      riCommitmentCost = usageAmount * adjustedUnitPrice;
      
      // デバッグログ（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 RDS RI Calculation:', {
          resourceId: costData.lineitem_resourceid,
          instanceType: costData.product_instancetype,
          isMultiAZ,
          nodeCount,
          baseUnitPrice: riDiscount.unit_price,
          adjustedUnitPrice,
          usageAmount,
          riCommitmentCost,
        });
      }
    } else {
      // EC2など、通常の計算
      riCommitmentCost = usageAmount * riDiscount.unit_price;
    }
  } else {
    riCommitmentCost = ondemandCost;
  }

  const riAppliedOndemand = ondemandCost * params.ri_applied_rate;
  const riCostReduction = Math.max(0, riAppliedOndemand - riCommitmentCost);
  // オンデマンドコストとコミットメントコストが同額の場合、返金は0
  const riRefund = riCommitmentCost === ondemandCost ? 0 : Math.max(0, riCommitmentCost - riAppliedOndemand);

  // 保険料 = コスト削減額 × 保険料率（コスト削減額が0以下の場合は保険料も0）
  const riInsurance30d = riCostReduction > 0 ? riCostReduction * params.insurance_rate_30d : 0;
  const riInsurance1y = riCostReduction > 0 ? riCostReduction * params.insurance_rate_1y : 0;

  const riFinalPayment30d = riCommitmentCost + riInsurance30d;
  const riFinalPayment1y = riCommitmentCost + riInsurance1y;

  const riEffectiveDiscountRate30d =
    ondemandCost > 0
      ? ((ondemandCost - riFinalPayment30d) / ondemandCost) * 100
      : 0;
  const riEffectiveDiscountRate1y =
    ondemandCost > 0
      ? ((ondemandCost - riFinalPayment1y) / ondemandCost) * 100
      : 0;

  // SP計算
  // SPの場合、unit_priceは割引率（支払い率）を表す
  // 例: unit_price = 0.6 → オンデマンドの60%を支払う（40%割引）
  const spCommitmentCost = spDiscount
    ? ondemandCost * spDiscount.unit_price
    : ondemandCost;

  const spAppliedOndemand = ondemandCost * params.sp_applied_rate;
  const spCostReduction = Math.max(0, spAppliedOndemand - spCommitmentCost);
  // オンデマンドコストとコミットメントコストが同額の場合、返金は0
  const spRefund = spCommitmentCost === ondemandCost ? 0 : Math.max(0, spCommitmentCost - spAppliedOndemand);

  // 保険料 = コスト削減額 × 保険料率（コスト削減額が0以下の場合は保険料も0）
  const spInsurance30d = spCostReduction > 0 ? spCostReduction * params.insurance_rate_30d : 0;
  const spInsurance1y = spCostReduction > 0 ? spCostReduction * params.insurance_rate_1y : 0;

  const spFinalPayment30d = spCommitmentCost + spInsurance30d;
  const spFinalPayment1y = spCommitmentCost + spInsurance1y;

  const spEffectiveDiscountRate30d =
    ondemandCost > 0
      ? ((ondemandCost - spFinalPayment30d) / ondemandCost) * 100
      : 0;
  const spEffectiveDiscountRate1y =
    ondemandCost > 0
      ? ((ondemandCost - spFinalPayment1y) / ondemandCost) * 100
      : 0;

  return {
    costData,
    // RI
    ri_discount: riDiscount,
    ri_commitment_cost: riCommitmentCost,
    ri_applied_rate: params.ri_applied_rate,
    ri_cost_reduction: riCostReduction,
    ri_refund: riRefund,
    ri_insurance_30d: riInsurance30d,
    ri_insurance_1y: riInsurance1y,
    ri_final_payment_30d: riFinalPayment30d,
    ri_final_payment_1y: riFinalPayment1y,
    ri_effective_discount_rate_30d: riEffectiveDiscountRate30d,
    ri_effective_discount_rate_1y: riEffectiveDiscountRate1y,
    // SP
    sp_discount: spDiscount,
    sp_commitment_cost: spCommitmentCost,
    sp_applied_rate: params.sp_applied_rate,
    sp_cost_reduction: spCostReduction,
    sp_refund: spRefund,
    sp_insurance_30d: spInsurance30d,
    sp_insurance_1y: spInsurance1y,
    sp_final_payment_30d: spFinalPayment30d,
    sp_final_payment_1y: spFinalPayment1y,
    sp_effective_discount_rate_30d: spEffectiveDiscountRate30d,
    sp_effective_discount_rate_1y: spEffectiveDiscountRate1y,
  };
}

/**
 * 複数のコストデータを集計して結果を返す（非同期版）
 */
export async function aggregateResults(
  costDataList: AWSCostData[],
  params: CalculationParams
): Promise<AggregatedResult> {
  const details = await Promise.all(
    costDataList.map((costData) => calculateCommitmentCost(costData, params))
  );

  const totalOndemandCost = details.reduce(
    (sum, d) => sum + d.costData.ondemand_risk_cost,
    0
  );

  // 現在の総コスト（lineitem_unblendedrate × usage_amount）
  const totalCurrentCost = details.reduce(
    (sum, d) => sum + (d.costData.lineitem_unblendedrate * d.costData.usage_amount),
    0
  );

  // RI集計
  const riTotalCommitmentCost = details.reduce(
    (sum, d) => sum + d.ri_commitment_cost,
    0
  );
  const riTotalCostReduction = details.reduce(
    (sum, d) => sum + d.ri_cost_reduction,
    0
  );
  const riTotalRefund = details.reduce((sum, d) => sum + d.ri_refund, 0);
  const riTotalInsurance30d = details.reduce(
    (sum, d) => sum + d.ri_insurance_30d,
    0
  );
  const riTotalInsurance1y = details.reduce(
    (sum, d) => sum + d.ri_insurance_1y,
    0
  );
  const riTotalFinalPayment30d = details.reduce(
    (sum, d) => sum + d.ri_final_payment_30d,
    0
  );
  const riTotalFinalPayment1y = details.reduce(
    (sum, d) => sum + d.ri_final_payment_1y,
    0
  );

  const riAverageEffectiveDiscountRate30d =
    totalOndemandCost > 0
      ? ((totalOndemandCost - riTotalFinalPayment30d) / totalOndemandCost) * 100
      : 0;
  const riAverageEffectiveDiscountRate1y =
    totalOndemandCost > 0
      ? ((totalOndemandCost - riTotalFinalPayment1y) / totalOndemandCost) * 100
      : 0;

  // SP集計
  const spTotalCommitmentCost = details.reduce(
    (sum, d) => sum + d.sp_commitment_cost,
    0
  );
  const spTotalCostReduction = details.reduce(
    (sum, d) => sum + d.sp_cost_reduction,
    0
  );
  const spTotalRefund = details.reduce((sum, d) => sum + d.sp_refund, 0);
  const spTotalInsurance30d = details.reduce(
    (sum, d) => sum + d.sp_insurance_30d,
    0
  );
  const spTotalInsurance1y = details.reduce(
    (sum, d) => sum + d.sp_insurance_1y,
    0
  );
  const spTotalFinalPayment30d = details.reduce(
    (sum, d) => sum + d.sp_final_payment_30d,
    0
  );
  const spTotalFinalPayment1y = details.reduce(
    (sum, d) => sum + d.sp_final_payment_1y,
    0
  );

  const spAverageEffectiveDiscountRate30d =
    totalOndemandCost > 0
      ? ((totalOndemandCost - spTotalFinalPayment30d) / totalOndemandCost) * 100
      : 0;
  const spAverageEffectiveDiscountRate1y =
    totalOndemandCost > 0
      ? ((totalOndemandCost - spTotalFinalPayment1y) / totalOndemandCost) * 100
      : 0;

  return {
    total_ondemand_cost: totalOndemandCost,
    total_current_cost: totalCurrentCost,
    // RI
    ri_total_commitment_cost: riTotalCommitmentCost,
    ri_total_cost_reduction: riTotalCostReduction,
    ri_total_refund: riTotalRefund,
    ri_total_insurance_30d: riTotalInsurance30d,
    ri_total_insurance_1y: riTotalInsurance1y,
    ri_total_final_payment_30d: riTotalFinalPayment30d,
    ri_total_final_payment_1y: riTotalFinalPayment1y,
    ri_average_effective_discount_rate_30d: riAverageEffectiveDiscountRate30d,
    ri_average_effective_discount_rate_1y: riAverageEffectiveDiscountRate1y,
    // SP
    sp_total_commitment_cost: spTotalCommitmentCost,
    sp_total_cost_reduction: spTotalCostReduction,
    sp_total_refund: spTotalRefund,
    sp_total_insurance_30d: spTotalInsurance30d,
    sp_total_insurance_1y: spTotalInsurance1y,
    sp_total_final_payment_30d: spTotalFinalPayment30d,
    sp_total_final_payment_1y: spTotalFinalPayment1y,
    sp_average_effective_discount_rate_30d: spAverageEffectiveDiscountRate30d,
    sp_average_effective_discount_rate_1y: spAverageEffectiveDiscountRate1y,
    details,
  };
}
