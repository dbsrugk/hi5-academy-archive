// 하이파이브 아카이브 메일 중계 (Google Apps Script)
// 사이트 서버가 보낸 알림을 이 구글 계정의 Gmail로 발송합니다.
const SECRET = "여기에_비밀키"; // 안내받은 비밀키로 바꿔 붙여넣기 (저장소에는 올리지 않음)

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: "forbidden" });
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

// 처음 한 번 '실행'해서 메일 보내기 권한을 허용하는 용도
function 권한허용() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "아카이브 메일 중계 준비 완료", "이 메일이 오면 권한 허용이 끝난 거예요.");
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
