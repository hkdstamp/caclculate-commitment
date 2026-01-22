'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { AWSCostData } from '@/lib/types';

interface CSVUploadProps {
  onDataLoaded: (data: AWSCostData[]) => void;
}

export default function CSVUpload({ onDataLoaded }: CSVUploadProps) {
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setError('');

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedData: AWSCostData[] = results.data.map((row, index) => {
            // 必須フィールドのバリデーション
            if (!row.account_id || !row.service) {
              throw new Error(`行 ${index + 1}: 必須フィールドが不足しています`);
            }

            return {
              account_id: row.account_id,
              service: row.service,
              lineitem_resourceid: row.lineitem_resourceid || '',
              product_instancetype: row.product_instancetype || '',
              lineitem_operation: row.lineitem_operation || '',
              lineitem_usagetype: row.lineitem_usagetype || '',
              product_region: row.product_region || '',
              lineitem_lineitemtype: row.lineitem_lineitemtype || '',
              pricing_publicondemandrate: parseFloat(row.pricing_publicondemandrate || '0'),
              lineitem_unblendedrate: parseFloat(row.lineitem_unblendedrate || '0'),
              ondemand_risk_cost: parseFloat(row.ondemand_risk_cost || '0'),
              usage_amount: parseFloat(row.usage_amount || '0'),
            };
          });

          onDataLoaded(parsedData);
          setLoading(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'データの解析に失敗しました');
          setLoading(false);
        }
      },
      error: (err) => {
        setError(`CSVの読み込みに失敗しました: ${err.message}`);
        setLoading(false);
      },
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        📊 AWSコストデータのアップロード
      </h2>
      
      <div className="mb-4">
        <label
          htmlFor="csv-upload"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          CSVファイルを選択
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 p-2"
        />
      </div>

      {fileName && (
        <div className="text-sm text-gray-600 mb-2">
          選択されたファイル: <span className="font-medium">{fileName}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center text-primary-600">
          <svg
            className="animate-spin h-5 w-5 mr-2"
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
          データを読み込み中...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">エラー</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          CSVフォーマット
        </h3>
        <div className="text-xs text-blue-800 space-y-1">
          <p>• account_id: アカウントID</p>
          <p>• service: サービス名</p>
          <p>• lineitem_resourceid: リソースID</p>
          <p>• product_instancetype: インスタンス種別</p>
          <p>• lineitem_operation: 課金操作種別</p>
          <p>• lineitem_usagetype: 課金詳細</p>
          <p>• product_region: リージョン</p>
          <p>• lineitem_lineitemtype: 課金種別</p>
          <p>• pricing_publicondemandrate: オンデマンド単価</p>
          <p>• lineitem_unblendedrate: 混合単価</p>
          <p>• ondemand_risk_cost: オンデマンドコスト</p>
          <p>• usage_amount: 利用量（時間、または、実行数）</p>
        </div>
      </div>
    </div>
  );
}
