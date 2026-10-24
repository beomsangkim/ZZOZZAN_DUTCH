import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Copy,
  Crown,
  Gavel,
  PencilLine,
  Receipt,
  RotateCcw,
  Scale,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
 * 상수 & 프리셋
 * ────────────────────────────────────────────────────────────── */

const BASE_WEIGHT = 100;
const MIN_WEIGHT = 10;
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 10;
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 100_000_000;
const MAX_NAME_LENGTH = 8;
const CUSTOM_MIN = -30;
const CUSTOM_MAX = 50;
const LOADING_DURATION = 2500;
const LOADING_INTERVAL = 600;

const DEFAULT_PEOPLE = ['김총무', '박빌런', '이얌체'];

const LOADING_MESSAGES = [
  '불판 열역학 데이터 및 젓가락 이동 궤적 분석 중...',
  '전 애인 언급으로 인한 모임 분위기 감가상각 계산 중...',
  '소수점 셋째 자리까지 우정 파괴 지수 산출 완료!',
];

const TAG_CATEGORIES = [
  {
    id: 'labor',
    title: '먹방/노동 기피',
    kind: 'penalty',
    tags: [
      {
        id: 'no-grill',
        emoji: '🥩',
        label: '고기 한 점도 안 굽고 쌈만 싸 먹음',
        delta: 25,
        reason: '집게 알레르기 및 불판 노동 기피세',
        verdict: '집게는 무기가 아닙니다. 그러나 귀하는 끝내 그것을 들지 않았습니다.',
      },
      {
        id: 'fries',
        emoji: '🍟',
        label: '안주 안 먹는다더니 감자튀김/기본안주 싹쓸이',
        delta: 15,
        reason: '무임승차 탄수화물 횡령죄',
        verdict: '"난 배불러서 안 먹을게"는 오늘부로 법적 효력을 상실했습니다.',
      },
      {
        id: 'no-drink',
        emoji: '🍺',
        label: '첫 잔 이후로 술 안 마시고 안주만 공략',
        delta: 20,
        reason: '안주 가성비 생태계 교란세',
        verdict: '술값은 나눴지만 안주는 독점하셨군요. 시장경제가 울고 있습니다.',
      },
    ],
  },
  {
    id: 'mood',
    title: '분위기/시간 훼손',
    kind: 'penalty',
    tags: [
      {
        id: 'late',
        emoji: '⏰',
        label: '약속 시간 지각',
        delta: 12,
        reason: '타인의 생명 시간 가치 훼손',
        verdict: '귀하가 늦은 동안 고기는 탔고, 우정도 함께 탔습니다.',
      },
      {
        id: 'rant',
        emoji: '😭',
        label: '전 애인/회사 하소연 30분 이상 시전',
        delta: 35,
        reason: '감정노동 유발 및 테이블 분위기 곱창세',
        verdict: '전 애인은 떠났지만, 그 이야기는 30분간 우리 곁에 머물렀습니다.',
      },
      {
        id: 'phone',
        emoji: '📱',
        label: '술자리 내내 인스타/카톡만 봄',
        delta: 15,
        reason: '사이버 망명 및 오프라인 직무유기',
        verdict: '몸은 고깃집에, 영혼은 인스타 피드에 계셨던 것으로 확인됩니다.',
      },
    ],
  },
  {
    id: 'merit',
    title: '우정 기여자 할인',
    kind: 'deduction',
    tags: [
      {
        id: 'grill-master',
        emoji: '🔥',
        label: '고기 전담 마크 및 볶음밥 집도',
        delta: -25,
        reason: '불판 앞 고온 화상 위험 수당 공제',
      },
      {
        id: 'far-home',
        emoji: '🏠',
        label: '오늘 집이 제일 멂',
        delta: -12,
        reason: '장거리 귀가 여정 교통 복지 공제',
      },
      {
        id: 'treasurer',
        emoji: '💳',
        label: '내 카드로 일단 긁음/총무 담당',
        delta: -10,
        reason: '선결제 유동성 공급 및 정산 행정 수고비',
      },
      {
        id: 'clown',
        emoji: '🤡',
        label: '오늘 썰 풀어서 전원 웃겨줌',
        delta: -15,
        reason: '테이블 엔터테인먼트 광대 수당',
      },
    ],
  },
];

const PRESET_TAGS = TAG_CATEGORIES.flatMap((c) => c.tags);

const NO_VILLAIN_VERDICT =
  '오늘 모임은 놀라울 만큼 평화로웠습니다. 다만 자투리는 누군가 내야 하므로 법정은 냉정하게 한 명을 지목합니다.';

/* ──────────────────────────────────────────────────────────────
 * 유틸
 * ────────────────────────────────────────────────────────────── */

let idSeq = 0;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

const makeDefaultPeople = () => DEFAULT_PEOPLE.map((name) => ({ id: uid('p'), name }));

const fmtWon = (n) => Math.round(n).toLocaleString('ko-KR');

const fmtExact = (n) =>
  n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDiff = (n) => {
  if (Math.abs(n) < 0.05) return '±0.0';
  const abs = Math.abs(n).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${n > 0 ? '+' : '-'}${abs}`;
};

const fmtPct = (n) => `${n > 0 ? '+' : n < 0 ? '-' : '±'}${Math.abs(n)}%`;

const toKoreanUnit = (n) => {
  if (!n) return '';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const rest = n % 10_000;
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest) parts.push(rest.toLocaleString('ko-KR'));
  return `${parts.join(' ')}원`;
};

const customVerdict = (label) =>
  `"${label}" 혐의는 현장 배심원 만장일치로 유죄가 인정되었습니다. 항소는 다음 모임 1차 계산으로만 가능합니다.`;

/**
 * 제로섬 정산 엔진
 * - W_i = max(10, 100 + Σ delta)
 * - Exact_i = 총액 × W_i / ΣW  (화면 표시용 소수점 2자리)
 * - 송금액 = 10원 단위 내림 → 자투리 전액을 1등 빌런에게 독박
 * 정수 연산으로 내림을 계산해 부동소수점 오차 없이 합계 = 총액을 보장한다.
 */
function computeSettlement(total, people, selections, tagMap) {
  if (!people.length) return null;

  const rows = people.map((p, idx) => {
    const tags = (selections[p.id] || []).map((id) => tagMap[id]).filter(Boolean);
    const deltaSum = tags.reduce((s, t) => s + t.delta, 0);
    const rawWeight = BASE_WEIGHT + deltaSum;
    const weight = Math.max(MIN_WEIGHT, rawWeight);
    return {
      ...p,
      idx,
      tags,
      deltaSum,
      weight,
      clamped: rawWeight < MIN_WEIGHT,
      penaltyCount: tags.filter((t) => t.delta > 0).length,
    };
  });

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const base = total / rows.length;

  // 1등 빌런: 가중치 최고 → 동률이면 죄목 수 많은 사람 → 그래도 동률이면 먼저 등록된 사람
  const villain = rows.reduce((best, r) => {
    if (!best) return r;
    if (r.weight > best.weight) return r;
    if (r.weight === best.weight && r.penaltyCount > best.penaltyCount) return r;
    return best;
  }, null);

  rows.forEach((r) => {
    r.exact = (total * r.weight) / totalWeight;
    r.floored = Math.floor((total * r.weight) / (totalWeight * 10)) * 10;
    r.diff = r.exact - base;
  });

  const flooredSum = rows.reduce((s, r) => s + r.floored, 0);
  const remainder = total - flooredSum;

  rows.forEach((r) => {
    r.isVillain = r.id === villain.id;
    r.pay = r.floored + (r.isVillain ? remainder : 0);
  });

  const paySum = rows.reduce((s, r) => s + r.pay, 0);
  const minWeight = Math.min(...rows.map((r) => r.weight));
  const hasVillain = villain.weight > BASE_WEIGHT;
  const worstTag = villain.tags.filter((t) => t.delta > 0).sort((a, b) => b.delta - a.delta)[0] || null;
  const verdict = !hasVillain
    ? NO_VILLAIN_VERDICT
    : worstTag
      ? worstTag.verdict || customVerdict(worstTag.label)
      : NO_VILLAIN_VERDICT;

  const sorted = [...rows].sort((a, b) => b.weight - a.weight || a.idx - b.idx);
  sorted.forEach((r) => {
    r.isSaint = !r.isVillain && r.weight === minWeight && r.weight < BASE_WEIGHT;
  });

  return {
    rows,
    sorted,
    base,
    totalWeight,
    villain,
    hasVillain,
    surcharge: villain.weight - BASE_WEIGHT,
    remainder,
    paySum,
    balanced: paySum === total,
    worstTag,
    verdict,
  };
}

function buildShareText({ total, settlement, account, memo }) {
  const { sorted, villain, hasVillain, surcharge, verdict, remainder, base } = settlement;
  const line = '━━━━━━━━━━━━━━━━━━';
  const out = [];
  out.push('📢 [토스 쪼잔정산] 초정밀 기여도 청구서');
  out.push(line);
  out.push(`💸 총 결제액: ${fmtWon(total)}원 (${sorted.length}명)`);
  out.push(`📏 단순 1/N: ${fmtExact(base)}원 ← 이건 이제 무효입니다`);
  out.push('');
  if (hasVillain) {
    out.push(`⚖️ [판결문] 오늘의 최고 빌런: ${villain.name}님 (가산세 ${fmtPct(surcharge)})`);
  } else {
    out.push(`⚖️ [판결문] 오늘은 빌런 없음. 자투리 당번: ${villain.name}님`);
  }
  out.push(`👨‍⚖️ "${verdict}"`);
  out.push('');
  out.push('🧾 개인별 청구 내역');
  sorted.forEach((r) => {
    const mark = r.isVillain ? '👑 ' : r.isSaint ? '😇 ' : '• ';
    out.push(`${mark}${r.name}: ${fmtWon(r.pay)}원`);
    out.push(`   └ 팩트 청구액 ${fmtExact(r.exact)}원 (1/N 대비 ${fmtDiff(r.diff)}원)`);
    if (r.isVillain && remainder > 0) {
      out.push(`   └ *(자투리 ${fmtWon(remainder)}원 빌런 독박 포함)`);
    }
    r.tags.forEach((t) => {
      out.push(`   └ ${t.emoji} ${t.reason} (${fmtPct(t.delta)})`);
    });
  });
  out.push(line);
  out.push(`✅ 송금액 합계 ${fmtWon(settlement.paySum)}원 = 총액 ${fmtWon(total)}원 (오차 0원)`);
  if (account.trim()) out.push(`🏦 입금처: ${account.trim()}`);
  if (memo.trim()) out.push(`💬 총무의 한마디: ${memo.trim()}`);
  out.push('');
  out.push('※ 본 정산은 AI 대법관의 확정 판결로 항소가 불가합니다.');
  out.push('※ 이의 제기 시 다음 모임 가산세 +50%가 자동 부과됩니다.');
  return out.join('\n');
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(t >= 1 ? target : target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ──────────────────────────────────────────────────────────────
 * 공통 UI
 * ────────────────────────────────────────────────────────────── */

const GLOBAL_STYLE = `
@keyframes tds-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes tds-pop { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
@keyframes tds-roll { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes tds-toast { from { opacity: 0; transform: translate(-50%, 16px) scale(.96); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
@keyframes tds-sheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes tds-dim { from { opacity: 0; } to { opacity: 1; } }
@keyframes tds-stamp { 0% { transform: rotate(-14deg) scale(2.2); opacity: 0; } 60% { transform: rotate(-14deg) scale(.92); opacity: 1; } 100% { transform: rotate(-14deg) scale(1); opacity: 1; } }
@keyframes tds-progress { from { width: 0%; } to { width: 100%; } }
@keyframes tds-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-5px); } 40%,80% { transform: translateX(5px); } }
.tds-fade-up { animation: tds-fade-up .45s cubic-bezier(.2,.8,.2,1) both; }
.tds-pop { animation: tds-pop .35s cubic-bezier(.2,.8,.2,1) both; }
.tds-roll { animation: tds-roll .4s cubic-bezier(.2,.8,.2,1) both; }
.tds-toast { animation: tds-toast .3s cubic-bezier(.2,.8,.2,1) both; }
.tds-sheet { animation: tds-sheet .35s cubic-bezier(.2,.8,.2,1) both; }
.tds-dim { animation: tds-dim .25s ease both; }
.tds-stamp { animation: tds-stamp .55s cubic-bezier(.2,.8,.2,1) .35s both; }
.tds-progress { animation: tds-progress ${LOADING_DURATION}ms cubic-bezier(.4,0,.2,1) both; }
.tds-shake { animation: tds-shake .4s ease; }
.tds-noscroll::-webkit-scrollbar { display: none; }
.tds-noscroll { scrollbar-width: none; }
input[type=range].tds-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; }
input[type=range].tds-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 9999px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer; }
input[type=range].tds-range::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 9999px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer; }
`;

function Card({ children, className = '', style }) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm ${className}`} style={style}>
      {children}
    </section>
  );
}

function PrimaryButton({ children, onClick, disabled, className = '', icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-14 rounded-2xl text-[17px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] ${
        disabled
          ? 'bg-[#E5E8EB] text-[#B0B8C1] cursor-not-allowed active:scale-100'
          : 'bg-[#3182F6] text-white hover:bg-[#1B64DA] shadow-[0_4px_14px_rgba(49,130,246,0.35)]'
      } ${className}`}
    >
      {Icon && <Icon size={20} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, icon: Icon, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-2xl text-[16px] font-semibold flex items-center justify-center gap-1.5 bg-[#E8F3FF] text-[#1B64DA] transition-all duration-200 hover:bg-[#DCEBFF] active:scale-[0.98] ${className}`}
    >
      {Icon && <Icon size={18} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

function BottomCTA({ children, hint }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30">
      <div className="h-6 bg-gradient-to-t from-[#F2F4F6] to-transparent pointer-events-none" />
      <div className="bg-[#F2F4F6] px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        {hint && <p className="text-center text-[13px] text-[#8B95A1] mb-2.5">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

function DeltaBadge({ delta, size = 'md' }) {
  const isPenalty = delta > 0;
  const cls = isPenalty ? 'bg-[#FFEEEE] text-[#F04452]' : 'bg-[#E5F8EF] text-[#00A661]';
  const sz = size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-[13px] px-2 py-1';
  return <span className={`shrink-0 rounded-md font-bold tabular-nums ${cls} ${sz}`}>{fmtPct(delta)}</span>;
}

function Avatar({ name, tone = 'blue', size = 40 }) {
  const tones = {
    blue: 'bg-[#E8F3FF] text-[#3182F6]',
    red: 'bg-[#FFEEEE] text-[#F04452]',
    green: 'bg-[#E5F8EF] text-[#00A661]',
    gray: 'bg-[#F2F4F6] text-[#4E5968]',
  };
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 ${tones[tone]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const Icon = toast.type === 'error' ? AlertCircle : Check;
  return (
    <div
      key={toast.key}
      className="tds-toast fixed left-1/2 bottom-28 z-50 w-[calc(100%-40px)] max-w-[408px] rounded-2xl bg-[#191F28]/95 backdrop-blur px-4 py-3.5 flex items-center gap-2.5 shadow-lg"
      role="status"
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          toast.type === 'error' ? 'bg-[#F04452]' : 'bg-[#3182F6]'
        }`}
      >
        <Icon size={13} strokeWidth={3} className="text-white" />
      </span>
      <span className="text-white text-[15px] font-medium leading-snug">{toast.message}</span>
    </div>
  );
}

function Header({ step, onBack }) {
  const titles = ['', '정산 정보 입력', '인간적 기여도 평가', 'AI 대법관 심리 중', '최종 판결문'];
  return (
    <header className="sticky top-0 z-20 bg-[#F2F4F6]/90 backdrop-blur">
      <div className="h-14 px-2 flex items-center">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label="뒤로 가기"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            onBack ? 'text-[#191F28] hover:bg-black/5 active:scale-90' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft size={26} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-[#191F28] -ml-10 pointer-events-none">
          {titles[step]}
        </h1>
      </div>
      <div className="h-[3px] bg-[#E5E8EB]">
        <div
          className="h-full bg-[#3182F6] transition-all duration-500 ease-out"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Step 1: 기본 정산 정보
 * ────────────────────────────────────────────────────────────── */

function StepBasicInfo({ total, setTotal, people, onAddPerson, onRemovePerson, showToast, onNext }) {
  const [name, setName] = useState('');
  const [shake, setShake] = useState(false);

  const addAmount = (amount) => {
    const next = total + amount;
    if (next > MAX_AMOUNT) {
      setTotal(MAX_AMOUNT);
      showToast('1억 원 이상은 쪼잔정산이 아니라 법원에 가셔야 합니다', 'error');
      return;
    }
    setTotal(next);
  };

  const handleAmountChange = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    if (!digits) return setTotal(0);
    const n = Number(digits);
    if (n > MAX_AMOUNT) {
      setTotal(MAX_AMOUNT);
      showToast('최대 1억 원까지 정산할 수 있어요', 'error');
      return;
    }
    setTotal(n);
  };

  const submitName = () => {
    const ok = onAddPerson(name);
    if (ok) {
      setName('');
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const amountTooSmall = total > 0 && total < MIN_AMOUNT;
  const canProceed = total >= MIN_AMOUNT && people.length >= MIN_PEOPLE;
  const hint =
    total === 0
      ? '0원은 정산할 수 없어요. 우정도 공짜는 아닙니다'
      : amountTooSmall
        ? `${MIN_AMOUNT}원 미만은 쪼잔함 측정 장비가 작동하지 않아요`
        : people.length < MIN_PEOPLE
          ? `최소 ${MIN_PEOPLE}명은 있어야 누군가를 탓할 수 있어요`
          : null;

  return (
    <div className="px-5 pt-6 pb-40 space-y-4">
      <div className="tds-fade-up">
        <h2 className="text-[26px] font-bold leading-[1.35] text-[#191F28]">
          오늘 얼마나 쓰셨나요?
          <br />
          <span className="text-[#3182F6]">원 단위까지 따져드릴게요</span>
        </h2>
        <p className="mt-2 text-[15px] text-[#8B95A1]">우정은 영원하지만, 계산은 정확해야 하니까요.</p>
      </div>

      <Card className="p-5 tds-fade-up" style={{ animationDelay: '60ms' }}>
        <label htmlFor="total" className="text-[14px] font-medium text-[#4E5968] flex items-center gap-1.5">
          <Wallet size={16} /> 총 결제 금액
        </label>
        <div className="mt-2 flex items-end gap-1 border-b-2 border-[#E5E8EB] focus-within:border-[#3182F6] transition-colors pb-2">
          <input
            id="total"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={total ? total.toLocaleString('ko-KR') : ''}
            onChange={handleAmountChange}
            className="flex-1 min-w-0 bg-transparent text-[32px] font-bold text-[#191F28] placeholder:text-[#D1D6DB] outline-none tabular-nums"
          />
          <span className="text-[24px] font-bold text-[#191F28] pb-1">원</span>
        </div>
        <p className="mt-2 h-5 text-[13px] text-[#8B95A1]">{toKoreanUnit(total)}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ['+1만', 10_000],
            ['+5만', 50_000],
            ['+10만', 100_000],
          ].map(([label, amount]) => (
            <button
              key={label}
              type="button"
              onClick={() => addAmount(amount)}
              className="h-10 rounded-xl bg-[#F2F4F6] text-[14px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-95 transition-all"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTotal(0)}
            className="h-10 rounded-xl bg-[#F2F4F6] text-[14px] font-semibold text-[#8B95A1] hover:bg-[#E5E8EB] active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <RotateCcw size={13} /> 초기화
          </button>
        </div>
      </Card>

      <Card className="p-5 tds-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#4E5968] flex items-center gap-1.5">
            <Users size={16} /> 참가자
          </span>
          <span className="text-[13px] text-[#8B95A1] tabular-nums">
            <b className="text-[#3182F6]">{people.length}</b> / {MAX_PEOPLE}명
          </span>
        </div>

        <ul className="mt-3 divide-y divide-[#F2F4F6]">
          {people.map((p) => (
            <li key={p.id} className="tds-fade-up flex items-center gap-3 py-3">
              <Avatar name={p.name} />
              <span className="flex-1 text-[16px] font-medium text-[#191F28] truncate">{p.name}</span>
              <button
                type="button"
                onClick={() => onRemovePerson(p.id)}
                disabled={people.length <= MIN_PEOPLE}
                aria-label={`${p.name} 삭제`}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#B0B8C1] hover:bg-[#FFEEEE] hover:text-[#F04452] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#B0B8C1] transition-all active:scale-90"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>

        {people.length < MAX_PEOPLE ? (
          <div className={`mt-2 flex gap-2 ${shake ? 'tds-shake' : ''}`}>
            <input
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="이름을 입력하세요 (예: 최노쇼)"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitName();
              }}
              className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-[#F2F4F6] text-[15px] text-[#191F28] placeholder:text-[#B0B8C1] outline-none focus:ring-2 focus:ring-[#3182F6]/40 transition-all"
            />
            <button
              type="button"
              onClick={submitName}
              className="h-12 px-4 rounded-xl bg-[#3182F6] text-white text-[15px] font-semibold flex items-center gap-1 hover:bg-[#1B64DA] active:scale-95 transition-all"
            >
              <UserPlus size={17} /> 추가
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-[#8B95A1] text-center py-2">
            10명이 넘으면 AI 대법관도 누가 누군지 헷갈려요
          </p>
        )}
      </Card>

      <BottomCTA hint={hint}>
        <PrimaryButton disabled={!canProceed} onClick={onNext}>
          다음: 인간적 기여도 평가하기
        </PrimaryButton>
      </BottomCTA>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Step 2: 가산세 / 공제 태그
 * ────────────────────────────────────────────────────────────── */

function TagRow({ tag, checked, onToggle, onDelete }) {
  const isPenalty = tag.delta > 0;
  const accent = isPenalty ? '#F04452' : '#00C471';
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`group w-full text-left flex items-start gap-3 p-3.5 rounded-xl cursor-pointer select-none transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/50 ${
        checked ? (isPenalty ? 'bg-[#FFF5F5]' : 'bg-[#F0FBF6]') : 'hover:bg-[#F9FAFB]'
      }`}
    >
      <span
        className="mt-0.5 w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0 transition-all duration-200 border-2"
        style={{
          backgroundColor: checked ? accent : '#fff',
          borderColor: checked ? accent : '#D1D6DB',
        }}
      >
        {checked && <Check size={14} strokeWidth={3.5} className="text-white tds-pop" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-start gap-1.5">
          <span className="text-[16px] leading-[1.4]">{tag.emoji}</span>
          <span className="text-[15px] font-medium leading-[1.4] text-[#191F28] break-keep">{tag.label}</span>
        </span>
        <span className="block mt-1 text-[13px] text-[#8B95A1] break-keep">사유: {tag.reason}</span>
      </span>
      <span className="flex items-center gap-1">
        <DeltaBadge delta={tag.delta} />
        {onDelete && (
          <button
            type="button"
            aria-label="죄목 폐지"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[#B0B8C1] hover:text-[#F04452] hover:bg-[#FFEEEE] transition-all active:scale-90"
          >
            <Trash2 size={15} />
          </button>
        )}
      </span>
    </div>
  );
}

function CustomTagForm({ onAdd }) {
  const [label, setLabel] = useState('');
  const [delta, setDelta] = useState(20);
  const [shake, setShake] = useState(false);

  const submit = () => {
    if (onAdd(label, delta)) {
      setLabel('');
      setDelta(20);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const pct = ((delta - CUSTOM_MIN) / (CUSTOM_MAX - CUSTOM_MIN)) * 100;
  const zeroPct = ((0 - CUSTOM_MIN) / (CUSTOM_MAX - CUSTOM_MIN)) * 100;
  const color = delta > 0 ? '#F04452' : delta < 0 ? '#00C471' : '#B0B8C1';
  const lo = Math.min(pct, zeroPct);
  const hi = Math.max(pct, zeroPct);

  return (
    <div className={`mt-3 p-4 rounded-xl bg-[#F9FAFB] ${shake ? 'tds-shake' : ''}`}>
      <input
        type="text"
        value={label}
        maxLength={30}
        placeholder="죄목 이름 (예: 계산할 때 화장실 감)"
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
        }}
        className="w-full h-12 px-4 rounded-xl bg-white border border-[#E5E8EB] text-[15px] text-[#191F28] placeholder:text-[#B0B8C1] outline-none focus:border-[#3182F6] transition-colors"
      />
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#4E5968]">가산율</span>
        <span className="text-[18px] font-bold tabular-nums transition-colors" style={{ color }}>
          {fmtPct(delta)}
          <span className="ml-1 text-[12px] font-medium text-[#8B95A1]">
            {delta > 0 ? '가산세' : delta < 0 ? '공제' : '무의미'}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={CUSTOM_MIN}
        max={CUSTOM_MAX}
        step={1}
        value={delta}
        onChange={(e) => setDelta(Number(e.target.value))}
        className="tds-range w-full mt-3"
        style={{
          background: `linear-gradient(to right, #E5E8EB ${lo}%, ${color} ${lo}%, ${color} ${hi}%, #E5E8EB ${hi}%)`,
        }}
        aria-label="가산율"
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-[#B0B8C1] tabular-nums">
        <span>{CUSTOM_MIN}%</span>
        <span>0</span>
        <span>+{CUSTOM_MAX}%</span>
      </div>
      <button
        type="button"
        onClick={submit}
        className="mt-3 w-full h-11 rounded-xl bg-[#191F28] text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#333D4B] active:scale-[0.98] transition-all"
      >
        <Gavel size={16} /> 즉석 입법 후 이 사람에게 적용
      </button>
    </div>
  );
}

function StepTags({
  people,
  activeId,
  setActiveId,
  selections,
  toggleTag,
  customTags,
  onAddCustomTag,
  onRemoveCustomTag,
  settlement,
  total,
  onStart,
}) {
  const active = people.find((p) => p.id === activeId) || people[0];
  const activeRow = settlement?.rows.find((r) => r.id === active.id);
  const selected = selections[active.id] || [];
  const tabsRef = useRef(null);

  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-pid="${active.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active.id]);

  const weightTone = !activeRow
    ? '#191F28'
    : activeRow.weight > BASE_WEIGHT
      ? '#F04452'
      : activeRow.weight < BASE_WEIGHT
        ? '#00C471'
        : '#191F28';

  const groups = [
    { key: 'penalty', label: '가산세', color: '#F04452', bg: '#FFEEEE', cats: TAG_CATEGORIES.filter((c) => c.kind === 'penalty') },
    { key: 'deduction', label: '공제', color: '#00A661', bg: '#E5F8EF', cats: TAG_CATEGORIES.filter((c) => c.kind === 'deduction') },
  ];

  return (
    <div className="pt-6 pb-40">
      <div className="px-5 tds-fade-up">
        <h2 className="text-[26px] font-bold leading-[1.35] text-[#191F28]">
          누가 오늘
          <br />
          <span className="text-[#F04452]">우정을 갉아먹었나요?</span>
        </h2>
        <p className="mt-2 text-[15px] text-[#8B95A1]">
          모두 가중치 100에서 시작해요. 죄목은 복수 선택 가능합니다.
        </p>
      </div>

      {/* 참가자 탭 */}
      <div ref={tabsRef} className="tds-noscroll mt-5 px-5 flex gap-2 overflow-x-auto pb-1">
        {people.map((p) => {
          const row = settlement?.rows.find((r) => r.id === p.id);
          const isActive = p.id === active.id;
          const w = row?.weight ?? BASE_WEIGHT;
          const count = (selections[p.id] || []).length;
          return (
            <button
              key={p.id}
              data-pid={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={`shrink-0 h-11 pl-4 pr-3 rounded-full flex items-center gap-2 text-[15px] font-semibold transition-all duration-200 active:scale-95 ${
                isActive ? 'bg-[#191F28] text-white shadow-md' : 'bg-white text-[#4E5968] shadow-sm hover:bg-[#F9FAFB]'
              }`}
            >
              {p.name}
              <span
                className={`min-w-[34px] h-6 px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center tabular-nums transition-colors ${
                  w > BASE_WEIGHT
                    ? 'bg-[#F04452] text-white'
                    : w < BASE_WEIGHT
                      ? 'bg-[#00C471] text-white'
                      : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#F2F4F6] text-[#8B95A1]'
                }`}
              >
                {w}
              </span>
              {count > 0 && <span className="sr-only">{count}개 선택됨</span>}
            </button>
          );
        })}
      </div>

      <div key={active.id} className="px-5 mt-4 space-y-4 tds-fade-up">
        {/* 피고인 요약 */}
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Avatar
              name={active.name}
              size={48}
              tone={activeRow?.weight > BASE_WEIGHT ? 'red' : activeRow?.weight < BASE_WEIGHT ? 'green' : 'blue'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#8B95A1]">피고인</p>
              <p className="text-[19px] font-bold text-[#191F28] truncate">{active.name}님</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-[#8B95A1]">현재 가중치</p>
              <p className="text-[24px] font-bold tabular-nums transition-colors" style={{ color: weightTone }}>
                {activeRow?.weight ?? BASE_WEIGHT}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#F2F4F6] flex justify-between text-[13px]">
            <span className="text-[#8B95A1] tabular-nums">
              기본 100 {activeRow && activeRow.deltaSum !== 0 && (activeRow.deltaSum > 0 ? '+ ' : '- ')}
              {activeRow && activeRow.deltaSum !== 0 && Math.abs(activeRow.deltaSum)}
              {activeRow?.clamped && <span className="text-[#00A661]"> (최소 {MIN_WEIGHT} 방어)</span>}
            </span>
            {activeRow && total > 0 && (
              <span className="text-[#4E5968] font-medium tabular-nums">
                예상 부담 {fmtExact(activeRow.exact)}원
              </span>
            )}
          </div>
        </Card>

        {/* 프리셋 죄목 */}
        {groups.map((g) =>
          g.cats.map((cat) => (
            <Card key={cat.id} className="p-2.5">
              <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-2">
                <span
                  className="text-[12px] font-bold px-2 py-0.5 rounded-md"
                  style={{ color: g.color, backgroundColor: g.bg }}
                >
                  {g.label}
                </span>
                <span className="text-[15px] font-semibold text-[#191F28]">{cat.title}</span>
              </div>
              {cat.tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  checked={selected.includes(tag.id)}
                  onToggle={() => toggleTag(active.id, tag.id)}
                />
              ))}
            </Card>
          ))
        )}

        {/* 커스텀 죄목 */}
        <Card className="p-2.5">
          <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-2">
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-md text-[#3182F6] bg-[#E8F3FF]">
              즉석 입법
            </span>
            <span className="text-[15px] font-semibold text-[#191F28]">현장 맞춤형 죄목 추가</span>
          </div>
          {customTags.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-[#8B95A1]">
              프리셋에 없는 만행이 있었나요? 직접 법을 만들어 주세요. 추가된 죄목은 모든 참가자에게 적용할 수 있어요.
            </p>
          ) : (
            customTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                checked={selected.includes(tag.id)}
                onToggle={() => toggleTag(active.id, tag.id)}
                onDelete={() => onRemoveCustomTag(tag.id)}
              />
            ))
          )}
          <div className="px-1 pb-1">
            <CustomTagForm onAdd={(label, delta) => onAddCustomTag(active.id, label, delta)} />
          </div>
        </Card>

        {/* 다음 피고인 */}
        {people.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const idx = people.findIndex((p) => p.id === active.id);
              setActiveId(people[(idx + 1) % people.length].id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full h-12 rounded-xl text-[15px] font-semibold text-[#4E5968] bg-white shadow-sm hover:bg-[#F9FAFB] active:scale-[0.98] transition-all"
          >
            다음 피고인 심문하기 →
          </button>
        )}
      </div>

      <BottomCTA>
        <PrimaryButton icon={Gavel} onClick={onStart}>
          AI 대법관 정산 시작
        </PrimaryButton>
      </BottomCTA>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Step 3: 가짜 AI 로딩
 * ────────────────────────────────────────────────────────────── */

function StepLoading({ onDone }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, LOADING_INTERVAL);
    const timeout = setTimeout(() => doneRef.current(), LOADING_DURATION);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const isLast = msgIdx === LOADING_MESSAGES.length - 1;

  return (
    <div className="tds-fade-up min-h-[calc(100vh-60px)] px-8 flex flex-col items-center justify-center text-center">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-[6px] border-[#E8F3FF]" />
        <div className="absolute inset-0 rounded-full border-[6px] border-[#3182F6] border-t-transparent border-r-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Scale size={28} className="text-[#3182F6]" />
        </div>
      </div>

      <p className="mt-8 text-[13px] font-semibold text-[#3182F6] tracking-wide">AI 대법관 정밀 심리 중</p>
      <div className="mt-3 h-[60px] flex items-start justify-center">
        <p
          key={msgIdx}
          className={`tds-roll text-[19px] font-bold leading-[1.45] break-keep ${
            isLast ? 'text-[#3182F6]' : 'text-[#191F28]'
          }`}
        >
          {LOADING_MESSAGES[msgIdx]}
        </p>
      </div>

      <div className="mt-8 w-full max-w-[260px] h-1.5 rounded-full bg-[#E5E8EB] overflow-hidden">
        <div className="tds-progress h-full rounded-full bg-[#3182F6]" />
      </div>
      <div className="mt-6 flex gap-1.5">
        {LOADING_MESSAGES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= msgIdx ? 'w-5 bg-[#3182F6]' : 'w-1.5 bg-[#D1D6DB]'
            }`}
          />
        ))}
      </div>
      <p className="mt-10 text-[12px] text-[#B0B8C1]">※ 실제 AI는 사용되지 않았으며, 우정은 실제로 파괴됩니다.</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Step 4: 최종 판결문 & 영수증
 * ────────────────────────────────────────────────────────────── */

function CountUpWon({ value, className = '' }) {
  const v = useCountUp(value);
  return <span className={`tabular-nums ${className}`}>{fmtWon(v)}</span>;
}

function ReceiptItem({ row, settlement, delay }) {
  const { remainder } = settlement;
  const diffColor = row.diff > 0.05 ? '#F04452' : row.diff < -0.05 ? '#00A661' : '#8B95A1';
  const diffDot = row.diff > 0.05 ? '🔴' : row.diff < -0.05 ? '🟢' : '⚪';

  return (
    <div className="tds-fade-up py-5 first:pt-1" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3">
        <Avatar name={row.name} tone={row.isVillain ? 'red' : row.isSaint ? 'green' : 'gray'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[16px] font-bold text-[#191F28] truncate">{row.name}</span>
            {row.isVillain && settlement.hasVillain && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#F04452] text-white flex items-center gap-0.5">
                <Crown size={11} /> 1등 빌런
              </span>
            )}
            {row.isVillain && !settlement.hasVillain && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#4E5968] text-white">자투리 당번</span>
            )}
            {row.isSaint && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#00C471] text-white">😇 모범 시민</span>
            )}
          </div>
          <p className="text-[12px] text-[#8B95A1] tabular-nums">
            가중치 {row.weight} · 지분 {((row.weight / settlement.totalWeight) * 100).toFixed(3)}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-bold text-[#191F28]">
            <CountUpWon value={row.pay} />
            <span className="text-[16px]">원</span>
          </p>
        </div>
      </div>

      <div className="mt-3 ml-[52px] rounded-xl bg-[#F9FAFB] p-3 space-y-1.5 text-[13px]">
        <div className="flex justify-between gap-2">
          <span className="text-[#8B95A1]">초정밀 팩트 청구액</span>
          <span className="font-semibold text-[#191F28] tabular-nums">{fmtExact(row.exact)}원</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#8B95A1]">1/N 대비</span>
          <span className="font-semibold tabular-nums" style={{ color: diffColor }}>
            {fmtDiff(row.diff)}원 {diffDot}
          </span>
        </div>
        {row.isVillain && remainder > 0 && (
          <div className="pt-1">
            <span className="inline-block text-[12px] font-semibold px-2 py-1 rounded-md bg-[#FFEEEE] text-[#F04452]">
              *(자투리 {fmtWon(remainder)}원 빌런 독박 포함)
            </span>
          </div>
        )}
        {row.tags.length > 0 ? (
          <ul className="pt-1.5 mt-1.5 border-t border-dashed border-[#E5E8EB] space-y-1">
            {row.tags.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2">
                <span className="text-[#4E5968] break-keep">
                  {t.emoji} {t.reason}
                </span>
                <DeltaBadge delta={t.delta} size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-1.5 mt-1.5 border-t border-dashed border-[#E5E8EB] text-[#B0B8C1]">
            적용된 죄목 없음 (수상할 정도로 무난함)
          </p>
        )}
      </div>
    </div>
  );
}

function StepResult({ total, settlement, account, setAccount, memo, setMemo, onCopy, onEditTags, onRestart }) {
  const { villain, hasVillain, surcharge, verdict, sorted, base, paySum, balanced } = settlement;

  return (
    <div className="px-5 pt-6 pb-48 space-y-4">
      {/* 판결문 배너 */}
      <Card className="relative overflow-hidden tds-fade-up">
        <div className="bg-gradient-to-br from-[#191F28] to-[#333D4B] px-5 pt-5 pb-6 text-white">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#FF8A95]">
            <Gavel size={15} /> [판결문] 2026 쪼잔합의 제1호
          </div>
          {hasVillain ? (
            <h2 className="mt-3 text-[22px] font-bold leading-[1.45] break-keep">
              오늘 모임의 최고 빌런은
              <br />
              <span className="text-[#FF6B78]">{villain.name}님</span>입니다
            </h2>
          ) : (
            <h2 className="mt-3 text-[22px] font-bold leading-[1.45] break-keep">
              오늘 모임엔 빌런이 없습니다
              <br />
              <span className="text-[#8EC5FF]">자투리 당번은 {villain.name}님</span>
            </h2>
          )}
          <p className="mt-2 text-[14px] text-[#B0B8C1]">
            (기여도 대비 가산세{' '}
            <b className={hasVillain ? 'text-[#FF6B78]' : 'text-white'}>{fmtPct(surcharge)}</b>)
          </p>
          {hasVillain && (
            <div className="tds-stamp absolute top-5 right-4 w-[74px] h-[74px] rounded-full border-[3px] border-[#F04452] text-[#F04452] flex flex-col items-center justify-center font-black leading-none bg-[#191F28]/40">
              <span className="text-[11px]">우정</span>
              <span className="text-[17px] mt-0.5">파산</span>
            </div>
          )}
        </div>
        <div className="px-5 py-4 flex gap-3 items-start">
          <span className="w-8 h-8 rounded-full bg-[#F2F4F6] flex items-center justify-center shrink-0">
            <Scale size={16} className="text-[#4E5968]" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[#8B95A1]">
              AI 대법관 한줄 팩폭{settlement.worstTag && hasVillain ? ` · 주요 혐의: ${settlement.worstTag.label}` : ''}
            </p>
            <p className="mt-1 text-[15px] font-medium text-[#191F28] leading-[1.55] break-keep">"{verdict}"</p>
          </div>
        </div>
      </Card>

      {/* 요약 */}
      <Card className="p-5 grid grid-cols-3 gap-2 text-center tds-fade-up" style={{ animationDelay: '80ms' }}>
        <div>
          <p className="text-[12px] text-[#8B95A1]">총 결제액</p>
          <p className="mt-1 text-[15px] font-bold text-[#191F28] tabular-nums">{fmtWon(total)}원</p>
        </div>
        <div className="border-x border-[#F2F4F6]">
          <p className="text-[12px] text-[#8B95A1]">단순 1/N</p>
          <p className="mt-1 text-[15px] font-bold text-[#8B95A1] tabular-nums line-through decoration-[#F04452]/70">
            {fmtWon(Math.floor(base))}원
          </p>
        </div>
        <div>
          <p className="text-[12px] text-[#8B95A1]">총 가중치</p>
          <p className="mt-1 text-[15px] font-bold text-[#191F28] tabular-nums">{settlement.totalWeight}</p>
        </div>
      </Card>

      {/* 영수증 */}
      <Card className="relative tds-fade-up" style={{ animationDelay: '140ms' }}>
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Receipt size={18} className="text-[#3182F6]" />
          <h3 className="text-[17px] font-bold text-[#191F28]">개인별 청구 내역서</h3>
        </div>
        <div className="px-5 divide-y divide-[#F2F4F6]">
          {sorted.map((row, i) => (
            <ReceiptItem key={row.id} row={row} settlement={settlement} delay={200 + i * 70} />
          ))}
        </div>

        {/* 톱니 절취선 */}
        <div className="relative h-6 flex items-center">
          <span className="absolute -left-3 w-6 h-6 rounded-full bg-[#F2F4F6]" />
          <span className="absolute -right-3 w-6 h-6 rounded-full bg-[#F2F4F6]" />
          <span className="mx-5 w-full border-t-2 border-dashed border-[#E5E8EB]" />
        </div>

        <div className="px-5 pb-5 pt-1 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-[#4E5968]">송금액 합계</span>
            <span className="text-[18px] font-bold text-[#191F28] tabular-nums">{fmtWon(paySum)}원</span>
          </div>
          <div
            className={`flex items-center gap-1.5 text-[13px] font-medium ${
              balanced ? 'text-[#00A661]' : 'text-[#F04452]'
            }`}
          >
            <ShieldCheck size={15} />
            {balanced ? `총 결제액과 1원도 틀리지 않고 일치 (오차 0원)` : '합계 불일치 — 대법관 재심 필요'}
          </div>
          {(account.trim() || memo.trim()) && (
            <div className="tds-fade-up mt-3 rounded-xl bg-[#E8F3FF] p-3.5 space-y-1">
              {account.trim() && (
                <p className="text-[14px] text-[#1B64DA] font-semibold break-all">🏦 {account.trim()}</p>
              )}
              {memo.trim() && <p className="text-[13px] text-[#4E5968] break-all">💬 {memo.trim()}</p>}
            </div>
          )}
          <p className="pt-2 text-[11px] text-[#B0B8C1] leading-relaxed">
            ※ 본 정산은 AI 대법관의 확정 판결로 항소가 불가합니다. 이의 제기 시 다음 모임 가산세 +50%가 자동 부과됩니다.
          </p>
        </div>
      </Card>

      {/* 입금처 */}
      <Card className="p-5 tds-fade-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-[15px] font-bold text-[#191F28] flex items-center gap-1.5">
          <PencilLine size={16} className="text-[#3182F6]" /> 총무 입금처 & 한마디
        </h3>
        <p className="mt-1 text-[13px] text-[#8B95A1]">입력하면 영수증과 복사 텍스트에 바로 반영돼요.</p>
        <input
          type="text"
          value={account}
          maxLength={60}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="계좌번호 또는 토스아이디 (예: 토스뱅크 1000-0000-0000)"
          className="mt-3 w-full h-12 px-4 rounded-xl bg-[#F2F4F6] text-[15px] text-[#191F28] placeholder:text-[#B0B8C1] outline-none focus:ring-2 focus:ring-[#3182F6]/40 transition-all"
        />
        <input
          type="text"
          value={memo}
          maxLength={80}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="한줄 메시지 (예: 자정까지 미입금 시 연체이자 12%)"
          className="mt-2 w-full h-12 px-4 rounded-xl bg-[#F2F4F6] text-[15px] text-[#191F28] placeholder:text-[#B0B8C1] outline-none focus:ring-2 focus:ring-[#3182F6]/40 transition-all"
        />
      </Card>

      <BottomCTA>
        <PrimaryButton icon={Copy} onClick={onCopy}>
          단톡방 투하용 텍스트 복사하기
        </PrimaryButton>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SecondaryButton icon={PencilLine} onClick={onEditTags}>
            태그 수정
          </SecondaryButton>
          <SecondaryButton icon={RotateCcw} onClick={onRestart}>
            처음부터 다시
          </SecondaryButton>
        </div>
      </BottomCTA>
    </div>
  );
}

function ManualCopySheet({ text, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="tds-dim absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="tds-sheet relative w-full max-w-md bg-white rounded-t-3xl p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-10 h-1 rounded-full bg-[#E5E8EB] mb-4" />
        <h3 className="text-[18px] font-bold text-[#191F28]">자동 복사가 막혀 있어요</h3>
        <p className="mt-1 text-[14px] text-[#8B95A1]">아래 텍스트를 길게 눌러 직접 복사해 주세요.</p>
        <textarea
          ref={ref}
          readOnly
          value={text}
          className="mt-4 w-full h-64 p-3 rounded-xl bg-[#F2F4F6] text-[13px] text-[#191F28] leading-relaxed outline-none resize-none"
        />
        <PrimaryButton className="mt-3" onClick={onClose}>
          확인
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * App
 * ────────────────────────────────────────────────────────────── */

export default function App() {
  const [step, setStep] = useState(1);
  const [total, setTotal] = useState(0);
  const [people, setPeople] = useState(makeDefaultPeople);
  const [selections, setSelections] = useState({});
  const [customTags, setCustomTags] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [account, setAccount] = useState('');
  const [memo, setMemo] = useState('');
  const [toast, setToast] = useState(null);
  const [manualCopyText, setManualCopyText] = useState(null);
  const toastTimer = useRef(null);

  const tagMap = useMemo(() => {
    const map = {};
    [...PRESET_TAGS, ...customTags].forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [customTags]);

  const settlement = useMemo(
    () => computeSettlement(total, people, selections, tagMap),
    [total, people, selections, tagMap]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  /* 참가자 */
  const addPerson = (rawName) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) {
      showToast('이름을 입력해 주세요. 익명 빌런은 허용되지 않아요', 'error');
      return false;
    }
    if (people.length >= MAX_PEOPLE) {
      showToast(`최대 ${MAX_PEOPLE}명까지만 재판할 수 있어요`, 'error');
      return false;
    }
    if (people.some((p) => p.name === name)) {
      showToast(`'${name}'님은 이미 법정에 출석해 있어요`, 'error');
      return false;
    }
    setPeople((prev) => [...prev, { id: uid('p'), name }]);
    return true;
  };

  const removePerson = (id) => {
    if (people.length <= MIN_PEOPLE) {
      showToast(`최소 ${MIN_PEOPLE}명은 있어야 정산이 성립해요`, 'error');
      return;
    }
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setSelections((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeId === id) setActiveId(null);
  };

  /* 태그 */
  const toggleTag = (personId, tagId) => {
    setSelections((prev) => {
      const cur = prev[personId] || [];
      const next = cur.includes(tagId) ? cur.filter((t) => t !== tagId) : [...cur, tagId];
      return { ...prev, [personId]: next };
    });
  };

  const addCustomTag = (personId, rawLabel, delta) => {
    const label = rawLabel.trim();
    if (!label) {
      showToast('죄목 이름을 입력해 주세요', 'error');
      return false;
    }
    if (!Number.isInteger(delta) || delta < CUSTOM_MIN || delta > CUSTOM_MAX) {
      showToast(`가산율은 ${CUSTOM_MIN}% ~ +${CUSTOM_MAX}% 사이여야 해요`, 'error');
      return false;
    }
    if (delta === 0) {
      showToast('0%짜리 죄목은 법적 실익이 없어요', 'error');
      return false;
    }
    if ([...PRESET_TAGS, ...customTags].some((t) => t.label === label)) {
      showToast('이미 같은 이름의 죄목이 있어요', 'error');
      return false;
    }
    const tag = {
      id: uid('c'),
      emoji: delta > 0 ? '⚖️' : '😇',
      label,
      delta,
      reason: delta > 0 ? `현장 즉석 입법 "${label}" 가산세` : `현장 배심원 특별 감면 "${label}" 공제`,
      custom: true,
    };
    setCustomTags((prev) => [...prev, tag]);
    setSelections((prev) => ({ ...prev, [personId]: [...(prev[personId] || []), tag.id] }));
    showToast(`신규 죄목이 제정되어 즉시 적용됐어요 (${fmtPct(delta)})`);
    return true;
  };

  const removeCustomTag = (tagId) => {
    setCustomTags((prev) => prev.filter((t) => t.id !== tagId));
    setSelections((prev) => {
      const next = {};
      Object.entries(prev).forEach(([pid, ids]) => {
        next[pid] = ids.filter((id) => id !== tagId);
      });
      return next;
    });
    showToast('해당 죄목이 폐지되었어요');
  };

  /* 네비게이션 */
  const goStep2 = () => {
    if (total <= 0) return showToast('0원은 정산할 수 없어요', 'error');
    if (total < MIN_AMOUNT) return showToast(`${MIN_AMOUNT}원 이상 입력해 주세요`, 'error');
    if (people.length < MIN_PEOPLE) return showToast(`최소 ${MIN_PEOPLE}명이 필요해요`, 'error');
    if (!people.some((p) => p.id === activeId)) setActiveId(people[0].id);
    setStep(2);
  };

  const startJudging = () => {
    if (!settlement || total < MIN_AMOUNT) {
      showToast('정산 금액을 다시 확인해 주세요', 'error');
      setStep(1);
      return;
    }
    setStep(3);
  };

  const finishLoading = useCallback(() => setStep(4), []);

  const handleCopy = async () => {
    const text = buildShareText({ total, settlement, account, memo });
    const ok = await copyToClipboard(text);
    if (ok) {
      showToast('명세서가 복사됐어요. 단톡방에 투하하세요 💣');
    } else {
      setManualCopyText(text);
    }
  };

  const restart = () => {
    setTotal(0);
    setPeople(makeDefaultPeople());
    setSelections({});
    setCustomTags([]);
    setActiveId(null);
    setAccount('');
    setMemo('');
    setStep(1);
    showToast('새 재판을 시작합니다. 우정은 리셋되지 않아요');
  };

  const back = step === 2 ? () => setStep(1) : step === 4 ? () => setStep(2) : null;

  return (
    <div className="min-h-screen bg-[#F2F4F6]">
      <style>{GLOBAL_STYLE}</style>
      <div className="relative max-w-md mx-auto min-h-screen bg-[#F2F4F6]">
        <Header step={step} onBack={back} />
        <main key={step}>
          {step === 1 && (
            <StepBasicInfo
              total={total}
              setTotal={setTotal}
              people={people}
              onAddPerson={addPerson}
              onRemovePerson={removePerson}
              showToast={showToast}
              onNext={goStep2}
            />
          )}
          {step === 2 && (
            <StepTags
              people={people}
              activeId={activeId}
              setActiveId={setActiveId}
              selections={selections}
              toggleTag={toggleTag}
              customTags={customTags}
              onAddCustomTag={addCustomTag}
              onRemoveCustomTag={removeCustomTag}
              settlement={settlement}
              total={total}
              onStart={startJudging}
            />
          )}
          {step === 3 && <StepLoading onDone={finishLoading} />}
          {step === 4 && settlement && (
            <StepResult
              total={total}
              settlement={settlement}
              account={account}
              setAccount={setAccount}
              memo={memo}
              setMemo={setMemo}
              onCopy={handleCopy}
              onEditTags={() => setStep(2)}
              onRestart={restart}
            />
          )}
        </main>
      </div>
      <Toast toast={toast} />
      {manualCopyText && <ManualCopySheet text={manualCopyText} onClose={() => setManualCopyText(null)} />}
    </div>
  );
}
