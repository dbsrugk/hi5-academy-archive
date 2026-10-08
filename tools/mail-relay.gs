// 하이파이브 아카이브 중계 (Google Apps Script)
// 1) 메일: 사이트 서버가 보낸 알림을 이 구글 계정의 Gmail로 발송
// 2) 드라이브: 제작 완료 이미지를 '학원 아카이브 제작물 / 연도 / 캠퍼스 / 날짜 제목' 폴더에 저장
const SECRET = "여기에_비밀키"; // 안내받은 비밀키로 바꿔 붙여넣기 (저장소에는 올리지 않음)
const SHARE_LINK = true; // true: 링크가 있는 사람은 '보기'만 가능 (사이트에서 Drive 버튼으로 열 수 있게). 끄려면 false

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: "forbidden" });
    if (d.action === "drive") return out(saveToDrive(d));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.to || "")) return out({ ok: false, error: "bad-to" });
    MailApp.sendEmail({
      to: d.to,
      subject: String(d.subject || "아카이브 알림").slice(0, 200),
      htmlBody: String(d.html || ""),
      name: "하이파이브 아카이브 알림",
      noReply: true,
    });
    return out({ ok: true, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// 폴더를 차례로 찾고 없으면 만든다 → 그 안에 이미지 저장
function saveToDrive(d) {
  const path = (d.folderPath || []).map(function (p) { return String(p).replace(/[\\/]/g, "_").slice(0, 100); }).filter(String);
  if (!path.length) return { ok: false, error: "no-folder" };
  let folder = DriveApp.getRootFolder();
  path.forEach(function (name) {
    const it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  });
  const saved = [];
  (d.files || []).slice(0, 30).forEach(function (f) {
    if (!f || !f.url) return;
    const res = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    const file = folder.createFile(res.getBlob().setName(String(f.name || "image").slice(0, 120)));
    saved.push(file.getName());
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
