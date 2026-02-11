# 靜態隨機圖 API (Static Random Pic API) - Typelin 定製版 🎨

![Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-orange?style=flat-square&logo=cloudflare)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

這是一個基於純靜態架構的隨機圖 API 解決方案。它不依賴任何後端邏輯（如 Cloudflare Workers 或 Python 伺服器），完全依靠建置時 (Build-time) 生成的靜態資源與客戶端 JavaScript 實現隨機圖功能。

## 🌟 本專案特色 (相較於原專案的改進)
本專案基於 [afoim/Static_RandomPicAPI](https://github.com/afoim/Static_RandomPicAPI) 進行了深度重構與優化：

- **部署平台遷移**：針對 **Cloudflare Pages** 進行了深度整合，支援預覽網域 (Preview Domain) 自動路徑識別。
- **高效能畫廊 (Gallery)**：
    - **抽樣展示**：解決原專案在圖片過多（5000+ 張）時導致瀏覽器崩潰的問題，實作隨機抽樣 (Max 100 預覽)。
    - **節流排版 (Throttled Layout)**：實作 Masonry 佈局節流，大幅降低 CPU 負擔。
    - **Anti-CLS**：引入 `aspect-ratio` 佔位機制，防止圖片載入時的頁面跳動。
- **現代化依賴**：將 Masonry 與 Lozad 等庫轉由 **CDN (unpkg/jsdelivr)** 加載，確保靜態環境下的 100% 可用性。
- **智慧路徑解析**：`random.js` 能自動識別測試環境與正式域名，自動切換相對/絕對路徑。
- **會話保持 (Session Persistence)**：在同一次瀏覽會話中保持圖片一致，避免頻繁閃爍，提升 UX。
- **Swup 深度整合**：內置對 Swup 頁面切換的 Native Hook 支持。

---

## 🚀 快速導覽
- **正式域名**：[https://pic.typelin.me](https://pic.typelin.me)
- **JSON API**：[https://pic.typelin.me/api.json](https://pic.typelin.me/api.json)
- **視覺畫廊**：[https://pic.typelin.me/gallery](https://pic.typelin.me/gallery)

---

## 🛠️ 建置與部署 (Build & Deploy)
本專案採用 Node.js 作為建置工具。

### 1. 準備圖片
- 將橫屏 (Landscape) 圖片放入 `ri/h/`。
- 將豎屏 (Portrait) 圖片放入 `ri/v/`。

### 2. 執行建置
```bash
# 安裝依賴 (僅需一次)
npm install

# 執行建置腳本
node build.js
```
建置腳本會將圖片隨機打亂並重新命名為 `1.webp`, `2.webp`... 等序列，並產出至 `dist/` 目錄。

### 3. 配置域名
修改 `config.json`：
```json
{
    "domain": "https://pic.typelin.me"
}
```

---

## 📖 客戶端使用指南 (Usage)
只需在 HTML 頁面頂部引入一次腳本：
```html
<script src="https://pic.typelin.me/random.js"></script>
```

### 1. 隨機背景 (精確匹配 #bg-box)
這專為特定主題設計。JS 會自動尋找 `id="bg-box"` 的元素，進行預載入 (Preloading) 並在成功後設置背景與 CSS 變數。
```html
<div id="bg-box"></div>
```

### 2. 通用隨機背景
對任意元素使用 `data-random-bg` 屬性：
```html
<div data-random-bg="h">我會變成隨機橫屏背景</div>
```

### 3. 圖片標籤 (img Tags)
使用 `alt` 屬性標記：
```html
<!-- 橫屏隨機圖 -->
<img alt="random:h">

<!-- 豎屏隨機圖 -->
<img alt="random:v">
```

---

## 📂 目錄結構
- `ri/`：圖片源文件目錄。
- `build.js`：建置核心邏輯。
- `dist/`：建置產物目錄（部署此文件夾至 Cloudflare Pages / GitHub Pages）。
- `config.json`：域名與環境配置。

## 📍 參考與鳴謝
- **原專案作者**：[afoim](https://github.com/afoim/Static_RandomPicAPI)
- **技術棧**：Node.js, Masonry.js, Lozad.js, Cloudflare Pages.

---
*Powered by Static Random Pic API.*
