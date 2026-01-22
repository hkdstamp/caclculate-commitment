'use client';

import { useState } from 'react';
import { AggregatedResult } from '@/lib/types';

interface ResultsTableProps {
  results: AggregatedResult;
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [reservationType, setReservationType] = useState<'RI' | 'SP'>('RI');
  const [insuranceType, setInsuranceType] = useState<'30d' | '1y'>('30d');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        📋 詳細結果テーブル
      </h2>

      {/* フィルター */}
      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">
            予約タイプ:
          </label>
          <select
            value={reservationType}
            onChange={(e) => setReservationType(e.target.value as 'RI' | 'SP')}
            className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
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

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                サービス
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                リージョン
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                インスタンスタイプ
              </th>
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
              const is30d = insuranceType === '30d';

              const discount = isRI ? detail.ri_discount : detail.sp_discount;
              const commitmentCost = isRI
                ? detail.ri_commitment_cost
                : detail.sp_commitment_cost;
              const appliedRate = isRI
                ? detail.ri_applied_rate
                : detail.sp_applied_rate;
              const costReduction = isRI
                ? detail.ri_cost_reduction
                : detail.sp_cost_reduction;
              const refund = isRI ? detail.ri_refund : detail.sp_refund;
              const insurance = isRI
                ? is30d
                  ? detail.ri_insurance_30d
                  : detail.ri_insurance_1y
                : is30d
                ? detail.sp_insurance_30d
                : detail.sp_insurance_1y;
              const finalPayment = isRI
                ? is30d
                  ? detail.ri_final_payment_30d
                  : detail.ri_final_payment_1y
                : is30d
                ? detail.sp_final_payment_30d
                : detail.sp_final_payment_1y;
              const effectiveRate = isRI
                ? is30d
                  ? detail.ri_effective_discount_rate_30d
                  : detail.ri_effective_discount_rate_1y
                : is30d
                ? detail.sp_effective_discount_rate_30d
                : detail.sp_effective_discount_rate_1y;

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {detail.costData.service}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {detail.costData.product_region}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {detail.costData.product_instancetype || '-'}
                  </td>
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
                    {detail.costData.usage_amount.toFixed(2)}
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
