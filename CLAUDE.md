# Spendly — Personal Expense Tracker
## Claude Code Reference (Updated: June 2026)

---

## Project overview

**Spendly** is a single-user personal expense tracker. The user logs expenses and income via Telegram messages in natural language or the web dashboard. The system parses them, categorises them, persists to PostgreSQL, and runs a financial zone engine (Safe / Warning / Danger) powered by Gemini 2.0 Flash. A Next.js dashboard shows the zone, savings plan, wallet overview, and live spend insights.

**Phase: Local Docker. No cloud deployment yet.**
Everything runs via `docker compose up --build`.

---

## Absolute constraints

- Single user. No auth, no multi-tenancy. One hardcoded user context.
- Zero paid services during local dev. Gemini 2.0 Flash free tier only (1M tokens/day). Telegram Bot API is free.
- All secrets in `.env` file only. Never hardcode keys. Never commit `.env`.
- Long polling for Telegram locally (no webhook, no ngrok needed).
- Python 3.12. FastAPI + Uvicorn for the API. SQLAlchemy 2.x (async) + Alembic for DB.
- PostgreSQL 16. No SQLite.
- No Celery, no Redis. APScheduler (AsyncIOScheduler) for scheduled jobs.
- Next.js 14 App Router for frontend. Tailwind CSS. No UI component library (shadcn removed).
- All containers restart cleanly without data loss. Named Docker volumes.

---

## Repository structure (current actual state)

```
spend_tracker/
├── CLAUDE.md
├── docker-compose.yml
├── .env / .env.example
├── .gitignore
│
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── seed_data.py              # Seeds dummy May/June 2026 expense data
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── app/
│   │   ├── main.py               # FastAPI app, lifespan, APScheduler (boot recalc + 21:00 daily AI job)
│   │   ├── config.py             # pydantic-settings, reads .env
│   │   ├── database.py           # async SQLAlchemy engine + session
│   │   ├── models.py             # ORM models (Expense, IncomeEvent, SavingsPlan, SpendInsight, MonthSettings)
│   │   ├── schemas.py            # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── expense.py        # POST /expense (single + multi), GET /expenses, DELETE /expense/{id}, POST /expense/{id}/confirm
│   │   │   ├── income.py         # POST /income, GET /income
│   │   │   ├── insights.py       # GET /zone, GET /savings-plan, POST /insights/refresh, GET /investment-insight
│   │   │   └── settings.py       # GET /settings, POST /settings, POST /settings/restart
│   │   └── services/
│   │       ├── parser.py         # Gemini: parse raw text → ParsedEntry; parse_multi() for comma-separated
│   │       ├── categoriser.py    # Rule engine first, Gemini fallback
│   │       ├── zone_calculator.py # Deterministic zone scoring (no LLM)
│   │       └── advisor.py        # Gemini: narrative + action pills + investment suggestions
│   └── tests/
│       ├── test_parser.py
│       ├── test_zone.py
│       └── test_categoriser.py
│
├── bot/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── bot.py                    # python-telegram-bot v20+, long polling
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/app/
        ├── layout.tsx
        ├── globals.css            # Tailwind + global keyframes (dangerPulse, fadeScale, fadeUp)
        ├── page.tsx               # Dashboard (main route)
        ├── compare/page.tsx       # Month-over-month comparison chart
        ├── settings/page.tsx      # Salary + month settings with lock mechanic
        ├── components/
        │   ├── NavBar.tsx         # Top nav with theme toggle + zone danger dot badge
        │   ├── ThemeToggle.tsx    # Dark/light mode toggle
        │   ├── ZoneBanner.tsx     # SAFE/WARNING/DANGER banner with scores + narrative
        │   ├── SavingsPanel.tsx   # Wallet Overview: segmented bar (Invest/Spent/Save Goal)
        │   ├── StatsCards.tsx     # 2-card grid: Expense donut + Invest donut
        │   ├── MonthlySpendLine.tsx # SVG cumulative spend line chart, drag-to-resize
        │   ├── SpendInsight.tsx   # Category bars with accordion + delete entries
        │   ├── CardModal.tsx      # Bottom-sheet modal: expense detail or invest plan + AI insight
        │   ├── AiInsights.tsx     # AI narrative + action pills + investment suggestions panel
        │   ├── RecentEntries.tsx  # Auto-scrolling list sorted by created_at
        │   ├── SavingsPlan.tsx    # Savings plan allocations display
        │   ├── KpiRow.tsx         # (exists but NOT used in dashboard — superseded by SavingsPanel)
        │   ├── LogBar.tsx         # Fixed bottom input bar with Toast notifications
        │   └── Toast.tsx          # Toast notification system (success/error/loading)
        └── lib/
            ├── api.ts             # All fetch wrappers + TypeScript interfaces
            └── utils.ts           # fmt(n) currency formatter, clamp(val, min, max)
```

---

## Docker Compose — five services

```yaml
services:
  db:          # postgres:16-alpine, port internal only, volume pg_data
  api:         # FastAPI on port 8000, hot-reload via ./api:/app mount
  bot:         # Telegram bot, long polling, no ports
  frontend:    # Next.js on port 3000, hot-reload via ./frontend:/app mount
  pgadmin:     # dpage/pgadmin4 on port 5050, volume pgadmin_data

volumes:
  pg_data:
  pgadmin_data:

networks:
  spendly_net: bridge
```

**pgAdmin access:** http://localhost:5050
- Login: `admin@gmail.com` / `admin`
- Connect to DB: Host=`db`, Port=`5432`, use `POSTGRES_*` values from `.env`

### `.env` variables
```
POSTGRES_DB=spendly
POSTGRES_USER=spendly_user
POSTGRES_PASSWORD=changeme
DATABASE_URL=postgresql+asyncpg://spendly_user:changeme@db:5432/spendly

TELEGRAM_TOKEN=...
API_BASE_URL=http://api:8000

GEMINI_API_KEY=...

MONTHLY_SALARY_TARGET=95000
SAVING_TARGET_PCT=30
```

---

## Database schema

**`expenses`**
```
id           UUID PK
amount       Numeric(10,2)
description  String(500)
category     String(50)           # one of 8 categories below
source       String(20)           # 'telegram' | 'web'
created_at   DateTime TZ          # insertion timestamp (used for sorting in RecentEntries)
expense_date Date                 # parsed date from message
confirmed    Boolean default False
```

**`income_events`**
```
id           UUID PK
amount       Numeric(10,2)
source_name  String(100) default 'salary'
credited_at  DateTime TZ
month        Integer
year         Integer
```

**`savings_plans`**
```
id              UUID PK
month           Integer
year            Integer
salary_amount   Numeric(10,2)
target_save_pct Integer
allocations     JSONB    # [{instrument, amount, rationale}]
total_to_save   Numeric(10,2)
gemini_narrative Text
created_at      DateTime TZ
```

**`spend_insights`**
```
id              UUID PK
month           Integer
year            Integer
zone            String(10)    # SAFE | WARNING | DANGER
zone_score      Integer       # 0-100
saving_score    Integer       # 0-100
spend_score     Integer       # 0-100
category_data   JSONB         # {category: {spent, budget}}
action_pills    JSONB         # [string]
narrative       Text          # Gemini narrative (shown in ZoneBanner)
updated_at      DateTime TZ
```
One row per month — upserted on every new confirmed expense.

**`month_settings`**
```
id          UUID PK
month       Integer
year        Integer
salary      Numeric(10,2)
locked      Boolean default False
created_at  DateTime TZ
```
Used by the Settings page to lock a month after salary is set.

---

## Categories (10 fixed — use everywhere)

```python
CATEGORIES = [
    "Food",     # restaurants, delivery, cafes
    "Grocery",  # supermarket, kirana, online grocery
    "Travel",   # metro, auto, cab, petrol, flights
    "Family",   # school fees, gifts, kids
    "EMI",      # loan repayments, credit card minimum
    "Saving",   # PPF, SIP, FD deposits — tracked separately in invest card
    "Luxury",   # shopping, entertainment, fine dining
    "Health",   # medical, doctor, pharmacy, gym, fitness
    "House",    # rent, electricity, internet, maintenance, maid
    "Other",    # fallback
]
```

The `Saving` category is special: it is excluded from the Expense card total and from SpendInsight bars, and is summed separately for the Invest card and SavingsPanel.

---

## Multi-expense parsing

`POST /expense` accepts comma-separated input:
```
"500 food, 200 auto, 1000 grocery"
```

Flow:
1. `parse_multi(raw_text)` splits on `,` and `and` (case-insensitive)
2. Each part must contain an amount — if any part fails, falls back to single parse
3. If N > 1: all expenses inserted and confirmed in one shot, returns:
   ```json
   {"status": "multi_confirmed", "count": 3, "items": [{amount, description, category}, ...]}
   ```
4. If N == 1: standard single-expense flow (returns `pending_confirmation` for Telegram bot, auto-confirms for web)

---

## API routes (current)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/expense` | Log expense(s). Supports single and multi (comma-separated) |
| POST | `/expense/{id}/confirm` | Confirm a pending expense, triggers zone recalc |
| DELETE | `/expense/{id}` | Delete an expense |
| GET | `/expenses?month=&year=` | All confirmed expenses for month, ordered by `expense_date DESC` |
| GET | `/expenses/recent` | Latest expenses across all months, ordered by `created_at DESC` |
| GET | `/expenses/history` | Monthly summaries for Compare page (total_spent, total_saved, zone, salary per month) |
| POST | `/income` | Log salary/income, triggers savings plan generation |
| GET | `/zone` | Current month SpendInsight (calculates on the fly if missing) |
| GET | `/savings-plan?month=&year=` | Savings plan for month |
| POST | `/insights/refresh` | Force Gemini AI re-run for current month, returns fresh ZoneResponse |
| GET | `/investment-insight?month=&year=` | Gemini investment advice for Invest card modal |
| GET | `/settings?month=&year=` | Monthly settings (salary, locked state) |
| POST | `/settings` | Save salary for a month |
| POST | `/settings/restart` | Unlock a locked month |

---

## Frontend — dashboard layout (`page.tsx`)

Top to bottom:
1. **Header row** — "Dashboard" title + month label + refresh button + last-synced time
2. **Onboarding CTA** — shown only when `salary === 0`, links to `/settings`
3. **`<SavingsPanel />`** — full-width wallet overview (segmented bar: Invest / Spent / Save Goal)
4. **Left column (lg:col-span-3)**
   - `<ZoneBanner />` — zone badge + save/spend score bars + AI narrative
   - `<MonthlySpendLine />` — cumulative SVG spend chart with drag-to-resize handle
   - `<StatsCards />` — 2-card grid: Expense donut + Invest donut (tap to open modal)
5. **Right column (lg:col-span-2)**
   - `<SpendInsight />` — category bars with accordion dropdown + delete entries
   - AI Insights button → `<AiInsights />` panel
   - `<RecentEntries />` — auto-scrolling list (pauses on hover and hidden tab)
6. **`<LogBar />`** — fixed bottom input, posts to `/expense`, shows Toast notifications
7. **`<CardModal />`** — bottom-sheet modal for expense detail or invest plan + AI insight

Auto-refreshes data every 30 seconds. Zone written to `localStorage("spendly_zone")` so NavBar badge can read it without prop drilling.

---

## Frontend — other routes

**`/compare`** — Month-over-month comparison
- Line chart (pure SVG, drag-to-resize, default 320px)
- Select multiple months via pills; toggle metric lines (Spent/Saved/Salary)
- Focused month detail card below chart
- Data from `GET /expenses/history`

**`/settings`** — Monthly salary settings
- Input salary for current month → locks after save
- Locked view shows month name, summary stats
- "Restart month" unlocks (re-fetches from API after restart)

---

## Key component behaviours

**SavingsPanel**
- "Invest" segment = sum of `Saving`-category expenses
- "Spent" segment = total expenses minus Saving-category
- "Save Goal" sub-card = % of target achieved + remaining shortfall (not wallet balance — that's in header)
- Count-up animations via `useCountUp` hook (RAF, ease-out cubic)
- Bar segments spring-animate on mount via `cubic-bezier(0.34, 1.56, 0.64, 1)`

**ZoneBanner**
- Props: `zone`, `daysElapsed`, `daysInMonth`, `month`, `savingScore`, `spendScore`, `narrative`
- Shows two score progress bars (Save / Spend) when scores are available
- DANGER zone has `animate-danger-pulse` glow (defined in `globals.css`)

**StatsCards**
- Expense card: total of all non-Saving expenses, donut fill = overspend %
- Invest card: `savingTotal / investTotal` progress, donut fill = % of target met
- Donut ring animation: JS-driven via `useRef` + RAF on `pct` change

**MonthlySpendLine**
- Fixed SVG viewBox W=600, `preserveAspectRatio="none"`
- Spend line draw animation: `strokeDashoffset` RAF trick (1.2s ease-out)
- Drag handle at bottom to resize height (220px default, 70–480px range)
- Budget pace dashed line at 70% of salary

**SpendInsight**
- Excludes `Saving` category from bars
- Accordion: `max-height` CSS transition (0→500px), 300ms `cubic-bezier(0.4,0,0.2,1)`
- Two-step delete: click bin → confirm appears with `animate-fade-scale` → confirm deletes
- Left border accent when category row is expanded

**LogBar**
- `bg-indigo-600` button (consistent with app palette)
- Toast system: persistent "Parsing…" loading toast dismissed before result toast
- Multi-expense: single input `"500 food, 200 auto"` → one success toast listing all items

**RecentEntries**
- Sorted by `created_at` (insertion time), not `expense_date`
- Auto-scrolls at 25px/s; pauses on `mouseenter`, `visibilitychange`, and hidden tab

**NavBar**
- Reads `localStorage("spendly_zone")` on mount + `focus` + `storage` events
- Shows red `animate-pulse` dot on Dashboard link when zone is DANGER

**Toast**
- Types: `"success"` | `"error"` | `"loading"`
- Fixed at `bottom-20 right-4 z-[100]`
- Auto-dismiss after `duration` ms (pass `0` to keep until manually dismissed)

---

## APScheduler jobs

```python
# On boot: recalculate zone for current month (catches up if container was down)
await recalculate_zone()

# Daily at 21:00: run Gemini AI insights without waiting for an expense trigger
scheduler.add_job(_daily_ai_insights, CronTrigger(hour=21, minute=0))
```

---

## Global CSS keyframes (`globals.css`)

```css
@keyframes dangerPulse   /* red glow on DANGER zone banner, 2.5s infinite */
@keyframes fadeScale     /* pop-in for delete confirm buttons, 0.15s */
@keyframes fadeUp        /* staggered entrance for dashboard sections, 0.4s */
```

Use CSS classes `.animate-danger-pulse`, `.animate-fade-scale` — do NOT inject `<style>` tags inside component JSX.

---

## Zone calculator (`api/app/services/zone_calculator.py`)

Pure Python — no LLM. No per-category budget thresholds.

```python
saving_score = min(100, int((actually_saved / target_save_amount) * 100))

# spend_score based on total spending pace vs total spendable budget (salary × (1 - save_pct))
spend_score  = max(0, 100 - int((total_spent / (spendable * pro_rata) - 1.0) * 100))
             # 100 if total spend is on/under pace

zone:
  SAFE    → saving_score >= 70 AND spend_score >= 70
  DANGER  → saving_score < 40 OR spend_score < 40
  WARNING → everything else
```

---

## Advisor (`api/app/services/advisor.py`)

Gemini input is always anonymised — aggregated numbers only, no raw descriptions.

Output schema:
```json
{
  "narrative": "2-3 sentences, direct, mention numbers",
  "action_pills": ["3-4 items, max 8 words each"],
  "investment_suggestions": [
    {"instrument": "...", "amount": 0, "reason": "...", "liquidity": "..."}
  ]
}
```

Result cached in `spend_insights.narrative` and `action_pills`. Not re-called until next expense confirmation or manual refresh.

---

## TypeScript API types (`lib/api.ts`)

```typescript
interface ZoneResponse {
  zone: "SAFE" | "WARNING" | "DANGER";
  saving_score: number | null;
  spend_score: number | null;
  zone_score: number | null;
  narrative: string | null;
  action_pills: string[] | null;
  category_data: Record<string, { spent: number; budget: number }> | null;
  month: number;
  year: number;
}

interface SavingsPlan {
  id: string;
  month: number;
  year: number;
  salary_amount: number;
  target_save_pct: number;
  allocations: Array<{ instrument: string; amount: number; rationale?: string; reason?: string }>;
  total_to_save: number;
  gemini_narrative: string | null;
  created_at: string;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  source: string;
  created_at: string;
  expense_date: string;
  confirmed: boolean;
}

interface MonthlySummary {
  month: number;
  year: number;
  month_label: string;
  total_spent: number;
  total_saved: number;
  salary: number;
  zone: string | null;
  saving_score: number | null;
  spend_score: number | null;
}

interface InvestmentInsight {
  assessment: "GOOD" | "MODERATE" | "NEEDS_ATTENTION";
  summary: string;
  allocation_review: string | null;
  priority_action: string | null;
  action_items: string[];
}
```

---

## Code style rules

- `async`/`await` everywhere in FastAPI and SQLAlchemy. No sync DB calls.
- `Annotated` dependency injection for DB sessions in FastAPI routes.
- No bare `except:` — catch specific exceptions.
- All Gemini prompts as module-level constants, not inline strings.
- Type hints on every function signature.
- No `print()` — Python `logging` module, `INFO` level.
- Frontend: no `any` in TypeScript. No inline `<style>` tags in JSX — use `globals.css`.
- `fmt()` from `lib/utils.ts` for all currency display — do not redefine per-file.
- Button palette: `bg-indigo-600 hover:bg-indigo-700` for all primary CTAs.

---

## Error handling rules

- Every Gemini call: try/except, fallback to deterministic result with `narrative = null`.
- Every DB operation: try/except with session rollback.
- Bot never crashes on bad input — always replies with a rephrasing hint.
- `DATABASE_URL` missing → fail fast at startup with clear log message.
- Frontend: every data-fetching component handles `initialLoading`, `error`, and empty states.

---

## Seed data

`api/seed_data.py` seeds dummy expense data for May and June 2026.

Run: `docker compose exec api python seed_data.py`

---

## Definition of done (Phase 1 — complete)

1. ✅ `docker compose up --build` starts all 5 services (db, api, bot, frontend, pgadmin)
2. ✅ Telegram: "spent 480 swiggy dinner" → confirmation → ✅ → in DB
3. ✅ Telegram: "salary 95000 credited" → savings plan → visible on dashboard
4. ✅ Dashboard shows zone banner (with scores + narrative), wallet overview, spend chart, category bars
5. ✅ Multi-expense: "500 food, 200 auto" → two entries logged in one message
6. ✅ Delete entries from SpendInsight accordion (two-step confirm)
7. ✅ Compare tab shows month-over-month line chart
8. ✅ Settings page with salary lock/restart mechanic
9. ✅ pgAdmin at localhost:5050 connected to Spendly DB
10. ✅ `docker compose down && docker compose up` retains all data
