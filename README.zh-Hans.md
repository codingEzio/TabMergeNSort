# Tab Merge N Sort

<p><img src="extension_chrome/icons/icon-128.png" width="96" height="96" alt="Tab Merge N Sort"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

## 概览

合并标签页，并按 URL 或标题排序当前窗口或全部窗口。Chrome 与保留的桌面 Safari 源码版本为0.99.0。

## 使用

在 Chrome 中选择“加载已解压的扩展程序”，载入 extension_chrome/。使用扩展的合并及排序操作管理标签页。更新时保留现有公钥固定的扩展身份与 storage keys，不需要工作区 hub 或符号链接。

## 平台限制

桌面 Safari 不支持合并／排序所需的 tabs.move。缺少该 API 时，扩展明确报告无法移动标签页，保留原标签页；不会通过关闭重开或新增原生自动化权限绕过。0.99.0版本号不代表 Safari 功能与 Chrome 相同。原生构建另需 macOS、Xcode、XcodeGen 及私人签署配置；不包含 iOS／VIA 或 Firefox 发布。

## 源码与构建

安装 Deno 2.x 和 Git 后，在本仓库运行下列命令。检查使用合成本地样例；构建在忽略的 Local/candidates 下写入候选并精确读回，不安装扩展、不打开浏览器，也不访问个人设置。正常检查使用本地固定依赖，不依赖同级源码目录。

```sh
deno task check
deno task build
```

## 隐私与来源审查

先暂存已审查的具名文件，再执行 deno task public:check 与 deno task public:prepare。public-source.json 选择精确 Git index 输入；导出不含私人操作记录、配置或 Git 历史。候选不可变，重跑只核对，拒绝覆盖不一致内容。模式扫描有限，不能当成完整历史／秘密检测。接收端、数据和浏览器设置不因准备而改变。

## 许可

本版自有代码使用 GNU GPL 第3版（仅限该版，GPL-3.0-only）。以前版本的 MIT 授权继续有效；字体与第三方素材保留原条款。保留 LICENSE、历史 MIT 授权及全部 notices。完整素材权利和内容审查仍是发布门槛；本机候选不代表已公开、已安装或完整历史已清理。
