const Anthropic = require('@anthropic-ai/sdk');
const { Redis } = require('@upstash/redis');

// =============================================================================
// MODULE: Stats Fact Builder
// Purpose: Convert raw Henrik API match data into structured player stats
// =============================================================================
const { buildPlayerFacts, assignBotfragCounts } = require('./statsFacts');
const ACHIEVEMENTS = require('./achievements');

// =============================================================================
// MODULE: Service Singletons
// Purpose: Lazy-init Redis + Anthropic clients
// =============================================================================
let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

// =============================================================================
// MODULE: Valorant Agent Images (cached)
// Purpose: Fetch agent icons for client display
// =============================================================================
let agentImageCache = null;
async function getAgentImages() {
  if (agentImageCache) return agentImageCache;
  const MAX_RETRIES = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true', {
        timeout: 5000,
      });
      
      if (!res.ok) {
        throw new Error(`Valorant API returned ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid API response: missing data array');
      }
      
      const map = {};
      for (const a of data.data) {
        map[a.displayName.toLowerCase()] = a.displayIconSmall;
      }
      agentImageCache = map;
      console.log(`[getAgentImages] Cached ${Object.keys(map).length} agents`);
      return map;
    } catch (e) {
      lastError = e;
      console.error(`[getAgentImages] Attempt ${attempt}/${MAX_RETRIES} failed:`, e.message);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  
  console.error('[getAgentImages] All retries exhausted:', lastError);
  return {};
}

// =============================================================================
// MODULE: Henrik API (matches)
// Purpose: Fetch latest match data for a Riot ID
// =============================================================================
async function fetchPlayerMatches(name, tag) {
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 8000;
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `https://api.henrikdev.xyz/valorant/v3/matches/ap/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const res = await fetch(url, {
        headers: { Authorization: HENRIK_API_KEY },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(`Rate limited (429). Retry in ${res.headers.get('retry-after') || '30s'}`);
        }
        throw new Error(`Henrik API error ${res.status}`);
      }
      
      const data = await res.json();
      console.log(`[fetchPlayerMatches] Success for ${name}#${tag}`);
      return data;
    } catch (e) {
      lastError = e;
      console.error(`[fetchPlayerMatches] Attempt ${attempt}/${MAX_RETRIES} for ${name}#${tag}:`, e.message);
      if (attempt < MAX_RETRIES && e.message.includes('Rate limited')) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      } else if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  
  throw new Error(`Failed to fetch ${name}#${tag}: ${lastError?.message}`);
}

// =============================================================================
// MODULE: Shared Match Detection
// Purpose: Detect whether players were in the same match(es)
// =============================================================================
function detectSharedGames(allMatchIds) {
  if (allMatchIds.length < 2) return { shared_count: 0, together_label: 'solo analysis' };
  let shared = new Set(allMatchIds[0]);
  for (let i = 1; i < allMatchIds.length; i++) {
    shared = new Set([...shared].filter(id => new Set(allMatchIds[i]).has(id)));
  }
  const count = shared.size;
  return {
    shared_count: count,
    together_label: count >= 1 ? 'เล่นด้วยกันในแมชนี้ 🔥' : 'เล่นคนละแมช — วิเคราะห์ solo stats',
  };
}

// =============================================================================
// MODULE: Achievements Engine
// Purpose: Assign achievement badges based on derived stats (solo/group aware)
// =============================================================================
function assignAchievements(allFacts) {
  const group    = allFacts;
  const hasGroup = group.length >= 2;

  const avgFlash = hasGroup ? group.reduce((s, p) => s + p.flash_casts, 0) / group.length : 0;
  const derived  = {
    hasGroup,
    avgDeaths:    hasGroup ? group.reduce((s, p) => s + p.deaths,              0) / group.length : 0,
    avgKills:     hasGroup ? group.reduce((s, p) => s + p.kills,               0) / group.length : 0,
    avgAssists:   hasGroup ? group.reduce((s, p) => s + p.assists,             0) / group.length : 0,
    avgCasts:     hasGroup ? group.reduce((s, p) => s + p.ability_casts.total, 0) / group.length : 0,
    avgEconSpent: hasGroup ? group.reduce((s, p) => s + p.economy.avg_spent,   0) / group.length : 0,
    avgFlash,
    kdValues: hasGroup ? group.map(p => parseFloat(p.kd)) : [],
    sortedKd: hasGroup ? [...group.map(p => parseFloat(p.kd))].sort((a, b) => a - b) : [],
  };

  group.forEach(player => {
    player.achievements = ACHIEVEMENTS
      .filter(ach => {
        if (ach.groupOnly && !hasGroup) return false;
        try   { return ach.condition(player, group, derived); }
        catch (e) { console.error(`ACH ${ach.id} error:`, e.message); return false; }
      })
      .map(ach => ({
        id:             ach.id,
        name:           ach.name,
        dialogue:       ach.dialogue,
        trigger_reason: ach.reason(player, group, derived),
      }));
  });

  return group;
}

// =============================================================================
// MODULE: AI Analysis (Anthropic)
// Purpose: Produce structured JSON analysis for each player + team
// =============================================================================
function normalizePlayerKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/#/g, '');
}

function extractJsonCandidate(raw) {
  if (!raw) return '';

  // Prefer fenced JSON if the model outputs it.
  const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (mdMatch) return mdMatch[1].trim();

  // Otherwise, find the first balanced {...} block.
  const first = raw.indexOf('{');
  if (first === -1) return raw.trim();

  let depth = 0;
  for (let i = first; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.substring(first, i + 1).trim();
    }
  }

  // Fallback: best-effort substring using last '}'
  const last = raw.lastIndexOf('}');
  if (last > first) return raw.substring(first, last + 1).trim();
  return raw.trim();
}

function tryParseJson(jsonStr) {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Common model formatting issue: trailing commas in objects/arrays.
    const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function formatStatsText(facts) {
  return facts.map(s => {
    const mk  = s.multi_kills;
    const cl  = s.clutches;
    const ws  = s.weapon_stats;
    const ac  = s.ability_casts;
    const mkStr = [mk['2k']>0&&`${mk['2k']}x 2K`, mk['3k']>0&&`${mk['3k']}x 3K`,
                   mk['4k']>0&&`${mk['4k']}x 4K`, mk['ace']>0&&`${mk['ace']}x ACE`]
                  .filter(Boolean).join(', ') || 'none';
    const clStr = [cl['1v2']>0&&`${cl['1v2']}x 1v2`, cl['1v3']>0&&`${cl['1v3']}x 1v3`,
                   cl['1v4']>0&&`${cl['1v4']}x 1v4`, cl['1v5']>0&&`${cl['1v5']}x 1v5`]
                  .filter(Boolean).join(', ') || 'none';
    return `Player: ${s.name} (${s.agent})
W/L: ${s.wins}W/${s.total_games - s.wins}L | KDA: ${s.kills}/${s.deaths}/${s.assists} | KD: ${s.kd} | HS%: ${s.headshot_percent}% | DMG: ${s.damage_made} | DMG_RCV: ${s.damage_received}
Multi-kill: ${mkStr} | Clutch: ${clStr} | Weapon: ${ws?.primary_weapon || 'unknown'} | Ability casts/game: ${ac.per_game}
Economy avg_spent: ${s.economy.avg_spent} | avg_loadout: ${s.economy.avg_loadout}
FF outgoing: ${s.friendly_fire.outgoing} | FF incoming: ${s.friendly_fire.incoming}`;
  }).join('\n\n');
}

async function callClaudeJson({ prompt, maxTokens, label }) {
  console.log(`[AI] ${label} max_tokens=${maxTokens}`);
  const msg = await getAnthropic().messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = msg.content?.[0]?.text?.trim?.() || '';
  const jsonStr = extractJsonCandidate(raw);
  const parsed = tryParseJson(jsonStr);
  if (parsed) return parsed;

  console.error(`[AI] ${label} JSON parse failed`);
  console.error('[DEBUG] Extracted JSON string length:', jsonStr.length);
  console.error('[DEBUG] First 500 chars:', jsonStr.slice(0, 500));
  console.error('[DEBUG] Full raw response:', raw);
  throw new Error(`AI JSON parse failed: ${label}`);
}

async function getStructuredAnalysisBatch(facts, sharedGames) {
  const statsText = facts.map(s => {
    const mk  = s.multi_kills;
    const cl  = s.clutches;
    const ws  = s.weapon_stats;
    const ac  = s.ability_casts;
    const mkStr = [mk['2k']>0&&`${mk['2k']}x 2K`, mk['3k']>0&&`${mk['3k']}x 3K`,
                   mk['4k']>0&&`${mk['4k']}x 4K`, mk['ace']>0&&`${mk['ace']}x ACE`]
                  .filter(Boolean).join(', ') || 'none';
    const clStr = [cl['1v2']>0&&`${cl['1v2']}x 1v2`, cl['1v3']>0&&`${cl['1v3']}x 1v3`,
                   cl['1v4']>0&&`${cl['1v4']}x 1v4`, cl['1v5']>0&&`${cl['1v5']}x 1v5`]
                  .filter(Boolean).join(', ') || 'none';
    return `Player: ${s.name} (${s.agent})
W/L: ${s.wins}W/${s.total_games - s.wins}L | KDA: ${s.kills}/${s.deaths}/${s.assists} | KD: ${s.kd} | HS%: ${s.headshot_percent}% | DMG: ${s.damage_made} | DMG_RCV: ${s.damage_received}
Multi-kill: ${mkStr} | Clutch: ${clStr} | Weapon: ${ws?.primary_weapon || 'unknown'} | Ability casts/game: ${ac.per_game}
Economy avg_spent: ${s.economy.avg_spent} | avg_loadout: ${s.economy.avg_loadout}
FF outgoing: ${s.friendly_fire.outgoing} | FF incoming: ${s.friendly_fire.incoming}`;
  }).join('\n\n');

  const sharedNote = sharedGames.shared_count > 0
    ? '\nNote: ผู้เล่นเล่นแมชเดียวกัน'
    : '\nNote: ผู้เล่นไม่ได้เล่นแมชเดียวกัน';

  const prompt = `คุณคือโค้ช Valorant สายตรง ไม่เกรงใจ พูดตรงๆ ใช้ภาษาไทยสมัยใหม่ วิเคราะห์สถิติผู้เล่นและตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม commentary นอก JSON ห้ามเพิ่มข้อความใดๆ นอก JSON object

สถิติแมชล่าสุด:
${statsText}
${sharedNote}

ตอบ JSON นี้เท่านั้น (ภาษาไทยพูดตรงไม่เกรงใจ สั้นกระชับ)
เงื่อนไขสำคัญ: players ต้องมีจำนวนเท่ากับ ${facts.length} และต้องมีชื่อผู้เล่นตรงกับที่ให้ไป:
{
  "players": [
    {
      "name": "<ชื่อผู้เล่น>",
      "playstyle": {
        "name": "<ชื่อสไตล์ 2-4 คำ>",
        "because": "<stat หลักที่บ่งบอก เช่น KD 2.1, HS% 34%>",
        "meaning": "<หมายความว่าอะไรในเกม 1 ประโยค>",
        "tendency": "<คุณมีแนวโน้มที่จะ... 1 ประโยค>"
      },
      "strong_points": [{"name":"<>","because":"<>","meaning":"<>","tendency":"<>"}],
      "weak_points":   [{"name":"<>","because":"<>","meaning":"<>","tendency":"<>"}],
      "improve": "<คำแนะนำตรงๆ 1-2 ประโยค>"
    }
  ],
  "team_analysis": "<วิเคราะห์ทีม synergy จุดอ่อน โอกาสชนะ ไม่เกิน 3 ประโยค>"
}`;

  // Increase max_tokens based on number of players to prevent truncation with 3 players
  const playerCount = facts.length;
  const maxTokens = playerCount === 1 ? 2200 : playerCount === 2 ? 3600 : 6500;
  
  console.log(`[getStructuredAnalysis] Analyzing ${playerCount} player(s) with max_tokens: ${maxTokens}`);
  
  return await callClaudeJson({ prompt, maxTokens, label: `batch:${playerCount}` });
}

async function getStructuredAnalysis(facts, sharedGames) {
  const playerCount = facts.length;

  // Most reliable path for 3 players: analyze each player separately (short JSON),
  // then ask a short team_analysis-only response.
  if (playerCount >= 3) {
    const sharedNote = sharedGames.shared_count > 0
      ? '\nNote: ผู้เล่นเล่นแมชเดียวกัน'
      : '\nNote: ผู้เล่นไม่ได้เล่นแมชเดียวกัน';

    const perPlayer = await Promise.all(
      facts.map(async (p) => {
        const statsText = formatStatsText([p]);
        const prompt = `คุณคือโค้ช Valorant สายตรง ไม่เกรงใจ พูดตรงๆ ใช้ภาษาไทยสมัยใหม่ วิเคราะห์สถิติผู้เล่นและตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม commentary นอก JSON ห้ามเพิ่มข้อความใดๆ นอก JSON object

สถิติแมชล่าสุด:
${statsText}
${sharedNote}

ตอบ JSON นี้เท่านั้น:
{
  "players": [
    {
      "name": "${p.name}",
      "playstyle": { "name": "<>", "because": "<>", "meaning": "<>", "tendency": "<>" },
      "strong_points": [{"name":"<>","because":"<>","meaning":"<>","tendency":"<>"}],
      "weak_points":   [{"name":"<>","because":"<>","meaning":"<>","tendency":"<>"}],
      "improve": "<คำแนะนำตรงๆ 1-2 ประโยค>"
    }
  ]
}`;

        try {
          const parsed = await callClaudeJson({ prompt, maxTokens: 2400, label: `player:${p.name}` });
          const only = parsed?.players?.[0];
          return only ? { ok: true, player: only } : { ok: false, player: null };
        } catch {
          return { ok: false, player: null };
        }
      })
    );

    const playersOut = facts.map((p, idx) => {
      const r = perPlayer[idx];
      if (r?.ok && r.player) return r.player;
      return {
        name:          p.name,
        playstyle:     { name: 'วิเคราะห์ไม่สำเร็จ', because: '-', meaning: '-', tendency: '-' },
        strong_points: [], weak_points: [],
        improve:       'ลองวิเคราะห์ใหม่อีกครั้ง',
      };
    });

    // team_analysis only (short response => less JSON risk)
    let teamAnalysis = 'วิเคราะห์ทีมไม่สำเร็จในขณะนี้';
    try {
      const teamStats = formatStatsText(facts);
      const teamPrompt = `คุณคือโค้ช Valorant สายตรง ไม่เกรงใจ พูดตรงๆ ใช้ภาษาไทยสมัยใหม่ วิเคราะห์ทีมและตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม commentary นอก JSON ห้ามเพิ่มข้อความใดๆ นอก JSON object

สถิติแมชล่าสุด:
${teamStats}
${sharedNote}

ตอบ JSON นี้เท่านั้น:
{ "team_analysis": "<วิเคราะห์ทีม synergy จุดอ่อน โอกาสชนะ ไม่เกิน 3 ประโยค>" }`;

      const parsed = await callClaudeJson({ prompt: teamPrompt, maxTokens: 1200, label: 'team_analysis' });
      if (typeof parsed?.team_analysis === 'string' && parsed.team_analysis.trim()) {
        teamAnalysis = parsed.team_analysis.trim();
      }
    } catch {}

    return { players: playersOut, team_analysis: teamAnalysis };
  }

  // 1–2 players: single request is fine
  try {
    return await getStructuredAnalysisBatch(facts, sharedGames);
  } catch (e) {
    console.error('AI JSON parse error (batch fallback):', e.message);
    return {
      players: facts.map(s => ({
        name:          s.name,
        playstyle:     { name: 'วิเคราะห์ไม่สำเร็จ', because: '-', meaning: '-', tendency: '-' },
        strong_points: [], weak_points: [],
        improve:       'ลองวิเคราะห์ใหม่อีกครั้ง',
      })),
      team_analysis: 'วิเคราะห์ทีมไม่สำเร็จในขณะนี้',
    };
  }
}

// =============================================================================
// MODULE: HTTP Handler (API entrypoint)
// Purpose: Validate input, fetch stats, run AI analysis, return JSON payload
// =============================================================================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '99', 10);
  const TEST_MODE  = process.env.NODE_ENV !== 'production';

  const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const ua  = (req.headers['user-agent'] || '').slice(0, 60);
  const key = `valo:rl:${ip}:${Buffer.from(ua).toString('base64').slice(0, 20)}`;

  let quotaRemaining = RATE_LIMIT;

  if (!TEST_MODE) {
    try {
      const used = parseInt(await getRedis().get(key) || '0', 10);
      if (used >= RATE_LIMIT)
        return res.status(429).json({ error: 'limit', message: `ใช้ครบ ${RATE_LIMIT} ครั้งต่อวันแล้ว กลับมาพรุ่งนี้`, quota_remaining: 0 });
      quotaRemaining = RATE_LIMIT - used - 1;
    } catch (e) { console.error('Redis pre-check error:', e); }
  }

  const { players } = req.body || {};
  if (!players || players.length < 1 || players.length > 3)
    return res.status(400).json({ error: 'ต้องการ 1-3 Riot ID' });

  try {
    const factBuilders = players.map(async (p) => {
      const [name, tag] = p.split('#');
      if (!name || !tag) throw new Error(`รูปแบบ Riot ID ผิด: ${p} (ต้องมี # เช่น ZyklonHCN#A1940)`);
      const data = await fetchPlayerMatches(name.trim(), tag.trim());
      return buildPlayerFacts(data, name.trim(), tag.trim());
    });

    const [agentImages, ...parsed] = await Promise.all([
      getAgentImages(),
      ...factBuilders.map(p => p.catch(() => null)),
    ]);

    let facts = parsed.filter(Boolean);
    if (!facts.length)
      return res.status(400).json({ error: 'ไม่พบข้อมูลผู้เล่น กรุณาตรวจสอบ Riot ID' });

    facts = facts.map(s => { s.agent_image = agentImages[s.agent?.toLowerCase()] || null; return s; });

    const sharedGames = facts.length >= 2
      ? detectSharedGames(facts.map(s => s.match_ids))
      : { shared_count: 0, together_label: 'solo analysis' };

    if (facts.length >= 2) facts = assignBotfragCounts(facts);
    facts = assignAchievements(facts);

    const aiResult = await getStructuredAnalysis(facts, sharedGames);
    facts = facts.map((s, idx) => {
      const want = normalizePlayerKey(s.name);
      const byName = aiResult.players?.find(p => normalizePlayerKey(p.name) === want);
      // fallback: sometimes model drops tags (e.g. "name#tag" -> "name")
      const byShort = aiResult.players?.find(p => normalizePlayerKey(p.name) === normalizePlayerKey(String(s.name).split('#')[0]));
      s.ai_report = byName ?? byShort ?? aiResult.players?.[idx] ?? null;
      return s;
    });

    if (!TEST_MODE) {
      try {
        const newCount = await getRedis().incr(key);
        if (newCount === 1) await getRedis().expire(key, 86400);
        quotaRemaining = Math.max(0, RATE_LIMIT - newCount);
      } catch (e) { console.error('Redis incr error:', e); }
    }

    const clientStats = facts.map(s => ({
      name:             s.name,
      agent:            s.agent,
      agent_image:      s.agent_image,
      kills:            s.kills,
      deaths:           s.deaths,
      assists:          s.assists,
      kd:               s.kd,
      headshot_percent: s.headshot_percent,
      damage_made:      s.damage_made,
      wins:             s.wins,
      total_games:      s.total_games,
      winrate:          s.winrate,
      multi_kills:      s.multi_kills,
      clutches:         s.clutches,
      weapon_stats:     s.weapon_stats ? {
        primary_weapon: s.weapon_stats.primary_weapon,
        weapon_kills:   s.weapon_stats.weapon_kills,
        flags:          s.weapon_stats.flags,
      } : null,
      ability_casts:    s.ability_casts,
      damage_received:  s.damage_received,
      friendly_fire:    s.friendly_fire,
      economy:          s.economy,
      flags:            s.flags,
      achievements:     s.achievements,
      ai_report:        s.ai_report,
    }));

    return res.status(200).json({
      stats:           clientStats,
      shared_games:    sharedGames,
      team_analysis:   aiResult.team_analysis || null,
      quota_remaining: quotaRemaining,
    });

  } catch (err) {
    console.error('Handler error:', err.message || err);
    return res.status(500).json({
      error:           'เกิดข้อผิดพลาด กรุณาลองใหม่',
      detail:          String(err.message),
      quota_remaining: quotaRemaining,
    });
  }
};
