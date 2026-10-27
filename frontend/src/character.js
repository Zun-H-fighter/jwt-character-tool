// 캐릭터 정보 ↔ 게시글(title, content) 변환과 전투력 계산.
// 서버 API는 title·content만 받으므로, 캐릭터 정보는 content에 JSON 문자열로 담는다.

export const STAT_KEYS = ["STR", "DEX", "INT", "LUK"];

export const emptyCharacter = () => ({
  name: "",
  weaponName: "",
  weaponAttack: "",
  STR: "",
  DEX: "",
  INT: "",
  LUK: "",
});

// 폼 값 → 서버로 보낼 { title, content }
export function toPost(form) {
  return {
    title: form.name.trim(),
    content: JSON.stringify({
      weapon: { name: form.weaponName.trim(), attack: Number(form.weaponAttack) },
      stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Number(form[k])])), // (STR,40)값 쌍을 STR: 40.. 같은 객체로 바꾸기!!
    }),
  };
}

// 서버의 게시글 → 캐릭터 객체. 캐릭터 형식이 아니면 null (예: 자동 검사가 만든 일반 글)
export function fromPost(post) {
  try {
    const data = JSON.parse(post.content);
    const ok =
      data &&
      typeof data.weapon?.name === "string" &&
      Number.isFinite(data.weapon?.attack) &&
      STAT_KEYS.every((k) => Number.isFinite(data.stats?.[k]));
    if (!ok) return null;
    return {
      name: post.title,
      weaponName: data.weapon.name,
      weaponAttack: data.weapon.attack,
      ...data.stats,
    };
  } catch {
    return null; // JSON이 아닌 content, 테스트용 check_api는 content가 일반문장임
  }              // 그걸 JSON.parse하면 에러나니까 try/catch로 감싸서 막음!!
}

// 캐릭터 객체 → 수정 폼에 넣을 문자열 값
export function toForm(character) {
  return Object.fromEntries(
    Object.entries(character).map(([k, v]) => [k, String(v)]), 
  );
}

// 입력 검사. 문제가 있으면 안내 문구, 없으면 null
export function validate(form) {
  const isInt = (v, min, max) =>
    /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
  if (!form.name.trim() || form.name.trim().length > 100)
    return "캐릭터 이름은 1~100자로 입력하세요.";
  if (!form.weaponName.trim() || form.weaponName.trim().length > 50)
    return "무기 이름은 1~50자로 입력하세요.";
  if (!isInt(form.weaponAttack, 1, 9999))
    return "무기 공격력은 1~9999 사이의 정수로 입력하세요.";
  for (const k of STAT_KEYS)
    if (!isInt(form[k], 0, 999)) return `${k}는 0~999 사이의 정수로 입력하세요.`;
  return null;
}

// ---- 전투력 계산 (가상 게임 규칙) ----
// 1) 스탯은 '유효 스탯'으로 바꿔서 쓴다. 값이 클수록 1포인트의 효과가 줄어든다(수확 체감).
//    유효 스탯 = SOFT_CAP × 스탯 / (스탯 + SOFT_CAP)
// 2) 전투력 = 무기 공격력 × (1 + (주스탯 유효값 + SUB_WEIGHT × 부스탯 유효값 합) / 100)
const SOFT_CAP = 200;  // 클수록 체감이 늦게 옴
const SUB_WEIGHT = 0.3 //부스탯 반영 비율 (주스탯 대비)

export function effective(stat) {
  return (SOFT_CAP * stat) / (stat + SOFT_CAP);
}

export function mainStat(c) {
  return STAT_KEYS.reduce((best, k) => (c[k] > c[best] ? k : best), STAT_KEYS[0]);
}

//반올림 전 전투력 (투자 효과 비교에 사용)
function rawPower(c) {
  const main = mainStat(c);
  const subSum = STAT_KEYS.filter((k) => k !== main).reduce(
    (sum, k) => sum + effective(c[k]),
    0,
  );
  return c.weaponAttack * (1 + (effective(c[main]) + SUB_WEIGHT * subSum) / 100);
}

//화면에 보여줄 전투력 (정수)
export function combatPower(c) {
  return Math.round(rawPower(c));
}

// 스탯 하나에 points 만큼 투자했을 때 전투력 증가량 (소수 첫째 자리)
export function gainFor(c, stat, points = 10) {
  const gain = rawPower({ ...c, [stat]: c[stat] + points }) - rawPower(c);
  return Math.round(gain * 10) / 10;
}

// 최적화 제안: 스탯 포인트 10을 어디에 투자하면 전투력이 가장 많이 오르는지
export function bestInvestment(c, points = 10) {
  let best = null;
  for (const k of STAT_KEYS) {
    const gain = gainFor( c, k, points);
    if (!best || gain > best.gain) best = { stat: k, gain };
  }
  return best;
}
