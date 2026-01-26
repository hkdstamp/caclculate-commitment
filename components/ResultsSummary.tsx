'use client';

import { AggregatedResult } from '@/lib/types';

interface ResultsSummaryProps {
  results: AggregatedResult;
}

export default function ResultsSummary({ results }: ResultsSummaryProps) {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        📈 コスト最適化サマリー
      </h2>

      {/* オンデマンドコストと現在のコスト */}
      <div className="mb-6 grid md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">
            総オンデマンドコスト
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(results.total_ondemand_cost)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            リスクコストベース
          </p>
        </div>
        
        <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-700 mb-1">
            現在の総コスト
          </h3>
          <p className="text-2xl font-bold text-blue-900">
            {formatCurrency(results.total_current_cost)}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            混合単価 × 利用量
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* RI結果 */}
        <div className="border-2 border-primary-300 rounded-lg p-5 bg-primary-50">
          <h3 className="text-xl font-bold text-primary-800 mb-4 flex items-center">
            <span className="mr-2">🔹</span>
            Reserved Instance (RI)
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">コミットメントコスト</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(results.ri_total_commitment_cost)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">コスト削減額</span>
              <span className="font-semibold text-green-600">
                -{formatCurrency(results.ri_total_cost_reduction)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">返金額</span>
              <span className="font-semibold text-blue-600">
                {formatCurrency(results.ri_total_refund)}
              </span>
            </div>

            <hr className="border-gray-300" />

            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                30日保証プラン
              </p>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">保険料 (50%)</span>
                <span className="text-sm font-medium">
                  {formatCurrency(results.ri_total_insurance_30d)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">最終支払額</span>
                <span className="text-sm font-bold text-primary-700">
                  {formatCurrency(results.ri_total_final_payment_30d)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">実効割引率</span>
                <span className="text-sm font-bold text-green-600">
                  {formatPercent(results.ri_average_effective_discount_rate_30d)}
                </span>
              </div>
            </div>

            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                1年保証プラン
              </p>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">保険料 (30%)</span>
                <span className="text-sm font-medium">
                  {formatCurrency(results.ri_total_insurance_1y)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">最終支払額</span>
                <span className="text-sm font-bold text-primary-700">
                  {formatCurrency(results.ri_total_final_payment_1y)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">実効割引率</span>
                <span className="text-sm font-bold text-green-600">
                  {formatPercent(results.ri_average_effective_discount_rate_1y)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SP結果 */}
        <div className="border-2 border-secondary-300 rounded-lg p-5 bg-secondary-50">
          <h3 className="text-xl font-bold text-secondary-800 mb-4 flex items-center">
            <span className="mr-2">💎</span>
            Savings Plans (SP)
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">コミットメントコスト</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(results.sp_total_commitment_cost)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">コスト削減額</span>
              <span className="font-semibold text-green-600">
                -{formatCurrency(results.sp_total_cost_reduction)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">返金額</span>
              <span className="font-semibold text-blue-600">
                {formatCurrency(results.sp_total_refund)}
              </span>
            </div>

            <hr className="border-gray-300" />

            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                30日保証プラン
              </p>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">保険料 (50%)</span>
                <span className="text-sm font-medium">
                  {formatCurrency(results.sp_total_insurance_30d)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">最終支払額</span>
                <span className="text-sm font-bold text-secondary-700">
                  {formatCurrency(results.sp_total_final_payment_30d)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">実効割引率</span>
                <span className="text-sm font-bold text-green-600">
                  {formatPercent(results.sp_average_effective_discount_rate_30d)}
                </span>
              </div>
            </div>

            <div className="bg-white rounded p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                1年保証プラン
              </p>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">保険料 (30%)</span>
                <span className="text-sm font-medium">
                  {formatCurrency(results.sp_total_insurance_1y)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">最終支払額</span>
                <span className="text-sm font-bold text-secondary-700">
                  {formatCurrency(results.sp_total_final_payment_1y)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">実効割引率</span>
                <span className="text-sm font-bold text-green-600">
                  {formatPercent(results.sp_average_effective_discount_rate_1y)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
