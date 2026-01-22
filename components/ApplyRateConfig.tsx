'use client';

import { useState } from 'react';

interface ApplyRateConfigProps {
  onRateChange: (riRate: number, spRate: number) => void;
}

export default function ApplyRateConfig({ onRateChange }: ApplyRateConfigProps) {
  const [riRate, setRiRate] = useState(100);
  const [spRate, setSpRate] = useState(100);

  const handleRiChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setRiRate(value);
    onRateChange(value / 100, spRate / 100);
  };

  const handleSpChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setSpRate(value);
    onRateChange(riRate / 100, value / 100);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        ⚙️ 適用率の設定
      </h2>

      <div className="space-y-6">
        {/* RI適用率 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="ri-rate"
              className="text-sm font-medium text-gray-700"
            >
              RI (Reserved Instance) 適用率
            </label>
            <span className="text-lg font-bold text-primary-600">
              {riRate}%
            </span>
          </div>
          <input
            id="ri-rate"
            type="range"
            min="0"
            max="100"
            step="5"
            value={riRate}
            onChange={handleRiChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* SP適用率 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="sp-rate"
              className="text-sm font-medium text-gray-700"
            >
              SP (Savings Plans) 適用率
            </label>
            <span className="text-lg font-bold text-secondary-600">
              {spRate}%
            </span>
          </div>
          <input
            id="sp-rate"
            type="range"
            min="0"
            max="100"
            step="5"
            value={spRate}
            onChange={handleSpChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-secondary-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          適用率について
        </h3>
        <p className="text-xs text-gray-600">
          適用率は、オンデマンドコストに対してどの程度の割合でコミットメント割引を適用するかを設定します。
          100%に設定すると、全てのコストに対して最大限の割引が適用されます。
        </p>
      </div>
    </div>
  );
}
