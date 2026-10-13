// 하이파이브 아카이브 중계 (Google Apps Script)
// 1) 메일: 사이트 서버가 보낸 알림을 이 구글 계정의 Gmail로 발송
// 2) 드라이브 저장: 제작 완료 이미지를 '학원 아카이브 제작물 / …' 폴더에 저장
// 3) 자료함 바로 올리기: 브라우저가 이 계정 드라이브로 파일을 직접 올릴 수 있게 '업로드 창구'를 열어 줌 (용량 제한 없음)
const SECRET = "여기에_비밀키"; // 안내받은 비밀키로 바꿔 붙여넣기 (저장소에는 올리지 않음)
const SHARE_LINK = true; // 제작물 폴더: 링크가 있는 사람은 '보기'만 가능. 비공개로 두려면 false

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: "forbidden" });
    if (d.action === "upload-start") return out(uploadStart(d));
    if (d.action === "drive") return out(saveToDrive(d));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.to || "")) return out({ ok: false, error: "bad-to" });
    MailApp.sendEmail({ to: d.to, subject: String(d.subject || "아카이브 알림").slice(0, 200), htmlBody: String(d.html || ""), name: "하이파이브 아카이브 알림", noReply: true });
    return out({ ok: true, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// 폴더를 차례로 찾고 없으면 만든다
function ensurePath(names) {
  let folder = DriveApp.getRootFolder();
  (names || []).map(function (p) { return String(p).replace(/[\\/]/g, "_").slice(0, 100); }).filter(String).forEach(function (name) {
    const it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  });
  return folder;
}

// 자료함: 드라이브 '업로드 창구(세션 주소)'를 열어 브라우저에 넘겨준다. 파일은 브라우저 → 구글로 직접 간다.
function uploadStart(d) {
  const folder = d.folderId ? DriveApp.getFolderById(d.folderId) : ensurePath(d.folderPath);
  const res = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,webViewLink", {
    method: "post",
    contentType: "application/json; charset=UTF-8",
    payload: JSON.stringify({ name: String(d.name || "file").slice(0, 200), parents: [folder.getId()] }),
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      "X-Upload-Content-Type": d.type || "application/octet-stream",
      "X-Upload-Content-Length": String(d.size || 0),
      Origin: d.origin || "https://hi5-academy-archive.vercel.app",
    },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: "start " + res.getResponseCode() + " " + res.getContentText().slice(0, 200) };
  const h = res.getAllHeaders();
  return { ok: true, uploadUrl: h.Location || h.location, folderId: folder.getId(), folderUrl: folder.getUrl() };
}

// 제작 완료 이미지 저장 (사이트 저장소 → 드라이브)
function saveToDrive(d) {
  const folder = ensurePath(d.folderPath);
  const saved = [];
  (d.files || []).slice(0, 30).forEach(function (f) {
    if (!f || !f.url) return;
    const res = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    saved.push(folder.createFile(res.getBlob().setName(String(f.name || "image").slice(0, 120))).getName());
  });
  if (SHARE_LINK) folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: saved.length > 0, folderUrl: folder.getUrl(), saved: saved.length, error: saved.length ? undefined : "no-files" };
}

// 처음 한 번 '실행'해서 메일·드라이브 권한을 허용하는 용도
function 권한허용() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch("https://www.google.com", { muteHttpExceptions: true });
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "아카이브 중계 준비 완료", "이 메일이 오면 메일·드라이브 권한 허용이 끝난 거예요.");
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
