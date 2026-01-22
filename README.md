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
account_id,service,product_instancetype,lineitem_operation,lineitem_usagetype,product_region,lineitem_lineitemtype,ondemand_risk_cost,usage_amount
123456789012,Amazon Elastic Compute Cloud,t3.medium,RunInstances,BoxUsage:t3.medium,ap-northeast-1,Usage,33.60,730
```

**必須カラム:**
- `account_id`: アカウントID
- `service`: サービス名
- `product_instancetype`: インスタンス種別
- `lineitem_operation`: 課金操作種別
- `lineitem_usagetype`: 課金詳細
- `product_region`: リージョン
- `lineitem_lineitemtype`: 課金種別
- `ondemand_risk_cost`: オンデマンドコスト
- `usage_amount`: 利用量（時間、または実行数）

サンプルCSVファイル: [`public/sample-data.csv`](/public/sample-data.csv)

### 2. 適用率の設定

- **RI適用率**: Reserved Instanceをどの程度適用するか（0%～100%）
- **SP適用率**: Savings Plansをどの程度適用するか（0%～100%）

スライダーで調整すると、リアルタイムで結果が更新されます。

### 3. 結果の確認

- **サマリー**: RI/SPそれぞれの総コスト、削減額、保険料、最終支払額
- **詳細テーブル**: 各リソースごとの詳細な計算結果
- **保険プラン別**: 30日保証（50%）と1年保証（30%）の比較

## 🧮 計算ロジック

### コミットメントコストの算出

1. **RI検索**: サービス、インスタンスタイプ、リージョン、課金詳細から最適なRI割引を検索
2. **SP検索**: サービス、リージョンから最適なSP割引を検索
3. **優先順位**:
   - 3年契約が存在する場合は3年契約を優先
   - 3年契約がない場合は1年契約を優先
   - 同じ契約年数の場合は最安単価を選択
   - 予約サービスが存在しない場合はオンデマンドコストをそのまま使用

### コスト削減額と返金額

```
適用オンデマンド = オンデマンドコスト × 適用率
コスト削減額 = max(0, 適用オンデマンド - コミットメントコスト)
返金額 = max(0, コミットメントコスト - 適用オンデマンド)
```

### 保険料と最終支払額

```
保険料(30日) = コミットメントコスト × 50%
保険料(1年) = コミットメントコスト × 30%
最終支払額 = コミットメントコスト + 保険料 - コスト削減額
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

## 📁 プロジェクト構造

```
/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # ルートレイアウト
│   ├── page.tsx              # メインページ
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

現在、`lib/reservation-catalog.ts` にハードコードされたサンプルデータを使用しています。

実際の運用では、以下のような方法でデータを取得することを推奨します：

1. **AWS Price List API**: AWSの公式価格APIから最新の価格を取得
2. **データベース**: 定期的に更新される価格データをデータベースに保存
3. **外部API**: 独自の価格管理システムからAPIで取得

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
