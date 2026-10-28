"""T01~T17 API 시나리오 검사 스크립트 (05_테스트시나리오.md 기준).

사용법 (저장소 루트에서, 백엔드를 켠 상태로):
  python3 tools/manual_tests.py                      # T01~T09, T11~T14, T17
  python3 tools/manual_tests.py --expiry             # TOKEN_TTL=3으로 켠 서버에서 T10만
  python3 tools/manual_tests.py --t15 save           # T15: 서버 재시작 전 글 저장
  python3 tools/manual_tests.py --t15 verify         # T15: 서버 재시작 후 같은 글 확인

결과는 화면과 docs/evidence/api-tests.log 에 기록된다(기존 내용 뒤에 추가).
토큰 원문은 앞 10글자만 남기고 가린다. T11의 화면 확인, T15 재시작, T16은 브라우저에서 직접 확인한다.
외부 패키지 없이 Python 표준 라이브러리만 사용한다.
"""

import argparse
import json
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = "http://127.0.0.1:8000/api"
PASSWORD = "Classroom!2026"
ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "docs" / "evidence" / "api-tests.log"
T15_FILE = ROOT / "docs" / "evidence" / "t15-post-id.txt"

lines = []  # 로그에 쓸 줄
results = []  # (ID, PASS/FAIL)


def out(text=""):
    print(text)
    lines.append(text)


def mask(token):
    return token[:10] + "…(가림)" if token else "-"


def call(method, path, body=None, token=None, raw_auth=None):
    """HTTP 요청을 보내고 (상태코드, JSON 또는 None, 헤더, 원본 본문)을 돌려준다."""
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if raw_auth is not None:
        req.add_header("Authorization", raw_auth)
    elif token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            status, content, headers = r.status, r.read(), r.headers
    except urllib.error.HTTPError as e:
        status, content, headers = e.code, e.read(), e.headers
    try:
        parsed = json.loads(content) if content else None
    except json.JSONDecodeError:
        parsed = None
    return status, parsed, headers, content


def check(tid, desc, who, method, path, expect_status, expect_code=None,
          body=None, token=None, raw_auth=None, need_header=None, extra=None):
    """요청 하나를 보내고 예상과 실제를 한 줄로 기록한다."""
    status, data, headers, content = call(method, path, body, token, raw_auth)
    code = data.get("code") if isinstance(data, dict) else None
    ok = status == expect_status and (expect_code is None or code == expect_code)
    notes = []
    if need_header:
        name, value = need_header
        got = headers.get(name)
        notes.append(f"{name}: {got}")
        ok = ok and got is not None and (value is None or got == value)
    if expect_status == 204:
        notes.append(f"본문 {len(content)}바이트")
        ok = ok and len(content) == 0
    if extra:
        msg, passed = extra(status, data)
        notes.append(msg)
        ok = ok and passed
    expected = f"{expect_status}" + (f" {expect_code}" if expect_code else "")
    actual = f"{status}" + (f" {code}" if code else "")
    out(f"| {tid} | {desc} | {who} | {method} {path} | {expected} | {actual} | "
        f"{'; '.join(notes) or '-'} | {'PASS' if ok else 'FAIL'} |")
    results.append((tid, ok))
    return status, data


def login(email):
    status, data, _, _ = call("POST", "/auth/login", {"email": email, "password": PASSWORD})
    if status != 200:
        raise SystemExit(f"{email} 로그인 실패: HTTP {status} {data}. 서버가 켜져 있는지 확인하세요.")
    return data["accessToken"]


def get_post(pid):
    return call("GET", f"/posts/{pid}")[1]


def same_as(before):
    """실패한 요청 뒤 재조회해서 글이 그대로인지 확인하는 extra 함수를 만든다."""
    def _check(_status, _data):
        after = get_post(before["id"])
        same = after == before
        return ("재조회: 원문 유지" if same else f"재조회: 변경됨! {after}"), same
    return _check


def header():
    out()
    out(f"## 실행 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  (대상 {BASE})")
    out()
    out("| ID | 조건 | 사용자 | 요청 | 예상 | 실제 HTTP/code | 확인 내용 | 판정 |")
    out("|---|---|---|---|---|---|---|---|")


def run_main():
    a_tok, b_tok = login("alice@class.test"), login("bob@class.test")
    out(f"Alice 토큰 {mask(a_tok)} / Bob 토큰 {mask(b_tok)}")
    header()

    # 준비: 공개 조회용 Alice 글
    seed = call("POST", "/posts", {"title": "T01 공개 조회용", "content": "공개 조회 확인"}, a_tok)[1]
    sid = seed["id"]

    # T01 공개 조회
    check("T01", "토큰 없이 목록", "없음", "GET", "/posts", 200,
          extra=lambda s, d: (f"{len(d)}개", isinstance(d, list)))
    check("T01", "토큰 없이 존재하는 글 상세", "없음", "GET", f"/posts/{sid}", 200)

    # T02 로그인
    check("T02", "올바른 계정 로그인", "Alice", "POST", "/auth/login", 200,
          body={"email": "alice@class.test", "password": PASSWORD},
          extra=lambda s, d: (
              f"token {mask(d.get('accessToken'))}, expiresIn {d.get('expiresIn')}, user {d.get('user')}",
              bool(d.get("accessToken")) and d.get("user") == {"id": 1, "name": "Alice", "email": "alice@class.test"}))

    # T03 잘못된 계정
    no_token = lambda s, d: ("accessToken 없음", "accessToken" not in (d or {}))
    check("T03", "틀린 비밀번호", "Alice", "POST", "/auth/login", 401, "INVALID_CREDENTIALS",
          body={"email": "alice@class.test", "password": "wrong"}, extra=no_token)
    check("T03", "없는 이메일", "-", "POST", "/auth/login", 401, "INVALID_CREDENTIALS",
          body={"email": "nobody@class.test", "password": PASSWORD}, extra=no_token)

    # T04 토큰 없음
    www = ("WWW-Authenticate", "Bearer")
    check("T04", "토큰 없이 /me", "없음", "GET", "/me", 401, "TOKEN_REQUIRED", need_header=www)
    count = len(call("GET", "/posts")[1])
    check("T04", "토큰 없이 글 등록", "없음", "POST", "/posts", 401, "TOKEN_REQUIRED",
          body={"title": "무토큰", "content": "x"}, need_header=www,
          extra=lambda s, d: ("글 수 변화 없음", len(call("GET", "/posts")[1]) == count))
    check("T04", "Bearer 형식 오류(Basic)", "Alice", "GET", "/me", 401, "TOKEN_REQUIRED",
          raw_auth="Basic " + a_tok, need_header=www)

    # T05 작성과 /me
    s, p = check("T05", "Alice 글 작성", "Alice", "POST", "/posts", 201,
                 body={"title": "T05 Alice 글", "content": "본문"}, token=a_tok,
                 need_header=("Location", None),
                 extra=lambda s, d: (f"authorId {d.get('authorId')}", d.get("authorId") == 1))
    pid = p["id"]
    check("T05", "Alice /me", "Alice", "GET", "/me", 200, token=a_tok,
          extra=lambda s, d: (f"{d}", d == {"id": 1, "name": "Alice", "email": "alice@class.test"}))

    # T07 / T08 Bob이 Alice 글 변경 시도
    before = get_post(pid)
    check("T07", "Bob이 Alice 글 수정", "Bob", "PUT", f"/posts/{pid}", 403, "FORBIDDEN",
          body={"title": "Bob 수정", "content": "x"}, token=b_tok, extra=same_as(before))
    check("T08", "Bob이 Alice 글 삭제", "Bob", "DELETE", f"/posts/{pid}", 403, "FORBIDDEN",
          token=b_tok, extra=same_as(before))

    # T09 서명 첫 글자 변조
    h, pl, sig = a_tok.split(".")
    tampered = f"{h}.{pl}.{('B' if sig[0] == 'A' else 'A')}{sig[1:]}"
    out(f"| T09 | 변조 토큰 준비 | Alice | 서명 첫 글자 {sig[0]} → {tampered.split('.')[2][0]} | - | - | {mask(tampered)} | - |")
    check("T09", "변조 토큰 /me", "Alice", "GET", "/me", 401, "INVALID_TOKEN", token=tampered, need_header=www)
    count = len(call("GET", "/posts")[1])
    check("T09", "변조 토큰 등록", "Alice", "POST", "/posts", 401, "INVALID_TOKEN",
          body={"title": "변조", "content": "x"}, token=tampered,
          extra=lambda s, d: ("글 수 변화 없음", len(call("GET", "/posts")[1]) == count))
    check("T09", "변조 토큰 수정", "Alice", "PUT", f"/posts/{pid}", 401, "INVALID_TOKEN",
          body={"title": "변조", "content": "x"}, token=tampered, extra=same_as(before))
    check("T09", "변조 토큰 삭제", "Alice", "DELETE", f"/posts/{pid}", 401, "INVALID_TOKEN",
          token=tampered, extra=same_as(before))

    # T11 로그아웃 후 요청 (API 관점: 헤더 없는 요청)
    check("T11", "로그아웃 후 /me (헤더 없음)", "없음", "GET", "/me", 401, "TOKEN_REQUIRED", need_header=www)

    # T12 작성자 위조
    count = len(call("GET", "/posts")[1])
    unchanged = lambda s, d: ("위조 글 미생성", len(call("GET", "/posts")[1]) == count)
    check("T12", "등록에 authorId:1 추가", "Bob", "POST", "/posts", 400, "BAD_INPUT",
          body={"title": "위조", "content": "x", "authorId": 1}, token=b_tok, extra=unchanged)
    check("T12", "등록에 userId:1 추가", "Bob", "POST", "/posts", 400, "BAD_INPUT",
          body={"title": "위조", "content": "x", "userId": 1}, token=b_tok, extra=unchanged)

    # T13 입력 검증 (본인 글 수정)
    before = get_post(pid)
    for desc, body in [
        ("빈 제목", {"title": "", "content": "본문"}),
        ("공백 본문", {"title": "제목", "content": "   "}),
        ("제목 101자", {"title": "x" * 101, "content": "본문"}),
        ("본문 5001자", {"title": "제목", "content": "x" * 5001}),
    ]:
        check("T13", desc, "Alice", "PUT", f"/posts/{pid}", 400, "BAD_INPUT",
              body=body, token=a_tok, extra=same_as(before))

    # T14 없는 글과 잘못된 ID, 판단 순서
    check("T14", "없는 글 조회", "없음", "GET", "/posts/999999", 404, "NOT_FOUND")
    check("T14", "없는 글 수정", "Alice", "PUT", "/posts/999999", 404, "NOT_FOUND",
          body={"title": "t", "content": "c"}, token=a_tok)
    check("T14", "없는 글 삭제", "Alice", "DELETE", "/posts/999999", 404, "NOT_FOUND", token=a_tok)
    check("T14", "잘못된 ID 조회", "없음", "GET", "/posts/abc", 400, "BAD_INPUT")
    check("T14", "토큰 없이 없는 글 수정", "없음", "PUT", "/posts/999999", 401, "TOKEN_REQUIRED",
          body={"title": "t", "content": "c"})
    check("T14", "Bob이 Alice 글에 공백 제목", "Bob", "PUT", f"/posts/{pid}", 403, "FORBIDDEN",
          body={"title": " ", "content": "c"}, token=b_tok, extra=same_as(before))

    # T06 본인 수정·삭제
    check("T06", "Alice 본인 글 수정", "Alice", "PUT", f"/posts/{pid}", 200,
          body={"title": "T06 수정됨", "content": "수정 본문"}, token=a_tok,
          extra=lambda s, d: ("작성자·createdAt 유지",
                              d.get("authorId") == 1 and d.get("createdAt") == before["createdAt"]
                              and d.get("title") == "T06 수정됨"))
    check("T06", "Alice 본인 글 삭제", "Alice", "DELETE", f"/posts/{pid}", 204, token=a_tok)
    check("T06", "삭제 후 조회", "없음", "GET", f"/posts/{pid}", 404, "NOT_FOUND")

    # T17 무토큰 수정·삭제, Bob 본인 작업
    check("T17", "토큰 없이 수정", "없음", "PUT", f"/posts/{sid}", 401, "TOKEN_REQUIRED",
          body={"title": "t", "content": "c"}, need_header=www)
    check("T17", "토큰 없이 삭제", "없음", "DELETE", f"/posts/{sid}", 401, "TOKEN_REQUIRED", need_header=www)
    s, bp = check("T17", "Bob 글 작성", "Bob", "POST", "/posts", 201,
                  body={"title": "T17 Bob 글", "content": "본문"}, token=b_tok,
                  extra=lambda s, d: (f"authorId {d.get('authorId')}", d.get("authorId") == 2))
    check("T17", "Bob 본인 글 수정", "Bob", "PUT", f"/posts/{bp['id']}", 200,
          body={"title": "T17 Bob 수정", "content": "본문"}, token=b_tok)
    check("T17", "Bob 본인 글 삭제", "Bob", "DELETE", f"/posts/{bp['id']}", 204, token=b_tok)

    # 정리: 준비용 글 삭제
    call("DELETE", f"/posts/{sid}", token=a_tok)
    out()
    out("T10(만료): `--expiry` 로 따로 실행. T11 화면 해제, T15 재시작, T16 새로고침: 브라우저에서 직접 확인.")


def run_expiry():
    a_tok = login("alice@class.test")
    status, data, _, _ = call("POST", "/auth/login", {"email": "alice@class.test", "password": PASSWORD})
    ttl = data["expiresIn"]
    pid = call("POST", "/posts", {"title": "T10 만료 확인용", "content": "본문"}, a_tok)[1]["id"]
    before = get_post(pid)
    out(f"서버 TTL {ttl}초. 토큰 {mask(a_tok)} 발급 후 {ttl + 2}초 대기")
    time.sleep(ttl + 2)
    header()
    www = ("WWW-Authenticate", "Bearer")
    check("T10", "만료 토큰 /me", "Alice", "GET", "/me", 401, "TOKEN_EXPIRED", token=a_tok, need_header=www)
    check("T10", "만료 토큰 수정", "Alice", "PUT", f"/posts/{pid}", 401, "TOKEN_EXPIRED",
          body={"title": "만료", "content": "x"}, token=a_tok, extra=same_as(before))
    check("T10", "만료 토큰 삭제", "Alice", "DELETE", f"/posts/{pid}", 401, "TOKEN_EXPIRED",
          token=a_tok, extra=same_as(before))
    count = len(call("GET", "/posts")[1])
    check("T10", "만료 토큰 등록", "Alice", "POST", "/posts", 401, "TOKEN_EXPIRED",
          body={"title": "만료", "content": "x"}, token=a_tok,
          extra=lambda s, d: ("글 수 변화 없음", len(call("GET", "/posts")[1]) == count))
    call("DELETE", f"/posts/{pid}", token=login("alice@class.test"))


def run_t15(step):
    if step == "save":
        tok = login("alice@class.test")
        p = call("POST", "/posts", {"title": "T15 재시작 확인", "content": "서버 재시작 후에도 남아야 함"}, tok)[1]
        T15_FILE.write_text(json.dumps(p, ensure_ascii=False))
        out(f"T15 저장: id {p['id']} / {p['title']} / authorId {p['authorId']} / createdAt {p['createdAt']}")
        out("이제 백엔드를 Ctrl+C로 종료하고 같은 폴더에서 다시 실행한 뒤 `--t15 verify` 를 실행하세요.")
    else:
        saved = json.loads(T15_FILE.read_text())
        header()
        check("T15", "재시작 후 같은 글 조회", "없음", "GET", f"/posts/{saved['id']}", 200,
              extra=lambda s, d: ("제목·내용·작성자·시간 동일" if d == saved else f"다름: {d}", d == saved))
        call("DELETE", f"/posts/{saved['id']}", token=login("alice@class.test"))
        T15_FILE.unlink()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--expiry", action="store_true")
    ap.add_argument("--t15", choices=["save", "verify"])
    args = ap.parse_args()
    if args.expiry:
        run_expiry()
    elif args.t15:
        run_t15(args.t15)
    else:
        run_main()
    if results:
        failed = [t for t, ok in results if not ok]
        out()
        out(f"결과: {len(results)}개 중 {len(results) - len(failed)}개 PASS"
            + (f", FAIL: {', '.join(sorted(set(failed)))}" if failed else ""))
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"\n기록 위치: {LOG}")


if __name__ == "__main__":
    main()
