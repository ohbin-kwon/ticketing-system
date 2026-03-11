# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

실시간 티켓팅 / 선착순 예약 시스템 — DB 성능 최적화와 트래픽 대응 아키텍처를 증명하는 포트폴리오 프로젝트.

**목표**: 동시 500~1000 요청 처리, 부하 테스트 수치 기반 README 정리

## Tech Stack

- **Framework**: NestJS + TypeScript
- **DB**: PostgreSQL (AWS RDS) + TypeORM
- **Cache/Queue**: Redis (AWS ElastiCache) + Bull Queue
- **Payment**: 토스페이먼츠
- **Infra**: AWS RDS, ElastiCache, Lambda, EventBridge, CloudWatch, Docker, GitHub Actions
- **Test**: Jest (unit/integration), k6 (load test)

## Commands

```bash
# 개발 서버
npm run start:dev

# 빌드
npm run build

# 테스트 (전체)
npm run test

# 테스트 (단일 파일)
npm run test -- --testPathPattern=<파일명>

# 테스트 (watch)
npm run test:watch

# e2e 테스트
npm run test:e2e

# 린트
npm run lint

# DB 마이그레이션
npm run migration:generate -- src/migrations/<이름>
npm run migration:run
npm run migration:revert
```

## Branch Strategy

```
main              ← 항상 동작하는 상태
 └── feat/xxx     ← 기능 브랜치 (PR 머지 후 삭제)
```

- 브랜치 네이밍: `feat/user-auth`, `feat/concert-crud`, `fix/seat-lock-bug`
- 구현 순서 단계별로 브랜치 → PR → **squash merge** → 삭제
- `develop` 브랜치 없음 — main + feat 브랜치만 운용

```bash
git checkout -b feat/<기능명>
# 작업 + 커밋
git push -u origin feat/<기능명>
gh pr create --title "feat: 기능 설명"
# PR squash merge 후
git checkout main && git pull
git branch -d feat/<기능명>
```

## Docker

```bash
# PostgreSQL 로컬 실행
docker run --name ticketing-pg -e POSTGRES_USER=ticketing -e POSTGRES_PASSWORD=ticketing -e POSTGRES_DB=ticketing -p 5432:5432 -d postgres:16

# Redis 로컬 실행
docker run --name ticketing-redis -p 6379:6379 -d redis:7-alpine
```

## Environment Variables

`.env.example` 형태:
```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ticketing
DB_PASSWORD=ticketing
DB_DATABASE=ticketing

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h

# Toss Payments
TOSS_PAYMENTS_SECRET_KEY=test_sk_xxx
TOSS_PAYMENTS_CLIENT_KEY=test_ck_xxx

# App
PORT=3000
NODE_ENV=development
```

## Architecture

### DDD 폴더 구조

```
src/
├── concert/          # Concert Bounded Context
├── reservation/      # Reservation Bounded Context
├── payment/          # Payment Bounded Context
├── user/             # User Bounded Context
├── queue/            # Queue Bounded Context
└── common/           # 공통 모듈 (guards, filters, interceptors)
```

각 컨텍스트 내부 레이어:
```
<context>/
├── domain/           # Entity, Value Object, Domain Event
├── application/      # Use Case, Command/Query Handler
├── infrastructure/   # Repository 구현체, External API
└── presentation/     # Controller, DTO
```

### 컨텍스트 간 통신

- 직접 의존 금지 — 반드시 **도메인 이벤트(Domain Event)** 를 통해 통신
- 이벤트는 Bull Queue를 통해 비동기 처리
- 이벤트 처리 실패 시 Dead Letter Queue로 이동

### 핵심 도메인 이벤트

| 이벤트 | 발행 | 구독 |
|--------|------|------|
| SeatHeld | Reservation | Concert (→ HELD) |
| SeatHoldExpired | Reservation | Concert (→ AVAILABLE) |
| ReservationConfirmed | Reservation | Concert (→ RESERVED) |
| ReservationCancelled | Reservation | Concert, Payment |
| PaymentCompleted | Payment | Reservation (확정) |
| PaymentFailed | Payment | Reservation (선점 해제) |
| QueueTokenActivated | Queue | Reservation (진입 허용) |

## Bounded Contexts & Aggregates

### Concert
- Aggregate Root: `Concert`
- 포함: `Schedule`, `Seat`, `SeatGrade` (VO)
- 불변: 좌석 수 = 수용 인원 범위 내
- **좌석 상태 변경은 반드시 도메인 이벤트를 통해서만 수행**

### Reservation
- Aggregate Root: `Reservation`
- 포함: `ReservationSeat`, `ReservationStatus` (VO)
- 불변: 선점~결제 원자성 보장
- 상태: `PENDING → CONFIRMED → CANCELLED`

### Payment
- Aggregate Root: `Payment`
- 포함: `PaymentHistory`, `PaymentStatus` (VO)
- 불변: 금액 검증 통과 후 상태 변경
- 상태: `PENDING → PAID → FAILED → REFUNDED`

### Queue
- Aggregate Root: `QueueToken`
- Redis Sorted Set + DB 병행 운영 (Redis: 실시간 순번, DB: 영속성)
- 동시 활성 토큰 최대 100개 제한

### User
- Aggregate Root: `User`
- 상태: `ACTIVE / SUSPENDED / DELETED`

## DB Schema 핵심 규칙

- **PK**: 모든 테이블 UUID (`gen_random_uuid()`)
- **타임스탬프**: 전부 `TIMESTAMPTZ` (UTC)
- **낙관적 락 대상**: `seats`, `schedules` — `version INTEGER` 컬럼 포함
- **소프트 딜리트 없음**: status 컬럼 변경으로 처리

### 핵심 인덱스

```sql
-- 피크 타임 가장 빈번한 쿼리
CREATE INDEX idx_seats_schedule_status ON seats(schedule_id, status);

-- 선점 만료 배치 전용 부분 인덱스
CREATE INDEX idx_reservations_hold_expires ON reservations(hold_expires_at)
  WHERE status = 'PENDING';
```

### 동시성 제어 3단계

1. **낙관적 락** — `seats`, `schedules`의 version 컬럼 기반
   ```sql
   UPDATE seats SET status='HELD', version=version+1
   WHERE id=$1 AND status='AVAILABLE' AND version=$2;
   ```
2. **비관적 락** — 인기 좌석 선점 임계구간 `SELECT FOR UPDATE`
3. **Redis 분산 락** — 다중 인스턴스 환경 `SET lock:seat:{seatId} {token} NX EX 10`

## 핵심 비즈니스 규칙

| 도메인 | 규칙 | 내용 |
|--------|------|------|
| Reservation | SeatHoldTimeout | 선점 후 **5분** 미결제 시 자동 해제 |
| Reservation | MaxSeatPerReservation | 1회 예약 최대 **4석** |
| Reservation | DuplicateSeatGuard | 동일 사용자, 동일 회차, 동일 좌석 중복 불가 |
| Payment | AmountVerification | 결제 금액 = 좌석 합산 금액 검증 필수 |
| Payment | IdempotentPayment | 동일 `order_id` 중복 요청 시 기존 결과 반환 |
| Payment | PaymentTimeout | 결제 요청 후 **30분** 미완료 시 자동 취소 |
| Queue | ActiveTokenLimit | 동시 활성 토큰 최대 **100개** |
| Queue | QueueTokenTTL | 대기 토큰 발급 후 **10분** 미진입 시 만료 |

## 네이밍 규칙

- **코드** (클래스, 메서드, 변수): 도메인 정의서 EN 컬럼 그대로 사용
- **DB 컬럼**: snake_case (`reservationStatus` → `reservation_status`)
- **API 응답**: camelCase
- "booking"과 "reservation" 혼용 금지 — `reservation` 통일

## Code Style

- **TypeScript strict mode** 활성화 (`strict: true`)
- `any` 타입 사용 금지 — 명시적 타입 또는 `unknown` 사용
- 도메인 레이어는 NestJS / TypeORM 등 인프라 의존성 import 금지 (순수 TypeScript)
- 비즈니스 규칙 검증은 도메인 레이어에서, HTTP 관련 검증(DTO)은 presentation 레이어에서
- `class-validator` + `class-transformer` — 모든 요청 DTO에 적용
- 에러는 NestJS `HttpException` 상속 커스텀 예외 클래스 사용, 도메인 에러는 별도 `DomainException` 기반
- 파일명: `kebab-case.ts` / 클래스명: `PascalCase` / 변수·함수: `camelCase`
- 인터페이스 prefix `I` 없음 — `ReservationRepository` (O), `IReservationRepository` (X)
- 환경변수는 `ConfigModule` + `@nestjs/config`를 통해서만 접근 — 코드에서 `process.env` 직접 참조 금지

## Test Convention

- 테스트 파일 위치: 소스 파일과 동일 디렉토리에 `*.spec.ts`
- e2e 테스트: `test/` 디렉토리에 `*.e2e-spec.ts`
- 네이밍: `describe('클래스명')` → `it('should 동작 설명')`
- 단위 테스트: 도메인/유스케이스 중심, 외부 의존성은 모킹
- 통합 테스트: DB 연결 포함, 트랜잭션 롤백으로 격리
- 각 Bounded Context별 최소 커버리지: 도메인 로직 100%, 유스케이스 80%+

## API Convention

### URL 구조
```
GET    /concerts                    # 목록
GET    /concerts/:id                # 단건
GET    /concerts/:id/schedules      # 하위 리소스
POST   /reservations                # 생성
PATCH  /reservations/:id/cancel     # 상태 변경 액션
```
- 복수형 소문자 kebab-case (`/queue-tokens`)
- 버전 prefix: `/api/v1/...`

### 응답 형식
```json
{
  "success": true,
  "data": { ... }
}
```
에러 응답:
```json
{
  "success": false,
  "error": {
    "code": "SEAT_ALREADY_HELD",
    "message": "이미 선점된 좌석입니다."
  }
}
```
- HTTP 상태코드: 200 (조회), 201 (생성), 400 (클라이언트 오류), 409 (충돌/중복), 500 (서버 오류)
- 에러 코드는 `SCREAMING_SNAKE_CASE`, 도메인 접두사 포함 (`SEAT_`, `RESERVATION_`, `PAYMENT_`, `QUEUE_`)

### 인증
- JWT Bearer Token (`Authorization: Bearer <token>`)
- `QueueGuard` — 예약 관련 엔드포인트에 활성 대기열 토큰 검증 추가

## Important Notes

- **낙관적 락 충돌 시** `0 rows updated` → `ConflictException(SEAT_VERSION_CONFLICT)` 반환, 재시도 로직은 클라이언트 책임
- **트랜잭션 범위** — 좌석 선점(`HoldSeat`) 유스케이스는 단일 트랜잭션 내에서 seats 업데이트 + reservation 생성 + 이벤트 발행 순서 보장
- **대기열 우회 불가** — 예약 API는 반드시 활성 QueueToken 검증 후 진입, 테스트 환경에서도 Guard 비활성화 금지
- **결제 금액 이중 검증** — 토스페이먼츠 콜백 수신 시 DB의 `reservations.total_amount`와 반드시 재검증
- **Redis 장애 시 fallback** — 대기열은 Redis 의존, Redis 다운 시 Queue 컨텍스트 전체 503 반환 (DB fallback 없음)
- **마이그레이션** — TypeORM `synchronize: false` 고정, 스키마 변경은 반드시 마이그레이션 파일로만 적용
- **Bull Queue Job** 실패 시 최대 3회 재시도, 이후 Dead Letter Queue 이동 — `attempts: 3, backoff: { type: 'exponential', delay: 1000 }`

## 구현 순서

1. **프로젝트 기반** — NestJS + TypeORM + Docker PostgreSQL + 마이그레이션
2. **User 컨텍스트** — 회원가입 / 로그인 / JWT
3. **Concert 컨텍스트** — venues, concerts, schedules, seats CRUD
4. **Queue 컨텍스트** — DB 기반 → Redis 전환 순서
5. **Reservation 컨텍스트** — 낙관적 락 → 비관적 락
6. **Payment 컨텍스트** — 토스페이먼츠 연동
7. **성능/트래픽** — Redis 대기열, 분산 락, Bull Queue, k6

각 단계 내 구현 순서: **Entity → Repository → UseCase → Controller**

> **작업 원칙: 한 번에 전부 만들지 않기 — 단계별로 진행**

## 4주 구현 로드맵

| 주차 | 목표 |
|------|------|
| 1주 | DDD 구조 세팅, DB 스키마 + 인덱스, 기본 CRUD API |
| 2주 | 낙관적 락 vs 비관적 락 구현 및 비교 문서화, 좌석 예약 유스케이스 완성 |
| 3주 | Redis 분산 락, Bull Queue 대기열, 토스페이먼츠 연동, AWS 인프라 구성 |
| 4주 | k6 부하 테스트 (동시 500~1000), 병목 개선, CloudWatch 대시보드, README 수치 정리 |
