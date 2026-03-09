# ⚡️ 閃電記帳 - 多人分攤版 (GS-Multiple-People-Splitting)

[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=flat-square&logo=google-apps-script&logoColor=white)](https://developers.google.com/apps-script)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

一個輕量、快速且基於 **Google 試算表** 的多人記帳與分攤解決方案。專為頻繁的多人支出情境設計，支援即時結算與客製化比例分攤。

---

## ✨ 主要功能

- � **極速記帳**：專為行動端優化的介面，隨手記帳毫不費力。
- 👥 **多人管理**：支援多位使用者，動態計算每人應付與應收金額。
- 📊 **多樣分攤模式**：
  - **均分**：一鍵平分總額。
  - **客製化比例**：手動調整每個人的分攤比例或金額。
  - **結算模式**：專門記錄還款與債務清償。
- 📜 **歷史紀錄**：完整的交易清單，支援即時修改與刪除。
- ☁️ **雲端同步**：資料完全存儲於 Google Spreadsheet，無需額外資料庫。

---

## 🛠 技術棧

- **後端**: Google Apps Script (GAS)
- **前端**: HTML5 / JavaScript (Vanilla)
- **樣式**: Tailwind CSS (CDN 載入)
- **資料庫**: Google Sheets

---

## 🚀 快速開始

### 1. 建立試算表
在 [Google Sheets](https://sheets.new) 建立一份新的試算表。

### 2. 設定 Google Apps Script
1. 點擊功能選單：`Extensions` > `Apps Script`。
2. 刪除預設代碼，貼入 `Code.gs` 的內容。
3. 新增 HTML 檔案命名為 `Index`，貼入 `Index.html` 的內容。

### 3. 初始化工作表
1. 在 GAS 編輯器中選擇 `setupSheet` 函式並點擊 **Run**。
2. 此動作會自動建立 `app_log` 與 `app_config` 兩個工作表並初始化欄位。

### 4. 部署應用程式
1. 點擊 **Deploy** > **New Deployment**。
2. Select type 選擇 **Web App**。
3. 設定：
   - **Execute as**: Me
   - **Who has access**: Anyone
4. 點擊 **Deploy** 並獲取 Web App URL。

---

## � 檔案結構

- `Code.gs`: 處理 Google Sheets API 溝通、資料讀寫、試算表初始化。
- `Index.html`: 單頁式網頁應用程式 (SPA)，包含介面邏輯與樣式。
- `README.md`: 專案操作與說明。

---

## 💡 注意事項

- 請確保在首次使用前執行過 `setupSheet`。
- 使用者名單可在 `app_config` 工作表中直接手動編輯或擴充。

---

© 2026 閃電記帳團隊