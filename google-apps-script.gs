const SPREADSHEET_ID = "13s6gsA3mF2m7bJH9dJBGx2hEteGpV51Ok4caxQ8zv3k";
const PHOTO_FOLDER_NAME = "Maxicare Temperature Photos";

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";

  if (action !== "list") {
    return jsonResponse({ ok: true, message: "Maxicare temperature API is running." });
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  ensureHeaders(sheet);

  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter((row) => row.some(Boolean));
  const records = rows.map((row) => ({
    createdAt: normalizeDate(row[1] || row[0]),
    temperature: Number(row[2]),
    status: row[3] || "",
    unit: row[4] || "",
    department: row[5] || "",
    staff: row[6] || "",
    notes: row[7] || "",
    photo: row[8] || "",
    id: row[9] || "",
  })).reverse();

  return jsonResponse({ ok: true, records });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const action = payload.action || "save";
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  ensureHeaders(sheet);

  if (action === "delete") {
    const deleted = deleteRecordById(sheet, payload.id);
    return jsonResponse({ ok: true, deleted });
  }

  if (action === "update") {
    const updated = updateRecordById(sheet, payload);
    return jsonResponse({ ok: true, updated });
  }

  const photoUrl = payload.photo ? savePhoto(payload) : "";

  sheet.appendRow([
    new Date(),
    payload.createdAt || "",
    payload.temperature || "",
    payload.status || "",
    payload.unit || "",
    payload.department || "",
    payload.staff || "",
    payload.notes || "",
    photoUrl,
    payload.id || "",
  ]);

  return jsonResponse({ ok: true, photoUrl });
}

function ensureHeaders(sheet) {
  const headers = [
    "Saved At",
    "Reading Time",
    "Temperature C",
    "Status",
    "Storage Unit",
    "Department",
    "Staff",
    "Notes",
    "Photo URL",
    "Record ID",
  ];
  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = existingHeaders.some(Boolean);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function savePhoto(payload) {
  const folder = getOrCreateFolder(PHOTO_FOLDER_NAME);
  const base64 = payload.photo.replace(/^data:image\/jpeg;base64,/, "");
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    "image/jpeg",
    `temperature-${payload.id || Date.now()}.jpg`
  );
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function findRowByRecordId(sheet, recordId) {
  if (!recordId) return -1;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const ids = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(recordId)) {
      return index + 2;
    }
  }

  return -1;
}

function updateRecordById(sheet, payload) {
  const row = findRowByRecordId(sheet, payload.id);
  if (row === -1) return false;

  const existingPhotoUrl = sheet.getRange(row, 9).getValue();
  const photoUrl = payload.photo && String(payload.photo).startsWith("data:image")
    ? savePhoto(payload)
    : existingPhotoUrl;

  sheet.getRange(row, 1, 1, 10).setValues([[
    new Date(),
    payload.createdAt || "",
    payload.temperature || "",
    payload.status || "",
    payload.unit || "",
    payload.department || "",
    payload.staff || "",
    payload.notes || "",
    photoUrl || "",
    payload.id || "",
  ]]);

  return true;
}

function deleteRecordById(sheet, recordId) {
  const row = findRowByRecordId(sheet, recordId);
  if (row === -1) return false;

  sheet.deleteRow(row);
  return true;
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
