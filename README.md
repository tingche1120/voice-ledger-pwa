# 日日記帳 Voice Ledger PWA

一個 iPhone 可用的 PWA 記帳 app 原型。目標是打開 app 後，可以用文字或語音快速記帳，先以本機資料與手動備份完成 A1.0，之後再接登入與雲端同步。

## 目前進度

目前版本：`A1.0.1`

已完成 A1.0 原型，A1.0.1 加入日曆滑動切月：

- 可加入 iPhone 主畫面的 PWA。
- 首頁包含月曆、快速記帳、本月支出、本月收入、結餘與最近紀錄。
- 日曆區可左右滑動切換月份，左滑往前一個月，右滑往後一個月，跨年會自動更新年份。
- 支援文字快速輸入與多筆解析。
- 支援日期解析，例如 `昨天午餐200`、`4月25午餐500`、`四月25午餐500`、`2026/2/10保險3000`。
- 支援確認視窗，可在儲存前修改類型、金額、分類、日期、備註，也可刪除候選筆數。
- 支援紀錄列表、編輯、刪除、搜尋、月份明細。
- 支援統計頁，顯示本月支出分類長條與圓餅比例。
- 支援自訂分類與關鍵字，設定頁可進入編輯模式新增、刪除、修改關鍵字。
- 支援 JSON 備份、JSON 還原與 CSV 匯出。
- 已加入 PWA icon 與 iPhone 主畫面名稱。
- 已部署到 GitHub repo：`tingche1120/voice-ledger-pwa`。

GitHub Pages 預計網址：

```text
https://tingche1120.github.io/voice-ledger-pwa/
```

若網址顯示 404，請到 GitHub repo 的 `Settings -> Pages` 啟用：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## 核心紀錄

### 技術方向

- 第一版是純前端 PWA。
- 主要檔案：
  - `index.html`
  - `styles.css`
  - `app.js`
  - `manifest.webmanifest`
  - `service-worker.js`
  - `icons/`
- 本機靜態伺服器：`server.js`
- 本機網址：

```text
http://localhost:4173
```

- 手機同 Wi-Fi 測試網址依電腦 IP 而定，例如：

```text
http://192.168.0.10:4173/
```

### 資料保存方式

目前資料存在使用者裝置的 `localStorage`，不同使用者不會互相看到資料。

使用的 key：

- `voice-ledger-records`：記帳紀錄
- `voice-ledger-categories`：自訂分類
- `voice-ledger-category-hints`：分類關鍵字

目前沒有雲端同步。換手機時請使用：

- `備份 JSON`：完整備份紀錄、分類、關鍵字
- `還原 JSON`：換手機或重裝後還原
- `匯出 CSV`：給 Numbers / Excel 查看

### 快速記帳解析

支援範例：

```text
午餐100
午餐一百 星巴克兩百
早餐80 午餐120 晚餐200
昨天午餐200 今天晚餐300
4月25午餐500
四月25午餐500
四月二十五號午餐500
2026/2/10保險3000
```

金額支援：

- 阿拉伯數字：`100`、`3000`
- 中文口語金額：`一百五`、`三千二`、`五萬八`

### 日期規則

- 沒有指定日期時，使用目前日曆選取日期。
- 說 `昨天`、`今天`、`明天`、`前天`、`大前天`、`後天`、`大後天` 時會自動對應相對日期。
- 說 `4月25` 或 `四月25` 時，年份使用目前日曆選取的年份。
- 說 `2026/2/10` 或 `2026年4月25` 時，使用輸入中的年份。

### 語音輸入現況

網頁語音辨識依瀏覽器支援度而定。iPhone Safari / PWA 對 Web Speech 支援不穩，尤其在區網 HTTP 測試時更有限。

目前 fallback：

- 支援 Web Speech 時：綠色按鈕可按住說話，放開解析。
- 不支援 Web Speech 時：按綠色按鈕會 focus 文字輸入框，讓 iPhone 鍵盤跳出，再由使用者按鍵盤上的麥克風 dictation。

### 分類與關鍵字

預設分類包含：

```text
餐飲、交通、購物、生活、娛樂、醫療、教育、保險、房租 / 房貸、貸款、薪資、退款、其他
```

自動分類使用關鍵字比對，並採用較長關鍵字優先。例如 `買課程` 會優先分類為 `教育`，不會被 `購物` 的 `買` 搶走。

教育分類目前關鍵字：

```text
補習、買課程、課程、學費、教材、書籍、考試、報名費、家教
```

使用者可在設定頁按 `分類與關鍵字 -> 編輯` 自行新增分類、修改關鍵字或刪除分類。

### 搜尋

月曆右上角搜尋按鈕會開啟搜尋面板。

搜尋範圍：

- 日期
- 備註
- 分類
- 類型：收入 / 支出

搜尋結果會列出所有符合資料，每筆顯示：

```text
日期｜備註 / 分類｜金額
```

點擊搜尋結果會跳到該日期。

## 本機開發

啟動本機 server：

```powershell
cd D:\Onedrive\codex-app-practice
node server.js
```

打開：

```text
http://localhost:4173
```

如果要讓手機連進電腦測試，手機和電腦需在同一個 Wi-Fi，並確認 Windows 防火牆允許 TCP `4173`。

## 部署紀錄

目前已推送到：

```text
https://github.com/tingche1120/voice-ledger-pwa
```

部署內容來自純靜態檔案，可用 GitHub Pages 直接發布。

公開前已確認沒有加入：

- API key
- token
- password
- private key
- `.agents/`
- `.codex/`
- log 檔

## 後續規劃

建議下一階段：

- A1.x：實機使用後修正 UI / 解析規則 / 備份流程。
- A2.0：接 Supabase 登入與雲端同步。
- A2.0 需要 Row Level Security，確保每個使用者只能讀寫自己的資料。
- 若要穩定語音，可考慮後端錄音轉文字，例如 Whisper / OpenAI transcription。
