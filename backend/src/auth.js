import jwt from "jsonwebtoken"; //jwt 제공 라이브러리
import { ApiError } from "./errors.js";
import { findPublic } from "./users.js";

// jsonwebtoken은 설치되어 있습니다. 아래 함수의 본문을 구현하세요.

const SAMPLE_SECRET = "REPLACE_WITH_RANDOM_64_HEX_CHARACTERS";

function loadSecret() {
  const hex = process.env.JWT_SECRET;
  if (!hex || hex === SAMPLE_SECRET || !/^[0-9a-fA-F]{64}$/.test(hex)) { //환경변수 없거나 빈 문자열, 예시 키 그대로면 거부
    throw new Error(                                                     //처음부터 끝까지 16진수 정확히 64글자만 통과
      "JWT_SECRET이 없거나 형식이 잘못되었음, 새로  생성한 64자리 16진수를 .env에 설정하세요."
    );
  }
  return Buffer.from(hex, "hex"); // 64자리 hex -> 32 바이트
}

function loadTtl() { //ttl 안전 장치
  const ttl = Number(process.env.TOKEN_TTL || 90);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error("TOKEN_TTL은 1 이상의 정수(초)여야 함.");   
  }
  return ttl;
}

const SECRET = loadSecret();
const TTL = loadTtl();
const ISSUER = process.env.JWT_ISSuer || "webservice-class";
const AUDIENCE = process.env.AUDIENCE || "borad-api";

export function issueToken(user) {
  // BE-01: 서버 환경변수 키로 HS256 JWT 발급. sub, exp, iss, aud 필수.
  return jwt.sign({}, SECRET, { // payload는 비워도 됨, 필요한 클레임 전부 옵션으로 넣음
    algorithm: "HS256",
    subject: String(user.id), // sub: 문자열 사용자 ID
    issuer: ISSUER,           // iss
    audience: AUDIENCE,       // aud
    expiresIn: TTL            // exp
  });
}

function invalidToken() {
    return new ApiError(401, "INVALID_TOKEN", "유효하지 않은 토큰입니다. 다시 로그인하세요");
}

export function currentUserId(req) {
  //BE-02: Bearer 추출 → 서명/알고리즘/만료/클레임 검증 → 실제 사용자 확인.
  const header = req.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header); // Bearer 토큰 추출(중요)
  if (!match) {
    throw new ApiError(401, "TOKEN_REQUIRED", "로그인이 필요합니다");
  }

  let payload;
  try {
    payload = jwt.verify(match[1], SECRET, { // 태그 재계산
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") { //서명은 진짜인데 시간만 지났다는 의미의 오류
      throw new ApiError(401, "TOKEN_EXPIRED", "로그인 시간이 만료되었습니다. 다시 로그인하세요");
    }
    throw invalidToken(); // 서명 불일치, 형식 오류, iss/aud 불일치 등
  }

  // jsonwebtoken은 exp가 없으면 그냥 통과시키므로 직접 확인!!(중요)
  if (typeof payload.exp !== "number") throw invalidToken();
  if (typeof payload.sub !== "string" || !/^[1-9]\d*$/.test(payload.sub)) throw invalidToken();

  const userId = Number(payload.sub);
  if (!findPublic(userId)) throw invalidToken(); // 실제 계정 여부 확인
  return userId;
}

export function assertOwner(userId, authorId) {
  //BE-03: 다른 작성자이면 403 FORBIDDEN.
  if (userId !== authorId) {
    throw new ApiError(403, "FORBIDDEN", "본인 작성 글만 수정/삭제할 수 있습니다.");
  }
}
