---
name: 像素填色
description: 漫画印刷感的照片数字填色工具，涂色区安静清楚。
colors:
  paper: "#f5f2e9"
  card: "#fffdf7"
  ink: "#171715"
  muted: "#62615b"
  line: "#ccc9c0"
  primary: "#c53827"
  primary-hover: "#ab2c1d"
  headline-mark: "#ef5540"
  canvas: "#e5e5e3"
  control-hover: "#e8e4d9"
  paper-deep: "#d8d5cc"
  white: "#ffffff"
  black: "#000000"
typography:
  display:
    fontFamily: '"Colorbook Display", "PingFang SC", sans-serif'
    fontSize: "clamp(54px, 8vw, 88px)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-.025em"
  headline:
    fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "24px"
    fontWeight: 850
  title:
    fontSize: "16px"
    fontWeight: 750
  body:
    fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  label:
    fontSize: "12px"
  button:
    fontSize: "16px"
    fontWeight: 650
rounded:
  square: "0"
  control: "2px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  tool-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
  select:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "5px 10px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  card-frame:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.square}"
  canvas-stage:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.square}"
---

# Design System: 像素填色

## Overview

**Creative North Star: "漫画印刷感"**

以用户确认的「漫画印刷感：黑白、朱红、粗线条，涂色区安静清楚」为视觉准则。首页借重黑刊头、粗字、锯齿纸边和朱红标记形成印刷品的力度；进入工作台后，装饰退到画布之外，照片本身和数字格子成为主角。

界面文案使用中文，正文保持系统字体的清楚易读。漫画气质来自排版与线条，不依赖角色插画。设计参考已确认的 `.impeccable/approved-concept.png`；本文记录当前 PWA 与微信小程序的实现，未将样式代码检查视作微信原生环境的视觉验收。

**Key Characteristics:**
- 重黑刊头与少量朱红形成印刷感。
- 作品缩略图保留像素边缘，工具和画布保持清楚。
- 近直角、实线边框、少量硬阴影；正文使用系统中文字体。

## Colors

品牌只有一个主要强调色；暖纸色承担界面，中性灰承担画布。前置 tokens 为数值规范，以下说明使用关系。

### Primary
- **朱红（primary）**：导入照片按钮、作品集进度、计数下划线和少量提示标记。悬停使用 primary-hover。
- **标题红（headline-mark）**：仅用于黑色刊头里的倾斜感叹号，与按钮朱红区分。

### Neutral
- **纸白（paper）／卡纸白（card）**：页面底色与按钮、缩略图、设置面板表面。
- **墨黑（ink）**：正文、刊头、边框、工具选中态和格内数字。
- **灰字（muted）**：日期、提示和保存状态；不承担主要操作标题。
- **分隔灰（line）／深纸灰（paper-deep）**：网页分隔与进度轨道、小程序分隔与未选开关。
- **画布灰（canvas）**：两端画布外围的中性底色，避免暖纸色影响观察照片颜色。
- **悬停纸色（control-hover）**：网页普通按钮与设置摘要的悬停反馈。
- **纯黑／纯白（black／white）**：色板编号根据共享 `mp/utils/art.js` 的对比度计算二选一；纯白也用于朱红按钮文字。作品颜色由照片和用户改色决定，不属于品牌 token。

**The Canvas Clarity Rule.** 画布底色保持中性，格内数字使用墨黑；色板编号依据颜色对比度选纯黑或纯白，不能统一染成品牌红。

## Typography

**Display Font:** Noto Sans SC 的本地子集；网页别名为 Colorbook Display，小程序为 cb-display，回退 PingFang SC 与 sans-serif。

**Body Font:** 系统字体，以 -apple-system、PingFang SC 为主；网页额外包含 Microsoft YaHei 回退。

标题采用粗黑字重，正文和控件保留现代中文系统字体的可读性。展示字体只用于品牌刊头；不要将标题的紧字距扩散到说明文字。

### Hierarchy
- **Display**：网页使用前置 display token；窄屏固定为 64px。小程序为 64px、900 字重、1.08 行高与 -1px 字距。感叹号倾斜 -9deg。
- **Headline**：作品集标题网页为 headline token，窄屏为 22px；小程序为 22px／800。
- **Title**：网页作品标题为 title token，窄屏次要作品为 14px；小程序普通作品为 14px，首幅为 17px。
- **Body**：网页遵循 body token；小程序按具体控件设置尺寸。操作文案以 14–16px 为主。
- **Label**：日期、保存状态和辅助说明为 11–13px；数量与进度优先采用等宽数字特性（网页已有实现）。

字体来自 [google/fonts 的 ofl/notosanssc](https://github.com/google/fonts/tree/main/ofl/notosanssc)，OFL 许可随文件保留（`assets/display-OFL.txt`、`mp/assets/display-OFL.txt`）。`tools/display-font.sh` 从源字体生成「像素填色!」子集，网页使用 `assets/display.woff2`，小程序使用 `mp/display.wxss` 内嵌 WOFF。当前标题使用 900 字重，字体声明保留可变字重范围。Fusion Pixel 仍由 `tools/font.sh` 生成 `mp/font.wxss`，许可证见 `mp/assets/OFL.txt`；保留资源不代表它仍是正文默认字体。

**The Readable Body Rule.** 展示字体只承担品牌名；长文、工具、数字提示继续使用清楚的系统字体。

## Layout

网页作品集最大宽度为 1040px，常规内边距为 24px 32px 36px。默认两列，首幅横跨两列；800px 起使用四列，首幅跨两列两行，只有一幅时占满整行。默认缩略图比例为 4:3，大屏首幅通常为正方形；单幅大屏为 2:1。600px 以下采用 18px 侧边距，刊头延伸至屏幕边缘。

小程序作品集采用两列，首幅占满整行；普通预览高 128px，首幅 240px。导入区域固定底部，页面底部预留空间。网页导入按钮留在作品集正常文档流中；两端不强行共享同一种定位。

工作台为纵向布局：保存与返回、进度、可伸缩画布、工具、色板。网页采用动态视口高度；画布通过 flex 与 min-height: 0 使用剩余空间。窄屏工具与粗细控件分两行；色板横向滚动，底部保留安全区。主要触控区域至少 44px。间距以 8、12、16、20、24、32px 为常用节奏；具体排版仍保留代码中的局部值。

## Elevation & Depth

普通页面、卡片和工具是平的，通过实线边框、墨黑色块与纸面层次区分区域，不使用柔和浮层阴影。网页完成提示使用朱红硬阴影（8px 8px 0）并旋转 -3deg，形成一次性的印刷偏移。小程序设置底片使用半透明墨黑遮罩，底部设置面板以上边粗线界定层级。

**The Flat Paper Rule.** 日常操作保持平面；硬阴影只沿用已实现的完成提示，不扩散到普通作品卡片。

## Shapes

以直角矩形和实线为基础。按钮与色板只有轻微圆角（rounded.control），选择器、进度条和画框保持直角。控件边线通常为 1px，作品画框和空态为 2px，完成提示与小程序设置面板上边线为 3px。刊头底部锯齿是识别性装饰：网页通过裁切路径，小程序通过重复渐变实现；不延伸到涂色画布。

## Components

### Buttons

清楚、结实的印刷按钮。普通按钮为卡纸底、墨黑线；导入为朱红底白字。网页悬停有颜色反馈，按下向下移动 1px；disabled 透明度为 .6。网页键盘焦点是 3px 朱红外描边、4px 间隔。小程序使用 pressed 透明度反馈：首页 .85，工作台 .75。网页导入高 60px，小程序高 56px。

### Inputs / Fields

网页设置使用原生范围滑条、复选框和直角选择器，交互强调色为墨黑；没有普通文本输入框。改色控件通过透明原生颜色输入覆盖按钮，focus-within 保留明显焦点。小程序设置使用分段选项、加减步进和方形开关；工作台改色面板使用 HSL 滑条。

### Chips

小程序设置选项使用三列、44px 高的直角卡纸按钮；选中切换墨黑底纸白字。此模式用于设置选项，不能把作品色板也变成统一黑色。

### Cards / Containers

缩略图置于卡纸底的粗黑画框中，网页使用 pixelated 图像渲染。标题、日期、进度置于框下；删除入口保留独立触控区域。首幅作品更大，继续入口遵循两端已实现的响应式差异。空态延续粗黑框和三个数字格。

### Navigation

网页工作台使用纯文字与左向符号的「返回作品集」，旁边是安静的保存状态；没有常驻底部导航栏。小程序保留平台页面导航，画布页顶部显示保存状态与进度。

### Color Palette & Canvas

色板直接展示作品颜色和编号；网页色块为 52px × 58px，小程序为 48px × 56px。选中时增加墨黑外描边与底部小三角，完成颜色显示勾选反馈。画布外围使用 canvas token，格内数字使用 ink token。画笔、油漆桶的选中按钮为黑底浅字；改色面板服务于真实作品颜色。保持已有填色、缩放和颜色算法行为。

### Completion & Settings

网页完成提示使用粗框、倾斜和硬阴影，避免永久占用画布。网页新作品设置可折叠；小程序通过遮罩与底部面板展开。当前代码没有连续装饰动画，网页尊重 prefers-reduced-motion。

## Do's and Don'ts

### Do:
- **Do** 将朱红用于导入、作品进度和关键标记，工作台进度与工具选中使用墨黑。
- **Do** 保留中性灰画布背景、清楚的格内数字和基于对比度的色板编号。
- **Do** 为按钮保留至少 44px 的主要触控区域，并照顾设备安全区。
- **Do** 新增品牌标题字符时重新生成本地字体子集；正文继续使用系统字体。

### Don't:
- **Don't** 把作品的任意颜色当作全局品牌色。
- **Don't** 用漫画装饰遮挡画布、数字、色板或手势操作。
- **Don't** 把全局正文改成展示字体或像素字体。
- **Don't** 给普通卡片添加柔和浮层阴影、胶囊轮廓或多色渐变。
