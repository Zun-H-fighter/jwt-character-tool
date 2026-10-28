# 캐릭터 최적화 툴

웹서비스설계 JWT 게시판 과제입니다. 가상 게임 캐릭터의 무기와 스탯을 기록하고 전투력을 계산하는 서비스이며, 누구나 캐릭터를 조회할 수 있고 로그인한 사용자만 등록할 수 있습니다. 수정과 삭제는 등록한 본인만 가능합니다.

## 작성자와 서비스 소개

- 학번 / 이름: 202212270 / 최준혁
- 서비스 목적과 대상 사용자: 가상의 RPG를 플레이하는 사용자가 자신의 캐릭터(무기 이름·공격력, STR·DEX·INT·LUK)를 기록하고, 다음 스탯 포인트를 어디에 투자해야 전투력이 가장 많이 오르는지 확인하는 도구입니다. 다른 사용자의 캐릭터도 공개로 볼 수 있어 육성 방향을 비교할 수 있습니다. 캐릭터 정보는 로그인한 본인만 등록·수정·삭제할 수 있도록 JWT 인증과 작성자 권한 검사를 적용했습니다.
- 선택한 기술: React + Express (SQLite 파일 DB)
- 주요 기능
  - Alice/Bob 테스트 계정 로그인과 JWT 발급(HS256), 보호 API의 토큰 검증
  - 캐릭터 공개 목록·상세, 로그인 사용자의 등록, 본인 캐릭터만 수정·삭제
  - 전투력 계산과 스탯 투자 추천: 스탯이 높을수록 효율이 떨어지는 수확 체감 규칙을 적용해, 스탯별로 +10 투자 시 전투력 증가량을 보여주고 가장 효율이 좋은 스탯을 추천

## 보고서와 테스트 증거

- [구현 보고서 PDF](docs/report.pdf)
- [테스트 증거 폴더](docs/evidence/)
- [T01~T17 API 시나리오 실행 기록](docs/evidence/api-tests.log)
- [AI 활용 기록](docs/ai-log.md)

## 프로젝트 구조

```text
.
├── README.md
├── .gitignore
├── frontend/                 # React (Vite) — 제공 템플릿 frontend-react 기반
│   └── src/
│       ├── api.js            # 서버 통신, 토큰 보관·전송, 응답 코드 처리 (FE-01~04)
│       ├── character.js      # 캐릭터 ↔ 게시글 변환, 입력 검사, 전투력 계산 (추가 파일)
│       ├── main.jsx          # 화면
│       └── style.css
├── backend/                  # Express — 제공 템플릿 backend-express 기반
│   ├── .env.example
│   └── src/
│       ├── app.js            # 라우트, 입력 검사, 에러 응답
│       ├── auth.js           # JWT 발급·검증, 작성자 권한 (BE-01~03)
│       ├── store.js          # SQLite(sql.js) 저장
│       ├── users.js          # 테스트 계정과 비밀번호 검증 (제공 코드 유지)
│       └── errors.js
├── tools/
│   ├── check_api.py          # 제공 자동 검사 도구
│   └── manual_tests.py       # T01~T17 API 시나리오 검사 (추가)
└── docs/
    ├── report.pdf
    ├── ai-log.md
    └── evidence/             # 테스트 캡처와 실행 기록
```

캐릭터 정보는 공통 API 명세(게시글은 `title`, `content` 두 필드만 허용)를 바꾸지 않고 저장합니다. 캐릭터 이름은 `title`에, 무기와 스탯은 JSON 문자열로 `content`에 담습니다. 서버 코드와 API는 명세 그대로이며, 변환은 `frontend/src/character.js`가 담당합니다.

## 실행 환경

| 항목 | 사용 버전 |
|---|---|
| 운영체제 | Windows 11 + WSL2 Ubuntu 24.04.4 LTS |
| 프론트·백엔드 런타임 Node.js | v24.21.0 |
| 프론트 | React 19.3.0, Vite 8.3.4 |
| 백엔드 | Express 5.3.0, jsonwebtoken 9.0.3, dotenv 18.0.7 |
| 데이터 저장 | SQLite 파일 DB (sql.js 1.14.2) |
| 확인 브라우저 | Chrome 156 |

Node.js 20.19 이상이면 실행됩니다.

## 설치와 실행

터미널 두 개를 사용합니다. 터미널 A는 백엔드, 터미널 B는 프론트입니다.

### 1 저장소 복제

```sh
git clone https://github.com/Zun-H-fighter/jwt-character-tool.git
cd jwt-character-tool
```

### 2 백엔드 준비와 실행 (터미널 A)

```sh
cd backend
npm ci
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

마지막 명령이 출력한 64자리 16진수를 `.env`의 `JWT_SECRET=` 뒤에 붙여 넣습니다. 그 뒤 실행합니다.

```sh
npm start
```

- 환경설정 예시 파일: `backend/.env.example`
- JWT_SECRET: 새로 생성한 64자리 16진수(32바이트)만 허용합니다. 비어 있거나, 예시 값 그대로이거나, 형식이 다르면 서버가 시작하지 않고 오류를 출력합니다. 실제 키는 저장소에 포함하지 않습니다.
- JWT_ISSUER / JWT_AUDIENCE: `webservice-class` / `board-api`
- TOKEN_TTL: 기본 90초. 만료 테스트는 서버를 `TOKEN_TTL=3 npm start`로 실행합니다(PowerShell: `$env:TOKEN_TTL="3"; npm start`).
- 백엔드 주소: http://127.0.0.1:8000
- 정상 실행 확인: http://127.0.0.1:8000/api/health → `{"status":"ok", ...}`

### 3 프론트 빌드와 로컬 실행 (터미널 B)

백엔드를 켜 둔 상태에서 실행합니다.

```sh
cd frontend
npm ci
npm run build
npm run preview
```

- 최종 확인 주소: http://127.0.0.1:4173
- 개발 중 실행: `npm run dev`, http://127.0.0.1:5173
- API 연결: 브라우저는 4173(또는 5173)의 `/api`로 요청하고, Vite의 `preview.proxy`(`server.proxy`)가 8000번 백엔드로 전달합니다. 백엔드 포트를 바꾸면 `frontend/vite.config.js`의 두 proxy 주소를 함께 바꿉니다.
- 종료: 각 터미널에서 Ctrl+C
- 코드 변경 후: 프론트는 `npm run build` 후 `npm run preview`를 다시 실행하고, 백엔드는 Ctrl+C 후 `npm start`로 재시작합니다.

### 4 테스트 계정과 DB

| 사용자 | 이메일 | 실습용 비밀번호 |
|---|---|---|
| Alice (id 1) | alice@class.test | Classroom!2026 |
| Bob (id 2) | bob@class.test | Classroom!2026 |

- SQLite 파일: `backend/data/board.sqlite`. 서버 시작 시 폴더와 테이블이 자동 생성되며 저장소에는 포함하지 않습니다.
- DB 초기화: 백엔드를 종료한 뒤 `backend/data/board.sqlite`를 삭제하고 다시 실행합니다.
- 서버 재시작 후 데이터 유지: 글을 저장한 뒤 백엔드를 실제로 종료·재실행하고 같은 글을 조회해 제목·내용·작성자·시간이 같은 것을 확인했습니다(T15, `docs/evidence/api-tests.log`).

## 구현 완료 범위

| 기능 | 완료 여부 | 주요 파일 또는 함수 |
|---|---|---|
| 공개 목록과 상세 | 완료 | `backend/src/app.js` GET 라우트 (제공 코드 유지) |
| 로그인과 JWT 발급 | 완료 | `backend/src/auth.js` `loadSecret`, `issueToken` |
| JWT 검증과 내 정보 조회 | 완료 | `backend/src/auth.js` `currentUserId` |
| 글 작성과 작성자 저장 | 완료 | `backend/src/app.js` POST `/api/posts` + `currentUserId` |
| 본인 글 수정·삭제 | 완료 | `backend/src/auth.js` `assertOwner` |
| 토큰 만료와 로그아웃 | 완료 | `frontend/src/api.js` `request`, `clearSession` |
| 입력 오류와 권한 오류 처리 | 완료 | `frontend/src/api.js` `request`, `frontend/src/main.jsx` `run`, `save` |
| 캐릭터 기록과 전투력 계산 (주제 기능) | 완료 | `frontend/src/character.js` |

알려진 문제와 제한

- 캐릭터 수치(무기 공격력 1~9999, 스탯 0~999)의 범위 검사는 프론트에서만 합니다. 서버는 공통 API 명세를 유지하기 위해 `content`를 1~5000자 문자열로만 검사하므로, API를 직접 호출하면 범위를 벗어난 값이 저장될 수 있습니다. 화면은 캐릭터 형식이 아닌 `content`를 일반 텍스트로 표시하고 수정 버튼을 비활성화합니다.
- 로그인 상태는 브라우저 메모리에만 보관하므로 새로고침하면 해제됩니다(과제 요구사항). 로그아웃은 이미 복사된 JWT를 서버에서 무효화하지 않으며, 토큰은 만료 시각까지 유효합니다.

## 테스트 방법과 결과 요약

- 실행한 검사와 위치(저장소 루트, 백엔드 실행 중)
  - `python3 tools/check_api.py --mode final` → 40개 통과
  - `TOKEN_TTL=3`으로 재시작 후 `python3 tools/check_api.py --mode final --expiry` → 48개 통과
  - `python3 tools/manual_tests.py` → T01~T09, T11~T14, T17의 37개 요청 PASS
  - `python3 tools/manual_tests.py --expiry` (TTL 3초) → T10 4개 요청 PASS
  - `python3 tools/manual_tests.py --t15 save` → 백엔드 실제 종료·재실행 → `--t15 verify` → T15 PASS
  - 브라우저(4173)에서 로그인 표시, 토큰 헤더, 삭제 204, Bob 화면의 버튼 숨김, 만료·로그아웃·새로고침 확인
- Alice/Bob 권한 구분: Bob의 정상 토큰으로 Alice 글 수정·삭제 시 403 FORBIDDEN, 재조회로 원문 유지 확인(T07, T08). Bob이 Alice 글에 공백 제목을 보내도 403(T14).
- HTTP 상태와 오류 code: 200·201·204, 400 BAD_INPUT, 401 INVALID_CREDENTIALS·TOKEN_REQUIRED·INVALID_TOKEN·TOKEN_EXPIRED, 403 FORBIDDEN, 404 NOT_FOUND를 모두 실제 요청으로 확인했습니다.
- 응답 헤더와 본문: 등록 201의 `Location: /api/posts/{id}`, 보호 API 401의 `WWW-Authenticate: Bearer`, 삭제 204의 빈 본문(0바이트)을 확인했습니다.
- 토큰 없음·변조·만료: 각각 401 TOKEN_REQUIRED, INVALID_TOKEN(서명 첫 글자 변경), TOKEN_EXPIRED(TTL 3초)이며, 실패한 변경 요청 뒤 데이터가 바뀌지 않았습니다.
- 전체 T01~T17 결과와 증거: 보고서 4장, `docs/evidence/api-tests.log`, `docs/evidence/`

## 핵심 구현 설명

1. 로그인: `POST /api/auth/login` → 제공 함수 `verifyCredentials`로 계정 확인 → `issueToken`이 HS256으로 `sub`(문자열 사용자 ID), `iss`, `aud`, `exp`를 담아 서명
2. 토큰 보관·전송: 프론트 `api.js`의 `session` 변수(메모리)에 저장하고, `authorizationHeaders`가 토큰이 있을 때만 `Authorization: Bearer <JWT>`를 붙임
3. 서버 검증: `currentUserId`가 Bearer 형식 확인 → `jwt.verify`(허용 알고리즘 HS256 고정, 서명·만료·iss·aud) → `exp` 존재, `sub` 형식, 실제 계정 존재를 직접 확인 → 검증된 사용자 ID만 반환
4. 작성자 권한: 등록 시 작성자는 `currentUserId`의 결과로만 정하고, 수정·삭제는 `assertOwner`가 DB의 `authorId`와 비교해 다르면 403

상세 설명은 [보고서](docs/report.pdf) 3장에 있습니다.

## AI 활용 요약과 참고 자료

- AI 사용 여부: 사용
- 도구: Claude (Anthropic, claude-opus-5-5로 설정된 세션)
- 사용 목적: 과제 문서 분석과 진행 순서 설계, JWT·Express·React 개념 학습, 코드 제안, 오류 원인 분석, 테스트 스크립트 작성, README·보고서 문장 정리
- 반영 방식: 백엔드 `auth.js`와 프론트 `api.js`는 제안 코드를 직접 입력하며 적용했고, 입력 과정에서 생긴 오류는 서버 로그·브라우저 콘솔·Network 탭으로 직접 원인을 찾아 수정했습니다. `character.js`, `main.jsx` 화면 첫 버전과 `tools/manual_tests.py`는 제공받은 코드를 반영했으며, 전투력 공식 개선(부스탯 반영·수확 체감)은 본인 아이디어를 바탕으로 수정 위치를 안내받아 직접 수정했습니다.
- 검증: 제공 `check_api.py`와 T01~T17 시나리오를 직접 실행해 확인했습니다.
- 상세 활용 기록: [docs/ai-log.md](docs/ai-log.md), 보고서 5장
- 참고 자료
  - 수업 제공 시작 코드와 과제 문서(01_과제공지, 02_API명세, 03_구현체크리스트, 05_테스트시나리오)
  - jsonwebtoken: https://github.com/auth0/node-jsonwebtoken (`auth.js`의 `jwt.sign`, `jwt.verify`)
  - Express: https://expressjs.com/ , Vite: https://vite.dev/guide/

## 제출 확인

- [ ] README의 안내 문구를 실제 내용으로 교체했다.
- [ ] 새 폴더에 clone하여 README만으로 설치·환경설정·빌드·로컬 실행했다.
- [ ] 4173번 빌드 화면에서 API 연결과 전체 필수 기능을 확인했다.
- [ ] GitHub에서 보고서와 증거 링크가 열린다.
- [ ] 교수자가 저장소를 열람·복제할 수 있다.
- [ ] 비밀 키·실제 토큰·DB·node_modules·.venv·target을 커밋하지 않았다.
- [ ] 최종 push 후 저장소 URL과 제출 기준 커밋 SHA를 LMS에 제출했다.
