'use client';

import { AggregatedResult } from '@/lib/types';

interface ResultsSummaryProps {
  results: AggregatedResult;
  riRate: number;
  spRate: number;
}

export default function ResultsSummary({ results, riRate, spRate }: ResultsSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">
          コスト最適化サマリー
        </h2>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">RI適用率</span>
            <span className="font-semibold text-gray-900">{(riRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">SP適用率</span>
            <span className="font-semibold text-gray-900">{(spRate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* オンデマンドコストと現在のコスト */}
      <div className="mb-8 grid md:grid-cols-2 gap-4">
        <div className="p-5 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">
            総オンデマンドコスト
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(results.total_ondemand_cost)}
          </p>
        </div>
        
        <div className="p-5 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700 mb-1">
            現在の総コスト
          </p>
          <p className="text-2xl font-bold text-blue-900">
            {formatCurrency(results.total_current_cost)}
          </p>
        </div>
      </div>

      {/* 3パターンのカード */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Mix */}
        <div className="border-2 border-purple-500 rounded-lg overflow-hidden">
          <div className="bg-purple-500 px-5 py-3">
            <h3 className="text-lg font-bold text-white">
              Mix (RI + SP)
            </h3>
          </div>
          
          <div className="p-5 space-y-4">
            {/* 30日保証 */}
            <div className="pb-4 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                30日保証プラン
              </p>
              
              {/* 実効割引率 - 強調表示 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 mb-3">
                <p className="text-xs text-purple-700 mb-1">実効割引率</p>
                <p className="text-3xl font-bold text-purple-900">
                  {formatPercent(results.mix_average_effective_discount_rate_30d)}
                </p>
              </div>
              
              {/* 最終支払額 - 強調表示 */}
              <div className="bg-purple-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-purple-700 mb-1">最終支払額</p>
                <p className="text-xl font-bold text-purple-900">
                  {formatCurrency(results.mix_total_final_payment_30d)}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">初期費用（別途）</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(results.mix_total_upfront_fee_30d)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">コミットメントコスト</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.mix_total_commitment_cost_30d)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保険料 (50%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.mix_total_insurance_30d)}
                  </span>
                </div>
              </div>
            </div>

            {/* 1年保証 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                1年保証プラン
              </p>
              
              {/* 実効割引率 - 強調表示 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 mb-3">
                <p className="text-xs text-purple-700 mb-1">実効割引率</p>
                <p className="text-3xl font-bold text-purple-900">
                  {formatPercent(results.mix_average_effective_discount_rate_1y)}
                </p>
              </div>
              
              {/* 最終支払額 - 強調表示 */}
              <div className="bg-purple-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-purple-700 mb-1">最終支払額</p>
                <p className="text-xl font-bold text-purple-900">
                  {formatCurrency(results.mix_total_final_payment_1y)}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">初期費用（別途）</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(results.mix_total_upfront_fee_1y)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">コミットメントコスト</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.mix_total_commitment_cost_1y)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保険料 (30%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.mix_total_insurance_1y)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RI */}
        <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
          <div className="bg-blue-500 px-5 py-3">
            <h3 className="text-lg font-bold text-white">
              Reserved Instance (RI)
            </h3>
          </div>
          
          <div className="p-5 space-y-4">
            {/* 30日保証 */}
            <div className="pb-4 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                30日保証プラン
              </p>
              
              {/* 実効割引率 - 強調表示 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 mb-3">
                <p className="text-xs text-blue-700 mb-1">実効割引率</p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatPercent(results.ri_average_effective_discount_rate_30d)}
                </p>
              </div>
              
              {/* 最終支払額 - 強調表示 */}
              <div className="bg-blue-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-700 mb-1">最終支払額</p>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(results.ri_total_final_payment_30d)}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">初期費用（別途）</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(results.ri_total_upfront_fee_30d)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">コミットメントコスト</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.ri_total_commitment_cost_30d)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保険料 (50%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.ri_total_insurance_30d)}
                  </span>
                </div>
              </div>
            </div>

            {/* 1年保証 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                1年保証プラン
              </p>
              
              {/* 実効割引率 - 強調表示 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 mb-3">
                <p className="text-xs text-blue-700 mb-1">実効割引率</p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatPercent(results.ri_average_effective_discount_rate_1y)}
                </p>
              </div>
              
              {/* 最終支払額 - 強調表示 */}
              <div className="bg-blue-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-700 mb-1">最終支払額</p>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(results.ri_total_final_payment_1y)}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">初期費用（別途）</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(results.ri_total_upfront_fee_1y)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">コミットメントコスト</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.ri_total_commitment_cost_1y)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保険料 (30%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.ri_total_insurance_1y)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SP */}
        <div className="border-2 border-green-500 rounded-lg overflow-hidden">
          <div className="bg-green-500 px-5 py-3">
            <h3 className="text-lg font-bold text-white">
              Savings Plans (SP)
            </h3>
          </div>
          
          <div className="p-5 space-y-4">
            {/* 30日保証 */}
            <div className="pb-4 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                30日保証プラン
              </p>
              
              {/* 実効割引率 - 強調表示 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 mb-3">
                <p className="text-xs text-green-700 mb-1">実効割引率</p>
                <p className="text-3xl font-bold text-green-900">
                  {formatPercent(results.sp_average_effective_discount_rate_30d)}
                </p>
              </div>
              
              {/* 最終支払額 - 強調表示 */}
              <div className="bg-green-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-700 mb-1">最終支払額</p>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(results.sp_total_final_payment_30d)}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">初期費用（別途）</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(results.sp_total_upfront_fee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">コミットメントコスト</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.sp_total_commitment_cost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保険料 (50%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.sp_total_insurance_30d)}
                  </span>
                </div>
              </div>
            </div>

            {/* 1年保証 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                1年保証プラン
              </p>
              
              {/* 実効割引率 - 強調表示 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 mb-3">
                <p className="text-xs text-green-700 mb-1">実効割引率</p>
                <p className="text-3xl font-bold text-green-900">
                  {formatPercent(results.sp_average_effective_discount_rate_1y)}
                </p>
              </div>
              
              {/* 最終支払額 - 強調表示 */}
              <div className="bg-green-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-700 mb-1">最終支払額</p>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(results.sp_total_final_payment_1y)}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">初期費用（別途）</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(results.sp_total_upfront_fee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">コミットメントコスト</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.sp_total_commitment_cost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">保険料 (30%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(results.sp_total_insurance_1y)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
