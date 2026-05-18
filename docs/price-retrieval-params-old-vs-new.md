# 価格取得パラメータ比較（旧バージョン vs 新バージョン）

このドキュメントは、価格取得処理で実際に使われるパラメータをサービス別に整理し、旧バージョン（AWS Price List API）と新バージョン（内部API/BigQuery）の差分を比較したものです。

## RI（Reserved Instance）

| サービス | 旧バージョン（AWS Pricing API）で使うパラメータ | 新バージョン（内部API/BigQuery）で使うパラメータ | 差分ポイント |
|---|---|---|---|
| EC2 | instanceType, region(location), tenancy, operatingSystem, preInstalledSw=NA(固定) | service=ec2, location_name, instance_type, tenancy, operating_system | 新はBigQuery母集団から取得するため件数が増えやすい。最安単価は一致しやすい |
| RDS | instanceType, region(location), databaseEngine, databaseEdition(任意), deploymentOption(任意), licenseModel(任意) | service=rds, location_name, instance_type, deployment_option（RDSではtenancy未適用） | 旧は条件厳密一致のため0件化しやすい。新はdatabaseEngine/databaseEdition/licenseModelを現在は未使用 |
| ElastiCache | 未実装（常に0件） | service=elasticache, location_name, instance_type | 新のみ実データ取得可能 |
| Redshift | 未実装（常に0件） | service=redshift, location_name, instance_type | 新のみ実データ取得可能 |
| OpenSearch/ES | 未実装（常に0件） | service=es, location_name, instance_type | 新のみ実データ取得可能 |

## SP（Savings Plans）

| サービス | 旧バージョン（AWS Pricing API）で使うパラメータ | 新バージョン（内部API/BigQuery）で使うパラメータ | 差分ポイント |
|---|---|---|---|
| EC2 | regionのみ（実質固定割引率セットを返却） | 取得: service=ec2, location_name / 選定: lineitem_operation, lineitem_usagetype, instanceType | 旧は discount rate、新は per hour 実測単価。新は候補選定時に行コンテキストで絞り込む |
| RDS | 未実装（常に0件） | service=rds, location_name | 新のみ取得対象（データ有無はテーブル依存） |
| ElastiCache/Redshift/ES | 未実装（常に0件） | service=elasticache/redshift/es, location_name | 新は呼び出し可能だが、データ有無は discountedservicecode との一致次第 |
| Compute/Database（SP分類） | なし | service=compute / database, location_name | 新のみ対応（SP用途の分類検索） |

## 実務上の注意

- 旧RDSは databaseEngine 未指定時に Any 条件で検索し、0件になるケースがある。
- 新SPは service + location_name の条件で広く取得するため、件数が大きくなりやすい。
- ただし計算・比較で使うSP価格は、取得後に以下の優先順で絞り込む。
	- usage_type + operation 完全一致
	- usage_type 一致
	- instanceType 由来サフィックス + operation 一致
	- instanceType 由来サフィックス一致
	- operation 一致
	- どれも無い場合は全件
- 上記の絞り込みにより、SP単価が無関係な最小値（例: 別インスタンスタイプの 0.002x）へ寄る事象を回避する。
- 旧SP（割引率）と新SP（時間単価）は指標が異なるため、同じ列で直接比較すると差が出る。
