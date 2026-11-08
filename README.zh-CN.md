# Tab Merge N Sort

Chrome 源码版本 0.99.1，保留的桌面 macOS Safari 源码版本 0.99.0。此扩展合并标签页，并按 URL 或标题
排序当前窗口或全部窗口。Chrome 使用 Chrome「加载已解压的扩展程序」选择本项目的
`extension_chrome/`，无需工作区目录或软链接。保留既有扩展身份和存储键。

Chrome 界面使用系统字体。此前发布的字体资源仍保留在源码和包内，但此界面不会加载。

Safari 功能限制：Apple 的
[Web Extension 兼容性说明](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
列出 `tabs.move` 不受支持，而合并与排序依赖此 API。缺少该 API 时，扩展明确提示
浏览器不支持移动标签页，并保留标签页。0.99.0 版本元数据不代表 Safari 功能适配
完成；未使用关闭后重开标签页的替代方案，也未新增原生自动化权限。

安装 Deno 2.x 与 Git，执行 `deno task check`、`deno task build`。检查使用合成
本地数据；构建只生成 `Local/candidates/` 候选包，不安装扩展或打开浏览器。
共享依赖由 `dependencies.lock.json` 固定，日常构建不读取相邻项目。

更新依赖时先修改其源项目，再显式执行
`deno task deps:sync --owner=X-ExtShared --workspace=/absolute/path/to/source-workspace`，
然后重新检查。Safari 的原生构建、签名和安装分别验证；Chrome 包不能证明这些结果。
签名密钥与本地配置保留在忽略的 `Local/`。

`public-source.json` 指定待审查的源文件。暂存具名改动后，执行
`deno task maintenance` 与 `deno task public:prepare`。工具读取 Git 暂存区，检查
私有文件、符号链接和有限的敏感内容模式，再生成并读回哈希验证的本地候选目录。
已有目录不会被覆盖；`public:check` 可重复只读检查。历史操作记录不进入候选， Git
历史保持不变。收据仅含相对路径。

0.99.0 自有代码采用 [GNU GPL 第 3 版，仅此版本](LICENSE)（`GPL-3.0-only`），
版权归 2026 X-ExtTabMergeNSort contributors。[NOTICE.md](NOTICE.md) 说明范围及
保留的历史 MIT 授权；本次变更不撤销过去已授出的合法 MIT 权利。字体及第三方资产
保留原有许可、声明与作者，未改为 GPL。完整资产权利与内容审查仍待完成；模式检查
不保证没有秘密。本地候选不会上传、发布、安装或重写历史。

桌面 Safari 原生脚本需要 macOS、Xcode、`/opt/homebrew/bin/xcodegen` 及自行创建的
`Local/signing/safari_identity.conf`（`SIGNING_IDENTITY`、`DEVELOPMENT_TEAM`）；
不随附签名身份。Deno 构建不依赖相邻目录。本次不涉及移动 Safari/iOS 或 Android
VIA。 工具与平台限制见 [依赖](DEPENDENCIES.md)，完整入口见 [README](README.md)。
