//로그인 정보는 이 변수(browser memory)에만 보관!!
let session = { accessToken: "", user: null };
export const getSession = () => session;
export function clearSession(){
  session = { accessToken: "", user: null };
}

// FE-02: 토큰 있을때만 Authorizaiton 헤더 만들기!
function authorizationHeaders() { // 삼항 연산자로 토큰 있을때만 헤더 객체 생성, 없으면 빈 객체 {}!!
  return session.accessToken 
    ? { Authorization: `Bearer ${session.accessToken}` }
    : {};
} 

// FE-03: 401 code별 안내 문구 
const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
  TOKEN_REQUIRED: "로그인이 필요합니다. 먼저 로그인하세요.",
  INVALID_TOKEN: "인증 정보가 올바르지 않아 로그아웃되었습니다. 다시 로그인하세요.",
  TOKEN_EXPIRED: "로그인 시간이 만료되어 로그아웃되었습니다. 다시 로그인하세요.",
};

export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-type": "application/json",
      ...authorizationHeaders(),
      ...options.headers,
    },
  });
  // 204는 본문 없음 => JSON으로 읽지 않기!
  const data =
    response.status === 204 ? null : await response.json().catch(() => null); // 응답이 JSON이 아닐 때 파싱 에러로 터지지 않게 하는 안전 장치
  if (!response.ok) {
    //FE-03: 401이면 메모리의 로그인 상태 해제!!, 403은 해제 안함.
    if (response.status === 401) clearSession(); // 401이면 강제 로그아웃
    const code = data?.code;
    const message =
      (response.status === 401 && AUTH_MESSAGES[code]) ||
      data?.message ||
      `요청이 실패했습니다. (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    throw error;
  }
  return data;
}

// FE-01: 로그인 성공 시 토큰과 사용자를 메모리에 저장!!
export async function login(email, password) {
  const data = await request("/auth/login", { //실패하면 request안에서 thorw!!
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  session = { accessToken: data.accessToken, user: data.user }; // 이 줄은 성공했을때만 실행
  return data.user;
}

// FE-04: 로그인한 사용자가 작성자 일때만 수정, 삭제 버튼 표시!!
export function canEdit(post) {
  return Boolean(session.user && post && post.authorId === session.user.id); //로그인 여부, 게시글 존재 여부, 작성자id === 유저id 인지
} //이건 보안이 아니라 편의 기능임. 버튼만 숨긴거라 개발자 도구에서 요청 직접 보내면 우회가능. 직접 막는 건 backend의 assertOwner임.

export const api = {
  list: () => request("/posts"),
  detail: (id) => request(`/posts/${id}`),
  create: (input) =>
    request("/posts", { method: "POST", body: JSON.stringify(input) }),
  update: (id, input) =>
    request(`/posts/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  remove: (id) => request(`/posts/${id}`, { method: "DELETE" }),
  me: () => request("/me"),
};
