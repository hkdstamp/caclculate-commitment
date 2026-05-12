'use client';

import { useState } from 'react';
import CSVUpload from '@/components/CSVUpload';
import ApplyRateConfig from '@/components/ApplyRateConfig';
import ResultsSummary from '@/components/ResultsSummary';
import ResultsTable from '@/components/ResultsTable';
import { AWSCostData, AggregatedResult } from '@/lib/types';

export default function Home() {
  const [costData, setCostData] = useState<AWSCostData[]>([]);
  const [riRate, setRiRate] = useState(1.0);
  const [spRate, setSpRate] = useState(1.0);
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

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

  const handleClearCache = async () => {
    setCacheClearing(true);
    setCacheMessage(null);
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      const data = await res.json();
      setCacheMessage(data.message ?? (data.ok ? 'キャッシュをクリアしました' : data.error));
    } catch {
      setCacheMessage('キャッシュクリアに失敗しました');
    } finally {
      setCacheClearing(false);
      setTimeout(() => setCacheMessage(null), 5000);
    }
  };

  const calculateResults = async (
    data: AWSCostData[],
    riAppliedRate: number,
    spAppliedRate: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      // サーバーサイドAPI経由で計算
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          costData: data,
          params: {
            ri_applied_rate: riAppliedRate,
            sp_applied_rate: spAppliedRate,
            insurance_rate_30d: 0.5, // 30日プラン: 50%
            insurance_rate_1y: 0.3,  // 1年プラン: 30%
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Calculation failed');
      }

      const calculatedResults = await response.json();
      setResults(calculatedResults);
    } catch (error) {
      console.error('Error calculating results:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* ツールバー */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleClearCache}
          disabled={cacheClearing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="価格データのキャッシュを強制クリアします。次回計算時にBigQueryから最新データを取得します。"
        >
          {cacheClearing ? (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
          価格キャッシュをクリア
        </button>
      </div>

      {/* キャッシュクリア結果メッセージ */}
      {cacheMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-blue-800 text-sm">{cacheMessage}</p>
        </div>
      )}

      {/* 説明セクション */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          使い方
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>AWSコストデータのCSVファイルをアップロードします</li>
          <li>システムが自動的にRI（Reserved Instance）とSP（Savings Plans）の最適な割引プランを検索します</li>
          <li>適用率を調整して、コミットメント割引の適用度合いを設定します</li>
          <li>スマート予約利用料（30日プラン: 50%、1年プラン: 30%）を含めた最終支払額と実効割引率を確認します</li>
        </ol>
      </div>

      {/* CSVアップロード */}
      <CSVUpload onDataLoaded={handleDataLoaded} />

      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">
            エラー: {error}
          </p>
        </div>
      )}

      {/* データがロードされている場合のみ表示 */}
      {costData.length > 0 && (
        <>
          {/* データ読み込み成功メッセージ */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              {costData.length} 件のコストデータを読み込みました
            </p>
          </div>

          {/* 適用率設定 */}
          <ApplyRateConfig onRateChange={handleRateChange} />

          {/* ローディング表示 */}
          {loading && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center mb-6">
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-12 w-12 text-primary-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <p className="text-lg text-gray-700 mt-4">
                予約割引コストを計算中...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                AWS Price List APIから最新価格を取得しています
              </p>
            </div>
          )}

          {/* 結果表示 */}
          {!loading && results && (
            <>
              <ResultsSummary results={results} riRate={riRate} spRate={spRate} />
              <ResultsTable results={results} />
            </>
          )}
        </>
      )}

      {/* データが未ロードの場合 */}
      {costData.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            CSVファイルをアップロードしてください
          </h3>
          <p className="text-gray-500">
            AWSコストデータのCSVファイルをアップロードすると、<br />
            自動的に予約割引コストを計算します。
          </p>
        </div>
      )}
    </div>
  );
}
