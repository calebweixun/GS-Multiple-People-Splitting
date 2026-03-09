/**
 * 1. 提供網頁畫面 (並允許被 iframe 嵌入)
 */
function doGet(e) {
  var htmlOutput = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('閃電記帳 - 多人版')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    
  // 允許此網頁被嵌入到 GitHub Pages 的 iframe 中
  htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return htmlOutput;
}

/**
 * 2. 初始化試算表與表頭 (請先在編輯器手動執行一次此函式！)
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 初始化 app_log (記帳紀錄)
  var logSheet = ss.getSheetByName('app_log');
  if (!logSheet) {
    logSheet = ss.insertSheet('app_log');
    logSheet.appendRow(['id', 'amount', 'description', 'paidBy', 'splitType', 'date', 'sharesJson']);
    logSheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f3f4f6');
    logSheet.setFrozenRows(1);
  }

  // 初始化 app_config (人員名單)
  var configSheet = ss.getSheetByName('app_config');
  if (!configSheet) {
    configSheet = ss.insertSheet('app_config');
    configSheet.appendRow(['userId', 'userName']);
    configSheet.appendRow(['u1', '勛']);
    configSheet.appendRow(['u2', '孟']);
    configSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f4f6');
    configSheet.setFrozenRows(1);
  }

  // 初始化 app_settings (系統設定與密碼)
  var settingsSheet = ss.getSheetByName('app_settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('app_settings');
    settingsSheet.appendRow(['Key', 'Value']);
    settingsSheet.appendRow(['PASSWORD', '8888']); // 預設密碼為 8888
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f4f6');
    settingsSheet.setFrozenRows(1);
  }

  // 初始化 app_audit (操作紀錄)
  var auditSheet = ss.getSheetByName('app_audit');
  if (!auditSheet) {
    auditSheet = ss.insertSheet('app_audit');
    auditSheet.appendRow(['時間', '操作人', '動作', '詳細內容']);
    auditSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f3f4f6');
    auditSheet.setFrozenRows(1);
  }
}

/**
 * 內部函數：驗證密碼
 */
function verifyPassword(pwd) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_settings');
  if (!sheet) return true; // 尚未設定則放行
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'PASSWORD') {
      return data[i][1].toString() === (pwd || '').toString();
    }
  }
  return true; 
}

/**
 * 內部函數：寫入操作紀錄 (Audit Log)
 */
function logAudit(operator, action, details) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_audit');
  if (sheet) {
    sheet.appendRow([new Date().toISOString(), operator, action, details]);
  }
}

/**
 * 3. 取得初始化資料 
 */
function getInitialData(pwd) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 先取得人員名單 (登入畫面需要顯示人名)
  var configSheet = ss.getSheetByName('app_config');
  var usersData = configSheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][0]) {
      users.push({ id: usersData[i][0].toString(), name: usersData[i][1].toString() });
    }
  }

  // 檢查密碼，錯誤則只回傳人員名單並擋下紀錄讀取
  if (!verifyPassword(pwd)) {
    return { users: users, error: "AUTH_FAILED" };
  }

  // 密碼正確，讀取歷史紀錄
  var logSheet = ss.getSheetByName('app_log');
  var logData = logSheet.getDataRange().getValues();
  var transactions = [];
  
  for (var j = 1; j < logData.length; j++) {
    var row = logData[j];
    if (!row[0]) continue;
    
    var tx = {
      id: row[0].toString(),
      amount: Number(row[1]),
      description: row[2].toString(),
      paidBy: row[3].toString(),
      splitType: row[4].toString(),
      date: new Date(row[5]).toISOString()
    };
    
    if (row[6]) {
      try { tx.shares = JSON.parse(row[6]); } catch(e) { tx.shares = {}; }
    }
    transactions.push(tx);
  }
  
  return { users: users, transactions: transactions.reverse() };
}

/**
 * 4. 新增一筆紀錄
 */
function addTransaction(pwd, operatorName, tx) {
  if (!verifyPassword(pwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_log');
  
  var sharesJson = '';
  if ((tx.splitType === 'custom' || tx.splitType === 'settlement') && tx.shares) {
    sharesJson = JSON.stringify(tx.shares);
  }
  
  sheet.appendRow([tx.id, tx.amount, tx.description, tx.paidBy, tx.splitType, tx.date, sharesJson]);
  logAudit(operatorName, '新增', tx.description + ' ($' + tx.amount + ')');
  return true;
}

/**
 * 5. 更新一筆紀錄
 */
function updateTransaction(pwd, operatorName, tx) {
  if (!verifyPassword(pwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_log');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === tx.id) {
      var sharesJson = '';
      if ((tx.splitType === 'custom' || tx.splitType === 'settlement') && tx.shares) {
        sharesJson = JSON.stringify(tx.shares);
      }
      sheet.getRange(i + 1, 2, 1, 6).setValues([[tx.amount, tx.description, tx.paidBy, tx.splitType, tx.date, sharesJson]]);
      logAudit(operatorName, '修改', tx.description + ' ($' + tx.amount + ')');
      return true;
    }
  }
  return false;
}

/**
 * 6. 刪除一筆紀錄
 */
function deleteTransaction(pwd, operatorName, id) {
  if (!verifyPassword(pwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_log');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id) {
      var desc = data[i][2]; // 記錄被刪除的項目名稱
      sheet.deleteRow(i + 1);
      logAudit(operatorName, '刪除', '移除了紀錄: ' + desc);
      return true;
    }
  }
  return false;
}

/**
 * 7. 新增使用者
 */
function addUser(pwd, operatorName, user) {
  if (!verifyPassword(pwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_config');
  sheet.appendRow([user.id, user.name]);
  logAudit(operatorName, '設定', '新增成員: ' + user.name);
  return true;
}

// --- AI 辨識後端邏輯 ---

// ⚠️ 請在這裡填入你申請的 Gemini API Key (絕對安全，不會暴露在網頁上)
const GEMINI_API_KEY = '請將你的_API_KEY_貼在這裡';

/**
 * 處理前端傳來的照片，呼叫 Gemini API
 */
function analyzeReceipt(base64Data, mimeType) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === '請將你的_API_KEY_貼在這裡') {
    throw new Error("後端尚未設定 API Key，請至 Code.gs 填寫。");
  }

  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
  var prompt = "你是一個專業的記帳助手。請辨識這張收據或發票的照片。找出『總金額』與『最可能的消費項目/店名』。請嚴格以 JSON 格式回傳，且不要包含 markdown 標籤，格式必須完全如： {\"amount\": 500, \"item\": \"家樂福日常用品\"} 。如果找不到，請回傳 {\"amount\": 0, \"item\": \"無法辨識\"}。";

  var payload = {
    "contents": [{
      "role": "user",
      "parts": [
        { "text": prompt },
        { "inlineData": { "mimeType": mimeType, "data": base64Data } }
      ]
    }]
  };

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error("AI API 請求失敗: " + (json.error ? json.error.message : "未知錯誤"));
  }

  var textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  var cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleanJson);
  } catch(e) {
    throw new Error("無法解析 AI 回傳結果");
  }
}