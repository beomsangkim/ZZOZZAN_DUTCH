# 토스 쪼잔정산 (ZZOZZAN_DUTCH)

초정밀 기여도 기반 우정 파괴 N빵 정산기. 서버 없이 100% 클라이언트에서 동작하는 토스 미니앱 프로토타입입니다.

- 핵심 로직/UI: `src/App.jsx` (단일 파일 컴포넌트)
- 스택: React 18 + Tailwind CSS 3 + lucide-react (Vite)

```bash
npm install
npm run dev
```

## 정산 알고리즘
- `W_i = max(10, 100 + Σ weightDelta)`
- `Exact_i = 총액 × W_i / ΣW` (소수점 2자리 표시)
- 송금액은 10원 단위 내림, 자투리는 가중치 1위 빌런에게 전액 독박 → 합계 = 총액 (오차 0원 보장)
