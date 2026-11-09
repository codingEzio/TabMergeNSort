# Tab Merge N Sort

<p><img src="extension_chrome/icons/icon-128.png" width="96" height="96" alt="Tab Merge N Sort"></p>

Chrome 原始碼版本 0.99.1，保留的桌面 macOS Safari 原始碼版本 0.99.0。此擴充合併分頁，並按 URL 或標題
排序目前視窗或所有視窗。Chrome 使用 Chrome「載入未封裝項目」選擇本專案的
`extension_chrome/`，無需工作區目錄或符號連結。保留既有擴充身分與儲存鍵。

Chrome 介面使用系統字型。先前發布的字型資產仍保留於原始碼中供 Safari 生成使用，但不包含在 Chrome 套件中。

Safari 功能限制：Apple 的
[Web Extension 相容性說明](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
列出 `tabs.move` 不受支援，而合併與排序依賴此 API。缺少該 API 時，擴充明確提示
瀏覽器不支援移動分頁，並保留分頁。0.99.0 版本中繼資料不代表 Safari 功能適配
完成；未使用關閉後重開分頁的替代方案，也未新增原生自動化權限。

安裝 Deno 2.x 與 Git，執行 `deno task check`、`deno task build`。檢查使用合成
本機資料；建置只產生 `Local/candidates/` 候選套件，不安裝擴充或開啟瀏覽器。
Chrome 建置僅在完整讀回一致時重用既有候選；衝突或中斷的候選會保留並報錯。
共用相依由 `dependencies.lock.json` 固定，日常建置不讀取相鄰專案。

更新相依時先修改其來源專案，再明確執行
`deno task deps:sync --owner=X-ExtShared --workspace=/absolute/path/to/source-workspace`，
然後重新檢查。Safari 的原生建置、簽署與安裝分別驗證；Chrome
套件不能證明這些結果。 簽署金鑰與本機設定保留於忽略的 `Local/`。

`public-source.json` 指定待審查的原始碼。暫存具名變更後，執行
`deno task maintenance` 與 `deno task public:prepare`。工具讀取 Git 暫存區，檢查
私有檔案、符號連結與有限的敏感內容模式，再產生並讀回雜湊驗證的本機候選目錄。
已有目錄不會被覆寫；`public:check` 可重複唯讀檢查。歷史操作紀錄不進入候選， Git
歷史保持不變。收據僅含相對路徑。

0.99.0 自有程式碼採用 [GNU GPL 第 3 版，僅此版本](LICENSE)（`GPL-3.0-only`），
著作權歸 2026 X-ExtTabMergeNSort contributors。[NOTICE.md](NOTICE.md) 說明範圍及
保留的歷史 MIT 授權；本次變更不撤銷過去已授出的合法 MIT 權利。字型及第三方資產
保留原有授權、聲明與作者，未改為 GPL。完整資產權利與內容審查仍待完成；模式檢查
不保證沒有秘密。本機候選不會上傳、發布、安裝或改寫歷史。

桌面 Safari 原生腳本需要 macOS、Xcode、`/opt/homebrew/bin/xcodegen` 及自行建立的
`Local/signing/safari_identity.conf`（`SIGNING_IDENTITY`、`DEVELOPMENT_TEAM`）；
不隨附簽署身分。Deno 建置不依賴相鄰目錄。本次不涉及行動 Safari/iOS 或 Android
VIA。 工具與平台限制見 [相依](DEPENDENCIES.md)，完整入口見 [README](README.md)。
