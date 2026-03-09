/**
 * 1. 提供網頁畫面
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('閃電記帳 - 多人版')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
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
    var logHeader = logSheet.getRange(1, 1, 1, 7);
    logHeader.setFontWeight('bold').setBackground('#f3f4f6');
    logSheet.setFrozenRows(1);
  }

  // 初始化 app_config (設定/人員)
  var configSheet = ss.getSheetByName('app_config');
  if (!configSheet) {
    configSheet = ss.insertSheet('app_config');
    configSheet.appendRow(['userId', 'userName']);
    configSheet.appendRow(['u1', '勛']);
    configSheet.appendRow(['u2', '孟']);
    var configHeader = configSheet.getRange(1, 1, 1, 2);
    configHeader.setFontWeight('bold').setBackground('#f3f4f6');
    configSheet.setFrozenRows(1);
  }
}

/**
 * 3. 取得初始化資料 (包含使用者與歷史紀錄)
 */
function getInitialData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 讀取 Users
  var configSheet = ss.getSheetByName('app_config');
  var usersData = configSheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][0]) {
      users.push({ id: usersData[i][0].toString(), name: usersData[i][1].toString() });
    }
  }

  // 讀取 Transactions
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
    
    // 解析 JSON 分攤資料
    if (row[6]) {
      try {
        tx.shares = JSON.parse(row[6]);
      } catch(e) {
        tx.shares = {};
      }
    }
    
    transactions.push(tx);
  }
  
  return {
    users: users,
    transactions: transactions.reverse() // 最新在前
  };
}

/**
 * 4. 新增一筆紀錄
 */
function addTransaction(tx) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_log');
  
  // 將 shares 物件轉為 JSON 字串
  var sharesJson = '';
  if ((tx.splitType === 'custom' || tx.splitType === 'settlement') && tx.shares) {
    sharesJson = JSON.stringify(tx.shares);
  }
  
  sheet.appendRow([
    tx.id,
    tx.amount,
    tx.description,
    tx.paidBy,
    tx.splitType,
    tx.date,
    sharesJson
  ]);
  
  return true;
}

/**
 * 5. 更新一筆紀錄
 */
function updateTransaction(tx) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_log');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === tx.id) {
      var sharesJson = '';
      if ((tx.splitType === 'custom' || tx.splitType === 'settlement') && tx.shares) {
        sharesJson = JSON.stringify(tx.shares);
      }
      // ID 位於第1欄，我們從第2欄開始更新後續的6個欄位
      sheet.getRange(i + 1, 2, 1, 6).setValues([[
        tx.amount,
        tx.description,
        tx.paidBy,
        tx.splitType,
        tx.date,
        sharesJson
      ]]);
      return true;
    }
  }
  return false;
}

/**
 * 6. 刪除一筆紀錄
 */
function deleteTransaction(id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_log');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * 7. 新增使用者
 */
function addUser(user) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('app_config');
  sheet.appendRow([user.id, user.name]);
  return true;
}