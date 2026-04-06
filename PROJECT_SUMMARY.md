# Buzzwoo Songkran — Project Summary

## Overview

Real-time party game web app สำหรับเทศกาลสงกรานต์ เล่นผ่านจอ TV/laptop (host) โดยผู้เล่นเข้าร่วมผ่านมือถือด้วย QR code รองรับ 1–20+ คน

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5, React Router 6 |
| Styling | TailwindCSS 3, Framer Motion 11 |
| Backend/Realtime | Supabase (Postgres + Realtime Broadcast) |
| Deployment | Vercel |
| QR Code | qrcode.react |

## Routes

| Path | Description |
|------|-------------|
| `/host` | Host screen แสดงบน TV/laptop — ควบคุม game lifecycle |
| `/join/:roomId` | Mobile player view — ผู้เล่นเข้าร่วมผ่านมือถือ |
| `/` | Redirect ไป `/host` |

## Game Modes

### 1. RPS Bracket Tournament
- เกมเป่ายิ้งฉุบแบบ bracket tournament
- Random shuffle ทุก round, คนเลขคี่ได้ bye
- Reveal flow: คำนวณ local → animation 1.8s → commit DB

### 2. Quiz Mode
- 4-zone arena quiz — ผู้เล่นเดินไปยังโซนคำตอบที่คิดว่าถูก
- รองรับ 1+ คน
- Key files: `QuizZones.jsx`, `QuizHostView.jsx`, `quizQuestions.js`

## Arena System

- Logical world 800×450 px พร้อม scaling
- Pixel-art characters (16×16 SVG) — 8 Songkran palettes, 4 directions × 4 walk frames
- HP bar + water projectiles (space bar / shoot button)
- Physics: collision detection, MOVE_SPEED 150 px/sec
- Joystick control บนมือถือ

## Project Structure

```
src/
├── pages/
│   ├── HostPage.jsx          # Game lifecycle orchestrator
│   └── JoinPage.jsx          # Mobile player view
├── components/
│   ├── host/
│   │   ├── CreateRoom.jsx    # Room creation
│   │   ├── Lobby.jsx         # Lobby + QR + player list
│   │   ├── BracketView.jsx   # RPS bracket display
│   │   ├── QuizHostView.jsx  # Quiz mode host view
│   │   └── HostChampionScreen.jsx
│   ├── mobile/
│   │   ├── JoinForm.jsx      # Player join form
│   │   ├── PickScreen.jsx    # RPS weapon selection
│   │   └── MobileChampionScreen.jsx
│   ├── arena/
│   │   ├── Arena.jsx         # Main arena component
│   │   ├── Character.jsx     # Player character wrapper
│   │   ├── PixelSprite.jsx   # Pixel-art sprite renderer
│   │   ├── QuizZones.jsx     # Quiz answer zones
│   │   └── Joystick.jsx      # Mobile joystick control
│   └── ThaiDecor.jsx         # Songkran themed decorations
├── hooks/
│   ├── useRoom.js            # Room state subscription
│   ├── usePlayers.js         # Player list subscription
│   ├── useMatches.js         # Match data subscription
│   ├── useArena.js           # Broadcast player positions
│   └── useKeyboard.js        # Keyboard input
├── lib/
│   ├── supabase.js           # Supabase client
│   ├── gameLogic.js          # resolveChoice, createBracketPairs, WEAPONS
│   ├── quizQuestions.js      # Quiz question bank
│   └── arena/
│       └── physics.js        # World constants, collision detection
├── App.jsx                   # Router setup
└── main.jsx                  # Entry point
```

## Supabase Tables

- `rooms` — room state (status, current_round, game_mode)
- `players` — player info per room
- `matches` — match records for RPS bracket

## Realtime Pattern

ทุก hook สร้าง named Supabase channel, subscribe `postgres_changes`, แล้ว re-fetch full row set ทุกครั้ง (ไม่ใช้ optimistic updates)

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Game Flow

```
idle → create room → lobby (arena + QR) → select mode → playing → champion → play again / back to lobby
```

## Repository

- GitHub: `iwillcode29/songkarn`
- Deploy: Vercel (auto-deploy from main)
