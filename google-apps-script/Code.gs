// Belinda Assessment — скрипт для Google Sheets (v2.1)
// Обновлено: добавлены passThreshold, tags, violations, violationDetails и др.

const SS = SpreadsheetApp.getActiveSpreadsheet();

function setup() {
  const sheets = {
    'Quizzes': ['id', 'title', 'description', 'category', 'group', 'product', 'createdAt', 'questions', 'caseIds', 'passThreshold', 'tags', 'isSession', 'isArchived'],
    'Sessions': ['id', 'title', 'description', 'category', 'group', 'product', 'createdAt', 'questions', 'timeLimit', 'availableFrom', 'availableUntil', 'passThreshold', 'isSession', 'isArchived'],
    'Results': ['id', 'quizId', 'quizTitle', 'userId', 'score', 'maxPossibleScore', 'percentage', 'date', 'status', 'answers', 'questions', 'manualScores', 'manualComments', 'violations', 'violationDetails', 'timeSpent'],
    'Employees': ['id', 'fullName', 'login', 'password', 'group', 'area', 'positionId', 'role', 'managedArea', 'managedGroups', 'createdAt'],
    'Positions': ['id', 'name'],
    'Assignments': ['id', 'quizId', 'targetType', 'targetArea', 'targetGroup', 'targetEmployeeId', 'assignedAt', 'isRetake']
  };

  Object.keys(sheets).forEach(name => {
    let sheet = SS.getSheetByName(name);
    if (!sheet) {
      sheet = SS.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight("bold").setBackground("#f3f3f3");
    } else {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      sheets[name].forEach(h => {
        if (headers.indexOf(h) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h).setFontWeight("bold").setBackground("#f3f3f3");
        }
      });
    }
  });
}

function doGet() {
  setup();
  const data = {};
  SS.getSheets().forEach(sheet => {
    const name = sheet.getName();
    const rows = sheet.getDataRange().getValues();
    const headers = rows.shift();
    if (!headers || headers.length === 0) return;
    data[name.toLowerCase()] = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { val = JSON.parse(val); } catch(e) {}
        }
        obj[h] = val;
      });
      return obj;
    });
  });
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const sheetName = params.sheet;
  const payload = params.data;
  const sheet = SS.getSheetByName(sheetName);
  
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({status: 'error'})).setMimeType(ContentService.MimeType.JSON);

  if (action === 'save') {
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIndex] == payload.id) { rowIndex = i + 1; break; }
    }
    const rowData = headers.map(h => {
      let val = payload[h];
      if (val === undefined || val === null) return "";
      return (typeof val === 'object') ? JSON.stringify(val) : val;
    });
    if (rowIndex > -1) sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    else sheet.appendRow(rowData);
  }

  if (action === 'delete') {
    const rows = sheet.getDataRange().getValues();
    const idIndex = rows[0].indexOf('id');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIndex] == params.id) { sheet.deleteRow(i + 1); break; }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
}
