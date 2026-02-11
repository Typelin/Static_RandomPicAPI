# Static Random Pic API 使用手冊 (Traditional Chinese Version)

本專案提供一個 **純靜態** 的隨機圖片 API 方案。其工作原理是在建置時將圖片重新命名，並生成一個包含隨機邏輯的客戶端 JavaScript 檔案。

## 🌟 核心特性

-   **完全靜態**：無需後端或 Edge Functions。可部署於 GitHub Pages, Cloudflare Pages, Vercel 等任何平台。
-   **智慧隨機化**：支援橫屏 (`h`) 與豎屏 (`v`) 圖片。
-   **會話保持 (Session Consistency)**：在同一瀏覽會話中，隨機圖片保持不變，提升使用者體驗。
-   **Swup 整合**：自動與 SPA 框架（如 Swup）的頁面切換鉤子對接。
-   **背景優化邏輯**：特別針對 `#bg-box` 元素進行預載入 (Preloading) 與透明度 CSS 變數處理。
-   **視覺化畫廊**：自動產出 `gallery.html` 供快速預覽所有資源。

## 🛠️ 安裝與建置

1.  **準備圖片**：
    *   將橫屏圖片放入 `ri/h/`。
    *   將豎屏圖片放入 `ri/v/`。
2.  **建置專案**：
    ```bash
    node build.js
    ```

建置腳本將會：
-   隨機打亂並命名所有圖片為 `1.webp`, `2.webp` ...
-   輸出所有結果至 `dist/` 資料夾（部署此資料夾即可）。
-   產生 `dist/random.js` (核心邏輯) 與 `dist/gallery.html` (視覺導覽)。

## ⚙️ 進階配置

您可以配置域名首碼（Domain Prefix），這對於 CDN 或跨域服務非常有幫助。

### 方法 1：環境變數 (CI/CD 推薦)
```bash
# Windows PowerShell 範例
$env:DOMAIN="https://pic.typelin.me"; node build.js
```

### 方法 2：config.json 檔案
在根目錄建立 `config.json`：
```json
{
    "domain": "https://pic.typelin.me"
}
```

## 🔌 客戶端調用方法

在您的 HTML 中引入腳本：
```html
<script src="https://pic.typelin.me/random.js"></script>
```

### 1. 隨機圖片 (`<img>`)
使用特殊的 `alt` 屬性標記：
```html
<img alt="random:h" title="隨機橫屏圖片">
<img alt="random:v" title="隨機豎屏圖片">
```

### 2. 精確背景控制 (`#bg-box`)
腳本會尋找 `id="bg-box"` 的元素並自動執行：
1. 取回隨機 URL（會話內唯一）。
2. 靜默預載入圖片。
3. 成功後設置為 `background-image`。
4. 加入 `.loaded` 類別名。
5. 更新 CSS 變數 `--card-bg` 之透明度效果。

### 3. 通用背景標記
使用 `data-random-bg` 屬性：
```html
<div data-random-bg="h">我是橫屏背景</div>
```

---
*Powered by Static Random Pic API.*
