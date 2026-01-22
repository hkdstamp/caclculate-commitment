'use client';

import { useState } from 'react';
import CSVUpload from '@/components/CSVUpload';
import ApplyRateConfig from '@/components/ApplyRateConfig';
import ResultsSummary from '@/components/ResultsSummary';
import ResultsTable from '@/components/ResultsTable';
import { AWSCostData, AggregatedResult } from '@/lib/types';
import { aggregateResults } from '@/lib/calculator';

export default function Home() {
  const [costData, setCostData] = useState<AWSCostData[]>([]);
  const [riRate, setRiRate] = useState(1.0);
  const [spRate, setSpRate] = useState(1.0);
  const [results, setResults] = useState<AggregatedResult | null>(null);

  const handleDataLoaded = (data: AWSCostData[]) => {
    setCostData(data);
    calculateResults(data, riRate, spRate);
  };

  const handleRateChange = (newRiRate: number, newSpRate: number) => {
    setRiRate(newRiRate);
    setSpRate(newSpRate);
    if (costData.length > 0) {
      calculateResults(costData, newRiRate, newSpRate);
    }
  };

  const calculateResults = (
    data: AWSCostData[],
    riAppliedRate: number,
    spAppliedRate: number
  ) => {
    const calculatedResults = aggregateResults(data, {
      ri_applied_rate: riAppliedRate,
      sp_applied_rate: spAppliedRate,
      insurance_rate_30d: 0.5, // 30日保証: 50%
      insurance_rate_1y: 0.3,  // 1年保証: 30%
    });
    setResults(calculatedResults);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* 説明セクション */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-blue-900 mb-2">
          🚀 使い方
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>AWSコストデータのCSVファイルをアップロードします</li>
          <li>システムが自動的にRI（Reserved Instance）とSP（Savings Plans）の最適な割引プランを検索します</li>
          <li>適用率を調整して、コミットメント割引の適用度合いを設定します</li>
          <li>保険料（30日保証: 50%、1年保証: 30%）を含めた最終支払額と実効割引率を確認します</li>
        </ol>
      </div>

      {/* CSVアップロード */}
      <CSVUpload onDataLoaded={handleDataLoaded} />

      {/* データがロードされている場合のみ表示 */}
      {costData.length > 0 && (
        <>
          {/* データ読み込み成功メッセージ */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              ✅ {costData.length} 件のコストデータを読み込みました
            </p>
          </div>

          {/* 適用率設定 */}
          <ApplyRateConfig onRateChange={handleRateChange} />

          {/* 結果表示 */}
          {results && (
            <>
              <ResultsSummary results={results} />
              <ResultsTable results={results} />
            </>
          )}
        </>
      )}

      {/* データが未ロードの場合 */}
      {costData.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            CSVファイルをアップロードしてください
          </h3>
          <p className="text-gray-500">
            AWSコストデータのCSVファイルをアップロードすると、<br />
            自動的にコミットメントコストを計算します。
          </p>
        </div>
      )}
    </div>
  );
}
