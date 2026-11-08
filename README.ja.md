# Tab Merge N Sort

<p><img src="extension_chrome/icons/icon-128.png" width="96" height="96" alt="Tab Merge N Sort"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

## 概要

タブをまとめ、現在のウィンドウまたは全ウィンドウを URL／タイトル順に並べ替えます。Chrome ソース版は0.99.1、保持するデスクトップ Safari は0.99.0です。

## 使い方

Chrome の「パッケージ化されていない拡張機能を読み込む」で extension_chrome/ を選択し、統合・並べ替え操作を使います。更新時は公開鍵で固定されたIDと storage keys を保持します。ワークスペースの hub やリンクは不要です。

## プラットフォーム制限

デスクトップ Safari は必須の tabs.move に対応しません。API がなければ移動できないことを表示し、タブを変更しません。閉じて開き直す回避策やネイティブ自動化権限は追加しません。版番号は機能同等の証明ではありません。ネイティブ構築には macOS、Xcode、XcodeGen、個人の署名設定が別途必要。iOS／VIA、Firefox 配布は含みません。

## ソースとビルド

Deno2.x と Git を用意して、このリポジトリで次を実行します。検査は合成したローカル例を使います。ビルドは無視対象の Local/candidates に候補を作り、正確なバイト列を読み戻します。拡張機能の導入、ブラウザー起動、個人設定へのアクセスは行いません。通常の検査は固定済みローカル依存を使い、隣のソースディレクトリは不要です。

```sh
deno task check
deno task build
```

## プライバシーとソース確認

確認済みのファイルを名前指定でステージし、deno task public:check と deno task public:prepare を実行します。public-source.json が正確な Git index 入力を選び、個人の運用記録・設定・Git 履歴は除外します。候補は不変で、再実行は照合のみ。不一致を上書きしません。限定的なパターン検査は履歴や秘密の完全検査ではありません。準備によって受信先・データ・ブラウザー設定は変わりません。

## ライセンス

この版の独自コードは GNU GPL 第3版のみ（GPL-3.0-only）です。以前の版への MIT 許諾は存続します。フォントと第三者素材は元の条件を保持。LICENSE、過去の MIT 許諾、全 notices を同梱してください。素材権利と内容の確認は公開前に必要です。ローカル候補は公開・導入済み・履歴検査完了を意味しません。
