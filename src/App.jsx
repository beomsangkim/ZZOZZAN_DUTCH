import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
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
// 정산 매운맛(양형 강도). 기본값은 normal
const COURT_MODES = [
  { id: 'peace', emoji: '🕊️', name: '평화', short: '소액 차이', desc: '실제 송금용! 커피 한 잔 값 차이로 훈훈하게 정산', penaltyFactor: 1, compress: 0.4, min: 60, max: 160 },
  { id: 'normal', emoji: '⚖️', name: '기본', short: '1.0x', desc: '죄목과 공로를 그대로 반영', penaltyFactor: 1, compress: 1, min: 10, max: 300 },
  { id: 'bankrupt', emoji: '🔥', name: '파산', short: '1.5x', desc: '벌칙 게임용 극한 정산 (가산세 1.5배)', penaltyFactor: 1.5, compress: 1, min: 10, max: 500 },
];
const DEFAULT_COURT_MODE = 'normal';
// 송금 내림 단위. 총액이 인원수 × 단위보다 작으면 10원 단위로 폴백
const ROUND_UNITS = [10, 100, 1000];
const DEFAULT_ROUND_UNIT = 10;

// 상습범 누진 가산세: 가산세 태그 개수 기준 (위에서부터 먼저 걸리는 규칙 적용)
const PROGRESSIVE_RULES = [
  { min: 4, delta: 20, label: (n) => `🚨 교화 불가 흉악범 누진세 (죄목 ${n}건)` },
  { min: 3, delta: 12, label: () => '🚨 상습 빌런 누진세 (죄목 3건)' },
  { min: 2, delta: 5, label: () => '🚨 재범 가중처벌 (죄목 2건)' },
];

// 죄목 시너지 콤보: 두 그룹에서 서로 다른 가산세 태그가 하나씩 잡히면 발동.
// 커스텀 죄목도 잡히도록 id 외에 라벨 키워드로도 판별한다.
const COMBO_RULES = [
  {
    id: 'hit-and-run',
    label: '⚡ 시너지: 늦게 와서 일찍 튄 먹튀범',
    delta: 15,
    groups: [
      { ids: ['late'], keywords: ['지각'] },
      { ids: ['run', 'ghost'], keywords: ['도망', '화장실', '증발'] },
    ],
  },
  {
    id: 'free-rider',
    label: '⚡ 시너지: 일 안 하고 맛있는 것만 골라 먹음',
    delta: 15,
    groups: [
      { ids: ['no-grill', 'camp-lazy'], keywords: ['안 굽', '설거지'] },
      { ids: ['drumstick-thief', 'engawa-steal', 'jokbal-lean', 'shabu-meat-only', 'stew-meat', 'mara-topping'], keywords: ['독식', '골라 먹'] },
    ],
  },
  {
    id: 'sober-bomber',
    label: '⚡ 시너지: 맨정신으로 안주 단가 박살',
    delta: 12,
    groups: [
      { ids: ['no-drink', 'fake-soju'], keywords: [] },
      { ids: ['one-bite', 'basic-snack', 'tangsuyuk-thief', 'bread-tray'], keywords: [] },
    ],
  },
  {
    id: 'funeral',
    label: '⚡ 시너지: 모임 분위기 초상집 전환',
    delta: 20,
    groups: [
      { ids: ['rant'], keywords: [] },
      { ids: ['drunk-call'], keywords: ['만취', '오열', '토했'] },
    ],
  },
];

// 공로 세탁 방지법: 중범죄자(가산세 3건 이상 또는 가산세 합계 +45% 이상)의 공제 혜택 50% 삭감
const HYPOCRISY_MIN_COUNT = 3;
const HYPOCRISY_MIN_SUM = 45;
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 10;
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 100_000_000;
const MAX_NAME_LENGTH = 8;
const CUSTOM_MIN = -30;
const CUSTOM_MAX = 50;
const CUSTOM_DEFAULT_DELTA = 20;

// 양형 기준 퀵 버튼
const SENTENCING_PRESETS = [
  { emoji: '😇', label: '특별감면', delta: -25 },
  { emoji: '👏', label: '미담', delta: -15 },
  { emoji: '😒', label: '얄미움', delta: 15 },
  { emoji: '😡', label: '악질', delta: 30 },
  { emoji: '💀', label: '대역죄', delta: 50 },
];

// ── 커스텀 죄목 양형 추론 엔진 ──
// 1) 문맥 규칙: 같은 명사라도 서술어에 따라 가산/공제가 갈리는 경우를 먼저 판별
// 2) 카테고리 규칙: 위에서부터 먼저 걸리는 키워드 적용
// 한 글자 키워드는 다른 단어 속에서 오탐지를 만들므로 쓰지 않는다.
const CUSTOM_CONTEXT_RULES = [
  {
    triggers: ['고기', '불판'],
    branches: [
      { keywords: ['안 구', '안 굽', '먹기만', '날름', '태움', '태웠'], emoji: '🥩', delta: 25, category: '고기 노동 기피/방화' },
      { keywords: ['구움', '구웠', '구워', '자름', '잘랐', '볶음밥'], emoji: '🔥', delta: -25, category: '불판 집도 장인' },
    ],
  },
  {
    triggers: ['계산', '결제', '술값', '밥값', '택시비'],
    branches: [
      { keywords: ['안 냄', '빼돌', '화장실', '도망', '미룸', '척'], emoji: '🚽', delta: 35, category: '계산 회피 기동' },
      { keywords: ['냄', '냈', '긁음', '긁었', '쏨', '쐈', '보태'], emoji: '💳', delta: -20, category: '쾌척/선결제' },
    ],
  },
  {
    triggers: ['지각', '늦게', '늦음', '늦었'],
    // 송금 지연·후발대 합류는 아래 카테고리 규칙이 더 정확하므로 시간 문맥에서 제외
    excludes: ['입금', '송금', '정산', '늦게 합류'],
    branches: [
      { keywords: ['안 늦', '지각 안', '일찍', '제시간'], emoji: '⏱️', delta: -10, category: '칼같은 시간 엄수' },
      { keywords: null, emoji: '⏰', delta: 15, category: '코리안타임 지각' },
    ],
  },
];

const CUSTOM_KEYWORD_RULES = [
  // A. 대역죄 & 중범죄 가산세
  { category: '구토/인사불성', emoji: '🤮', delta: 45, keywords: ['토했', '토함', '토하', '오바이트', '구토', '게워', '변기 잡고', '기절', '필름 끊', '인사불성', '만취 진상'] },
  { category: '먹튀/무단탈주', emoji: '🏃', delta: 35, keywords: ['먹튀', '도망', '탈주', '막차런', '화장실런', '무단 귀가', '인사도 없이', '말 없이 집에', '증발', '튀었'] },
  { category: '감정배설/눈물바다', emoji: '😭', delta: 35, keywords: ['전여친', '전남친', '전애인', '울었', '울음', '오열', '통곡', '눈물', '질질 짜', '하소연'] },
  { category: '헌팅/합석/주사', emoji: '🚨', delta: 35, keywords: ['옆 테이블', '옆테이블', '헌팅', '합석', '번호 따', '시비', '고성방가', '소리 지', '진상'] },
  { category: '분위기 갑분싸 떡밥', emoji: '💣', delta: 30, keywords: ['정치', '종교', '젠더', '군대 얘기', '훈수', '설교', '꼰대', '갑분싸', '싸움', '분위기 곱창'] },
  { category: '물리적 테러/파손', emoji: '🌊', delta: 30, keywords: ['쏟음', '쏟았', '엎음', '엎었', '컵 깨', '잔 깨', '옷에 흘'] },
  // B. 얄미움 & 생태계 교란 가산세
  { category: '정산/송금 미루기', emoji: '💸', delta: 25, keywords: ['송금 안', '입금 안', '정산 안', '토스 안', '읽씹', '돈 안 보', '입금 늦', '송금 늦', '정산 늦'] },
  { category: '메뉴/잔반 빌런', emoji: '🍲', delta: 25, keywords: ['시켜놓고 안', '남김', '남겼', '손도 안', '비싼 술', '비싼 안주', '혼자 시'] },
  { category: '안주 독점/스틸', emoji: '🍖', delta: 20, keywords: ['혼자 다 먹', '싹쓸이', '건더기만', '고기만 골라', '안주발', '안주 킬러', '식사하러'] },
  { category: '한입만/국자 강탈', emoji: '🥄', delta: 15, keywords: ['한 입만', '한입만', '맛만 본다', '뺏어 먹', '국자로'] },
  { category: '술 밑장빼기/비율 테러', emoji: '🍺', delta: 15, keywords: ['꺾어 마', '물 타', '소맥 비율', '거품만', '술 안 마시', '입만 대'] },
  { category: '노잼/도돌이표/구라', emoji: '🦜', delta: 20, keywords: ['했던 얘기', '또 말', '무한 반복', '허세', '구라', '거짓말', '노잼', '아재개그'] },
  { category: '술자리 태업/수면', emoji: '💤', delta: 20, keywords: ['잠듦', '잠만', '자고 있', '꿀잠', '졸고', '게임 안', '술게임 룰'] },
  { category: '사이버 망명/통화충', emoji: '📱', delta: 15, keywords: ['핸드폰만', '폰만 봄', '인스타만', '카톡만', '게임만', '통화하러', '전화 받으러'] },
  { category: '흡연/자리 비움', emoji: '🚬', delta: 15, keywords: ['담배', '흡연', '전담', '밖에만 나', '자리 비'] },
  { category: '당일 번복/장소 불평', emoji: '😒', delta: 15, keywords: ['장소 바꾸', '맛없다고', '불평', '투덜', '집에 가자고'] },
  // C. 천사 & 우정 기여자 공제
  { category: '주인공/경조사 우대', emoji: '🎂', delta: -30, keywords: ['생일', '승진', '합격', '이직', '취업', '퇴사 축하', '전역', '결혼', '청첩장'] },
  { category: '2차/커피/해장 협찬', emoji: '☕', delta: -25, keywords: ['커피 쏨', '커피 샀', '해장', '아이스크림', '초코에몽', '숙취해소', '컨디션', '상쾌환', '인생네컷'] },
  { category: '운전/대리/호송', emoji: '🚕', delta: -25, keywords: ['운전', '카풀', '태워 줌', '태워다', '택시 태워', '대리', '데려다'] },
  { category: '수발/서빙 천사', emoji: '🦐', delta: -20, keywords: ['새우 까', '껍질 까', '게살', '쌈 싸', '물 떠', '물 챙', '앞접시', '수저 세팅', '소맥 말아'] },
  { category: '예약/웨이팅/장소 섭외', emoji: '📅', delta: -15, keywords: ['예약', '웨이팅', '줄 서', '자리 잡', '맛집 찾', '총무'] },
  { category: '후발대/짧은 체류 참작', emoji: '🏃‍♂️', delta: -25, keywords: ['야근하고', '늦게 합류', '막판에 합류', '30분만', '잠깐 얼굴만', '먼저 일어'] },
  { category: '장거리 상경/귀가 복지', emoji: '🚇', delta: -15, keywords: ['집이 멀', '제일 멀', '서울 끝', '경기도', '인천', '수원', '지방에서', '막차 끊'] },
  { category: '눈물겨운 사정 복지', emoji: '🩹', delta: -15, keywords: ['차임', '이별', '헤어짐', '실연', '백수', '취준생', '거지', '통장 잔고', '다이어트 중', '모솔', '솔로'] },
  { category: '분위기 메이커', emoji: '🤣', delta: -15, keywords: ['웃겨', '하드캐리', '텐션', '분위기 살', '리액션', '선물 챙'] },
];
const LOADING_DURATION = 3000;
const LOADING_INTERVAL = 750;
const LOADING_TAG_SLOTS = 3;

const FALLBACK_LOADING_POOL = [
  '테이블 위 빈 소주병·맥주병 개수와 영수증 내역 대조 중...',
  '누가 안주발 세웠는지 젓가락 동선 역추적 중...',
  '전원 무죄 주장에 따라 10원 단위 자투리 독박자 추첨 중...',
  '단순 1/N이라는 공산주의식 정산 방식 폐기 처분 중...',
];

const LOADING_FINALE = '1원 단위 오차 없는 우정 파괴 청구서 발급 완료!';

// 프리셋 태그. 라벨은 만취 상태에서도 한눈에 읽히도록 짧게 유지한다.
const PRESET_TAGS = [
  {
    id: 'no-grill',
    emoji: '🥩',
    label: '고기 안 굽고 먹기만 함',
    delta: 25,
    reason: '불판 무임승차 및 날름충 가산세',
    verdict: '고기가 익자마자 젓가락이 마하 속도로 움직이더군요. 집게 드는 법은 까먹으셨나요?',
    loadingTemplates: [
      '{name}님이 다 익은 고기만 골라 집어간 횟수 대조 중...',
      '{name}님이 고기 뒤집는 척만 하고 쌈 싸 먹은 정황 포착 중...',
    ],
  },
  {
    id: 'late',
    emoji: '⏰',
    label: '"다 와가!" 해놓고 지각',
    delta: 15,
    reason: '상습 코리안타임 및 거짓 위치보고',
    verdict: '본인이 말한 "다 와간다"의 기준이 집 현관문 앞이었다는 사실이 밝혀졌습니다.',
    loadingTemplates: [
      '{name}님이 "지하철역 앞이야"라고 말한 시점의 실제 GPS 거리 계산 중...',
      '{name}님 기다리느라 남들이 먼저 시켜 먹은 빈속 대기 수당 반영 중...',
    ],
  },
  {
    id: 'rant',
    emoji: '😭',
    label: '전 애인·회사 욕 30분 이상',
    delta: 35,
    reason: '테이블 감정 쓰레기통화 배상금',
    verdict: '그 이야기 작년부터 오늘까지 도합 14번째 들었습니다. 이제 방청객 알바비 내세요.',
    loadingTemplates: [
      '{name}님의 전 애인 언급 횟수 및 주변 친구들 영혼 가출 시간 합산 중...',
      '{name}님의 했던 얘기 또 하기 도돌이표 구간 시급 환산 중...',
    ],
  },
  {
    id: 'run',
    emoji: '🚽',
    label: '계산할 때 화장실·막차 도망',
    delta: 30,
    reason: '포스기 회피 기동 및 얌체 귀가',
    verdict: '계산서 빌지가 테이블에 올라오는 순간 방광이 반응하는 과학적 신비를 목격했습니다.',
    loadingTemplates: [
      '{name}님이 영수증 나오는 소리에 맞춰 화장실로 이동한 타이밍 검증 중...',
    ],
  },
  {
    id: 'no-drink',
    emoji: '🥤',
    label: '술 안 마시고 비싼 안주만 흡입',
    delta: 20,
    reason: '맨정신 안주 폭격기 가산세',
    verdict: '술값 빼달라고 하기 전에 본인이 뱃속에 넣은 안주 단가부터 생각해 보시기 바랍니다.',
    loadingTemplates: [
      '{name}님이 콜라 한 캔 마시면서 해치운 메인 안주 접시 수 합산 중...',
      '{name}님의 맨정신 젓가락질 속도와 테이블 안주 소멸 속도 비교 중...',
    ],
  },
  {
    id: 'phone',
    emoji: '📱',
    label: '내내 핸드폰만 보고 대답 안 함',
    delta: 15,
    reason: '술자리 영혼 불참 및 카톡 중독',
    verdict: '그렇게 핸드폰만 볼 거면 다음부턴 단톡방 보이스톡으로만 참석하시기 바랍니다.',
    loadingTemplates: [
      '{name}님이 술자리에서 고개 숙이고 액정만 쳐다본 시간 초 단위 측정 중...',
    ],
  },
  {
    id: 'grill-master',
    emoji: '🔥',
    label: '고기 굽기·볶음밥 풀코스 집도',
    delta: -25,
    reason: '불판 앞 고기 장인 및 연기 흡입 수당',
    loadingTemplates: [
      '{name}님의 패딩과 니트에 밴 삼겹살 연기 탈취 비용 공제 중...',
      '{name}님이 한 점도 안 태우고 구워낸 집게질 노동 가치 산정 중...',
    ],
  },
  {
    id: 'treasurer',
    emoji: '💳',
    label: '내 카드로 선결제 & 총무 담당',
    delta: -10,
    reason: '선결제 총대 및 정산 수금 수고비',
    loadingTemplates: [
      '{name}님의 카드값 선결제 희생 및 미입금자 추심 수고비 반영 중...',
    ],
  },
  {
    id: 'far-home',
    emoji: '🏠',
    label: '오늘 집이 제일 멂 (막차 위기)',
    delta: -12,
    reason: '장거리 원정 참석 귀가 위로금',
    loadingTemplates: [
      '{name}님의 험난한 귀가 환승 횟수와 거리 비례 교통 복지비 감액 중...',
    ],
  },
  {
    id: 'clown',
    emoji: '🤣',
    label: '오늘 썰 풀어서 전원 웃겨줌',
    delta: -15,
    reason: '술자리 메인 MC 및 오디오 캐리',
    loadingTemplates: [
      '{name}님이 살려낸 술자리 텐션과 웃음 데시벨 기여도 할인 적용 중...',
    ],
  },
  {
    id: 'coupon-pocket',
    emoji: '🎟️',
    label: '할인쿠폰 써놓고 정가로 청구',
    delta: 25,
    reason: '쿠폰 차액 착복 및 배달비 뻥튀기',
    verdict: '쿠폰으로 아낀 3천 원은 어디로 갔을까요? 정산서에서 다시 만나게 됐습니다.',
    loadingTemplates: [
      '{name}님의 배달 앱 쿠폰 사용 내역과 청구 금액 대조 중...',
    ],
  },
  {
    id: 'drumstick-thief',
    emoji: '🍗',
    label: '안 물어보고 닭다리·날개 독식',
    delta: 25,
    reason: '닭다리 무단 선점 및 퍽퍽살 전가',
    verdict: '닭 한 마리에 다리는 두 개뿐인데 왜 본인 앞접시에서만 뼈가 두 개 나왔을까요?',
    loadingTemplates: [
      '{name}님 앞접시에 쌓인 닭다리·날개 뼈다귀 개수 감식 중...',
    ],
  },
  {
    id: 'jokbal-lean',
    emoji: '🐷',
    label: '족발·보쌈 살코기·막국수만 독식',
    delta: 20,
    reason: '살코기 편식 및 왕뼈 떠넘기기',
    verdict: '살코기만 외과 수술하듯 발라 드셨군요. 남은 왕뼈는 누가 뜯으라고 두셨나요?',
    loadingTemplates: [
      '{name}님이 족발에서 살코기만 골라 집어간 정밀 타격률 분석 중...',
    ],
  },
  {
    id: 'mara-topping',
    emoji: '🥘',
    label: '마라탕·엽떡에 개인 토핑 폭탄',
    delta: 25,
    reason: '소고기·분모자·치즈 사리사욕 과금',
    verdict: '공용 냄비에 본인 취향 토핑만 산더미처럼 올리셨군요. 토핑값은 토핑 주인이 냅니다.',
    loadingTemplates: [
      '{name}님이 추가한 분모자·소고기·치즈 토핑 단가 합산 중...',
    ],
  },
  {
    id: 'pizza-crust',
    emoji: '🍕',
    label: '피자 토핑만 먹고 꼬다리 방치',
    delta: 20,
    reason: '도우 손잡이 유기 및 디핑소스 독점',
    verdict: '빈 박스에 꼬다리만 가지런히 남기셨군요. 디핑소스는 왜 다 비었을까요?',
    loadingTemplates: [
      '{name}님 앞에 쌓인 피자 꼬다리 개수 세는 중...',
    ],
  },
  {
    id: 'review-steal',
    emoji: '🎁',
    label: '리뷰 서비스(치즈볼·음료) 꿀꺽',
    delta: 15,
    reason: '모임 공공재 서비스 메뉴 횡령',
    verdict: '다 같이 쓴 리뷰로 받은 서비스를 혼자 드셨습니다. 공공재 횡령으로 판단합니다.',
    loadingTemplates: [
      '{name}님이 혼자 먹은 리뷰 이벤트 서비스 메뉴 추적 중...',
    ],
  },
  {
    id: 'side-impulse',
    emoji: '🧀',
    label: '사이드 우겨서 시키고 한 입만',
    delta: 20,
    reason: '사이드 메뉴 충동 주문 및 잔반 유발세',
    verdict: '배달 앱 최소주문금액 맞춘다며 시킨 사이드 메뉴, 결국 본인은 한 입만 드셨습니다.',
    loadingTemplates: [
      '{name}님이 강력 주장해서 추가된 치즈볼의 잔반 비율 계산 중...',
    ],
  },
  {
    id: 'home-host',
    emoji: '🧹',
    label: '자취방 제공 & 배달 쓰레기 독박',
    delta: -30,
    reason: '방 대관료 및 플라스틱 용기 분리수거',
    loadingTemplates: [
      '{name}님의 자취방 제공 및 치킨 박스·뼈다귀 분리수거 노동 가치 환산 중...',
    ],
  },
  {
    id: 'pickup-runner',
    emoji: '🏃',
    label: '직접 포장 픽업 or 1층 가서 받아옴',
    delta: -15,
    reason: '배달비 절감 인간 라이더 발품 수당',
    loadingTemplates: [
      '{name}님이 포장 픽업으로 아낀 배달비 환급 중...',
    ],
  },
  {
    id: 'burn-meat',
    emoji: '🥩',
    label: '불판 새까맣게 태움',
    delta: 15,
    reason: '육즙 손실 유발 및 불판 방화범 가산세',
    verdict: '가만히 계시는 게 도와주는 겁니다. 오늘 태워 먹은 고기들에게 사과하세요.',
    loadingTemplates: [
      '{name}님이 태워 먹은 삼겹살 부위별 시가 환산 중...',
    ],
  },
  {
    id: 'one-bite',
    emoji: '🍨',
    label: '"한 입만" 해놓고 냉면 반 먹음',
    delta: 15,
    reason: '사이드 메뉴 강탈 및 한입만 사기죄',
    verdict: '본인의 "한 입"은 왜 국자 기준인지 과학적 해명이 필요합니다.',
    loadingTemplates: [
      '{name}님이 "맛만 본다"며 퍼간 볶음밥과 후식 냉면 부피 측정 중...',
    ],
  },
  {
    id: 'garlic-hog',
    emoji: '🧄',
    label: '구운 마늘·김치·버섯 혼자 싹쓸이',
    delta: 15,
    reason: '불판 위 구운 마늘·김치 독점 수확세',
    verdict: '고기는 거들 뿐, 불판 위 구운 마늘과 김치를 한 톨도 남기지 않고 수확하셨습니다.',
    loadingTemplates: [
      '{name}님이 기름장에 건져 간 구운 마늘 개수 세는 중...',
    ],
  },
  {
    id: 'engawa-steal',
    emoji: '🍣',
    label: '광어 지느러미·뱃살만 골라 먹음',
    delta: 25,
    reason: '고급 특수부위 독점 수렵세',
    verdict: '접시 위에서 광어 지느러미와 뱃살만 사라지는 마술을 부리셨군요. 어부도 울고 갑니다.',
    loadingTemplates: [
      '{name}님의 젓가락이 광어 지느러미(엔가와)로 직행한 확률 계산 중...',
    ],
  },
  {
    id: 'shabu-meat-only',
    emoji: '🥩',
    label: '샤브샤브·전골 고기만 다 건져 먹음',
    delta: 25,
    reason: '육류 초고속 인양 및 채소 방치세',
    verdict: '고기가 냄비에 들어가자마자 사라졌습니다. 남은 건 배추와 숙주뿐이었습니다.',
    loadingTemplates: [
      '{name}님의 국자가 샤브샤브 고기를 인양한 횟수 집계 중...',
    ],
  },
  {
    id: 'skidashi-full',
    emoji: '🌽',
    label: '콘치즈·스끼다시만 먹고 회 남김',
    delta: 15,
    reason: '메인 등장 전 위장 조기 마감세',
    verdict: '콘치즈 리필할 때의 전투력이 정작 메인 회 앞에서는 증발해 버렸습니다.',
    loadingTemplates: [
      '{name}님이 회 나오기 전에 해치운 콘치즈와 꽁치구이 지분 산출 중...',
    ],
  },
  {
    id: 'maeuntang-ramen',
    emoji: '🍜',
    label: '라면사리 넣자고 해놓고 불게 방치',
    delta: 15,
    reason: '매운탕 국물 증발 및 탄수화물 유기',
    verdict: '본인이 넣자고 한 라면사리가 매운탕 국물을 다 흡수해 떡이 되었습니다.',
    loadingTemplates: [
      '{name}님이 매운탕 냄비에 방치해 불어버린 라면사리 부피 측정 중...',
    ],
  },
  {
    id: 'shrimp-peeler',
    emoji: '🦐',
    label: '새우·게 껍질 까주고 죽·볶음밥 제조',
    delta: -20,
    reason: '갑각류 해체 및 전골 육수 관리 장인',
    loadingTemplates: [
      '{name}님이 손에 비린내 묻히며 까준 새우 마릿수 공제 반영 중...',
    ],
  },
  {
    id: 'tangsuyuk-thief',
    emoji: '🥟',
    label: '공용 요리(탕수육·사이드)만 흡입',
    delta: 20,
    reason: '개인 식사 제쳐두고 공용 요리 폭격',
    verdict: '본인 짜장면은 그대로 두고 탕수육만 집중 공략하셨군요. 전략은 훌륭했습니다.',
    loadingTemplates: [
      '{name}님 젓가락의 탕수육 접시 방문 횟수 집계 중...',
    ],
  },
  {
    id: 'pasta-shrimp',
    emoji: '🍤',
    label: '파스타·피자 위 새우만 골라 먹음',
    delta: 20,
    reason: '핵심 토핑 도굴 및 면발 방치세',
    verdict: '파스타 위 새우가 전부 사라지고 면만 남았습니다. 발굴 작업이 완벽했네요.',
    loadingTemplates: [
      '{name}님이 파스타에서 골라낸 새우 마릿수 감식 중...',
    ],
  },
  {
    id: 'fried-soak',
    emoji: '🍤',
    label: '튀김에 소스 맘대로 부어버림',
    delta: 15,
    reason: '찍먹파 인권 유린 및 눅눅함 테러',
    verdict: '바삭함을 지키려던 찍먹파의 꿈이 소스 한 번에 무너졌습니다.',
    loadingTemplates: [
      '{name}님이 부먹으로 눅눅하게 만든 튀김 면적 측정 중...',
    ],
  },
  {
    id: 'table-setter',
    emoji: '🍽️',
    label: '앞접시·물 세팅 & 돈가스·피자 커팅',
    delta: -15,
    reason: '테이블 매너 세팅 및 칼질 서비스',
    loadingTemplates: [
      '{name}님이 깔아준 앞접시와 잘라준 돈가스 조각 수 공제 중...',
    ],
  },
  {
    id: 'expensive-booze',
    emoji: '🍾',
    label: '혼자 하이볼·사케·비싼 술 시킴',
    delta: 25,
    reason: '주류 단가 인플레이션 유발세',
    verdict: '남들 소주 마실 때 혼자 시켜 드신 고급 주류, 정산서도 고급스럽게 모시겠습니다.',
    loadingTemplates: [
      '{name}님이 단독 주문한 고단가 주류의 영수증 지분율 분리 계산 중...',
    ],
  },
  {
    id: 'stew-meat',
    emoji: '🍲',
    label: '찌개 고기·건더기만 건져 먹음',
    delta: 20,
    reason: '국물 생태계 파괴 및 건더기 독점',
    verdict: '남들은 김치찌개 국물만 마실 때 혼자 제육볶음을 드셨더군요.',
    loadingTemplates: [
      '{name}님의 국자 동선을 추적해 건져 간 찌개 고기 비율 계산 중...',
      '{name}님이 남긴 두부 조각과 파 건더기 잔해 분석 중...',
    ],
  },
  {
    id: 'skewer-unpin',
    emoji: '🍢',
    label: '꼬치 에이스 부위 통째로 들고 감',
    delta: 20,
    reason: '꼬치 해체 거부 및 고급 부위 독점',
    verdict: '꼬치는 빼서 나눠 먹는 겁니다. 통째로 들고 가신 에이스 부위의 행방을 묻습니다.',
    loadingTemplates: [
      '{name}님이 통째로 들고 간 모둠꼬치 에이스 부위 추적 중...',
    ],
  },
  {
    id: 'jeon-center',
    emoji: '🥞',
    label: '파전 오징어 많은 가운데만 파먹음',
    delta: 20,
    reason: '전 중심부 명당 도굴 및 테두리 유기',
    verdict: '파전 한가운데에 구멍이 뚫렸습니다. 오징어는 다 어디로 갔을까요?',
    loadingTemplates: [
      '{name}님이 파먹은 파전 중심부 오징어 함량 분석 중...',
    ],
  },
  {
    id: 'basic-snack',
    emoji: '🍿',
    label: '안 먹는다더니 기본안주 혼자 동냄',
    delta: 15,
    reason: '입터짐 위증죄 및 강냉이·계란찜 독식',
    verdict: '분명 입맛 없다면서요. 이모님이 기본안주 리필하러 오시다가 팔 빠지실 뻔했습니다.',
    loadingTemplates: [
      '{name}님이 배부르다면서 리필시킨 계란찜과 콘옥수수 단가 산출 중...',
      '{name}님이 무의식중에 집어 먹은 마카로니 과자 그램(g) 수 계량 중...',
    ],
  },
  {
    id: 'fake-soju',
    emoji: '🍺',
    label: '소주에 몰래 물 타거나 꺾어 마심',
    delta: 12,
    reason: '알코올 농도 조작 및 밑장빼기',
    verdict: '잔은 다 같이 부딪혔는데 왜 본인 잔만 끝까지 수위가 그대로인지 해명 바랍니다.',
    loadingTemplates: [
      '{name}님의 소주잔 잔류량 및 몰래 물 탄 비율 역산 중...',
    ],
  },
  {
    id: 'angel-care',
    emoji: '💊',
    label: '취한 친구 물·숙취해소제 챙겨줌',
    delta: -15,
    reason: '술자리 구호 활동 및 간 보호 엔젤',
    loadingTemplates: [
      '{name}님이 챙겨준 물컵과 숙취해소제 구호 활동 내역 감액 반영 중...',
    ],
  },
  {
    id: 'mic-hog',
    emoji: '🎤',
    label: '노래방 마이크 독점 & 5곡 예약',
    delta: 25,
    reason: '단독 콘서트 개최 대관료',
    verdict: '오늘 모임이 아니라 본인 단독 팬미팅인 줄 알았습니다. 대관료 더 내세요.',
    loadingTemplates: [
      '{name}님의 노래방 우선예약 횟수 및 마이크 독점 시간 합산 중...',
    ],
  },
  {
    id: 'interlude-skip',
    emoji: '⏭️',
    label: '남의 노래 간주점프·취소 누름',
    delta: 20,
    reason: '무대 매너 위반 및 흥 깨기 가산세',
    verdict: '남의 클라이맥스 직전에 취소 버튼을 누른 비정한 손가락에 벌금을 부과합니다.',
    loadingTemplates: [
      '{name}님이 남의 노래 도중 몰래 누른 간주점프와 취소 버튼 기록 조회 중...',
    ],
  },
  {
    id: 'team-troll',
    emoji: '🎳',
    label: '볼링·당구 팀전 패배 원흉(트롤)',
    delta: 25,
    reason: '상대 팀 스파이 및 X맨 역적세',
    verdict: '상대 팀에서 심어놓은 스파이가 아니냐는 합리적 의심이 제기되었습니다.',
    loadingTemplates: [
      '{name}님의 헛스윙 및 팀 승률 수직하락 기여도 분석 중...',
    ],
  },
  {
    id: 'mouth-player',
    emoji: '🗣️',
    label: '실력은 꼴찌면서 옆에서 온갖 훈수',
    delta: 15,
    reason: '무자격 코칭 및 입당구·입볼링세',
    verdict: '입으로는 이미 프로 선수지만 실제 점수판은 처참하군요. 조언 관람료 청구합니다.',
    loadingTemplates: [
      '{name}님의 훈수 횟수 대비 실제 본인 점수 괴리율 산출 중...',
    ],
  },
  {
    id: 'game-carry',
    emoji: '🏆',
    label: '팀전 하드캐리 or 초보 친절 강습',
    delta: -20,
    reason: '일타강사 레슨비 및 팀 버스 기사',
    loadingTemplates: [
      '{name}님의 멱살 캐리 및 무료 원포인트 레슨 기여도 할인 적용 중...',
    ],
  },
  {
    id: 'bread-tray',
    emoji: '🥐',
    label: '베이커리 카페에서 빵·케이크 과적',
    delta: 25,
    reason: '공용 트레이 사리사욕 빵 뷔페세',
    verdict: '다 같이 먹자던 트레이에 본인 취향 빵만 산처럼 쌓여 있었습니다.',
    loadingTemplates: [
      '{name}님이 공용 트레이에 담은 빵 개수와 단가 합산 중...',
    ],
  },
  {
    id: 'strawberry-thief',
    emoji: '🍓',
    label: '케이크 위 딸기·토핑만 쏙 빼먹음',
    delta: 15,
    reason: '핵심 토핑 도굴 및 빵 시트 방치',
    verdict: '케이크 위에 올라간 딸기만 쏙 빼먹는 만행, 유치원 이후로 오랜만에 봅니다.',
    loadingTemplates: [
      '{name}님 포크에 찍혀 사라진 케이크 위 딸기 행방 추적 중...',
    ],
  },
  {
    id: 'study-talker',
    emoji: '🗣️',
    label: '스터디룸에서 공부 안 하고 수다',
    delta: 20,
    reason: '시간당 대관료 증발 및 잡담 유발',
    verdict: '시간당 요금 내고 빌린 방에서 공부 빼고 다 하셨습니다.',
    loadingTemplates: [
      '{name}님의 스터디룸 수다 시간과 실제 공부 시간 비교 중...',
    ],
  },
  {
    id: 'escape-coward',
    emoji: '😱',
    label: '방탈출 룰 안 듣고 버스 탑승',
    delta: 20,
    reason: '두뇌 노동 무임승차 및 진행 지연',
    verdict: '자물쇠는 하나도 못 풀고 비명만 지르다 나오셨으므로 방탈출 버스비를 청구합니다.',
    loadingTemplates: [
      '{name}님이 방탈출 내내 푼 자물쇠 개수(0개) 및 비명 데시벨 측정 중...',
    ],
  },
  {
    id: 'luxury-dessert',
    emoji: '🍰',
    label: '혼자 9천 원짜리 음료+케이크 주문',
    delta: 20,
    reason: '카페 단가 인플레이션 및 당분 독점세',
    verdict: '밥값보다 비싼 디저트 세트를 혼자 조용히 해치우셨군요.',
    loadingTemplates: [
      '{name}님이 주문한 스페셜 음료와 디저트 단가 비율 분리 중...',
    ],
  },
  {
    id: 'photo-master',
    emoji: '📸',
    label: '친구들 인생샷 100장 찍어줌',
    delta: -20,
    reason: '전담 포토그래퍼 열정페이 수당',
    loadingTemplates: [
      '{name}님이 친구들 다리 길어 보이게 찍느라 굽힌 무릎 각도 공제 중...',
    ],
  },
  {
    id: 'study-prep',
    emoji: '📚',
    label: '스터디룸 예약·자료·룰 설명 담당',
    delta: -20,
    reason: '공간 섭외 및 일타강사 진행 공제',
    loadingTemplates: [
      '{name}님이 준비한 자료와 룰 설명 시간 공제 중...',
    ],
  },
  {
    id: 'camp-lazy',
    emoji: '⛺',
    label: '고기 굽고 설거지할 때만 잠듦·증발',
    delta: 30,
    reason: '야외 노동 기피 및 선택적 기절',
    verdict: '고기 구울 땐 코 골며 주무시더니 고기 다 구워지니까 눈이 번쩍 뜨이셨네요.',
    loadingTemplates: [
      '{name}님이 설거지 타임에 맞춰 화장실로 은신한 시간 대조 중...',
    ],
  },
  {
    id: 'mart-cart',
    emoji: '🛒',
    label: '마트 공금 장볼 때 개인 간식 투척',
    delta: 25,
    reason: '공금 카트 사유화 가산세',
    verdict: '공금으로 장 보는 카트에 본인 사리사욕이 담긴 고단가 간식이 포착되었습니다.',
    loadingTemplates: [
      '{name}님이 마트 카트에 몰래 넣은 개인 간식 영수증 내역 적발 중...',
    ],
  },
  {
    id: 'bed-occupation',
    emoji: '🛏️',
    label: '숙소 제일 좋은 침대 알박기',
    delta: 20,
    reason: '특실 침대 독점 프리미엄',
    verdict: '숙소 현관문 열리자마자 침대로 다이빙하셨군요. 특실 사용료 추가 청구합니다.',
    loadingTemplates: [
      '{name}님이 숙소 도착 후 침대에 누워 보낸 시간 점유율 계산 중...',
    ],
  },
  {
    id: 'copilot-sleep',
    emoji: '😴',
    label: '조수석 타자마자 5분 만에 숙면',
    delta: 20,
    reason: '네비게이터 직무유기 꿀잠 숙박료',
    verdict: '조수석은 침대가 아닙니다. 톨게이트 지나기도 전에 기절하신 죄를 묻습니다.',
    loadingTemplates: [
      '{name}님이 조수석에서 코 골며 숙면한 고속도로 구간 거리 측정 중...',
    ],
  },
  {
    id: 'driver-car',
    emoji: '🚗',
    label: '본인 차 제공 & 장거리 왕복 운전',
    delta: -35,
    reason: '전담 기사 수고비 및 차량 감가상각',
    loadingTemplates: [
      '{name}님의 왕복 운전 피로도와 타이어 마모도 복지 감액 중...',
    ],
  },
  {
    id: 'camp-chef',
    emoji: '🍳',
    label: '숙소 예약·바비큐·해장라면 집도',
    delta: -30,
    reason: '여행 총괄 가이드 및 메인 셰프',
    loadingTemplates: [
      '{name}님이 끓여낸 해장 라면과 바비큐 요리 노동 가치 정산 중...',
    ],
  },
  {
    id: 'drunk-call',
    emoji: '📞',
    label: '새벽에 전 애인·친구한테 전화 폭주',
    delta: 30,
    reason: '새벽 발신 폭주 및 흑역사 생성 방지세',
    verdict: '내일 아침 이불킥할 본인을 대신해 주변 친구들이 겪은 항마력 소모 비용을 청구합니다.',
    loadingTemplates: [
      '{name}님의 최근 통화목록 발신 시도를 말리느라 소모된 친구들 칼로리 계산 중...',
    ],
  },
  {
    id: 'brag-radio',
    emoji: '🪖',
    label: '안 물어본 왕년 허세·군대 썰',
    delta: 25,
    reason: '고장 난 라디오 청취료 및 거짓말 탐지세',
    verdict: '왕년에 그렇게 잘나가셨으니 오늘 정산 금액도 호기롭게 더 내실 줄 믿습니다.',
    loadingTemplates: [
      '{name}님의 무용담 과장 비율 및 테이블 하품 횟수 카운트 중...',
    ],
  },
  {
    id: 'sleep-2nd',
    emoji: '🎤',
    label: '2차 가자더니 구석에서 꿀잠',
    delta: 25,
    reason: '2차 강제 징집 후 본부 이탈 가산세',
    verdict: '집에 가자는 사람 붙잡아 놓고 본인이 주무시면 이건 숙박비로 청구해야 맞습니다.',
    loadingTemplates: [
      '{name}님이 술집 의자를 침대 삼아 취침한 분당 숙박료 산정 중...',
    ],
  },
  {
    id: 'ghost',
    emoji: '💨',
    label: '인사도 없이 유령처럼 증발',
    delta: 20,
    reason: '무단 증발 및 실종 신고 걱정 유발세',
    verdict: '화장실 간 줄 알았는데 집 이불 속이셨군요. 닌자 전직 축하금으로 가산세 부과합니다.',
    loadingTemplates: [
      '{name}님이 흔적도 없이 사라진 정확한 시점의 CCTV 동선 역추적 중...',
    ],
  },
  {
    id: 'taxi-escort',
    emoji: '🚕',
    label: '만취한 친구 택시 태워 보냄',
    delta: -20,
    reason: '주취자 안전 귀가 호송 및 보호자 수당',
    loadingTemplates: [
      '{name}님이 만취자 택시 문 닫아주며 기사님께 고개 숙인 횟수 공제 중...',
    ],
  },
  {
    id: 'wait-master',
    emoji: '📅',
    label: '핫플 예약·웨이팅 총대',
    delta: -15,
    reason: '사전 예약 행정력 및 웨이팅 다리 값 공제',
    loadingTemplates: [
      '{name}님이 식당 예약과 웨이팅으로 아껴준 모임 시간 가치 환산 중...',
    ],
  },
  {
    id: 'late-join',
    emoji: '⏱️',
    label: '야근 끝나고 의리로 합류',
    delta: -25,
    reason: '후발대 의리 참석 참작 및 체류시간 비례 감면',
    loadingTemplates: [
      '{name}님의 실제 착석 시간 대비 억울함 지수 대폭 감액 중...',
    ],
  },
  {
    id: 'vip-hero',
    emoji: '🎂',
    label: '오늘의 주인공 (생일·승진·합격)',
    delta: -30,
    reason: '오늘의 주인공 특별 우대 복지 할인',
    loadingTemplates: [
      '{name}님의 경사스러운 날을 맞아 주인공 특별 우대 할인율 적용 중...',
    ],
  },
  {
    id: 'sober-driver',
    emoji: '🚙',
    label: '술 참고 운전해서 다 데려다 줌',
    delta: -20,
    reason: '지정 운전자 금주 희생 및 귀가 셔틀 수당',
    loadingTemplates: [
      '{name}님이 술 참고 운전대 잡은 귀가 셔틀 노선 거리 공제 중...',
    ],
  },
];

const PRESET_TAG_MAP = Object.fromEntries(PRESET_TAGS.map((t) => [t.id, t]));

// Step 2 카테고리 탭. 같은 태그가 여러 탭에 나올 수 있다(단골 TOP은 다른 탭 대표 태그의 바로가기).
const CATEGORY_TABS = [
  { id: 'hot', emoji: '⚡', name: '단골 TOP', desc: '가장 많이 쓰는 죄목·공로 10선', tagIds: ['no-grill', 'late', 'rant', 'run', 'no-drink', 'phone', 'grill-master', 'treasurer', 'far-home', 'clown'] },
  { id: 'delivery', emoji: '🛵', name: '배달·야식', desc: '배달·치킨·피자·족발·마라', tagIds: ['coupon-pocket', 'drumstick-thief', 'jokbal-lean', 'mara-topping', 'pizza-crust', 'review-steal', 'side-impulse', 'home-host', 'pickup-runner'] },
  { id: 'meat', emoji: '🥩', name: '고기·곱창', desc: '고깃집·곱창', tagIds: ['no-grill', 'burn-meat', 'one-bite', 'garlic-hog', 'grill-master'] },
  { id: 'seafood_stew', emoji: '🐟', name: '회·전골·샤브', desc: '횟집·전골·샤브샤브', tagIds: ['engawa-steal', 'shabu-meat-only', 'skidashi-full', 'maeuntang-ramen', 'shrimp-peeler'] },
  { id: 'meal', emoji: '🥟', name: '중식·양식·분식', desc: '중식·양식·분식', tagIds: ['tangsuyuk-thief', 'pasta-shrimp', 'fried-soak', 'table-setter'] },
  { id: 'pub', emoji: '🍻', name: '포차·이자카야·전', desc: '포차·이자카야·전집', tagIds: ['expensive-booze', 'stew-meat', 'skewer-unpin', 'jeon-center', 'basic-snack', 'fake-soju', 'angel-care'] },
  { id: 'play', emoji: '🎳', name: '노래방·볼링·당구', desc: '노래방·볼링·당구·게임', tagIds: ['mic-hog', 'interlude-skip', 'team-troll', 'mouth-player', 'game-carry'] },
  { id: 'cafe_study', emoji: '☕', name: '카페·스터디·방탈출', desc: '카페·스터디·방탈출', tagIds: ['bread-tray', 'strawberry-thief', 'study-talker', 'escape-coward', 'luxury-dessert', 'photo-master', 'study-prep'] },
  { id: 'travel', emoji: '🏕️', name: '여행·MT·캠핑', desc: '여행·MT·캠핑', tagIds: ['camp-lazy', 'mart-cart', 'bed-occupation', 'copilot-sleep', 'driver-car', 'camp-chef'] },
];

// 장소 불문 공통 태그. 기본으로 접혀 있고, 체크된 태그만 접힌 상태에서도 보인다.
const MORE_TAG_IDS = ['drunk-call', 'brag-radio', 'sleep-2nd', 'ghost', 'taxi-escort', 'wait-master', 'late-join', 'vip-hero', 'sober-driver'];

const NO_VILLAIN_VERDICT =
  '오늘 모임은 웬일로 아무도 진상을 안 부렸습니다. 하지만 10원 단위 자투리는 누군가 내야 하므로 제일 만만한 사람을 지목합니다.';

/* ──────────────────────────────────────────────────────────────
 * 유틸
 * ────────────────────────────────────────────────────────────── */

let idSeq = 0;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

const fmtWon = (n) => Math.round(n).toLocaleString('ko-KR');

const fmtDiff = (n) => (n === 0 ? '±0' : `${n > 0 ? '+' : '-'}${fmtWon(Math.abs(n))}`);

const peopleShortageMessage = (count) =>
  count === 0
    ? '아직 아무도 없어요. 더치페이는 최소 2명부터예요 🙋'
    : '혼자서는 더치페이가 안 돼요. 1명만 더 데려오세요 👯';

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

const customVerdict = (label, delta) => {
  if (delta >= 35) {
    return `"${label}" 건은 우정 파탄급 중대 범죄로 인정되어 가석방 없는 최고형 가산세가 선고되었습니다.`;
  }
  if (delta >= 20) {
    return `"${label}" 혐의는 술자리 동석자 만장일치로 유죄가 확정되었습니다. 불복 시 다음 모임 1차 쏘기로 항소할 수 있습니다.`;
  }
  return `"${label}" 건은 얄미움 지수가 상당하여 소액의 괘씸죄 가산세가 부과되었습니다.`;
};

const customLoadingMessage = (name, tag) => {
  if (tag.delta >= 35) return `${name}님의 '${tag.label}' 중대 사건 특별수사본부 증거물 압수 중...`;
  if (tag.delta >= 20) return `${name}님의 '${tag.label}' 만행 현장 목격자 진술 확보 중...`;
  if (tag.delta > 0) return `${name}님의 '${tag.label}' 괘씸죄 얄미움 지수 정밀 측정 중...`;
  return `${name}님의 '${tag.label}' 미담 사례 진위 여부 확인 중...`;
};

const stripSpaces = (str) => str.replace(/\s+/g, '');

// 띄어쓰기를 안 해도 걸리도록 공백 제거본도 함께 비교 ('한입만', '옆테이블' 등)
const findKeyword = (text, compact, keywords) =>
  keywords.find((k) => text.includes(k) || compact.includes(stripSpaces(k)));

function detectCustomPreset(label) {
  const text = label.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  const compact = stripSpaces(text);

  for (const rule of CUSTOM_CONTEXT_RULES) {
    const trigger = findKeyword(text, compact, rule.triggers);
    if (!trigger) continue;
    if (rule.excludes && findKeyword(text, compact, rule.excludes)) continue;
    for (const branch of rule.branches) {
      const keyword = branch.keywords ? findKeyword(text, compact, branch.keywords) : trigger;
      if (keyword) {
        return { emoji: branch.emoji, delta: branch.delta, keyword, category: branch.category };
      }
    }
  }

  for (const rule of CUSTOM_KEYWORD_RULES) {
    const keyword = findKeyword(text, compact, rule.keywords);
    if (keyword) return { emoji: rule.emoji, delta: rule.delta, keyword, category: rule.category };
  }
  return null;
}

const defaultCustomEmoji = (delta) => (delta > 0 ? '⚖️' : '😇');

// 감지된 이모지는 가산/공제 방향이 일치할 때만 사용
const resolveCustomEmoji = (label, delta) => {
  const preset = detectCustomPreset(label);
  return preset && Math.sign(preset.delta) === Math.sign(delta) ? preset.emoji : defaultCustomEmoji(delta);
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shuffle = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * 로딩 문구 생성기
 * - 선택된 태그마다 참가자 이름을 넣은 감사 문구를 만들고, 가중치 절대값이 큰 순(동률은 랜덤)으로 3개 추출
 * - 모자라면 공통 감사 문구 풀에서 겹치지 않게 채우고, 마지막은 항상 피날레 문구
 */
function buildLoadingMessages(people, selections, tagMap) {
  const candidates = [];
  people.forEach((p) => {
    (selections[p.id] || []).forEach((tagId) => {
      const tag = tagMap[tagId];
      if (!tag) return;
      let text;
      if (tag.custom) {
        text = customLoadingMessage(p.name, tag);
      } else if (tag.loadingTemplates?.length) {
        text = pickRandom(tag.loadingTemplates).replaceAll('{name}', p.name);
      }
      if (text) candidates.push({ text, weight: Math.abs(tag.delta) });
    });
  });

  const picked = shuffle(candidates)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, LOADING_TAG_SLOTS)
    .map((c) => c.text);
  const fallback = shuffle(FALLBACK_LOADING_POOL);
  while (picked.length < LOADING_TAG_SLOTS && fallback.length) picked.push(fallback.shift());

  return [...picked, LOADING_FINALE];
}

const matchesComboGroup = (tag, group) =>
  group.ids.includes(tag.id) || group.keywords.some((k) => tag.label.includes(k));

/**
 * 태그만 보고 자동으로 붙는 가중처벌을 계산한다.
 * - 누진세·콤보는 가산세로 취급해 파산 모드에서 함께 증폭된다
 * - 공로 세탁 삭감은 공제를 깎는 것이므로 증폭하지 않는다
 */
function computeAutoPenalties(tags) {
  const penaltyTags = tags.filter((t) => t.delta > 0);
  const penaltySum = penaltyTags.reduce((s, t) => s + t.delta, 0);
  const deductionSum = tags.filter((t) => t.delta < 0).reduce((s, t) => s + t.delta, 0);
  const extras = [];

  const progressive = PROGRESSIVE_RULES.find((rule) => penaltyTags.length >= rule.min);
  if (progressive) {
    extras.push({ key: 'progressive', label: progressive.label(penaltyTags.length), delta: progressive.delta, amplify: true });
  }

  COMBO_RULES.forEach(({ id, label, delta, groups: [first, second] }) => {
    const hit = penaltyTags.some(
      (x) => matchesComboGroup(x, first) && penaltyTags.some((y) => y.id !== x.id && matchesComboGroup(y, second))
    );
    if (hit) extras.push({ key: id, label, delta, amplify: true });
  });

  const isHeavyOffender = penaltyTags.length >= HYPOCRISY_MIN_COUNT || penaltySum >= HYPOCRISY_MIN_SUM;
  if (isHeavyOffender && deductionSum < 0) {
    const cut = Math.round(Math.abs(deductionSum) * 0.5);
    extras.push({
      key: 'hypocrisy',
      label: `🚫 공로 세탁 적발 (중범죄자 할인 50% 강제 삭감: +${cut}%)`,
      delta: cut,
      amplify: false,
    });
  }

  return { penaltyCount: penaltyTags.length, penaltySum, deductionSum, extras };
}

/**
 * 제로섬 정산 엔진
 * - 변동폭 Δ = 가산세(태그+누진+콤보) × penaltyFactor + 공제 + 공로 세탁 삭감, 평화 모드는 Δ × 0.4
 * - W_i = clamp(100 + Δ, 모드 하한, 모드 상한)
 * - Exact_i = 총액 × W_i / ΣW  (화면에는 1원 단위 반올림으로 표시)
 * - 송금액 = 송금 단위로 내림 → 자투리 전액을 1등 빌런에게 독박
 * 가중치를 정수로 맞추고 정수 연산으로 내림을 계산해 부동소수점 오차 없이 합계 = 총액을 보장한다.
 */
function computeSettlement(total, people, selections, tagMap, options = {}) {
  if (!people.length) return null;
  const mode = COURT_MODES.find((m) => m.id === options.courtMode) || COURT_MODES.find((m) => m.id === DEFAULT_COURT_MODE);
  const requestedUnit = ROUND_UNITS.includes(options.roundUnit) ? options.roundUnit : DEFAULT_ROUND_UNIT;
  const unit = total >= people.length * requestedUnit ? requestedUnit : DEFAULT_ROUND_UNIT;

  const rows = people.map((p, idx) => {
    const tags = (selections[p.id] || []).map((id) => tagMap[id]).filter(Boolean);
    const { penaltyCount, penaltySum, deductionSum, extras } = computeAutoPenalties(tags);
    const amplified = penaltySum + extras.filter((e) => e.amplify).reduce((s, e) => s + e.delta, 0);
    const plain = deductionSum + extras.filter((e) => !e.amplify).reduce((s, e) => s + e.delta, 0);
    const delta = Math.round((Math.round(amplified * mode.penaltyFactor) + plain) * mode.compress);
    const rawWeight = BASE_WEIGHT + delta;
    const weight = Math.min(mode.max, Math.max(mode.min, rawWeight));
    return {
      ...p,
      idx,
      tags,
      extras,
      tagDeltaSum: penaltySum + deductionSum,
      extraSum: extras.reduce((s, e) => s + e.delta, 0),
      weight,
      clamped: rawWeight < mode.min,
      clampedMax: rawWeight > mode.max,
      penaltyCount,
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
    r.floored = Math.floor((total * r.weight) / (totalWeight * unit)) * unit;
    // 화면에 보이는 반올림 금액끼리 빼서 표시 숫자가 서로 맞아떨어지게 한다
    r.diff = Math.round(r.exact) - Math.round(base);
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
      ? worstTag.verdict || customVerdict(worstTag.label, worstTag.delta)
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
    mode,
    unit,
    unitFallback: unit !== requestedUnit,
  };
}

function buildShareText({ total, settlement, account, memo }) {
  const { sorted, villain, hasVillain, surcharge, verdict, remainder, base } = settlement;
  const line = '━━━━━━━━━━━━━━━━━━';
  const out = [];
  out.push('📢 [쪼잔정산] 초정밀 기여도 청구서');
  out.push(line);
  out.push(`💸 총 결제액: ${fmtWon(total)}원 (${sorted.length}명)`);
  out.push(`📏 단순 1/N: ${fmtWon(base)}원 ← 이건 이제 무효입니다`);
  out.push(`${settlement.mode.emoji} 정산 모드: ${settlement.mode.name} (${settlement.mode.short}) · ${fmtWon(settlement.unit)}원 단위 송금`);
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
    out.push(`   └ 팩트 청구액 ${fmtWon(r.exact)}원 (1/N 대비 ${fmtDiff(r.diff)}원)`);
    if (r.isVillain && remainder > 0) {
      out.push(`   └ *(자투리 ${fmtWon(remainder)}원 빌런 독박 포함)`);
    }
    r.tags.forEach((t) => {
      out.push(`   └ ${t.emoji} ${t.reason} (${fmtPct(t.delta)})`);
    });
    r.extras.forEach((e) => {
      out.push(`   └ ${e.label}${e.key === 'hypocrisy' ? '' : ` (${fmtPct(e.delta)})`}`);
    });
  });
  out.push(line);
  out.push(`✅ 송금액 합계 ${fmtWon(settlement.paySum)}원 = 총액 ${fmtWon(total)}원 (오차 0원)`);
  if (account.trim()) out.push(`🏦 입금처: ${account.trim()}`);
  if (memo.trim()) out.push(`💬 총무의 한마디: ${memo.trim()}`);
  out.push('');
  out.push('※ 본 정산은 최종 확정 판결로 항소가 불가하며, 읽씹 시 가산세가 추가됩니다.');
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
        {[].concat(hint || []).map((line) => (
          <p key={line} className="tds-fade-up text-center text-[13px] text-[#8B95A1] mb-1.5 last:mb-2.5">
            {line}
          </p>
        ))}
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

// 뒤로가기·제목은 앱인토스 내비게이션 바가 담당하므로, 미니앱은 단계 진행 바만 보여준다.
function StepProgress({ step }) {
  const labels = ['', '정산 정보 입력', '인간적 기여도 평가', '영수증 정밀 감사 중', '최종 판결문'];
  return (
    <div
      className="sticky top-0 z-20 h-[3px] bg-[#E5E8EB]"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={step}
      aria-label={`${step}/4단계 ${labels[step]}`}
    >
      <div
        className="h-full bg-[#3182F6] transition-all duration-500 ease-out"
        style={{ width: `${(step / 4) * 100}%` }}
      />
    </div>
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
  const hint = [
    total === 0 && '0원은 정산할 수 없어요. 우정도 공짜는 아닙니다',
    amountTooSmall && `${MIN_AMOUNT}원 미만은 쪼잔함 측정 장비가 작동하지 않아요`,
    people.length < MIN_PEOPLE && peopleShortageMessage(people.length),
  ].filter(Boolean);

  return (
    <div className="px-5 pt-6 pb-40 space-y-4">
      <div className="tds-fade-up">
        <h2 className="text-[26px] font-bold leading-[1.35] text-[#191F28]">
          오늘 얼마나 쓰셨나요?
          <br />
          <span className="text-[#3182F6]">1원 단위까지 계산해 드릴게요</span>
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

        {people.length === 0 && (
          <div className="tds-fade-up mt-3 py-6 rounded-xl bg-[#F9FAFB] flex flex-col items-center text-center">
            <span className="w-12 h-12 rounded-full bg-[#E8F3FF] flex items-center justify-center">
              <Users size={22} className="text-[#3182F6]" />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-[#4E5968]">아직 출석한 피고인이 없어요</p>
            <p className="mt-1 text-[13px] text-[#8B95A1]">같이 먹고 마신 사람을 2명 이상 추가해 주세요</p>
          </div>
        )}
        <ul className="mt-3 divide-y divide-[#F2F4F6]">
          {people.map((p) => (
            <li key={p.id} className="tds-fade-up flex items-center gap-3 py-3">
              <Avatar name={p.name} />
              <span className="flex-1 text-[16px] font-medium text-[#191F28] truncate">{p.name}</span>
              <button
                type="button"
                onClick={() => onRemovePerson(p.id)}
                aria-label={`${p.name} 삭제`}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#B0B8C1] hover:bg-[#FFEEEE] hover:text-[#F04452] transition-all active:scale-90"
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
              placeholder="이름 입력 (예: 김먹튀, 박지각)"
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
            10명이 넘으면 총무도 누가 누군지 기억 못 해요
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
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer select-none transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/50 ${
        checked
          ? isPenalty
            ? 'border-[#F04452] bg-[#FFF2F2]'
            : 'border-[#00C471] bg-[#E8FBF2]'
          : 'border-transparent bg-[#F9FAFB] hover:bg-[#F2F4F6]'
      }`}
    >
      <span
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 border-2"
        style={{
          backgroundColor: checked ? accent : '#fff',
          borderColor: checked ? accent : '#D1D6DB',
        }}
      >
        {checked && <Check size={16} strokeWidth={3.5} className="text-white tds-pop" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-bold leading-snug text-[#191F28] break-keep">
          <span className="mr-1" aria-hidden>
            {tag.emoji}
          </span>
          {tag.label}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <DeltaBadge delta={tag.delta} size="sm" />
          <span className="min-w-0 text-[13px] text-[#8B95A1] truncate">{tag.reason}</span>
        </span>
      </span>
      <span className="flex items-center">
        {onDelete && (
          <button
            type="button"
            aria-label="죄목 폐지"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-[#B0B8C1] hover:text-[#F04452] hover:bg-[#FFEEEE] transition-all active:scale-90"
          >
            <Trash2 size={16} />
          </button>
        )}
      </span>
    </div>
  );
}

function CustomTagForm({ onAdd }) {
  const [label, setLabel] = useState('');
  const [delta, setDelta] = useState(CUSTOM_DEFAULT_DELTA);
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(false);

  const detected = useMemo(() => detectCustomPreset(label), [label]);
  const autoApplied = !touched && detected;
  const previewEmoji = resolveCustomEmoji(label, delta);

  const handleLabelChange = (e) => {
    const next = e.target.value;
    setLabel(next);
    // 유저가 형량을 직접 건드리기 전까지만 키워드 기반 자동 추천
    if (!touched) {
      const preset = detectCustomPreset(next);
      setDelta(preset ? preset.delta : CUSTOM_DEFAULT_DELTA);
    }
  };

  const setManualDelta = (value) => {
    setTouched(true);
    setDelta(value);
  };

  const submit = () => {
    if (onAdd(label, delta)) {
      setLabel('');
      setDelta(CUSTOM_DEFAULT_DELTA);
      setTouched(false);
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
      <div className="flex items-center gap-2">
        <span
          key={previewEmoji}
          className="tds-pop w-12 h-12 shrink-0 rounded-xl bg-white border border-[#E5E8EB] flex items-center justify-center text-[22px]"
          aria-hidden
        >
          {previewEmoji}
        </span>
        <input
          type="text"
          value={label}
          maxLength={30}
          placeholder="죄목 직접 입력 (예: 만취해서 옆 테이블에 인사함)"
          onChange={handleLabelChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-white border border-[#E5E8EB] text-[15px] text-[#191F28] placeholder:text-[#B0B8C1] outline-none focus:border-[#3182F6] transition-colors"
        />
      </div>
      <div className="min-h-7 mt-1.5 flex items-center">
        {autoApplied ? (
          <p key={detected.keyword} className="tds-fade-up text-[12px] leading-snug text-[#3182F6] font-medium break-keep">
            💡 '{detected.keyword}' 감지 → {detected.emoji} {fmtPct(detected.delta)} ({detected.category}) 양형 기준 자동 적용
          </p>
        ) : touched ? (
          <p className="text-[12px] text-[#8B95A1]">재판부 직권으로 형량을 직접 조정 중이에요</p>
        ) : (
          <p className="text-[12px] text-[#B0B8C1]">키워드를 넣으면 양형 기준이 자동 추천돼요</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#4E5968]">가산율</span>
        <span className="text-[18px] font-bold tabular-nums transition-colors" style={{ color }}>
          {fmtPct(delta)}
          <span className="ml-1 text-[12px] font-medium text-[#8B95A1]">
            {delta > 0 ? '가산세' : delta < 0 ? '공제' : '무의미'}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {SENTENCING_PRESETS.map((preset) => {
          const selected = delta === preset.delta;
          const isPenalty = preset.delta > 0;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setManualDelta(preset.delta)}
              aria-pressed={selected}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center border transition-all duration-200 active:scale-95 ${
                selected
                  ? isPenalty
                    ? 'bg-[#FFEEEE] border-[#F04452] text-[#F04452]'
                    : 'bg-[#E5F8EF] border-[#00C471] text-[#00A661]'
                  : 'bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F2F4F6]'
              }`}
            >
              <span className="text-[15px] leading-none">{preset.emoji}</span>
              <span className="mt-1 text-[11px] font-medium leading-none whitespace-nowrap">{preset.label}</span>
              <span className="mt-0.5 text-[11px] font-bold leading-tight tabular-nums">{fmtPct(preset.delta)}</span>
            </button>
          );
        })}
      </div>

      <input
        type="range"
        min={CUSTOM_MIN}
        max={CUSTOM_MAX}
        step={1}
        value={delta}
        onChange={(e) => setManualDelta(Number(e.target.value))}
        className="tds-range w-full mt-4"
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
  categoryId,
  setCategoryId,
  onStart,
}) {
  const active = people.find((p) => p.id === activeId) || people[0];
  const activeRow = settlement?.rows.find((r) => r.id === active.id);
  const selected = selections[active.id] || [];
  const appliedTags = activeRow?.tags ?? [];
  const extras = activeRow?.extras ?? [];
  const category = CATEGORY_TABS.find((t) => t.id === categoryId) || CATEGORY_TABS[0];
  const [moreOpen, setMoreOpen] = useState(false);
  const tabsRef = useRef(null);
  const categoryTabsRef = useRef(null);

  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-pid="${active.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active.id]);

  useEffect(() => {
    const el = categoryTabsRef.current?.querySelector(`[data-category="${category.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [category.id]);

  const weight = activeRow?.weight ?? BASE_WEIGHT;
  const weightTone = weight > BASE_WEIGHT ? '#F04452' : weight < BASE_WEIGHT ? '#00C471' : '#191F28';
  const mode = settlement?.mode;

  const categoryTags = category.tagIds.map((id) => PRESET_TAG_MAP[id]);
  const categoryPenalties = categoryTags.filter((t) => t.delta > 0);
  const categoryDeductions = categoryTags.filter((t) => t.delta < 0);
  const moreTags = MORE_TAG_IDS.map((id) => PRESET_TAG_MAP[id]);
  const visibleMoreTags = moreOpen ? moreTags : moreTags.filter((t) => selected.includes(t.id));
  const hiddenMoreCount = moreTags.length - visibleMoreTags.length;

  const renderRows = (tags) => (
    <div className="space-y-2">
      {tags.map((tag) => (
        <TagRow
          key={tag.id}
          tag={tag}
          checked={selected.includes(tag.id)}
          onToggle={() => toggleTag(active.id, tag.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="pt-6 pb-40">
      <div className="px-5 tds-fade-up">
        <h2 className="text-[26px] font-bold leading-[1.35] text-[#191F28]">
          누가 오늘
          <br />
          <span className="text-[#F04452]">우정을 갉아먹었나요?</span>
        </h2>
        <p className="mt-2 text-[15px] text-[#8B95A1]">해당하는 것만 콕콕 누르세요.</p>
      </div>

      {/* 참가자 탭 */}
      <div ref={tabsRef} className="tds-noscroll mt-5 px-5 flex gap-2 overflow-x-auto pb-1">
        {people.map((p) => {
          const row = settlement?.rows.find((r) => r.id === p.id);
          const isActive = p.id === active.id;
          const w = row?.weight ?? BASE_WEIGHT;
          return (
            <button
              key={p.id}
              data-pid={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={`shrink-0 h-12 pl-4 pr-3 rounded-full flex items-center gap-2 text-[16px] font-bold transition-all duration-200 active:scale-95 ${
                isActive ? 'bg-[#191F28] text-white shadow-md' : 'bg-white text-[#4E5968] shadow-sm hover:bg-[#F9FAFB]'
              }`}
            >
              {p.name}
              <span
                className={`min-w-[36px] h-6 px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center tabular-nums transition-colors ${
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
            </button>
          );
        })}
      </div>

      {/* 카테고리 탭 (1단) */}
      <div
        ref={categoryTabsRef}
        role="tablist"
        aria-label="죄목 카테고리"
        className="tds-noscroll mt-3 px-5 flex gap-2 overflow-x-auto pb-1"
      >
        {CATEGORY_TABS.map((t) => {
          const isOn = t.id === category.id;
          const count = t.tagIds.filter((id) => selected.includes(id)).length;
          return (
            <button
              key={t.id}
              data-category={t.id}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => setCategoryId(t.id)}
              className={`shrink-0 h-11 px-4 rounded-full flex items-center gap-1.5 text-[15px] font-bold border-2 transition-all duration-200 active:scale-95 ${
                isOn
                  ? 'bg-[#3182F6] border-[#3182F6] text-white shadow-sm'
                  : 'bg-white border-[#E5E8EB] text-[#4E5968] hover:bg-[#F9FAFB]'
              }`}
            >
              <span aria-hidden>{t.emoji}</span>
              {t.name}
              {count > 0 && (
                <span
                  className={`tds-pop min-w-[20px] h-5 px-1 rounded-full text-[12px] font-bold flex items-center justify-center tabular-nums ${
                    isOn ? 'bg-white text-[#3182F6]' : 'bg-[#3182F6] text-white'
                  }`}
                >
                  {count}
                </span>
              )}
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
              tone={weight > BASE_WEIGHT ? 'red' : weight < BASE_WEIGHT ? 'green' : 'blue'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#8B95A1]">피고인</p>
              <p className="text-[19px] font-bold text-[#191F28] truncate">{active.name}님</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-[#8B95A1]">가중치</p>
              <p className="text-[26px] font-bold tabular-nums transition-colors" style={{ color: weightTone }}>
                {weight}
              </p>
            </div>
          </div>
          {activeRow && total > 0 && (
            <p className="mt-2 text-right text-[13px] text-[#4E5968] font-medium tabular-nums">
              예상 부담 {fmtWon(activeRow.exact)}원
              {activeRow.clamped && <span className="text-[#00A661]"> (하한 {mode.min})</span>}
              {activeRow.clampedMax && <span className="text-[#F04452]"> (상한 {mode.max})</span>}
            </p>
          )}

          {/* 적용 중인 태그 칩 */}
          {appliedTags.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#F2F4F6] flex flex-wrap gap-2">
              {appliedTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  title={tag.label}
                  aria-label={`${tag.label} 해제`}
                  onClick={() => toggleTag(active.id, tag.id)}
                  className={`tds-pop max-w-full h-9 pl-3 pr-2 rounded-full flex items-center gap-1.5 text-[13px] font-semibold border transition-all active:scale-95 ${
                    tag.delta > 0
                      ? 'bg-[#FFF2F2] border-[#FFD0D4] text-[#191F28]'
                      : 'bg-[#E8FBF2] border-[#B8EED3] text-[#191F28]'
                  }`}
                >
                  <span aria-hidden>{tag.emoji}</span>
                  <span className="truncate max-w-[140px]">{tag.label}</span>
                  <span className="font-bold tabular-nums" style={{ color: tag.delta > 0 ? '#F04452' : '#00A661' }}>
                    {fmtPct(tag.delta)}
                  </span>
                  <X size={15} strokeWidth={3} className="text-[#8B95A1]" aria-hidden />
                </button>
              ))}
            </div>
          )}

          {/* 자동 가중처벌 (누진·콤보·공로 세탁) */}
          {extras.length > 0 && (
            <ul className="tds-fade-up mt-3 rounded-xl bg-[#FFF2F2] p-3 space-y-1.5">
              {extras.map((e) => (
                <li key={e.key} className="flex items-start justify-between gap-2 text-[13px] font-semibold text-[#191F28]">
                  <span className="break-keep">{e.label}</span>
                  {e.key !== 'hypocrisy' && <DeltaBadge delta={e.delta} size="sm" />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 선택한 카테고리 */}
        <Card key={category.id} className="p-3 tds-fade-up">
          <div className="px-1 pt-1 pb-3">
            <p className="text-[18px] font-bold text-[#191F28]">
              {category.emoji} {category.name}
            </p>
            <p className="mt-0.5 text-[13px] text-[#8B95A1]">{category.desc}</p>
          </div>
          <p className="px-1 pb-2 text-[13px] font-bold text-[#F04452]">🔴 가산세</p>
          {renderRows(categoryPenalties)}
          <p className="px-1 pt-4 pb-2 text-[13px] font-bold text-[#00A661]">🟢 공제</p>
          {renderRows(categoryDeductions)}
        </Card>

        {/* 공통 추가 죄목 & 우정 할인 (기본 접힘, 체크된 항목만 노출) */}
        <Card className="p-3">
          <div className="px-1 pt-1 pb-2">
            <p className="text-[16px] font-bold text-[#191F28]">공통 추가 죄목 & 우정 할인</p>
            <p className="mt-0.5 text-[13px] text-[#8B95A1]">새벽 전화, 증발, 생일 주인공 등</p>
          </div>
          {visibleMoreTags.length > 0 && renderRows(visibleMoreTags)}
          {(moreOpen || hiddenMoreCount > 0) && (
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className="mt-2 w-full h-12 rounded-xl flex items-center justify-center gap-1 text-[15px] font-bold text-[#3182F6] bg-[#E8F3FF] hover:bg-[#DCEBFF] active:scale-[0.98] transition-all"
            >
              {moreOpen ? (
                <>
                  접기 <ChevronUp size={18} />
                </>
              ) : (
                <>
                  + {hiddenMoreCount}개 더보기 <ChevronDown size={18} />
                </>
              )}
            </button>
          )}
        </Card>

        {/* 커스텀 죄목 */}
        <Card className="p-3">
          <div className="px-1 pt-1 pb-2 flex items-center gap-2">
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-md text-[#3182F6] bg-[#E8F3FF]">
              즉석 입법
            </span>
            <span className="text-[16px] font-bold text-[#191F28]">직접 죄목 추가</span>
          </div>
          {customTags.length === 0 ? (
            <p className="px-1 py-1 text-[13px] text-[#8B95A1]">목록에 없는 만행은 직접 써 주세요.</p>
          ) : (
            <div className="space-y-2">
              {customTags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  checked={selected.includes(tag.id)}
                  onToggle={() => toggleTag(active.id, tag.id)}
                  onDelete={() => onRemoveCustomTag(tag.id)}
                />
              ))}
            </div>
          )}
          <CustomTagForm onAdd={(label, delta) => onAddCustomTag(active.id, label, delta)} />
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
            className="w-full h-14 rounded-2xl text-[16px] font-bold text-[#4E5968] bg-white shadow-sm hover:bg-[#F9FAFB] active:scale-[0.98] transition-all"
          >
            다음 사람 →
          </button>
        )}
      </div>

      <BottomCTA>
        <PrimaryButton icon={Gavel} onClick={onStart}>
          영수증 정밀 감사 시작
        </PrimaryButton>
      </BottomCTA>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Step 3: 영수증 정밀 감사 로딩
 * ────────────────────────────────────────────────────────────── */

function StepLoading({ messages, onDone }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, messages.length - 1));
    }, LOADING_INTERVAL);
    const timeout = setTimeout(() => doneRef.current(), LOADING_DURATION);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [messages.length]);

  const isLast = msgIdx === messages.length - 1;

  return (
    <div className="tds-fade-up min-h-[calc(100vh-60px)] px-8 flex flex-col items-center justify-center text-center">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-[6px] border-[#E8F3FF]" />
        <div className="absolute inset-0 rounded-full border-[6px] border-[#3182F6] border-t-transparent border-r-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Scale size={28} className="text-[#3182F6]" />
        </div>
      </div>

      <p className="mt-8 text-[13px] font-semibold text-[#3182F6] tracking-wide">술자리 행적 정밀 대조 중</p>
      <div className="mt-3 h-[108px] flex items-start justify-center">
        <p
          key={msgIdx}
          className={`tds-roll text-[18px] font-bold leading-[1.45] break-keep ${
            isLast ? 'text-[#3182F6]' : 'text-[#191F28]'
          }`}
        >
          {messages[msgIdx]}
        </p>
      </div>

      <div className="mt-8 w-full max-w-[260px] h-1.5 rounded-full bg-[#E5E8EB] overflow-hidden">
        <div className="tds-progress h-full rounded-full bg-[#3182F6]" />
      </div>
      <div className="mt-6 flex gap-1.5">
        {messages.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= msgIdx ? 'w-5 bg-[#3182F6]' : 'w-1.5 bg-[#D1D6DB]'
            }`}
          />
        ))}
      </div>
      <p className="mt-10 text-[12px] text-[#B0B8C1]">※ 본 감사는 한 치의 인정도 없이 오직 팩트와 뒤끝으로만 진행됩니다.</p>
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
  const diffColor = row.diff > 0 ? '#F04452' : row.diff < 0 ? '#00A661' : '#8B95A1';
  const diffDot = row.diff > 0 ? '🔴' : row.diff < 0 ? '🟢' : '⚪';

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
            가중치 {row.weight}
            {row.clampedMax && <span className="text-[#F04452]"> (상한 {settlement.mode.max})</span>}
            {row.clamped && <span className="text-[#00A661]"> (하한 {settlement.mode.min})</span>} · 지분 {((row.weight / settlement.totalWeight) * 100).toFixed(1)}%
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
          <span className="font-semibold text-[#191F28] tabular-nums">{fmtWon(row.exact)}원</span>
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
            {row.extras.map((e) => (
              <li key={e.key} className="flex items-start justify-between gap-2">
                <span className="font-semibold text-[#F04452] break-keep">{e.label}</span>
                {e.key !== 'hypocrisy' && <DeltaBadge delta={e.delta} size="sm" />}
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

// 결과 화면의 접이식 옵션: 정산 매운맛(양형 강도)과 송금 내림 단위. 기본은 접힘
function SettlementOptions({ settlement, courtMode, setCourtMode, roundUnit, setRoundUnit }) {
  const [open, setOpen] = useState(false);
  const { mode, unit, unitFallback } = settlement;
  const unitHint = {
    10: '기본. 10원 미만 자투리만 1등 빌런 몫이에요',
    100: '깔끔 송금. 100원 미만 자투리는 1등 빌런 몫이에요',
    1000: '천 원 미만 자투리 전액 1등 빌런 독박',
  };

  return (
    <Card className="tds-fade-up" style={{ animationDelay: '120ms' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between gap-2 text-left active:scale-[0.99] transition-transform"
      >
        <span>
          <span className="block text-[15px] font-bold text-[#191F28]">⚙️ 정산 매운맛 & 단위 조절</span>
          <span className="block mt-0.5 text-[13px] text-[#8B95A1]">
            지금: {mode.emoji} {mode.name} ({mode.short}) · {fmtWon(unit)}원 단위
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-0.5 text-[13px] font-semibold text-[#3182F6]">
          {open ? '닫기' : '옵션 열기'}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="tds-fade-up px-5 pb-5 space-y-5">
          <div>
            <p className="text-[14px] font-bold text-[#4E5968]">정산 매운맛</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {COURT_MODES.map((m) => {
                const on = m.id === courtMode;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCourtMode(m.id)}
                    className={`py-3 rounded-xl border-2 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                      on ? 'border-[#3182F6] bg-[#E8F3FF] text-[#1B64DA]' : 'border-[#E5E8EB] bg-white text-[#4E5968]'
                    }`}
                  >
                    <span className="text-[20px] leading-none" aria-hidden>
                      {m.emoji}
                    </span>
                    <span className="mt-1 text-[15px] font-bold">{m.name}</span>
                    <span className="text-[12px] font-medium">{m.short}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-[#8B95A1]">
              {mode.desc} · 가중치 {mode.min}~{mode.max}
            </p>
          </div>

          <div>
            <p className="text-[14px] font-bold text-[#4E5968]">송금 내림 단위</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ROUND_UNITS.map((u) => {
                const on = u === roundUnit;
                return (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRoundUnit(u)}
                    className={`h-12 rounded-xl border-2 text-[14px] font-bold transition-all active:scale-95 ${
                      on ? 'border-[#3182F6] bg-[#E8F3FF] text-[#1B64DA]' : 'border-[#E5E8EB] bg-white text-[#4E5968]'
                    }`}
                  >
                    {fmtWon(u)}원 단위
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-[#8B95A1]">{unitHint[roundUnit]}</p>
            {unitFallback && (
              <p className="mt-1 text-[12px] font-semibold text-[#F04452]">
                총액이 작아서 10원 단위로 자동 조정했어요
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function StepResult({
  total,
  settlement,
  account,
  setAccount,
  memo,
  setMemo,
  courtMode,
  setCourtMode,
  roundUnit,
  setRoundUnit,
  onCopy,
  onEditTags,
  onRestart,
}) {
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
              총무 감사실 한줄 참교육{settlement.worstTag && hasVillain ? ` · 주요 혐의: ${settlement.worstTag.label}` : ''}
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
            {fmtWon(base)}원
          </p>
        </div>
        <div>
          <p className="text-[12px] text-[#8B95A1]">총 가중치</p>
          <p className="mt-1 text-[15px] font-bold text-[#191F28] tabular-nums">{settlement.totalWeight}</p>
        </div>
      </Card>

      <SettlementOptions
        settlement={settlement}
        courtMode={courtMode}
        setCourtMode={setCourtMode}
        roundUnit={roundUnit}
        setRoundUnit={setRoundUnit}
      />

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
            {balanced ? `총 결제액과 1원도 틀리지 않고 일치 (오차 0원)` : '합계 불일치 — 정산 재판부 재심 필요'}
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
            ※ 본 정산은 최종 확정 판결로 항소가 불가하며, 읽씹 시 가산세가 추가됩니다. 이의 제기 시 다음 모임 가산세 +50%가 자동 부과됩니다.
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
          placeholder="계좌번호 또는 송금 아이디 (예: OO은행 1000-0000-0000)"
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
  const [people, setPeople] = useState([]);
  const [selections, setSelections] = useState({});
  const [customTags, setCustomTags] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [categoryId, setCategoryId] = useState(CATEGORY_TABS[0].id);
  const [courtMode, setCourtMode] = useState(DEFAULT_COURT_MODE);
  const [roundUnit, setRoundUnit] = useState(DEFAULT_ROUND_UNIT);
  const [account, setAccount] = useState('');
  const [memo, setMemo] = useState('');
  const [toast, setToast] = useState(null);
  const [manualCopyText, setManualCopyText] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState([LOADING_FINALE]);
  const toastTimer = useRef(null);

  const tagMap = useMemo(() => {
    const map = {};
    [...PRESET_TAGS, ...customTags].forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [customTags]);

  const settlement = useMemo(
    () => computeSettlement(total, people, selections, tagMap, { courtMode, roundUnit }),
    [total, people, selections, tagMap, courtMode, roundUnit]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // 단계 이동을 history에 쌓아, 앱인토스 내비게이션 바의 뒤로가기(=history.back)로 이전 단계로 돌아가게 한다.
  // 첫 화면에서는 쌓인 기록이 없으므로 뒤로가기를 누르면 미니앱이 종료된다.
  const canLeaveStep1Ref = useRef(false);
  canLeaveStep1Ref.current = total >= MIN_AMOUNT && people.length >= MIN_PEOPLE;

  useEffect(() => {
    window.history.replaceState({ step: 1, depth: 0 }, '');
    const onPopState = (e) => {
      const target = e.state?.step ?? 1;
      if (target > 1 && !canLeaveStep1Ref.current) {
        window.history.replaceState({ step: 1, depth: 0 }, '');
        setStep(1);
        return;
      }
      setStep(target);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const pushStep = (next) => {
    const depth = (window.history.state?.depth ?? 0) + 1;
    window.history.pushState({ step: next, depth }, '');
    setStep(next);
  };

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
      emoji: resolveCustomEmoji(label, delta),
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
    if (people.length < MIN_PEOPLE) return showToast(peopleShortageMessage(people.length), 'error');
    if (!people.some((p) => p.id === activeId)) setActiveId(people[0].id);
    pushStep(2);
  };

  const startJudging = () => {
    if (!settlement || total < MIN_AMOUNT) {
      showToast('정산 금액을 다시 확인해 주세요', 'error');
      window.history.back();
      return;
    }
    setLoadingMessages(buildLoadingMessages(people, selections, tagMap));
    pushStep(3);
  };

  // 로딩 화면은 기록에서 결과 화면으로 바꿔치기해, 결과에서 뒤로가기 시 로딩을 다시 보지 않고 태그 화면으로 간다
  const finishLoading = useCallback(() => {
    window.history.replaceState({ ...window.history.state, step: 4 }, '');
    setStep(4);
  }, []);

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
    setPeople([]);
    setSelections({});
    setCustomTags([]);
    setActiveId(null);
    setCategoryId(CATEGORY_TABS[0].id);
    setCourtMode(DEFAULT_COURT_MODE);
    setRoundUnit(DEFAULT_ROUND_UNIT);
    setAccount('');
    setMemo('');
    // 쌓인 단계 기록을 모두 되돌려 첫 화면(기록 없음)으로 돌아간다
    const depth = window.history.state?.depth ?? 0;
    if (depth > 0) window.history.go(-depth);
    setStep(1);
    showToast('새 재판을 시작합니다. 우정은 리셋되지 않아요');
  };

  return (
    <div className="min-h-screen bg-[#F2F4F6]">
      <style>{GLOBAL_STYLE}</style>
      <div className="relative max-w-md mx-auto min-h-screen bg-[#F2F4F6]">
        <StepProgress step={step} />
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
              categoryId={categoryId}
              setCategoryId={setCategoryId}
              onStart={startJudging}
            />
          )}
          {step === 3 && <StepLoading messages={loadingMessages} onDone={finishLoading} />}
          {step === 4 && settlement && (
            <StepResult
              total={total}
              settlement={settlement}
              account={account}
              setAccount={setAccount}
              memo={memo}
              setMemo={setMemo}
              courtMode={courtMode}
              setCourtMode={setCourtMode}
              roundUnit={roundUnit}
              setRoundUnit={setRoundUnit}
              onCopy={handleCopy}
              onEditTags={() => window.history.back()}
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
