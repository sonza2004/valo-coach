# VALO COACH — Report Structure Spec
> ไฟล์นี้คือ preview โครงสร้างรายงานก่อน implement จริง
> แก้ไขได้ตามใจ แล้วบอกให้ปรับ code ตาม

---

## โครงสร้างทั้งหมด (per player slide)

```
┌─────────────────────────────────────┐
│  [Agent Icon]  Name#tag             │
│                Agent  |  W/L  WR%   │
├─────────────────────────────────────┤
│  ACHIEVEMENTS                        │
│  ┌── Achievement Badge ──┐           │
│  │ 🏆 [Achievement Name] │           │
│  │ "[dialogue/quote]"    │           │
│  │ → trigger reason      │           │
│  └───────────────────────┘           │
├─────────────────────────────────────┤
│  STAT FACTS (hard data)             │
│  HS%   ADR   KD   KDA               │
│  Winrate  Damage                     │
│  [Multi-Kill Section — if any]      │
│   2K · 3K · 4K · ACE                │
│   2K Clutch · 3K Clutch · ...       │
├─────────────────────────────────────┤
│  PLAYSTYLE                          │
│  [Playstyle Name]                   │
│  เพราะ [stat] → ซึ่งหมายความว่า... │
│  คุณมีแนวโน้มที่จะ...              │
├─────────────────────────────────────┤
│  STRONG POINTS (2-3 จุด)           │
│  + [Trait Name]                     │
│    เพราะ [stat] → ...              │
│    คุณมีแนวโน้มที่จะ...            │
│  + [Trait Name]                     │
│    ...                              │
├─────────────────────────────────────┤
│  WEAK POINTS (1-2 จุด)             │
│  - [Trait Name]                     │
│    เพราะ [stat] → ...              │
│    คุณมีแนวโน้มที่จะ...            │
├─────────────────────────────────────┤
│  WHAT TO IMPROVE                    │
│  [คำแนะนำรายบุคคล 1-2 ข้อ]        │
└─────────────────────────────────────┘
```

---

## Data Source Map

| Section | แหล่งข้อมูล | v1 Ready |
|---------|------------|----------|
| Achievement badges | Code (rule-based จาก stats) | ✅ |
| Achievement trigger reason | Template string + stat value | ✅ |
| HS%, ADR, KD, KDA | Henrik API JSON | ✅ |
| Multi-kill (2k/3k/4k/ACE) | Henrik rounds data | ✅ |
| Clutch (2k/3k/4k/5k clutch) | Henrik rounds — complex calc | ❌ v2 |
| Damage taken per alive round | Henrik rounds — complex calc | ❌ v2 |
| Playstyle name + description | Claude AI (structured prompt) | ✅ |
| Strong/Weak points | Claude AI (structured prompt) | ✅ |
| What to improve | Claude AI (structured prompt) | ✅ |

---

## Mock Preview — ตัวอย่างรายงานจริง

> ด้านล่างคือตัวอย่างว่ารายงานจะออกมาหน้าตาแบบไหน
> ใช้ข้อมูลสมมติ — แก้ตรงนี้ถ้าอยากเปลี่ยน format

---

### SLIDE 1 — ZyklonHCN#A1940

---

**🎮 ZyklonHCN#A1940**
Jett &nbsp;|&nbsp; 2W / 1L &nbsp;|&nbsp; 67% WR

---

**🏆 ACHIEVEMENTS**

> **เดี๋ยวกูยิงเป็นทิคแทคโทเลย**
> *(ทำ 3K ใน 1 รอบ ถึง 3 ครั้งใน 3 เกม)*

> **จะมีก็มีอยู่แผลเดียวเนี่ย ที่ไหล่**
> *"เมาตกรถเมล์ แถ แท่ดๆ ร้องหยั่งหมา"*
> *(คิลสูงสุดในทีม 18K/5D — KD 3.60)*

---

**📊 STAT FACTS**

| | ค่าเฉลี่ย 3 เกม |
|--|--|
| KDA | 18 / 5 / 4 |
| KD | **3.60** 🟢 |
| HS% | **34%** 🟡 |
| ADR | 287 |
| Winrate | 67% |

**Multi-Kill** (รวม 3 เกม)
🔥 2K × 5 &nbsp; ✅ 3K × 3 &nbsp; 💜 4K × 1

---

**🎯 PLAYSTYLE — Aggressive Duelist**

HS% 34% + KD 3.60 + kills สูงสุดในทีม → บ่งบอกว่าเล่นสไตล์เข้าหาศัตรูตลอด เน้นยิงหัว ไม่รอให้ใครเปิดไปก่อน

*คุณมีแนวโน้มที่จะเป็นคนเข้าไซท์คนแรก และคาดหวังให้ทีมตาม — บางครั้งอาจเร็วเกินไป*

---

**💪 STRONG POINTS**

**Mechanical Aim**
KD 3.60 + HS% 34% → ความสามารถในการยิงอยู่ระดับสูงมาก ยิงได้ทั้งก่อนคู่ต่อสู้และมีความแม่นยำสูง
*คุณมีแนวโน้มที่จะชนะ duel 1v1 ส่วนใหญ่ และเป็น main entry fragger ที่น่ากลัว*

**Clutch Potential**
3K × 3 ครั้ง → มีความสามารถในการล้างในสถานการณ์กดดัน
*คุณมีแนวโน้มที่จะ perform ดีขึ้นเมื่อ situation tight*

---

**⚠️ WEAK POINTS**

**Low Assist Rate**
Assists เฉลี่ย 4 (ต่ำสุดในทีม) → เล่นเป็น solo fragger มากเกินไป ไม่ค่อย setup หรือ flash ให้ทีม
*คุณมีแนวโน้มที่จะได้คิลเยอะ แต่ทีมไม่ได้ประโยชน์จากคุณในแง่ utility*

---

**📈 WHAT TO IMPROVE**

ลองฝึก flash ให้ teammate ก่อนเข้าไซท์ แทนที่จะ dry peek คนเดียว — ด้วย HS% ระดับนี้คุณไม่จำเป็นต้องเป็นคนยิงทุกคนเอง การ setup ให้ทีมจะทำให้ winrate สูงขึ้นโดยตรง

---
---

### SLIDE 4 — ทีม (Team View)

---

**⚡ โค้ชโหด — Team Analysis**

🔥 ทั้ง 3 แมชเล่นด้วยกันหมดเลย

| | ZyklonHCN | littlemxi | Yuji |
|--|--|--|--|
| Agent | Jett | Skye | Sage |
| KD | 3.60 | 0.85 | 1.12 |
| Role | Duelist | Initiator | Sentinel |

*[AI analysis text ที่นี่]*

---

## ประเด็นที่ต้องคุยก่อน implement

### 1. Achievement → Trigger Reason (user เห็นไหม?)
ตอนนี้แสดงแค่ชื่อ achievement + dialogue
**ควรเพิ่ม:** เหตุผลที่ trigger เช่น "เพราะคุณตาย 12 ครั้ง (สูงสุดในทีม)"

```
ตัวเลือก A — แสดงเหตุผลใต้ achievement ทันที
ตัวเลือก B — ซ่อนไว้ กด expand ดูได้
ตัวเลือก C — ไม่แสดง (แค่ badge เฉยๆ)
```

### 2. Playstyle / Strong / Weak — structured หรือ free-form?
ตอนนี้ AI generate เป็น free text ทั้งหมด

**ตัวเลือก A — Structured (แนะนำ v1)**
AI return JSON ตาม schema แล้ว frontend render เอง:
```json
{
  "playstyle": {
    "name": "Aggressive Duelist",
    "because": "KD 3.60 + HS% 34%",
    "meaning": "เล่นสไตล์เข้าหาศัตรูตลอด",
    "tendency": "คุณมีแนวโน้มที่จะ..."
  },
  "strong_points": [...],
  "weak_points": [...],
  "improve": "..."
}
```

**ตัวเลือก B — Free-form (ง่ายกว่า แต่ควบคุมยาก)**
AI เขียน text ยาวๆ แล้วแสดง as-is

### 3. Clutch & Damage Taken — v1 skip ไหม?
ข้อมูลนี้ต้องการ round-by-round parsing ซับซ้อน
```
ตัวเลือก A — skip v1 แสดง placeholder "Coming Soon"
ตัวเลือก B — ทำเลย ใช้เวลาเพิ่มอีก 1-2 วัน
```

### 4. Multi-kill section แสดงเฉพาะตอนที่มีไหม?
```
ตัวเลือก A — แสดงเสมอ (ถ้าไม่มีแสดง 0)
ตัวเลือก B — ซ่อนถ้าไม่มีเลย (cleaner)
```

---

## คำถามที่ต้องการ input จากซัน

1. **Achievement trigger reason** — เลือก A/B/C?
2. **AI output format** — Structured JSON หรือ free text?
3. **Clutch/Damage taken** — v1 skip หรือทำเลย?
4. **Multi-kill** — แสดงเสมอหรือซ่อนถ้าไม่มี?
5. **Tone ของ AI** — ยังอยากได้ "โค้ชโหด" แบบเดิมไหม หรืออยากปรับ?

---

*อ่านแล้วตอบในแชทได้เลย จะ implement ตามที่ตกลงกัน*
