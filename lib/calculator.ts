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
 * サービスがRDSかどうかを判定
 */
function isRDSService(service: string): boolean {
  const normalizedService = service.toLowerCase();
  return normalizedService.includes('rds') || 
         normalizedService.includes('relational database');
}

/**
 * Dedicated Host/Tenancyの判定
 * lineitem_usagetypeに"Dedicated"が含まれている場合、Dedicatedと判定
 */
function isDedicatedUsage(lineitemUsageType: string): boolean {
  return lineitemUsageType.toLowerCase().includes('dedicated');
}

/**
 * RDS専用のRI割引を検索
 * - 30日保証（insurance_30d）: 3年契約NoUpfrontを優先
 * - 1年保証（insurance_1y）: 3年契約PartialUpfrontを優先
 */
async function findRDSReservationDiscount(
  service: string,
  region: string,
  instanceType: string,
  tenancy: 'Shared' | 'Dedicated' | 'Host',
  insuranceType: '30d' | '1y',
  databaseEngine?: string,
  databaseEdition?: string,
  deploymentOption?: string,
  licenseModel?: string
): Promise<ReservationDiscount | undefined> {
  const allDiscounts = await findReservationDiscounts(
    service,
    region,
    instanceType,
    'RI',
    tenancy,
    undefined, // operatingSystem (EC2のみ)
    databaseEngine,
    databaseEdition,
    deploymentOption,
    licenseModel
  );

  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 findRDSReservationDiscount: ${insuranceType}`, {
      service,
      region,
      instanceType,
      tenancy,
      totalDiscounts: allDiscounts.length,
      discounts: allDiscounts.map(d => ({
        contract_years: d.contract_years,
        payment_method: d.payment_method,
        unit_price: d.unit_price
      }))
    });
  }

  if (allDiscounts.length === 0) {
    return undefined;
  }

  // 30日保証: 3年契約NoUpfront優先
  if (insuranceType === '30d') {
    const threeYearNoUpfront = allDiscounts.find(
      d => d.contract_years === 3 && d.payment_method === 'NoUpfront'
    );
    if (threeYearNoUpfront) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Found 3-year NoUpfront for 30d:`, threeYearNoUpfront);
      }
      return threeYearNoUpfront;
    }
  }

  // 1年保証: 3年契約PartialUpfront優先
  if (insuranceType === '1y') {
    const threeYearPartialUpfront = allDiscounts.find(
      d => d.contract_years === 3 && d.payment_method === 'PartialUpfront'
    );
    if (threeYearPartialUpfront) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Found 3-year PartialUpfront for 1y:`, threeYearPartialUpfront);
      }
      return threeYearPartialUpfront;
    }
  }

  // フォールバック: 通常の優先順位
  const fallback = getBestReservationDiscount(allDiscounts);
  if (process.env.NODE_ENV === 'development') {
    console.log(`⚠️ Using fallback for ${insuranceType}:`, fallback);
  }
  return fallback;
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

  // Dedicated判定
  const isDedicated = isDedicatedUsage(costData.lineitem_usagetype);
  const tenancy = isDedicated ? 'Dedicated' : 'Shared';

  // RDS専用のRI検索（30日保証用と1年保証用で異なる契約条件）
  let riDiscount30d: ReservationDiscount | undefined;
  let riDiscount1y: ReservationDiscount | undefined;

  if (isRDSService(costData.service)) {
    // RDSの場合、コミットメント保証タイプごとに異なる契約条件で検索
    riDiscount30d = await findRDSReservationDiscount(
      costData.service,
      costData.product_region,
      costData.product_instancetype,
      tenancy,
      '30d',
      costData.product_databaseengine,
      costData.product_databaseedition,
      costData.product_deploymentoption,
      costData.product_licensemodel
    );
    riDiscount1y = await findRDSReservationDiscount(
      costData.service,
      costData.product_region,
      costData.product_instancetype,
      tenancy,
      '1y',
      costData.product_databaseengine,
      costData.product_databaseedition,
      costData.product_deploymentoption,
      costData.product_licensemodel
    );
  } else {
    // RDS以外は通常の検索
    const riDiscounts = await findReservationDiscounts(
      costData.service,
      costData.product_region,
      costData.product_instancetype,
      'RI',
      tenancy,
      costData.product_operatingsystem // EC2の場合、OS情報を渡す
    );
    const riDiscount = getBestReservationDiscount(riDiscounts);
    riDiscount30d = riDiscount;
    riDiscount1y = riDiscount;
  }

  // SP割引の検索（SPはShared/Dedicated区別なし）
  const spDiscounts = await findReservationDiscounts(
    costData.service,
    costData.product_region,
    undefined, // SPはインスタンスタイプ不問
    'SP'
  );
  const spDiscount = getBestReservationDiscount(spDiscounts);

  // RI計算用のヘルパー関数
  const calculateRICommitment = (discount: ReservationDiscount | undefined) => {
    if (!discount) {
      return {
        commitmentCost: ondemandCost,
        upfrontFee: 0,
      };
    }

    let commitmentCost: number;
    let upfrontFee: number = 0;

    // RDSの場合、API単価は既にMulti-AZ込み（プライマリ+スタンバイ）なのでそのまま使用
    if (isRDSService(costData.service)) {
      // API単価をそのまま使用（Multi-AZ込みの単価）
      commitmentCost = usageAmount * discount.unit_price;
      
      // 初期費用もそのまま使用（Multi-AZ込み）
      upfrontFee = discount.upfront_fee || 0;
      
      // デバッグログ（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 RDS RI Calculation:', {
          resourceId: costData.lineitem_resourceid,
          instanceType: costData.product_instancetype,
          paymentMethod: discount.payment_method,
          contractYears: discount.contract_years,
          isMultiAZ: isRDSMultiAZ(costData.lineitem_usagetype),
          unitPrice: discount.unit_price,
          upfrontFee: upfrontFee,
          usageAmount,
          commitmentCost,
          note: 'API単価は既にMulti-AZ込み'
        });
      }
    } else {
      // EC2など、通常の計算
      commitmentCost = usageAmount * discount.unit_price;
      upfrontFee = discount.upfront_fee || 0;
    }

    return { commitmentCost, upfrontFee };
  };

  // 30日保証用のRI計算
  const ri30dResult = calculateRICommitment(riDiscount30d);
  const riCommitmentCost30d = ri30dResult.commitmentCost;
  const riUpfrontFee30d = ri30dResult.upfrontFee;

  // 1年保証用のRI計算
  const ri1yResult = calculateRICommitment(riDiscount1y);
  const riCommitmentCost1y = ri1yResult.commitmentCost;
  const riUpfrontFee1y = ri1yResult.upfrontFee;

  // 初期費用を契約年数に応じた月数で割った額を月額コストに加算
  const contractMonths30d = riDiscount30d ? riDiscount30d.contract_years * 12 : 12;
  const contractMonths1y = riDiscount1y ? riDiscount1y.contract_years * 12 : 12;
  const monthlyUpfrontCost30d = riUpfrontFee30d / contractMonths30d;
  const monthlyUpfrontCost1y = riUpfrontFee1y / contractMonths1y;

  // 適用オンデマンドコスト
  const riAppliedOndemand = ondemandCost * params.ri_applied_rate;

  // 30日保証の計算
  const riCostReduction30d = Math.max(0, riAppliedOndemand - riCommitmentCost30d);
  const riRefund30d = riCommitmentCost30d === ondemandCost ? 0 : Math.max(0, riCommitmentCost30d - riAppliedOndemand);
  // リスクプレミアム料 = コスト削減額 × 料率（月額初期費用は含めない）
  const riInsurance30d = riCostReduction30d > 0 ? riCostReduction30d * params.insurance_rate_30d : 0;
  const riFinalPayment30d = riCommitmentCost30d + riInsurance30d + monthlyUpfrontCost30d;
  const riEffectiveDiscountRate30d = ondemandCost > 0
    ? ((ondemandCost - riFinalPayment30d) / ondemandCost) * 100
    : 0;

  // 1年保証の計算
  const riCostReduction1y = Math.max(0, riAppliedOndemand - riCommitmentCost1y);
  const riRefund1y = riCommitmentCost1y === ondemandCost ? 0 : Math.max(0, riCommitmentCost1y - riAppliedOndemand);
  // リスクプレミアム料 = コスト削減額 × 料率（月額初期費用は含めない）
  const riInsurance1y = riCostReduction1y > 0 ? riCostReduction1y * params.insurance_rate_1y : 0;
  const riFinalPayment1y = riCommitmentCost1y + riInsurance1y + monthlyUpfrontCost1y;
  const riEffectiveDiscountRate1y = ondemandCost > 0
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

  // リスクプレミアム料 = コスト削減額 × リスクプレミアム料率（コスト削減額が0以下の場合はリスクプレミアム料も0）
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

  // デバッグログ（開発時のみ）
  if (process.env.NODE_ENV === 'development' && isRDSService(costData.service)) {
    console.log('🔍 RDS Final Calculation:', {
      resourceId: costData.lineitem_resourceid,
      instanceType: costData.product_instancetype,
      '30d': {
        discount: riDiscount30d ? {
          contract: `${riDiscount30d.contract_years}年 ${riDiscount30d.payment_method}`,
          unit_price: riDiscount30d.unit_price,
          upfront_fee: riDiscount30d.upfront_fee || 0,
        } : 'なし',
        commitment_cost: riCommitmentCost30d,
        upfront_fee: riUpfrontFee30d,
        final_payment: riFinalPayment30d,
        effective_rate: riEffectiveDiscountRate30d.toFixed(2) + '%'
      },
      '1y': {
        discount: riDiscount1y ? {
          contract: `${riDiscount1y.contract_years}年 ${riDiscount1y.payment_method}`,
          unit_price: riDiscount1y.unit_price,
          upfront_fee: riDiscount1y.upfront_fee || 0,
        } : 'なし',
        commitment_cost: riCommitmentCost1y,
        upfront_fee: riUpfrontFee1y,
        final_payment: riFinalPayment1y,
        effective_rate: riEffectiveDiscountRate1y.toFixed(2) + '%'
      }
    });
  }

  return {
    costData,
    // RI（30日保証と1年保証で異なる契約を使用）
    ri_discount: riDiscount30d, // 30日保証のdiscount
    ri_discount_1y: riDiscount1y, // 1年保証のdiscount（RDS専用）
    ri_commitment_cost: riCommitmentCost30d, // 後方互換性のため残す
    ri_commitment_cost_30d: riCommitmentCost30d, // 30日保証のコミットメントコスト
    ri_commitment_cost_1y: riCommitmentCost1y, // 1年保証のコミットメントコスト
    ri_upfront_fee: riUpfrontFee30d, // 後方互換性のため残す
    ri_upfront_fee_1y: riUpfrontFee1y, // 1年保証の初期費用
    ri_monthly_upfront_30d: monthlyUpfrontCost30d, // 30日保証の月額初期費用
    ri_monthly_upfront_1y: monthlyUpfrontCost1y, // 1年保証の月額初期費用
    ri_applied_rate: params.ri_applied_rate,
    ri_cost_reduction: riCostReduction30d, // 後方互換性のため残す
    ri_cost_reduction_30d: riCostReduction30d, // 30日保証のコスト削減額
    ri_cost_reduction_1y: riCostReduction1y, // 1年保証のコスト削減額
    ri_refund: riRefund30d, // 後方互換性のため残す
    ri_refund_30d: riRefund30d, // 30日保証の返金額
    ri_refund_1y: riRefund1y, // 1年保証の返金額
    ri_insurance_30d: riInsurance30d,
    ri_insurance_1y: riInsurance1y,
    ri_final_payment_30d: riFinalPayment30d,
    ri_final_payment_1y: riFinalPayment1y,
    ri_effective_discount_rate_30d: riEffectiveDiscountRate30d,
    ri_effective_discount_rate_1y: riEffectiveDiscountRate1y,
    // SP
    sp_discount: spDiscount,
    sp_commitment_cost: spCommitmentCost,
    sp_upfront_fee: 0, // SPには初期費用なし
    sp_monthly_upfront_30d: 0, // SPには初期費用なし
    sp_monthly_upfront_1y: 0, // SPには初期費用なし
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
 * 集約キーを生成（詳細種別と混合単価を除外）
 * 
 * 集約キー:
 * - サービス (service)
 * - リソースID (lineitem_resourceid)
 * - インスタンス種別 (product_instancetype)
 * - 課金詳細 (lineitem_operation)
 * - リージョン (product_region)
 * - オンデマンド単価 (pricing_publicondemandrate)
 * 
 * 除外項目:
 * - 詳細種別 (lineitem_lineitemtype) - 集約するため
 * - 混合単価 (lineitem_unblendedrate) - Usage/DiscountedUsageで異なるため
 */
function getAggregationKey(data: AWSCostData): string {
  return [
    data.service,
    data.lineitem_resourceid,
    data.product_instancetype,
    data.lineitem_operation,
    data.product_region,
    data.pricing_publicondemandrate,
  ].join('|');
}

/**
 * コストデータを集約（詳細種別を除外してグループ化）
 */
function aggregateCostData(costDataList: AWSCostData[]): AWSCostData[] {
  const aggregationMap = new Map<string, AWSCostData>();

  for (const data of costDataList) {
    const key = getAggregationKey(data);
    
    if (aggregationMap.has(key)) {
      // 既存のエントリがある場合は、オンデマンドコストと利用量を加算
      const existing = aggregationMap.get(key)!;
      existing.ondemand_risk_cost += data.ondemand_risk_cost;
      existing.usage_amount += data.usage_amount;
    } else {
      // 新しいエントリを作成（詳細種別は空文字列にする）
      aggregationMap.set(key, {
        ...data,
        lineitem_lineitemtype: '', // 詳細種別を除外
      });
    }
  }

  return Array.from(aggregationMap.values());
}

/**
 * 複数のコストデータを集計して結果を返す（非同期版）
 */
export async function aggregateResults(
  costDataList: AWSCostData[],
  params: CalculationParams
): Promise<AggregatedResult> {
  // 現在の総コストは元データから計算（SavingsPlanCoveredUsage を除外）
  const totalCurrentCost = costDataList.reduce((sum, d) => {
    if (d.lineitem_lineitemtype === 'SavingsPlanCoveredUsage') {
      return sum;
    }
    return sum + (d.lineitem_unblendedrate * d.usage_amount);
  }, 0);

  // コミットメント計算用に集約（詳細種別を除外してグループ化）
  const aggregatedData = aggregateCostData(costDataList);

  // デバッグログ（開発時のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Data Aggregation:', {
      originalRecords: costDataList.length,
      aggregatedRecords: aggregatedData.length,
      totalCurrentCost,
    });
  }

  // 集約されたデータでコミットメント計算
  const details = await Promise.all(
    aggregatedData.map((costData) => calculateCommitmentCost(costData, params))
  );

  const totalOndemandCost = details.reduce(
    (sum, d) => sum + d.costData.ondemand_risk_cost,
    0
  );

  // RI集計
  const riTotalCommitmentCost = details.reduce(
    (sum, d) => sum + d.ri_commitment_cost,
    0
  );
  const riTotalCommitmentCost30d = details.reduce(
    (sum, d) => sum + d.ri_commitment_cost_30d,
    0
  );
  const riTotalCommitmentCost1y = details.reduce(
    (sum, d) => sum + d.ri_commitment_cost_1y,
    0
  );
  const riTotalUpfrontFee = details.reduce(
    (sum, d) => sum + d.ri_upfront_fee,
    0
  );
  const riTotalUpfrontFee30d = details.reduce(
    (sum, d) => sum + d.ri_upfront_fee,
    0
  );
  const riTotalUpfrontFee1y = details.reduce(
    (sum, d) => sum + d.ri_upfront_fee_1y,
    0
  );
  const riTotalCostReduction = details.reduce(
    (sum, d) => sum + d.ri_cost_reduction,
    0
  );
  const riTotalCostReduction30d = details.reduce(
    (sum, d) => sum + d.ri_cost_reduction_30d,
    0
  );
  const riTotalCostReduction1y = details.reduce(
    (sum, d) => sum + d.ri_cost_reduction_1y,
    0
  );
  const riTotalRefund = details.reduce((sum, d) => sum + d.ri_refund, 0);
  const riTotalRefund30d = details.reduce((sum, d) => sum + d.ri_refund_30d, 0);
  const riTotalRefund1y = details.reduce((sum, d) => sum + d.ri_refund_1y, 0);
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
  const spTotalUpfrontFee = details.reduce(
    (sum, d) => sum + d.sp_upfront_fee,
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

  // Mix集計（SPがある場合はSP、ない場合はRI）
  const mixTotalCommitmentCost = details.reduce((sum, d) => {
    // SPディスカウントがある場合はSP、ない場合はRI
    return sum + (d.sp_discount ? d.sp_commitment_cost : d.ri_commitment_cost);
  }, 0);
  
  const mixTotalCommitmentCost30d = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_commitment_cost : d.ri_commitment_cost_30d);
  }, 0);
  
  const mixTotalCommitmentCost1y = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_commitment_cost : d.ri_commitment_cost_1y);
  }, 0);
  
  const mixTotalUpfrontFee = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_upfront_fee : d.ri_upfront_fee);
  }, 0);
  
  const mixTotalUpfrontFee30d = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_upfront_fee : d.ri_upfront_fee);
  }, 0);
  
  const mixTotalUpfrontFee1y = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_upfront_fee : d.ri_upfront_fee_1y);
  }, 0);
  
  const mixTotalCostReduction = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_cost_reduction : d.ri_cost_reduction);
  }, 0);
  
  const mixTotalCostReduction30d = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_cost_reduction : d.ri_cost_reduction_30d);
  }, 0);
  
  const mixTotalCostReduction1y = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_cost_reduction : d.ri_cost_reduction_1y);
  }, 0);
  
  const mixTotalRefund = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_refund : d.ri_refund);
  }, 0);
  
  const mixTotalRefund30d = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_refund : d.ri_refund_30d);
  }, 0);
  
  const mixTotalRefund1y = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_refund : d.ri_refund_1y);
  }, 0);
  
  const mixTotalInsurance30d = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_insurance_30d : d.ri_insurance_30d);
  }, 0);
  
  const mixTotalInsurance1y = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_insurance_1y : d.ri_insurance_1y);
  }, 0);
  
  const mixTotalFinalPayment30d = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_final_payment_30d : d.ri_final_payment_30d);
  }, 0);
  
  const mixTotalFinalPayment1y = details.reduce((sum, d) => {
    return sum + (d.sp_discount ? d.sp_final_payment_1y : d.ri_final_payment_1y);
  }, 0);

  const mixAverageEffectiveDiscountRate30d =
    totalOndemandCost > 0
      ? ((totalOndemandCost - mixTotalFinalPayment30d) / totalOndemandCost) * 100
      : 0;
  const mixAverageEffectiveDiscountRate1y =
    totalOndemandCost > 0
      ? ((totalOndemandCost - mixTotalFinalPayment1y) / totalOndemandCost) * 100
      : 0;

  return {
    total_ondemand_cost: totalOndemandCost,
    total_current_cost: totalCurrentCost,
    // RI
    ri_total_commitment_cost: riTotalCommitmentCost,
    ri_total_commitment_cost_30d: riTotalCommitmentCost30d,
    ri_total_commitment_cost_1y: riTotalCommitmentCost1y,
    ri_total_upfront_fee: riTotalUpfrontFee,
    ri_total_upfront_fee_30d: riTotalUpfrontFee30d,
    ri_total_upfront_fee_1y: riTotalUpfrontFee1y,
    ri_total_cost_reduction: riTotalCostReduction,
    ri_total_cost_reduction_30d: riTotalCostReduction30d,
    ri_total_cost_reduction_1y: riTotalCostReduction1y,
    ri_total_refund: riTotalRefund,
    ri_total_refund_30d: riTotalRefund30d,
    ri_total_refund_1y: riTotalRefund1y,
    ri_total_insurance_30d: riTotalInsurance30d,
    ri_total_insurance_1y: riTotalInsurance1y,
    ri_total_final_payment_30d: riTotalFinalPayment30d,
    ri_total_final_payment_1y: riTotalFinalPayment1y,
    ri_average_effective_discount_rate_30d: riAverageEffectiveDiscountRate30d,
    ri_average_effective_discount_rate_1y: riAverageEffectiveDiscountRate1y,
    // SP
    sp_total_commitment_cost: spTotalCommitmentCost,
    sp_total_upfront_fee: spTotalUpfrontFee,
    sp_total_cost_reduction: spTotalCostReduction,
    sp_total_refund: spTotalRefund,
    sp_total_insurance_30d: spTotalInsurance30d,
    sp_total_insurance_1y: spTotalInsurance1y,
    sp_total_final_payment_30d: spTotalFinalPayment30d,
    sp_total_final_payment_1y: spTotalFinalPayment1y,
    sp_average_effective_discount_rate_30d: spAverageEffectiveDiscountRate30d,
    sp_average_effective_discount_rate_1y: spAverageEffectiveDiscountRate1y,
    // Mix
    mix_total_commitment_cost: mixTotalCommitmentCost,
    mix_total_commitment_cost_30d: mixTotalCommitmentCost30d,
    mix_total_commitment_cost_1y: mixTotalCommitmentCost1y,
    mix_total_upfront_fee: mixTotalUpfrontFee,
    mix_total_upfront_fee_30d: mixTotalUpfrontFee30d,
    mix_total_upfront_fee_1y: mixTotalUpfrontFee1y,
    mix_total_cost_reduction: mixTotalCostReduction,
    mix_total_cost_reduction_30d: mixTotalCostReduction30d,
    mix_total_cost_reduction_1y: mixTotalCostReduction1y,
    mix_total_refund: mixTotalRefund,
    mix_total_refund_30d: mixTotalRefund30d,
    mix_total_refund_1y: mixTotalRefund1y,
    mix_total_insurance_30d: mixTotalInsurance30d,
    mix_total_insurance_1y: mixTotalInsurance1y,
    mix_total_final_payment_30d: mixTotalFinalPayment30d,
    mix_total_final_payment_1y: mixTotalFinalPayment1y,
    mix_average_effective_discount_rate_30d: mixAverageEffectiveDiscountRate30d,
    mix_average_effective_discount_rate_1y: mixAverageEffectiveDiscountRate1y,
    details,
  };
}
