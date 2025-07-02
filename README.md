# 英文單字測試系統 📚

一個全功能的英文單字學習與測試平台，支援多用戶系統、智能選題、排行榜競賽等功能。

## ✨ 主要功能

### 🔐 用戶管理系統
- **多用戶登入**：支援用戶註冊與登入
- **管理員權限**：內建 `admin` 管理員帳號，可管理單字庫
- **個人化數據**：每位用戶獨立的測試記錄和錯題本

### 🎯 智能測試系統
- **多種題型**：
  - 英翻中（選擇題）
  - 中翻英（選擇題）
  - 拼寫測試（填空題）
- **智能選題**：
  - 20% 錯題複習 + 80% 新單字
  - 錯誤率越高的單字被選中機率越高
  - 確保每次測試不重複選題
- **語音朗讀**：自動播放英文單字發音（gTTS）

### 📊 學習追蹤
- **詳細統計**：記錄每個單字的測試次數和錯誤次數
- **錯題本**：按錯誤率排序，顯示前100個最需加強的單字
- **歷史成績**：個人測試記錄和成績趨勢圖表
- **排行榜**：按平均分數排名的全站競賽榜

### 🛠️ 管理功能
- **單字庫管理**（管理員專用）：
  - 上傳單字文件（支援特定格式）
  - 清空單字庫
  - 單字庫統計

## 🚀 快速開始

### 環境需求
- Node.js 14+
- Python 3.6+
- npm 或 yarn

### 安裝步驟

1. **克隆項目**
```bash
git clone https://github.com/[your-username]/english-vocab-tester.git
cd english-vocab-tester
```

2. **安裝後端依賴**
```bash
cd backend
npm install
pip install -r requirements.txt
```

3. **安裝前端依賴**
```bash
cd ../frontend
npm install
```

4. **構建前端**
```bash
npm run build
```

5. **啟動服務器**
```bash
cd ../backend
node server.js
```

6. **訪問應用**
- 本地訪問：`http://localhost:3001`
- 網路訪問：`http://[your-ip]:3001`

## 📱 使用說明

### 首次使用
1. 訪問應用網址
2. 使用任意用戶名登入（系統會自動創建帳號）
3. 管理員請使用用戶名 `admin` 登入

### 管理員操作
1. 登入後可看到 "單字庫管理" 區塊
2. 上傳單字文件（格式：`單字 詞性 中文翻譯`，每行一個）
3. 例如：`apple n. 蘋果`

### 一般用戶操作
1. 選擇測試範圍和題數
2. 選擇題型（英翻中、中翻英、拼寫）
3. 開始測試
4. 查看成績和錯題本
5. 與其他用戶競爭排行榜

## 🏗️ 技術架構

### 前端
- **React 19**：用戶界面框架
- **Bootstrap 5**：UI組件庫
- **Chart.js**：成績圖表
- **Axios**：API請求

### 後端
- **Node.js + Express**：服務器框架
- **SQLite**：輕量級數據庫
- **Multer**：文件上傳處理
- **Python + gTTS**：語音合成

### 數據庫設計
- `users`：用戶資料和角色
- `words`：單字庫和統計
- `tests`：測試記錄
- `mistakes`：錯題記錄

## 📁 項目結構

```
english-vocab-tester/
├── backend/                 # 後端服務器
│   ├── server.js           # 主服務器文件
│   ├── gtts_synthesize.py  # 語音合成腳本
│   ├── database.db         # SQLite數據庫
│   └── uploads/            # 上傳文件目錄
├── frontend/               # 前端應用
│   ├── src/
│   │   └── App.js          # 主應用組件
│   └── build/              # 構建後的靜態文件
├── CLAUDE.md              # Claude開發指南
└── README.md              # 項目說明
```

## 🎮 功能演示

### 智能選題演算法
- 系統會自動分析你的學習記錄
- 優先複習錯誤率高的單字
- 平衡新舊單字的學習比例

### 排行榜系統
- 按平均分數排名
- 顯示測試次數、最高分數等詳細統計
- 激勵用戶持續學習

### 錯題本功能
- 按錯誤率從高到低排序
- 顯示詳細的錯誤統計
- 支援錯題專項複習

## 🔧 自定義配置

### 單字文件格式
上傳的文件需要遵循以下格式：
```
apple n. 蘋果
beautiful adj. 美麗的
quickly adv. 快速地
```

### 網路配置
- 後端服務器監聽所有網路接口 (`0.0.0.0:3001`)
- 前端會自動檢測訪問來源並選擇正確的API地址
- 支援手機等移動設備訪問

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 這個項目
2. 創建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改動 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟一個 Pull Request

## 📄 授權條款

本項目採用 MIT 授權條款 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 🙏 致謝

- 感謝 Google Text-to-Speech (gTTS) 提供語音合成服務
- 感謝所有開源社區的貢獻者

## 📞 聯繫方式

如有問題或建議，請開啟 Issue 或聯繫項目維護者。

---

**Happy Learning! 📚✨**