'use client';

import { useState } from 'react';
import { AggregatedResult } from '@/lib/types';

interface ResultsTableProps {
  results: AggregatedResult;
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [reservationType, setReservationType] = useState<'RI' | 'SP' | 'Mix'>('Mix');
  const [insuranceType, setInsuranceType] = useState<'30d' | '1y'>('30d');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(3)}%`;
  };

  const downloadCSV = () => {
    const isRI = reservationType === 'RI';
    const isSP = reservationType === 'SP';
    const isMix = reservationType === 'Mix';
    const is30d = insuranceType === '30d';

    // CSVヘッダー
    const headers = [
      'サービス',
      'リソースID',
      'リージョン',
      'インスタンスタイプ',
      ...(isMix ? ['種別'] : []), // Mixの場合のみ種別列を追加
      '契約年数',
      '支払方法',
      '単価',
      '利用量',
      'オンデマンドコスト',
      'コミットメントコスト',
      '適用率',
      'コスト削減額',
      '返金額',
      '保険料',
      '最終支払額',
      '実効割引率',
    ];

    // CSVデータ行
    const rows = results.details.map((detail) => {
      let discount, commitmentCost, appliedRate, costReduction, refund, insurance, finalPayment, effectiveRate;
      
      if (isMix) {
        // Mix: SPがある場合はSP、ない場合はRI
        const useSP = !!detail.sp_discount;
        // RIの場合、1年保証は ri_discount_1y を、30日保証は ri_discount を使用
        discount = useSP ? detail.sp_discount : (is30d ? detail.ri_discount : detail.ri_discount_1y);
        commitmentCost = useSP ? detail.sp_commitment_cost : detail.ri_commitment_cost;
        appliedRate = useSP ? detail.sp_applied_rate : detail.ri_applied_rate;
        costReduction = useSP ? detail.sp_cost_reduction : detail.ri_cost_reduction;
        refund = useSP ? detail.sp_refund : detail.ri_refund;
        insurance = useSP
          ? (is30d ? detail.sp_insurance_30d : detail.sp_insurance_1y)
          : (is30d ? detail.ri_insurance_30d : detail.ri_insurance_1y);
        finalPayment = useSP
          ? (is30d ? detail.sp_final_payment_30d : detail.sp_final_payment_1y)
          : (is30d ? detail.ri_final_payment_30d : detail.ri_final_payment_1y);
        effectiveRate = useSP
          ? (is30d ? detail.sp_effective_discount_rate_30d : detail.sp_effective_discount_rate_1y)
          : (is30d ? detail.ri_effective_discount_rate_30d : detail.ri_effective_discount_rate_1y);
      } else {
        // RIの場合、1年保証は ri_discount_1y を、30日保証は ri_discount を使用
        discount = isRI 
          ? (is30d ? detail.ri_discount : detail.ri_discount_1y)
          : detail.sp_discount;
        commitmentCost = isRI ? detail.ri_commitment_cost : detail.sp_commitment_cost;
        appliedRate = isRI ? detail.ri_applied_rate : detail.sp_applied_rate;
        costReduction = isRI ? detail.ri_cost_reduction : detail.sp_cost_reduction;
        refund = isRI ? detail.ri_refund : detail.sp_refund;
        insurance = isRI
          ? (is30d ? detail.ri_insurance_30d : detail.ri_insurance_1y)
          : (is30d ? detail.sp_insurance_30d : detail.sp_insurance_1y);
        finalPayment = isRI
          ? (is30d ? detail.ri_final_payment_30d : detail.ri_final_payment_1y)
          : (is30d ? detail.sp_final_payment_30d : detail.sp_final_payment_1y);
        effectiveRate = isRI
          ? (is30d ? detail.ri_effective_discount_rate_30d : detail.ri_effective_discount_rate_1y)
          : (is30d ? detail.sp_effective_discount_rate_30d : detail.sp_effective_discount_rate_1y);
      }

      return [
        detail.costData.service,
        detail.costData.lineitem_resourceid || '-',
        detail.costData.product_region,
        detail.costData.product_instancetype || '-',
        ...(isMix ? [detail.sp_discount ? 'SP' : 'RI'] : []), // Mixの場合のみ種別を追加
        discount ? `${discount.contract_years}年` : '-',
        discount ? discount.payment_method : '-',
        discount ? discount.unit_price.toFixed(4) : '-',
        detail.costData.usage_amount.toFixed(3),
        detail.costData.ondemand_risk_cost.toFixed(3),
        commitmentCost.toFixed(3),
        (appliedRate * 100).toFixed(3),
        costReduction.toFixed(3),
        refund.toFixed(3),
        insurance.toFixed(3),
        finalPayment.toFixed(3),
        effectiveRate.toFixed(3),
      ];
    });

    // CSV文字列を生成
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // BOMを追加（Excel対応）
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    // ダウンロード
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `commitment-cost-${reservationType.toLowerCase()}-${insuranceType}-${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        詳細結果テーブル
      </h2>

      {/* フィルターとダウンロードボタン */}
      <div className="flex gap-4 mb-4 items-center justify-between">
        <div className="flex gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">
              予約タイプ:
            </label>
            <select
              value={reservationType}
              onChange={(e) => setReservationType(e.target.value as 'RI' | 'SP' | 'Mix')}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="Mix">Mix (RI + SP)</option>
              <option value="RI">Reserved Instance (RI)</option>
              <option value="SP">Savings Plans (SP)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">
              保険プラン:
            </label>
            <select
              value={insuranceType}
              onChange={(e) => setInsuranceType(e.target.value as '30d' | '1y')}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="30d">30日保証 (50%)</option>
              <option value="1y">1年保証 (30%)</option>
            </select>
          </div>
        </div>

        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
        >
          CSVダウンロード
        </button>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                サービス
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                リソースID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                リージョン
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                インスタンスタイプ
              </th>
              {reservationType === 'Mix' && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  種別
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                契約年数
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                支払方法
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                単価
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                利用量
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                オンデマンドコスト
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                コミットメントコスト
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                適用率
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                コスト削減額
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                返金額
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                保険料
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                最終支払額
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                実効割引率
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.details.map((detail, index) => {
              const isRI = reservationType === 'RI';
              const isSP = reservationType === 'SP';
              const isMix = reservationType === 'Mix';
              const is30d = insuranceType === '30d';

              let discount, commitmentCost, appliedRate, costReduction, refund, insurance, finalPayment, effectiveRate;

              if (isMix) {
                // Mix: SPがある場合はSP、ない場合はRI
                const useSP = !!detail.sp_discount;
                // RIの場合、1年保証は ri_discount_1y を、30日保証は ri_discount を使用
                discount = useSP ? detail.sp_discount : (is30d ? detail.ri_discount : detail.ri_discount_1y);
                commitmentCost = useSP ? detail.sp_commitment_cost : detail.ri_commitment_cost;
                appliedRate = useSP ? detail.sp_applied_rate : detail.ri_applied_rate;
                costReduction = useSP ? detail.sp_cost_reduction : detail.ri_cost_reduction;
                refund = useSP ? detail.sp_refund : detail.ri_refund;
                insurance = useSP
                  ? (is30d ? detail.sp_insurance_30d : detail.sp_insurance_1y)
                  : (is30d ? detail.ri_insurance_30d : detail.ri_insurance_1y);
                finalPayment = useSP
                  ? (is30d ? detail.sp_final_payment_30d : detail.sp_final_payment_1y)
                  : (is30d ? detail.ri_final_payment_30d : detail.ri_final_payment_1y);
                effectiveRate = useSP
                  ? (is30d ? detail.sp_effective_discount_rate_30d : detail.sp_effective_discount_rate_1y)
                  : (is30d ? detail.ri_effective_discount_rate_30d : detail.ri_effective_discount_rate_1y);
              } else {
                // RIの場合、1年保証は ri_discount_1y を、30日保証は ri_discount を使用
                discount = isRI 
                  ? (is30d ? detail.ri_discount : detail.ri_discount_1y)
                  : detail.sp_discount;
                commitmentCost = isRI ? detail.ri_commitment_cost : detail.sp_commitment_cost;
                appliedRate = isRI ? detail.ri_applied_rate : detail.sp_applied_rate;
                costReduction = isRI ? detail.ri_cost_reduction : detail.sp_cost_reduction;
                refund = isRI ? detail.ri_refund : detail.sp_refund;
                insurance = isRI
                  ? (is30d ? detail.ri_insurance_30d : detail.ri_insurance_1y)
                  : (is30d ? detail.sp_insurance_30d : detail.sp_insurance_1y);
                finalPayment = isRI
                  ? (is30d ? detail.ri_final_payment_30d : detail.ri_final_payment_1y)
                  : (is30d ? detail.sp_final_payment_30d : detail.sp_final_payment_1y);
                effectiveRate = isRI
                  ? (is30d ? detail.ri_effective_discount_rate_30d : detail.ri_effective_discount_rate_1y)
                  : (is30d ? detail.sp_effective_discount_rate_30d : detail.sp_effective_discount_rate_1y);
              }

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {detail.costData.service}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 text-xs">
                    {detail.costData.lineitem_resourceid || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {detail.costData.product_region}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {detail.costData.product_instancetype || '-'}
                  </td>
                  {isMix && (
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {detail.sp_discount ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          SP
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          RI
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {discount ? `${discount.contract_years}年` : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {discount ? discount.payment_method : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {discount ? formatCurrency(discount.unit_price) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {detail.costData.usage_amount.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(detail.costData.ondemand_risk_cost)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(commitmentCost)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {formatPercent(appliedRate * 100)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-green-600 font-medium">
                    {formatCurrency(costReduction)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-blue-600 font-medium">
                    {formatCurrency(refund)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                    {formatCurrency(insurance)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-gray-900">
                    {formatCurrency(finalPayment)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-green-600">
                    {formatPercent(effectiveRate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {results.details.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          データがありません
        </div>
      )}
    </div>
  );
}
