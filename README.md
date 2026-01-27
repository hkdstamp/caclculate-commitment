# 💰 コミットメント見積ツール

AWS Reserved Instance (RI) と Savings Plans (SP) のコスト最適化を行うための見積ツールです。

## 🌟 概要

このツールは、AWSのコストデータ（CSV形式）をアップロードすることで、Reserved InstanceとSavings Plansを適用した場合のコスト削減額、保険料、最終支払額、実効割引率を自動計算します。

### 主な機能

- ✅ **CSVアップロード**: AWSコストデータのCSVファイルを簡単にアップロード
- ✅ **自動割引検索**: サービス、インスタンスタイプ、リージョンに基づいて最適な割引プランを自動検索
- ✅ **RI & SP 両方対応**: Reserved InstanceとSavings Plansの両方を計算
- ✅ **適用率調整**: RI/SP個別に0%～100%の適用率を設定可能
- ✅ **保険料計算**: 30日保証（50%）と1年保証（30%）の保険料を含めた計算
- ✅ **詳細レポート**: コスト削減額、返金額、実効割引率などを詳細に表示
- ✅ **インタラクティブUI**: リアルタイムで結果が更新される直感的なインターフェース

## 🚀 使い方

### 1. CSVデータのアップロード

以下の形式のCSVファイルをアップロードします：

```csv
account_id,service,lineitem_resourceid,product_instancetype,lineitem_operation,lineitem_usagetype,product_region,lineitem_lineitemtype,pricing_publicondemandrate,lineitem_unblendedrate,ondemand_risk_cost,usage_amount
123456789012,Amazon Elastic Compute Cloud,i-0123456789abcdef0,t3.medium,RunInstances,BoxUsage:t3.medium,ap-northeast-1,Usage,0.0460,0.0460,33.60,730
```

**必須カラム:**
- `account_id`: アカウントID
- `service`: サービス名
- `lineitem_resourceid`: リソースID
- `product_instancetype`: インスタンス種別
- `lineitem_operation`: 課金操作種別
- `lineitem_usagetype`: 課金詳細
- `product_region`: リージョン
- `lineitem_lineitemtype`: 課金種別
- `pricing_publicondemandrate`: オンデマンド単価
- `lineitem_unblendedrate`: 混合単価
- `ondemand_risk_cost`: オンデマンドコスト
- `usage_amount`: 利用量（時間、または実行数）

サンプルCSVファイル: [`public/sample-data.csv`](/public/sample-data.csv)

#### BigQueryでCSVデータを生成する（サンプルクエリ）

AWS Cost and Usage Reportデータから、このツールに必要なCSVを生成するBigQueryクエリのサンプル：

```sql
-- 予約可能サービスの抽出
SELECT
  -- bill_billing_period_start_date as billing_month,
  lineitem_usageaccountid AS account_id,
  lineitem_productcode AS service,
  lineitem_resourceid,
  product_instancetype,
  lineitem_operation,
  lineitem_usagetype,
  product_region,
  lineitem_lineitemtype,
  pricing_publicondemandrate,
  lineitem_unblendedrate,
  -- 利用量
  SUM(lineitem_unblendedcost) AS uc,
  SUM(CAST(pricing_publicondemandrate AS FLOAT64) * lineitem_usageamount) AS ondemand_risk_cost,
  SUM(lineitem_usageamount) AS usage_amount
FROM 
  `mobingi-main.mspid.202512_accountid`
WHERE 
  lineitem_usageaccountid = '325215378246'
  -- RI/割引の対象となるサービス
  AND (
    -- EC2
    (lineitem_productcode = 'AmazonEC2' 
     AND lineitem_operation LIKE 'RunInstances%' 
     AND lineitem_usagetype LIKE '%Usage%')
    -- RDS
    OR (lineitem_productcode = 'AmazonRDS' 
        AND lineitem_operation LIKE 'CreateDBInstance%' 
        AND lineitem_usagetype LIKE '%InstanceUsage%')
    -- Redshift
    OR (lineitem_productcode = 'AmazonRedshift' 
        AND lineitem_operation LIKE 'RunComputeNode%')
    -- ElastiCache
    OR (lineitem_productcode = 'AmazonElastiCache' 
        AND lineitem_operation LIKE 'CreateCacheCluster%' 
        AND lineitem_usagetype LIKE '%NodeUsage%')
    -- OpenSearch
    OR (lineitem_productcode = 'AmazonOpenSearchService' 
        AND lineitem_operation LIKE 'RunInstance%')
    -- Fargate (ECS/EKS)
    OR (lineitem_productcode = 'AWSFargate' 
        AND lineitem_operation LIKE '%:Fargate%')
    -- Lambda
    OR (lineitem_productcode = 'AWSLambda' 
        AND lineitem_operation = 'Invoke')
  )
  -- Usage/DiscountedUsage/SavingsPlanCoveredUsageのみ
  AND lineitem_lineitemtype IN ('Usage', 'DiscountedUsage', 'SavingsPlanCoveredUsage')
  -- 0円除外（オプション）
  -- AND lineitem_unblendedcost > 0
GROUP BY 
  1,2,3,4,5,6,7,8,9,10
ORDER BY 
  lineitem_resourceid, product_instancetype
```

**クエリのポイント:**
- `lineitem_usageaccountid`: 対象アカウントIDでフィルタ
- 予約可能な7つのサービスをカバー（EC2, RDS, Redshift, ElastiCache, OpenSearch, Fargate, Lambda）
- `lineitem_lineitemtype`で Usage/DiscountedUsage/SavingsPlanCoveredUsage のみ抽出
- `ondemand_risk_cost`: オンデマンド単価×利用量で計算したリスクコスト
- リソースID、インスタンスタイプでソート

**注意事項:**
- テーブル名 `mobingi-main.mspid.202512_accountid` は環境に応じて変更してください
- `billing_month` が必要な場合はコメントを外してください
- 0円のレコードを除外する場合は `AND lineitem_unblendedcost > 0` のコメントを外してください

### 2. 適用率の設定

- **RI適用率**: Reserved Instanceをどの程度適用するか（0%～100%）
- **SP適用率**: Savings Plansをどの程度適用するか（0%～100%）

スライダーで調整すると、リアルタイムで結果が更新されます。

### 3. 結果の確認

- **サマリー**: RI/SPそれぞれの総コスト、削減額、保険料、最終支払額
- **詳細テーブル**: 各リソースごとの詳細な計算結果
- **保険プラン別**: 30日保証（50%）と1年保証（30%）の比較

### 4. コスト計算の詳細

- **総オンデマンドコスト**: 全てオンデマンドで利用した場合の理論上のコスト（`ondemand_risk_cost` の合計）
- **現在の総コスト**: 実際の請求額（`lineitem_unblendedrate × usage_amount` の合計）
  - **注意**: `SavingsPlanCoveredUsage` の行は除外されます（既にSP割引が適用されている利用分のため）

## 🧮 計算ロジック

### コミットメントコストの算出

1. **RI検索**: サービス、インスタンスタイプ、リージョン、課金詳細から最適なRI割引を検索
2. **SP検索**: サービス、リージョンから最適なSP割引を検索
3. **優先順位**:
   - 3年NoUpfront契約を最優先
   - 3年NoUpfrontが存在しない場合、**1年NoUpfrontにフォールバック**
   - NoUpfront > PartialUpfront > AllUpfront の順で優先
   - 同じ契約年数と支払い方法の場合は最安単価を選択
   - 予約サービスが存在しない場合はオンデマンドコストをそのまま使用

4. **フォールバックロジック**:
   - 3年NoUpfrontが見つからない → 1年NoUpfrontを使用
   - 1年NoUpfrontも見つからない → 通常の優先順位（3年PartialUpfront等）を適用
   - フォールバック時は開発モードでログ出力: `⚠️ Fallback: 3-year NoUpfront not found, using 1-year NoUpfront`

5. **DedicatedUsageの考慮**:
   - `lineitem_usagetype` に "Dedicated" が含まれている場合、Dedicated Host/Tenancy の価格を取得
   - Dedicated の RI 単価は Shared よりも高額
   - AWS Price List API で Tenancy=Dedicated でフィルタリング
   - 例: `DedicatedUsage:m5.large` → Dedicated Host の RI 価格を検索

#### RDSの特別な計算ルール

RDS（Amazon Relational Database Service）の場合、以下の要素を考慮します：

- **Node数の計算**: `Node数 = 利用額 / (オンデマンド単価 × 利用量)`
- **MultiAZ判定**: `lineitem_usagetype` に "Multi-AZ" が含まれている場合、MultiAZと判定
- **コミットメントコストの計算**:
  ```
  調整後単価 = RI単価 × Node数
  
  MultiAZの場合:
    調整後単価 = 調整後単価 × 2（プライマリ + スタンバイ）
  
  コミットメントコスト = 利用量 × 調整後単価
  ```

**計算例**:
- RI単価: $0.372/時間
- Node数: 2
- MultiAZ: Yes
- 利用量: 744時間
- **コミットメントコスト**: 744 × ($0.372 × 2 × 2) = **$1,107.072**

### コスト削減額と返金額

```
適用オンデマンド = オンデマンドコスト × 適用率
コスト削減額 = max(0, 適用オンデマンド - コミットメントコスト)
返金額 = オンデマンドコストとコミットメントコストが同額の場合は0、
        それ以外は max(0, コミットメントコスト - 適用オンデマンド)
```

### 保険料と最終支払額

```
保険料(30日) = コスト削減額 × 50% （コスト削減額が0以下の場合は0）
保険料(1年) = コスト削減額 × 30% （コスト削減額が0以下の場合は0）
最終支払額 = コミットメントコスト + 保険料
```

### 実効割引率

```
実効割引率 = (オンデマンドコスト - 最終支払額) / オンデマンドコスト × 100
```

## 🛠️ 技術スタック

- **Next.js 15**: 最新のReactフレームワーク (App Router)
- **React 19**: 最新のUIライブラリ
- **TypeScript 5.6**: 型安全な開発
- **TailwindCSS 3.4**: ユーティリティファーストCSS
- **Papa Parse**: CSVパーサー
- **React Chart.js 2**: データ可視化（将来的に追加予定）

## 📦 セットアップ

### 依存関係のインストール

```bash
npm install
```

### 環境変数の設定

AWS Price List APIを使用する場合は、環境変数を設定します：

```bash
cp .env.example .env.local
```

`.env.local`を編集して以下を設定：

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1

# Enable AWS Price List API (true/false)
ENABLE_AWS_PRICE_API=true

# Cache duration (seconds)
PRICE_CACHE_DURATION=86400

# AWS API Rate Limiting (ThrottlingException対策)
AWS_API_CALL_DELAY=1000          # API呼び出し間の遅延（ミリ秒）
AWS_API_MAX_RETRIES=5            # ThrottlingException時の最大リトライ回数
AWS_API_INITIAL_RETRY_DELAY=5000 # リトライ初期遅延（ミリ秒）
```

**注意**: 
- AWS Price List APIを使用しない場合は、`ENABLE_AWS_PRICE_API=false`のまま（デフォルト）にしてください。静的カタログが使用されます。
- ThrottlingExceptionが頻発する場合は、`AWS_API_CALL_DELAY`を1500-2000msに増やしてください。

### 環境変数の確認方法

環境変数が正しく読み込まれているか確認するには：

```bash
# 開発サーバーを起動後
curl http://localhost:3000/api/env-test
```

レスポンス例：
```json
{
  "message": "Environment Variables Test",
  "env": {
    "ENABLE_AWS_PRICE_API": "false",
    "AWS_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "SET (hidden)",
    "AWS_SECRET_ACCESS_KEY": "SET (hidden)",
    "PRICE_CACHE_DURATION": "86400",
    "NODE_ENV": "development"
  }
}
```

- `AWS_ACCESS_KEY_ID` が "NOT SET" の場合、`.env.local` でクレデンシャルを設定してください
- サーバー起動時に `- Environments: .env.local` が表示されることを確認してください

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

### プロダクションビルド

```bash
npm run build
npm run start
```

## 🏗️ アーキテクチャ

### クライアント・サーバー分離

このアプリケーションは、Next.js 15のApp Routerを使用し、クライアントとサーバーの責務を明確に分離しています：

#### **クライアントサイド** (`'use client'`)
- CSVファイルのアップロード
- UIの状態管理（React useState）
- ユーザー入力の処理
- 結果の表示

#### **サーバーサイド** (API Routes)
- `/api/calculate`: コミットメントコスト計算
- `/api/env-test`: 環境変数の確認
- AWS Price List APIへのアクセス
- 環境変数の読み込み（`process.env.*`）

**重要**: 環境変数は**サーバーサイドでのみ**アクセス可能です。クライアントサイドでAWS APIを直接呼び出すことはできません。

### データフロー

```
クライアント              サーバー
┌─────────┐              ┌──────────┐
│CSV Upload│──POST─────→│/api/     │
│         │              │calculate │
│         │              │          │──→ AWS Price List API
│         │              │          │   (環境変数使用)
│         │←─JSON Result─│          │
│Results  │              │          │
│Display  │              └──────────┘
└─────────┘
```

## 📁 プロジェクト構造

```
/
├── app/                      # Next.js App Router
│   ├── api/                  # サーバーサイドAPIルート
│   │   ├── calculate/        # コミットメント計算API
│   │   │   └── route.ts      # POST /api/calculate
│   │   └── env-test/         # 環境変数テストAPI
│   │       └── route.ts      # GET /api/env-test
│   ├── layout.tsx            # ルートレイアウト
│   ├── page.tsx              # メインページ（クライアント）
│   └── globals.css           # グローバルCSS
├── components/               # Reactコンポーネント
│   ├── CSVUpload.tsx         # CSVアップロード
│   ├── ApplyRateConfig.tsx   # 適用率設定
│   ├── ResultsSummary.tsx    # サマリー表示
│   └── ResultsTable.tsx      # 詳細テーブル
├── lib/                      # ロジック & ユーティリティ
│   ├── types.ts              # TypeScript型定義
│   ├── calculator.ts         # 計算ロジック
│   └── reservation-catalog.ts # 予約割引カタログ
├── public/                   # 静的ファイル
│   └── sample-data.csv       # サンプルCSV
├── package.json              # 依存関係
└── README.md                 # このファイル
```

## 🎯 予約割引カタログについて

### 💡 2つのモード

#### 1. 静的カタログモード（デフォルト）
`lib/reservation-catalog.ts` にハードコードされたサンプルデータを使用します。
- **メリット**: セットアップ不要、高速
- **デメリット**: 価格が最新でない可能性がある

#### 2. AWS Price List APIモード（推奨）
リアルタイムでAWS公式価格を取得します。
- **メリット**: 常に最新の価格、正確なコスト計算
- **デメリット**: AWSアクセスキーが必要、初回は遅い（キャッシュ後は高速）

### 🔧 AWS Price List API統合

環境変数で`ENABLE_AWS_PRICE_API=true`に設定すると、以下の動作になります：

1. **リアルタイム取得**: RIとSPの価格をAWS Price List APIから取得
2. **キャッシュ機能**: 取得した価格を24時間キャッシュ（設定可能）
3. **フォールバック**: API失敗時は静的カタログを使用
4. **自動更新**: APIから最新の価格を自動取得
5. **ThrottlingException対策**:
   - エクスポネンシャルバックオフによる自動リトライ（最大5回）
   - API呼び出し間に200msの遅延を挿入
   - ジッター（ランダム遅延）による競合回避

### 📊 対応するAWS Price List API

#### Reserved Instances (RI)
- **EC2**: Reserved Instanceの価格（NoUpfront/PartialUpfront/AllUpfront）
- **RDS**: Reserved Instanceの価格（NoUpfront/PartialUpfront/AllUpfront）
- **リージョン**: 全リージョン対応
- **契約期間**: 1年、3年
- **初期費用（Upfront Fee）**: PartialUpfront/AllUpfrontの初期費用を自動取得
  - AWS Price List APIのpriceDimensionsから抽出
  - `unit: "Hrs"` → 時間単価（hourly rate）
  - `unit: "Quantity"` → 初期費用（upfront fee）
  - Multi-AZやNode数による自動調整に対応

#### Savings Plans (SP)
- **EC2 Compute Savings Plans**: 標準的な割引率を適用
  - 1年NoUpfront: 34%割引（支払い率66%）
  - 1年AllUpfront: 40%割引（支払い率60%）
  - 3年NoUpfront: 46%割引（支払い率54%）
  - 3年AllUpfront: 60%割引（支払い率40%）
- **リージョン**: 全リージョン対応
- **インスタンスタイプ**: 不問（Compute Savings Plans）

### 対応サービス（サンプルデータ）

- **Amazon EC2**: t3.medium, t3.large, m5.large
- **Amazon RDS**: db.t3.medium, db.m5.large
- **Amazon ElastiCache**: cache.t3.medium

## 📝 ライセンス

MIT License - © 2026

## 👤 作成者

Your Name

## 🤝 コントリビューション

プルリクエストを歓迎します！

## 📧 サポート

問題や質問がある場合は、Issueを作成してください。

---

**⚡ Built with Next.js 15 + React 19 + TailwindCSS**

バージョン: 1.0.0
