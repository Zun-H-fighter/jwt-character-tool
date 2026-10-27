import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, login, getSession, clearSession, canEdit } from "./api";
import {
  STAT_KEYS,
  emptyCharacter,
  toPost,
  fromPost,
  toForm,
  validate,
  mainStat,
  combatPower,
  gainFor,
  bestInvestment,
} from "./character";
import "./style.css";

function App() {
  const [posts, setPosts] = useState([]),
    [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyCharacter()), //입력 칸이 7개라 객체하나로 묶음. 
    [editing, setEditing] = useState(null);
  const [email, setEmail] = useState("alice@class.test"),
    [password, setPassword] = useState("Classroom!2026");
  const [user, setUser] = useState(null),
    [message, setMessage] = useState("캐릭터 목록을 불러오는 중입니다."),
    [busy, setBusy] = useState(false);
  const refresh = async () => setPosts(await api.list());
  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e.message);
      // FE-03: 404면 상세를 닫고 목록을 다시 불러온다.
      if (e.status === 404) {
        setSelected(null);
        setEditing(null);
        await refresh().catch(() => {});
      }
    } finally {
      setUser(getSession().user);
      setBusy(false);
    }
  }
  useEffect(() => {
    run(refresh, "캐릭터 목록이 준비되었습니다.");
  }, []);
  function reset() {
    setForm(emptyCharacter());
    setEditing(null);
  }
  // 입력칸 하나의 값을 바꾸는 함수. key는 form의 필드 이름
  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function save(e) {
    e.preventDefault();
    // FE-04: 비로그인 사용자는 요청을 보내기 전에 로그인 안내
    if (!getSession().user) {
      setMessage("캐릭터를 저장하려면 먼저 로그인하세요.");
      return;
    }
    const problem = validate(form);
    if (problem) {
      setMessage(problem); // 입력값은 지우지 않는다
      return;
    }
    await run(async () => {
      const input = toPost(form); // {title, content} 로 변환하는 부분
      const p = editing
        ? await api.update(editing, input)
        : await api.create(input);
      setSelected(p);
      reset();
      await refresh();
    }, "캐릭터를 저장했습니다.");
  }

  const character = selected ? fromPost(selected) : null; // 캐릭터형식이면 표로, 아니면 원래 게시판 텍스트
  const tip = character ? bestInvestment(character) : null;

  return (
    <main>
      <header>
        <span className="eyebrow">WEB SERVICE DESIGN · JWT</span>
        <h1>캐릭터 최적화 툴</h1>
        <p className="muted">
          가상 게임 캐릭터의 무기와 스탯을 기록하고 전투력을 계산합니다.
        </p>
      </header>
      <p className="banner">
        누구나 캐릭터를 볼 수 있고, 로그인한 사용자만 등록할 수 있습니다. 수정과
        삭제는 등록한 본인만 가능합니다. 로그인 상태는 새로고침하면 해제됩니다.
      </p>
      <div role="status" className="message">
        {message}
      </div>
      <div className="grid">
        <aside>
          <section className="card">
            <h2>로그인</h2>
            <p>{user ? `${user.name}님 로그인 중` : "로그아웃 상태"}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => login(email, password), "로그인했습니다.");
              }}
            >
              <label>
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                비밀번호
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <div className="actions">
                <button disabled={busy}>로그인</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    clearSession();
                    setUser(null);
                    reset();
                    setMessage("이 탭의 로그인 상태를 해제했습니다.");
                  }}
                >
                  로그아웃
                </button>
              </div>
            </form>
            <p>
              <small>
                테스트 계정: alice@class.test / bob@class.test
                <br />
                공통 비밀번호: Classroom!2026
              </small>
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const me = await api.me();
                  setSelected(null);
                  alert(`${me.name} (${me.email})`);
                }, "내 정보 조회를 완료했습니다.")
              }
            >
              내 정보 조회
            </button>
          </section>
          <section className="card">
            <h2>{editing ? "캐릭터 수정" : "새 캐릭터 등록"}</h2>
            {!user && (
              <p className="muted">캐릭터를 등록하려면 먼저 로그인하세요.</p>
            )}
            <form onSubmit={save}>
              <label>
                캐릭터 이름
                <input
                  maxLength={100}
                  value={form.name}
                  onChange={setField("name")}
                  required
                />
              </label>
              <label>
                무기 이름
                <input
                  maxLength={50}
                  value={form.weaponName}
                  onChange={setField("weaponName")}
                  required
                />
              </label>
              <label>
                무기 공격력
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={form.weaponAttack}
                  onChange={setField("weaponAttack")}
                  required
                />
              </label>
              <div className="stats">
                {STAT_KEYS.map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={form[k]}
                      onChange={setField(k)}
                      required
                    />
                  </label>
                ))}
              </div>
              <div className="actions">
                <button disabled={busy}>
                  {editing ? "수정 저장" : "등록"}
                </button>
                <button type="button" className="secondary" onClick={reset}>
                  입력 초기화
                </button>
              </div>
            </form>
          </section>
        </aside>
        <div>
          <section className="card">
            <h2>
              캐릭터 목록 <small>{posts.length}개</small>
            </h2>
            {posts.length === 0 ? (
              <p>첫 번째 캐릭터를 등록해 보세요.</p>
            ) : (
              posts.map((p) => {
                const c = fromPost(p);
                return (
                  <article className="post" key={p.id}>
                    <button
                      className="post-title"
                      disabled={busy}
                      onClick={() =>
                        run(
                          async () => setSelected(await api.detail(p.id)),
                          "캐릭터를 불러왔습니다.",
                        )
                      }
                    >
                      {p.title}
                      {c && <span className="power"> 전투력 {combatPower(c)}</span>}
                    </button>
                    <p>
                      <small>
                        {p.authorName} ·{" "}
                        {new Date(p.createdAt).toLocaleString()}
                      </small>
                    </p>
                  </article>
                );
              })
            )}
          </section>
          <section className="card">
            <h2>캐릭터 상세</h2>
            {selected ? (
              <>
                <h3>{selected.title}</h3>
                {character ? (
                  <>
                    <p>
                      무기 <b>{character.weaponName}</b> (공격력{" "}
                      {character.weaponAttack})
                    </p>
                    <table className="stat-table">
                      <thead>
                        <tr>
                          <th>스탯</th>
                          <th>값</th>
                          <th>+10 투자 시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {STAT_KEYS.map((k) => (
                           <tr key={k} className={k === tip.stat ? "best" : ""}>
                            <th>
                              {k}
                              {k === mainStat(character) && " (주스탯)"}
                            </th>
                            <td>{character[k]}</td>
                            <td>전투력 +{gainFor(character, k)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="power-big">
                      전투력 <b>{combatPower(character)}</b>
                    </p>
                    <p className="muted">
                      추천: 다음 스탯 10포인트는 <b>{tip.stat}</b>에 투자하면
                      전투력이 가장 많이 오릅니다 (+{tip.gain}). 스탯은 높을수록
                      효율이 떨어집니다.
                    </p>
                  </>
                ) : (
                  <p className="content">{selected.content}</p>
                )}
                <p>
                  <small>등록자 {selected.authorName}</small>
                </p>
                {canEdit(selected) && (
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={!character}
                      onClick={() => {
                        setEditing(selected.id);
                        setForm(toForm(character));
                      }}
                    >
                      수정
                    </button>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("캐릭터를 삭제할까요?"))
                          run(async () => {
                            await api.remove(selected.id);
                            setSelected(null);
                            reset();
                            await refresh();
                          }, "캐릭터를 삭제했습니다.");
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">목록에서 캐릭터를 선택하세요.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
