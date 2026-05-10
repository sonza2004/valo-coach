# VALO COACH — Henrik API Variable Reference
> สร้างจาก achievement-spec.xlsx / variable tab — อ่านไฟล์นี้ก่อนเขียน code ที่ใช้ Henrik data

---

## Player Object — `match.players.all_players[]`

| # | Variable Path (JSON) | Example Value | Meaning | ใช้ใน |
|---|---------------------|---------------|---------|--------|
| 1 | `puuid` | `"b85399d1-c749-54b5-..."` | Player UUID | identity |
| 2 | `name` | `"rico86"` | ชื่อ Riot (ไม่มี #) | identity |
| 3 | `tag` | `"1738"` | Riot tag (ไม่มี #) | identity |
| 4 | `team` | `"Blue"` | สีทีม Blue/Red | team split |
| 5 | `character` | `"Sova"` | ชื่อ agent | achievement |
| 6 | `currenttier_patched` | `"Bronze 2"` | rank string | display |
| 7 | `behavior.afk_rounds` | `0.0` | รอบที่ afk | playstyle |
| 8 | `behavior.friendly_fire.incoming` | `0` | ดาเมจที่ถูกยิงจากเพื่อน | ACH013 |
| 9 | `behavior.friendly_fire.outgoing` | `0` | ดาเมจที่ยิงใส่เพื่อน | ACH019 |
| 10 | `ability_casts.x_cast` | `0` | จำนวนใช้ ultimate (X) | ACH011 |
| 11 | `ability_casts.e_cast` | `0` | จำนวนใช้ E ability | ACH009/010 |
| 12 | `ability_casts.q_cast` | `0` | จำนวนใช้ Q ability (flash สำหรับหลาย agent) | ACH002 |
| 13 | `ability_casts.c_cast` | `0` | จำนวนใช้ C ability | general |
| 14 | `stats.score` | `5345` | combat score | general |
| 15 | `stats.kills` | `17` | kill รวมทั้งเกม | ACH001/005/006/012/013/017 |
| 16 | `stats.deaths` | `18` | death รวมทั้งเกม | ACH001/006/012/013 |
| 17 | `stats.assists` | `9` | assist รวมทั้งเกม | ACH002/014 |
| 18 | `stats.bodyshots` | `47` | นัดที่ยิงเข้าตัว | HS% calc |
| 19 | `stats.headshots` | `10` | นัดที่ยิงเข้าหัว | HS% calc |
| 20 | `stats.legshots` | `7` | นัดที่ยิงเข้าขา | HS% calc |
| 21 | `economy.spent.average` | `2558.333` | เงินที่ใช้ซื้อของเฉลี่ยต่อรอบ | ACH003 |
| 22 | `economy.loadout_value.average` | `3372` | มูลค่า loadout เฉลี่ย | ACH003 |
| 23 | `damage_made` | `3675` | ดาเมจที่ทำได้ทั้งเกม | ADR calc |
| 24 | `damage_received` | `3155` | ดาเมจที่ได้รับทั้งเกม ✅ Available! | ACH008 |

---

## Kill Events — `rounds[r].player_stats[p].kill_events[]`

| Variable Path | Example | Meaning |
|--------------|---------|---------|
| `kill_time_in_round` | `34522` | เวลาที่คิลในรอบ (ms) |
| `kill_time_in_match` | `351077` | เวลาที่คิลในแมช (ms) |
| `killer_display_name` | `"PeepoStyle#2400"` | ชื่อคนฆ่า (Name#TAG) |
| `victim_display_name` | `"svckers#nnnn"` | ชื่อคนโดนฆ่า (Name#TAG) |
| `victim_death_location.x` | `4518` | พิกัด X ที่คนโดนตาย |
| `victim_death_location.y` | `5844` | พิกัด Y ที่คนโดนตาย |
| `damage_weapon_name` | `"Spectre"` | ปืนที่ใช้ยิง |
| `secondary_fire_mode` | `false` | ใช้ zoom หรือไม่ |
| `player_locations_on_kill[].player_display_name` | `"Name#TAG"` | ผู้เล่นที่บันทึกตำแหน่ง |
| `player_locations_on_kill[].location.x` | `4801` | พิกัด X |
| `player_locations_on_kill[].location.y` | `4743` | พิกัด Y |

---

## Damage Events — `rounds[r].player_stats[p].damage_events[]`

| Variable Path | Example | Meaning |
|--------------|---------|---------|
| `damage` | `278` | ดาเมจที่ใช้ในการคิลรายครั้ง |
| `headshots` | `0` | เข้าหัวกี่นัด |
| `bodyshots` | `5` | เข้าตัวกี่นัด |
| `legshots` | `1` | เข้าขากี่นัด |

---

## ability_casts Mapping (per agent class)

| Ability Key | Slot | Flash agents | Healer agents | Others |
|-------------|------|-------------|---------------|--------|
| `q_cast` | Q | Phoenix, Breach, Skye, KAY/O, Yoru | Skye (flash) | ส่วนใหญ่ |
| `e_cast` | E | — | Sage (barrier), Skye (trailblazer) | signature |
| `x_cast` | X (ult) | ทุกตัว | ทุกตัว (Sage ult=revive) | ultimate |
| `c_cast` | C | — | — | tactical/deployable |

> **ACH002 proxy**: ใช้ `q_cast` เป็น proxy สำหรับ flash เนื่องจาก flash ส่วนใหญ่อยู่บน Q
> **ACH009/010**: ใช้ `e_cast` สำหรับ Sage/Skye (signature heal/support)
> **ACH011**: ใช้ `x_cast` สำหรับ Sage ult

---

## Important Notes

1. `damage_received` **มีอยู่ใน Henrik API** (ยืนยันจาก variable tab) → ใช้ได้ใน ACH008
2. `friendly_fire.incoming/outgoing` **มีอยู่** ใน `behavior` object
3. `economy.spent.average` และ `loadout_value.average` **มีอยู่** → ใช้ได้ใน ACH003
4. `ability_casts` อยู่ที่ระดับ **match summary** (ไม่ต้องดูใน rounds) → เร็วกว่า
5. ชื่อ player ใน kill_events ใช้รูปแบบ `"Name#TAG"` (มี # รวมอยู่ด้วย)
