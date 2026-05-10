# VALO COACH — Data Schema & ER Diagram
> ไฟล์นี้ define ตัวแปรทั้งหมดในระบบ เพื่อให้ทีม/AI เข้าใจโครงสร้างข้อมูลก่อนเขียน code

---

## Entity Relationship Overview

```
[Henrik API]
     │
     ▼
[MatchData] ──contains──► [PlayerRaw]     ──ability_casts──► AbilityCasts
                 │          ──stats──────►  StatSummary
                 │          ──rounds──────► [RoundData]
                 │                              │
                 │                    ──player_stats──► [RoundPlayerStat]
                 │                                          ──kill_events──► [KillEvent]
                 │                                          ──damage_events──► [DamageEvent]
                 │
                 └──metadata──► MatchMeta
                 └──teams──────► TeamResult

     ▼ parsePlayerStats()
[PlayerStats]  (computed, per-player)
     │
     ├──► [MultiKills]
     ├──► [Clutches]
     ├──► [WeaponStats]
     ├──► [AbilityCastsSummary]
     ├──► [Achievement[]]   ◄── assignAchievements()
     └──► [AIReport]        ◄── getStructuredAnalysis()

     ▼ to client
[ClientStats]  (stripped of internal fields)
```

---

## Entity Definitions

### 1. MatchData (from Henrik API v3)
```
MatchData {
  metadata: MatchMeta
  players: {
    all_players: PlayerRaw[]
  }
  teams: {
    red:  TeamResult
    blue: TeamResult
  }
  rounds: RoundData[]
}
```

### 2. MatchMeta
```
MatchMeta {
  matchid:  String    // unique match ID, used for shared game detection
  map:      String    // e.g. "Bind", "Haven"
  game_start: Number  // unix timestamp
  mode:     String    // e.g. "Competitive"
}
```

### 3. PlayerRaw (Henrik API player object)
```
PlayerRaw {
  name:   String          // Riot name (without tag)
  tag:    String          // Riot tag (without #)
  team:   "Red" | "Blue"
  character: String       // Agent name e.g. "Jett"
  
  stats: StatSummary
  damage_made: Number     // total damage dealt in match
  
  ability_casts: AbilityCasts   // end-of-match summary
}
```

### 4. StatSummary
```
StatSummary {
  kills:      Number
  deaths:     Number
  assists:    Number
  headshots:  Number    // total headshot shots
  bodyshots:  Number
  legshots:   Number
  score:      Number    // combat score
}
```

### 5. AbilityCasts (end-of-game summary)
```
AbilityCasts {
  c_cast: Number    // C ability uses
  q_cast: Number    // Q ability uses (often flash/utility)
  e_cast: Number    // E ability uses (often heal/signature)
  x_cast: Number    // X (ultimate) uses
}
```

### 6. TeamResult
```
TeamResult {
  has_won:       Boolean
  rounds_won:    Number
  rounds_lost:   Number
}
```

### 7. RoundData
```
RoundData {
  winning_team: String
  player_stats: RoundPlayerStat[]
}
```

### 8. RoundPlayerStat
```
RoundPlayerStat {
  player_display_name: String    // "Name#TAG" format
  kills:               Number    // kills in this round (used for multi-kill)
  kill_events:         KillEvent[]
  damage_events:       DamageEvent[]
}
```

### 9. KillEvent
```
KillEvent {
  kill_time_in_round:       Number  // ms
  killer_display_name:      String  // "Name#TAG"
  victim_display_name:      String  // "Name#TAG"
  damage_weapon_name:       String  // weapon used e.g. "Vandal", "Operator"
}
```

### 10. DamageEvent
```
DamageEvent {
  bodyshots:  Number
  headshots:  Number
  legshots:   Number
  damage:     Number
}
```

---

## Computed Entities (coach.js output)

### 11. PlayerStats (output of parsePlayerStats)
```
PlayerStats {
  // Identity
  name:             String    // "Name#TAG"
  agent:            String    // most played agent in 3 games
  agent_image:      String?   // URL from valorant-api.com

  // Aggregate averages (across 3 games)
  kills:            Number    // avg kills/game
  deaths:           Number    // avg deaths/game
  assists:          Number    // avg assists/game
  kd:               String    // totalKills/totalDeaths, 2 decimals
  headshot_percent: Number    // % headshots of all shots
  damage_made:      Number    // avg damage/game

  // Match record
  wins:             Number    // games won
  total_games:      Number    // = 3 (or fewer if API returns less)
  winrate:          Number    // percentage

  // Combat breakdown
  multi_kills:      MultiKills
  clutches:         Clutches
  weapon_stats:     WeaponStats?
  ability_casts:    AbilityCastsSummary

  // Achievements + AI
  achievements:     Achievement[]
  ai_report:        AIReport?

  // Internal (stripped before sending to client)
  match_ids:        String[]
  per_game_kd:      Number[]
  per_game_kills:   Number[]
  botfrag_count:    Number    // times lowest KD in group
}
```

### 12. MultiKills
```
MultiKills {
  "2k": Number    // rounds with exactly 2 kills
  "3k": Number    // rounds with exactly 3 kills
  "4k": Number    // rounds with exactly 4 kills
  "ace": Number   // rounds with 5+ kills
}
```

### 13. Clutches
```
Clutches {
  "1v2": Number   // won as last alive vs 2 enemies
  "1v3": Number   // won as last alive vs 3 enemies
  "1v4": Number   // won as last alive vs 4 enemies
  "1v5": Number   // won as last alive vs 5 enemies
}
```

### 14. WeaponStats
```
WeaponStats {
  primary_weapon:     String?    // most kills with
  weapon_kills:       { [weaponName: String]: Number }
  total_weapon_kills: Number
  flags: {
    is_operator: Boolean    // >= 2 OP kills
    is_sniper:   Boolean    // >= 2 sniper kills total
    uses_rifle:  Boolean    // >= 40% kills from Vandal/Phantom
  }
}
```

### 15. AbilityCastsSummary (computed)
```
AbilityCastsSummary {
  c:        Number    // total C ability casts across all games
  q:        Number    // total Q ability casts
  e:        Number    // total E ability casts
  x:        Number    // total ultimate casts
  total:    Number    // c+q+e+x
  per_game: Number    // avg (c+q+e) per game (excl. ult)
}
```

### 16. Achievement
```
Achievement {
  id:             String    // "ACH001"–"ACH018"
  name:           String    // displayed to user (Thai phrase)
  dialogue:       String    // character line (may be empty)
  trigger_reason: String    // why this triggered (data-backed)
}
```

### 17. AIReport (from Claude Sonnet)
```
AIReport {
  name:   String
  playstyle: {
    name:     String    // e.g. "Aggressive Duelist"
    because:  String    // stat reference
    meaning:  String    // game impact
    tendency: String    // "คุณมีแนวโน้มที่จะ..."
  }
  strong_points: Array<{
    name:     String
    because:  String
    meaning:  String
    tendency: String
  }>
  weak_points: Array<{
    name:     String
    because:  String
    meaning:  String
    tendency: String
  }>
  improve: String    // 1-2 sentence coaching tip
}
```

### 18. SharedGames
```
SharedGames {
  shared_count:   Number    // how many of 3 matches were played together
  together_label: String    // e.g. "ทั้ง 3 แมชเล่นด้วยกันหมดเลย 🔥"
}
```

---

## API Response Schema

### POST /api/coach
```
Request {
  players: String[]    // 1-3 "Name#TAG" strings
}

Response 200 {
  stats:           ClientStats[]
  shared_games:    SharedGames
  team_analysis:   String?         // AI team analysis text
  quota_remaining: Number
}

Response 429 {
  error:           "limit"
  message:         String
  quota_remaining: 0
}

Response 500 {
  error:  String
  detail: String?    // only in dev/test
}
```

### GET /api/quota
```
Response 200 {
  quota_remaining: Number
  test_mode:       Boolean?    // true in dev
}
```

---

## Redis Key Schema
```
Key:   valo:rl:{ip}:{base64(userAgent)[0:20]}
Type:  String (integer count)
TTL:   86400 seconds (1 day)
Limit: 3 per day (production)
```

---

## Data Flow Summary

```
User Input → [index.html]
     │ POST /api/coach { players: ["Name#TAG", ...] }
     ▼
[api/coach.js]
     ├── 1. Pre-check Redis quota (read-only)
     ├── 2. Fetch Henrik API × N players  ──────────────► Henrik API
     ├── 3. Fetch agent images (cached)   ──────────────► valorant-api.com
     ├── 4. parsePlayerStats() × N
     │       ├── parseMultiKills(rounds)
     │       ├── detectClutches(rounds)
     │       ├── parseWeaponStats(rounds)
     │       └── collect ability_casts from match summary
     ├── 5. assignBotfragCounts() (group only)
     ├── 6. assignAchievements() (solo + group)
     ├── 7. getStructuredAnalysis() ────────────────────► Claude Sonnet API
     ├── 8. Increment Redis quota (AFTER success)
     └── 9. Return ClientStats[]

[index.html]
     ├── buildPlayerSlide(s) × N
     └── buildTeamSlide(stats, teamAnalysis, sharedGames)
```

---

## Achievement Trigger Rules (Quick Ref)

| ID | Trigger | Group? | Data Source |
|----|---------|--------|-------------|
| ACH001 | deaths = max(group) AND deaths > avg*1.15 | ✅ | henrik stats |
| ACH002 | ability_casts.per_game > 14 AND assists < avg*0.75 | optional | ability_casts |
| ACH003 | kd >= 1.2 AND hs% >= 25 | ❌ | henrik stats |
| ACH004 | agent ∈ [Viper/Phoenix/Astra/Veto/Yoru] | ❌ | henrik stats |
| ACH005 | multi_kills.3k >= 2 | ❌ | rounds |
| ACH006 | kd = min(group) AND gap >= 0.3 | ✅ | henrik stats |
| ACH007 | multi_kills.ace >= 2 | ❌ | rounds |
| ACH009 | agent ∈ [Skye/Sage] AND per_game > 10 | ❌ | ability_casts |
| ACH010 | agent ∈ [Skye/Sage] AND per_game < 4 | ❌ | ability_casts |
| ACH011 | agent = Sage AND x_cast >= 2 | ❌ | ability_casts |
| ACH012 | kills > avg AND deaths > avg AND kd < 1 | ✅ | henrik stats |
| ACH013 | kills = max AND kd >= 1.5 AND deaths <= avg | ✅ | henrik stats |
| ACH014 | lowest in >= 2 of [K/D/A] | ✅ | henrik stats |
| ACH015 | ability_casts.per_game < 4 (non-healer) | ❌ | ability_casts |
| ACH016 | (1v3+1v4+1v5) >= 3 | ❌ | rounds |
| ACH017 | per_game_kills.max >= 40 | ❌ | rounds |
| ACH018 | botfrag_count >= 2 | ✅ | per_game_kd |
