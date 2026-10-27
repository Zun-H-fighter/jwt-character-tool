import "dotenv/config";
import express from "express";
import { ApiError } from "./errors.js";
import { store } from "./store.js";
import { findPublic, verifyCredentials } from "./users.js";
import { issueToken, currentUserId, assertOwner } from "./auth.js";
const app = express();
app.use(express.json({ limit: "64kb" }));
function fields(body, limits) {
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    Object.keys(body).some((k) => !(k in limits))
  )
    throw new ApiError(400, "BAD_INPUT", "허용된 JSON 필드만 보내세요.");
  const result = {};
  for (const [k, max] of Object.entries(limits)) {
    if (
      typeof body[k] !== "string" ||
      !body[k].trim() ||
      [...body[k].trim()].length > max
    )
      throw new ApiError(400, "BAD_INPUT", `${k} 입력을 확인하세요.`);
    result[k] = k === "password" ? body[k] : body[k].trim();
  }
  return result;
}
function postId(req) {
  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(Number(req.params.id))
  )
    throw new ApiError(400, "BAD_INPUT", "ID는 양의 정수여야 합니다.");
  return Number(req.params.id);
}
function getPost(id) {
  const p = store.get(id);
  if (!p) throw new ApiError(404, "NOT_FOUND", "게시글이 없습니다.");
  return p;
}
app.get("/api/health", (_, res) =>
  res.json({ status: "ok", stack: "express" }),
);
app.post("/api/auth/login", (req, res) => {
  const input = fields(req.body, { email: 254, password: 128 });
  const user = verifyCredentials(input.email, input.password);
  if (!user)
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "이메일 또는 비밀번호를 확인하세요.",
    );
  const accessToken = issueToken(user);
  res.json({
    accessToken,
    expiresIn: Number(process.env.TOKEN_TTL || 90),
    user,
  });
});
app.get("/api/me", (req, res) => {
  const user = findPublic(currentUserId(req));
  if (!user)
    throw new ApiError(401, "INVALID_TOKEN", "사용자를 확인할 수 없습니다.");
  res.json(user);
});
app.get("/api/posts", (_, res) => res.json(store.list()));
app.get("/api/posts/:id", (req, res) => res.json(getPost(postId(req))));
app.post("/api/posts", (req, res) => {
  const userId = currentUserId(req);
  const p = store.create(
    fields(req.body, { title: 100, content: 5000 }),
    userId,
  );
  res.status(201).location(`/api/posts/${p.id}`).json(p);
});
app.put("/api/posts/:id", (req, res) => {
  const userId = currentUserId(req),
    id = postId(req),
    p = getPost(id);
  assertOwner(userId, p.authorId);
  res.json(store.update(id, fields(req.body, { title: 100, content: 5000 })));
});
app.delete("/api/posts/:id", (req, res) => {
  const userId = currentUserId(req),
    id = postId(req),
    p = getPost(id);
  assertOwner(userId, p.authorId);
  store.remove(id);
  res.status(204).end();
});
app.use((_, res) =>
  res.status(404).json({ code: "NOT_FOUND", message: "API 경로가 없습니다." }),
);
app.use((error, req, res, next) => {
  const status =
    error instanceof ApiError
      ? error.status
      : error.type === "entity.parse.failed"
        ? 400
        : 500;
  if (status === 500) console.error(error); // 에러를 서버로그로 추적!!(추가)
  if (status === 401) res.set("WWW-Authenticate", "Bearer");
  res
    .status(status)
    .json({
      code:
        error instanceof ApiError
          ? error.code
          : status === 400
            ? "BAD_INPUT"
            : "INTERNAL_ERROR",
      message: status === 500 ? "서버 오류가 발생했습니다." : error.message,
    });
});
app.listen(Number(process.env.PORT || 8000), "127.0.0.1", (error) => {
  if (error) {
    console.error("서버 시작 실패:", error.message);
    process.exitCode = 1;
    return;
  }
  console.log(
    "시작 코드 http://127.0.0.1:" +
      (process.env.PORT || 8000) +
      " — 가상의 게임 캐릭터 공격력 계산 사이트 ",
  );
});
