# Hover Bars

[English](#english) | [简体中文](#简体中文)

---

## English

A Zotero plugin that gives you more reading space: **hide the top tab bar and the reader toolbar, and bring each one back just by hovering where it normally sits.**

- Works with **Zotero 8, 9 and 10** (tested logic; declared `8.0` – `10.0.*`)
- PDF, EPUB and snapshot readers
- Each bar appears at its own height — they never cover each other
- Menu text in English and Simplified Chinese
- Settings are remembered between launches; everything is restored when the plugin is removed

### Install

1. Download `hover-bars.xpi` from the [Releases](https://github.com/dragonlau0924/zotero-hover-bars/releases) page.
2. In Zotero: **Tools → Plugins** → gear icon → **Install Plugin From File…** → choose the `.xpi`.

### Use

Open the **View** menu (main window or a reader window). Three items are added at the bottom:

| Item | What it does |
| --- | --- |
| Hide Tab Bar | Hides the tab bar at the top of the main window |
| Hide Reader Toolbar | Hides the toolbar above the PDF / EPUB / snapshot |
| Show Hidden Bars on Hover | Hidden bars slide back in when you hover their strip |

Hover strips are transparent and sit over the page, so they work even above the PDF:

- **Tab bar** — a 6 px strip at the very top of the window
- **Reader toolbar** — a 14 px strip exactly where the toolbar normally sits (just below the tab bar's height; at the top if the tab bar is not hidden)

A bar hides again about 0.35 s after the pointer leaves it. It stays open while the pointer is on it or one of its popups (appearance, find, …) is open. If you turn off hover, hidden bars stay hidden until you untick them in the View menu.

> On macOS, with the tab bar hidden, the red/yellow/green window buttons sit directly over the page until you hover the top edge.

### Build from source

```bash
./build.sh        # creates build/hover-bars.xpi
```

Requires only `zip`. Source is in `src/`:

| File | Purpose |
| --- | --- |
| `manifest.json` | Plugin metadata and supported Zotero versions |
| `bootstrap.js` | Zotero lifecycle hooks |
| `hover-bars.js` | All logic: menu, styles, hover strips |
| `locale/*/hover-bars.ftl` | Menu text (Fluent) |

### Troubleshooting

- Enable **Help → Debug Output Logging → View Output** and look for lines starting with `Hover Bars:`.
- Plugin shows as incompatible: check your version in **About Zotero**. Supported range is 8.0 – 10.0.\*.
- Zotero's reader markup (`.toolbar`, `#split-view`) is an internal detail and may change in future releases; please open an issue with your Zotero version.

### Credits & license

Idea inspired by [wmstack/Zotero-Toggle-Bars](https://github.com/wmstack/Zotero-Toggle-Bars) (BSD-2-Clause); this plugin is a rewrite for current Zotero. Released under the [BSD 2-Clause License](LICENSE).

---

## 简体中文

一个让 Zotero 阅读空间更大的插件：**隐藏顶部标签栏和阅读器工具栏，鼠标悬停到它们原来的位置时再自动浮现。**

- 支持 **Zotero 8 / 9 / 10**（声明范围 `8.0` – `10.0.*`）
- 适用于 PDF、EPUB、网页快照阅读器
- 两栏各自在不同高度出现，不会互相遮挡
- 菜单文字支持中文和英文
- 设置会被记住；卸载插件后界面完全还原

### 安装

1. 到 [Releases](https://github.com/dragonlau0924/zotero-hover-bars/releases) 页面下载 `hover-bars.xpi`。
2. 在 Zotero 中：**工具 → 插件** → 齿轮图标 → **Install Plugin From File…** → 选择 `.xpi`。

### 使用

打开主窗口或阅读器窗口的 **视图（View）** 菜单，底部会多出三项：

| 菜单项 | 作用 |
| --- | --- |
| 隐藏顶部标签栏 | 隐藏主窗口顶部的标签栏 |
| 隐藏阅读器工具栏 | 隐藏 PDF / EPUB / 快照上方的工具栏 |
| 悬停时显示已隐藏的栏 | 鼠标移到对应位置时，隐藏的栏滑出 |

悬停感应条是透明的，盖在页面上面，所以在 PDF 上方也能触发：

- **标签栏**：窗口最顶部 6 像素高的一条
- **工具栏**：工具栏平时所在的位置，14 像素高（在标签栏高度之下；没有隐藏标签栏时就在最顶部）

鼠标离开约 0.35 秒后该栏收起；鼠标停在栏上，或它的弹出菜单（外观、查找等）打开时不会收起。关闭“悬停显示”后，隐藏的栏会一直隐藏，直到你在视图菜单里取消勾选。

> macOS 上隐藏标签栏后，红黄绿窗口按钮会直接盖在页面左上角，悬停顶部时才回到标签栏里。

### 从源码构建

```bash
./build.sh        # 生成 build/hover-bars.xpi
```

只需要 `zip`。源码在 `src/` 目录下。

### 遇到问题

- 打开 **帮助 → Debug Output Logging → View Output**，查找以 `Hover Bars:` 开头的日志。
- 提示不兼容：在“关于 Zotero”里确认版本，支持范围是 8.0 – 10.0.\*。
- 阅读器内部的页面结构（`.toolbar`、`#split-view`）可能随 Zotero 升级变化，请带上你的 Zotero 版本号提交 issue。

### 致谢与许可

灵感来自 [wmstack/Zotero-Toggle-Bars](https://github.com/wmstack/Zotero-Toggle-Bars)（BSD-2-Clause），本插件为适配新版 Zotero 的重写。采用 [BSD 2-Clause 许可证](LICENSE)。
