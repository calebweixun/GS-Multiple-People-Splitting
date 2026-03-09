/**
 * 1. 提供網頁畫面 (並允許被 iframe 嵌入)
 */
function doGet(e) {
  var htmlOutput = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('閃電記帳 - 多人版')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    
  htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return htmlOutput;
}

/**
 * 🛠️ 終極防護：寫入時強制純文字 (防止 0 被吃掉，或 3/4 被當成日期)
 */
function forceText(val) {
  if (val === null || val === undefined) return '';
  // 無論是什麼字串，強制在開頭加上單引號，保證試算表 100% 視為純文字
  return "'" + val.toString();
}

/**
 * 🛠️ 終極防護：讀取時清除引號 (防止引號污染前端資料)
 */
function cleanText(val) {
  if (val === null || val === undefined) return '';
  var str = val.toString();
  // 拔除由 forceText 加上的開頭單引號
  if (str.charAt(0) === "'") return str.substring(1);
  return str;
}

/**
 * 2. 初始化試算表與表頭
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var logSheet = ss.getSheetByName('app_log');
  if (!logSheet) {
    logSheet = ss.insertSheet('app_log');
    logSheet.appendRow(['id', 'amount', 'description', 'paidBy', 'splitType', 'date', 'sharesJson']);
    logSheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f3f4f6');
    logSheet.setFrozenRows(1);
  }

  var configSheet = ss.getSheetByName('app_config');
  if (!configSheet) {
    configSheet = ss.insertSheet('app_config');
    configSheet.appendRow(['userId', 'userName']);
    configSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f4f6');
    configSheet.setFrozenRows(1);
  }

  var settingsSheet = ss.getSheetByName('app_settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('app_settings');
    settingsSheet.appendRow(['Key', 'Value']);
    settingsSheet.appendRow(['PASSWORD', forceText('8888')]); // 預設密碼寫入時加保護
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f4f6');
    settingsSheet.setFrozenRows(1);
  }

  var auditSheet = ss.getSheetByName('app_audit');
  if (!auditSheet) {
    auditSheet = ss.insertSheet('app_audit');
    auditSheet.appendRow(['時間', '操作人', '動作', '詳細內容']);
    auditSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f3f4f6');
    auditSheet.setFrozenRows(1);
  }
}

function verifyPassword(pwd) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_settings');
  if (!sheet) return true; 
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'PASSWORD') {
      // 讀取時脫殼比對
      return cleanText(data[i][1]) === (pwd || '').toString();
    }
  }
  return true; 
}

function logAudit(operator, action, details) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_audit');
  if (sheet) {
    sheet.appendRow([
      forceText(new Date().toISOString()), 
      forceText(operator), 
      forceText(action), 
      forceText(details)
    ]);
  }
}

/**
 * 3. 取得初始化資料 
 */
function getInitialData(pwd) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!verifyPassword(pwd)) return { error: "AUTH_FAILED" };

  var configSheet = ss.getSheetByName('app_config');
  var usersData = configSheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][0]) {
      users.push({ 
        id: cleanText(usersData[i][0]), 
        name: cleanText(usersData[i][1]) 
      });
    }
  }

  var logSheet = ss.getSheetByName('app_log');
  var logData = logSheet.getDataRange().getValues();
  var transactions = [];
  
  for (var j = 1; j < logData.length; j++) {
    var row = logData[j];
    if (!row[0]) continue;
    
    var tx = {
      id: cleanText(row[0]),
      amount: Number(row[1]), // 金額維持數字
      description: cleanText(row[2]),
      paidBy: cleanText(row[3]),
      splitType: cleanText(row[4]),
      date: cleanText(row[5]) // 日期也用純文字脫殼
    };
    
    if (row[6]) {
      try { tx.shares = JSON.parse(cleanText(row[6])); } catch(e) { tx.shares = {}; }
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
  
  // 寫入時全面加上 forceText 裝甲 (金額除外)
  sheet.appendRow([
    forceText(tx.id), 
    tx.amount, 
    forceText(tx.description), 
    forceText(tx.paidBy), 
    forceText(tx.splitType), 
    forceText(tx.date), 
    forceText(sharesJson)
  ]);
  logAudit(operatorName, '新增', forceText(tx.description) + ' ($' + tx.amount + ')');
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
    // 尋找時脫殼比對
    if (cleanText(data[i][0]) === cleanText(tx.id)) {
      var sharesJson = '';
      if ((tx.splitType === 'custom' || tx.splitType === 'settlement') && tx.shares) {
        sharesJson = JSON.stringify(tx.shares);
      }
      sheet.getRange(i + 1, 2, 1, 6).setValues([[
        tx.amount, 
        forceText(tx.description), 
        forceText(tx.paidBy), 
        forceText(tx.splitType), 
        forceText(tx.date), 
        forceText(sharesJson)
      ]]);
      logAudit(operatorName, '修改', forceText(tx.description) + ' ($' + tx.amount + ')');
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
    if (cleanText(data[i][0]) === cleanText(id)) {
      var desc = data[i][2];
      sheet.deleteRow(i + 1);
      logAudit(operatorName, '刪除', '移除了紀錄: ' + cleanText(desc));
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
  sheet.appendRow([forceText(user.id), forceText(user.name)]);
  logAudit(operatorName, '設定', '新增成員: ' + forceText(user.name));
  return true;
}

/**
 * 8. 修改密碼
 */
function changePassword(oldPwd, newPwd, operatorName) {
  if (!verifyPassword(oldPwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_settings');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'PASSWORD') {
      sheet.getRange(i + 1, 2).setValue(forceText(newPwd));
      logAudit(operatorName, '系統', '修改了群組密碼');
      return true;
    }
  }
  sheet.appendRow(['PASSWORD', forceText(newPwd)]);
  logAudit(operatorName, '系統', '設定了群組密碼');
  return true;
}

/**
 * 9. 編輯使用者
 */
function updateUser(pwd, operatorName, userId, newName) {
  if (!verifyPassword(pwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_config');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) === cleanText(userId)) {
      var oldName = data[i][1];
      sheet.getRange(i + 1, 2).setValue(forceText(newName));
      logAudit(operatorName, '設定', '將成員「' + cleanText(oldName) + '」更名為: ' + forceText(newName));
      return true;
    }
  }
  return false;
}

/**
 * 10. 刪除使用者
 */
function deleteUser(pwd, operatorName, userId) {
  if (!verifyPassword(pwd)) throw new Error("AUTH_FAILED");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_config');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) === cleanText(userId)) {
      var userName = data[i][1];
      sheet.deleteRow(i + 1);
      logAudit(operatorName, '設定', '刪除了成員: ' + cleanText(userName));
      return true;
    }
  }
  return false;
}


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