# 토스 쪼잔정산 (ZZOZZAN_DUTCH)

초정밀 기여도 기반 우정 파괴 N빵 정산기. 서버 없이 100% 클라이언트에서 동작하는 토스 미니앱 프로토타입입니다.

- 핵심 로직/UI: `src/App.jsx` (단일 파일 컴포넌트)
- 로딩 화면 문구는 선택된 죄목과 참가자 이름으로 동적 생성 (`buildLoadingMessages`)
- 스택: React 18 + Tailwind CSS 3 + lucide-react (Vite)

```bash
npm install
npm run dev
```

## 정산 알고리즘
- `W_i = min(300, max(10, 100 + Σ weightDelta))` (하한 10, 상한 300)
- `Exact_i = 총액 × W_i / ΣW` (소수점 2자리 표시)
- 송금액은 10원 단위 내림, 자투리는 가중치 1위 빌런에게 전액 독박 → 합계 = 총액 (오차 0원 보장)

## 앱인토스(토스 미니앱) 배포
- 설정: `apps-in-toss.config.ts` (`appName: zzozan-dutch` — 앱인토스 콘솔에 등록한 앱 이름과 같아야 업로드 가능)
- `npm run build`: 일반 웹 빌드 (Vercel용, 변경 없음)
- `npm run build:toss`: 웹 빌드 후 업로드용 `zzozan-dutch.ait` 생성
- `npm run deploy -- --api-key <API 키>`: `.ait`를 앱인토스에 업로드 (또는 콘솔에서 직접 업로드)
- `npm run dev`: 화면 오른쪽 아래 `AIT` 버튼으로 미니앱 환경 미리보기
