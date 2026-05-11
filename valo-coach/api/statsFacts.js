// ─── statsFacts.js ────────────────────────────────────────────────────────────
// Data layer: raw Henrik API response → clean player facts object
// coach.js ไม่ควรรู้เรื่อง Henrik API format — ทุกอย่าง normalize ที่นี่
//
// Export หลัก:
//   buildPlayerFacts(matchData, riotName, riotTag) → facts | null
//   assignBotfragCounts(allFacts[])                → allFacts[] (mutates botfrag_count)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Multi-kill ───────────────────────────────────────────────────────────────
function _parseMultiKills(rounds, displayNameLower) {
  const mk = { '2k': 0, '3k': 0, '4k': 0, 'ace': 0 };
  for (const round of rounds) {
    const ps = round.player_stats?.find(p =>
      p.player_display_name?.toLowerCase() === displayNameLower
    );
    if (!ps) continue;
    const k = ps.kills || 0;
    if      (k === 2) mk['2k']++;
    else if (k === 3) mk['3k']++;
    else if (k === 4) mk['4k']++;
    else if (k >= 5)  mk['ace']++;
  }
  return mk;
}

// ─── Weapon Engine ────────────────────────────────────────────────────────────
function _parseWeaponStats(rounds, displayNameLower) {
  const weaponKills = {};
  for (const round of rounds) {
    for (const ps of round.player_stats || []) {
      if (ps.player_display_name?.toLowerCase() !== displayNameLower) continue;
      for (const ke of ps.kill_events || []) {
        const w = ke.damage_weapon_name || 'Unknown';
        weaponKills[w] = (weaponKills[w] || 0) + 1;
      }
    }
  }
  const sorted     = Object.entries(weaponKills).sort((a, b) => b[1] - a[1]);
  const totalKills = sorted.reduce((s, [, v]) => s + v, 0);
  const sniperKills = (weaponKills['Operator']||0) + (weaponKills['Outlaw']||0) + (weaponKills['Marshal']||0);
  return {
    primary_weapon:     sorted[0]?.[0] || null,
    weapon_kills:       Object.fromEntries(sorted),
    total_weapon_kills: totalKills,
    flags: {
      // threshold: >= 30% of total kills AND >= 4 kills to qualify
      is_sniper:   totalKills > 0 && sniperKills >= Math.max(4, totalKills * 0.3),
      is_operator: totalKills > 0 && (weaponKills['Operator']||0) >= Math.max(4, totalKills * 0.3),
      uses_rifle:  totalKills > 0 && ((weaponKills['Vandal']||0)+(weaponKills['Phantom']||0)) >= Math.max(4, totalKills * 0.4),
    },
  };
}

// ─── Clutch Detection ─────────────────────────────────────────────────────────
function _detectClutches(match, riotName, riotTag) {
  const clutches = { '1v2': 0, '1v3': 0, '1v4': 0, '1v5': 0 };
  if (!match.rounds?.length) return clutches;

  const allPlayers = match.players?.all_players || [];
  const target = allPlayers.find(p =>
    p.name.toLowerCase() === riotName.toLowerCase() &&
    p.tag.toLowerCase()  === riotTag.toLowerCase()
  );
  if (!target) return clutches;

  const myTeam      = target.team?.toLowerCase();
  const enemyTeam   = myTeam === 'red' ? 'blue' : 'red';
  const displayName = `${riotName}#${riotTag}`.toLowerCase();

  const teamMap = {};
  for (const p of allPlayers)
    teamMap[`${p.name}#${p.tag}`.toLowerCase()] = p.team?.toLowerCase();

  for (const round of match.rounds) {
    const deaths = [];
    for (const ps of round.player_stats || [])
      for (const ke of ps.kill_events || [])
        deaths.push({ time: ke.kill_time_in_round || 0, victim: ke.victim_display_name?.toLowerCase() || '' });
    deaths.sort((a, b) => a.time - b.time);

    let myAlive = 5, eneAlive = 5, playerAlive = true, clutchAt = null;
    for (const d of deaths) {
      const vTeam = teamMap[d.victim];
      if (vTeam === myTeam) {
        if (d.victim === displayName) { playerAlive = false; break; }
        myAlive--;
        if (myAlive === 1 && playerAlive && clutchAt === null) clutchAt = eneAlive;
      } else if (vTeam === enemyTeam) {
        eneAlive--;
      }
    }
    if (clutchAt !== null && playerAlive && clutchAt >= 2) {
      const key = `1v${Math.min(clutchAt, 5)}`;
      if (clutches[key] !== undefined) clutches[key]++;
    }
  }
  return clutches;
}

// ─── Main: buildPlayerFacts ───────────────────────────────────────────────────
function buildPlayerFacts(matchData, riotName, riotTag) {
  const matches = matchData?.data;
  if (!matches?.length) return null;

  const displayName      = `${riotName}#${riotTag}`;
  const displayNameLower = displayName.toLowerCase();

  const gameStats    = [];
  const matchIds     = [];
  const perGameKd    = [];
  const perGameKills = [];
  const allRounds    = [];
  const totalMK      = { '2k': 0, '3k': 0, '4k': 0, 'ace': 0 };
  const totalClutch  = { '1v2': 0, '1v3': 0, '1v4': 0, '1v5': 0 };
  const totalAC      = { c: 0, q: 0, e: 0, x: 0 };
  let totalDmgReceived = 0, totalFFIn = 0, totalFFOut = 0;
  let totalEconSpent = 0, totalEconLoadout = 0;
  let totalHS = 0, totalLS = 0, totalShots = 0;
  let totalAfkRounds = 0;

  for (const match of matches) {
    if (match.metadata?.matchid) matchIds.push(match.metadata.matchid);

    const player = match.players?.all_players?.find(p =>
      p.name.toLowerCase() === riotName.toLowerCase() &&
      p.tag.toLowerCase()  === riotTag.toLowerCase()
    );
    if (!player) continue;

    const hs = player.stats.headshots || 0;
    const bs = player.stats.bodyshots || 0;
    const ls = player.stats.legshots  || 0;
    const shots = hs + bs + ls;
    totalHS    += hs;
    totalLS    += ls;
    totalShots += shots;

    const kills  = player.stats.kills;
    const deaths = player.stats.deaths;
    perGameKills.push(kills);
    perGameKd.push(deaths > 0 ? kills / deaths : kills);

    const ac = player.ability_casts || {};
    totalAC.c += (ac.c_cast || 0);
    totalAC.q += (ac.q_cast || 0);
    totalAC.e += (ac.e_cast || 0);
    totalAC.x += (ac.x_cast || 0);

    totalDmgReceived += (player.damage_received || 0);
    const ff = player.behavior?.friendly_fire || {};
    totalFFIn  += (ff.incoming || 0);
    totalFFOut += (ff.outgoing || 0);

    const econ = player.economy || {};
    totalEconSpent   += (econ.spent?.average        || 0);
    totalEconLoadout += (econ.loadout_value?.average || 0);

    gameStats.push({
      kills,
      deaths,
      assists:          player.stats.assists,
      headshot_percent: shots > 0 ? Math.round((hs / shots) * 100) : 0,
      legshot_percent:  shots > 0 ? Math.round((ls / shots) * 100) : 0,
      damage_made:      player.damage_made || 0,
      won:              match.teams?.[player.team?.toLowerCase()]?.has_won ? 1 : 0,
      agent:            player.character,
      map:              match.metadata?.map || 'Unknown',
    });

    if (match.rounds?.length) {
      allRounds.push(...match.rounds);
      for (const round of match.rounds) {
        const rps = round.player_stats?.find(p => p.player_display_name?.toLowerCase() === displayNameLower);
        if (rps?.was_afk) totalAfkRounds++;
      }

      const mk = _parseMultiKills(match.rounds, displayNameLower);
      totalMK['2k'] += mk['2k'];
      totalMK['3k'] += mk['3k'];
      totalMK['4k'] += mk['4k'];
      totalMK['ace'] += mk['ace'];

      const cl = _detectClutches(match, riotName, riotTag);
      totalClutch['1v2'] += cl['1v2'];
      totalClutch['1v3'] += cl['1v3'];
      totalClutch['1v4'] += cl['1v4'];
      totalClutch['1v5'] += cl['1v5'];
    }
  }

  if (!gameStats.length) return null;

  const n          = gameStats.length;
  const avg        = key => Math.round(gameStats.reduce((s, x) => s + x[key], 0) / n);
  const wins       = gameStats.reduce((s, x) => s + x.won, 0);
  const totalK     = gameStats.reduce((s, x) => s + x.kills,  0);
  const totalD     = gameStats.reduce((s, x) => s + x.deaths, 0);
  const totalCasts = totalAC.c + totalAC.q + totalAC.e;

  const agentCount = {};
  gameStats.forEach(g => { agentCount[g.agent] = (agentCount[g.agent] || 0) + 1; });
  const mainAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0][0];

  const weaponStats = allRounds.length ? _parseWeaponStats(allRounds, displayNameLower) : null;

  // Flash casts — agent-specific slot
  const FLASH_SLOT = { vyse: 'e', phoenix: 'e', kayo: 'q', skye: 'e', yoru: 'q' };
  const flashSlot   = FLASH_SLOT[mainAgent?.toLowerCase()] || null;
  const flash_casts = flashSlot ? totalAC[flashSlot] : 0;

  const flags = {
    has_2k:          totalMK['2k'] > 0,
    has_3k:          totalMK['3k'] > 0,
    has_4k:          totalMK['4k'] > 0,
    has_ace:         totalMK['ace'] > 0,
    has_clutch:      Object.values(totalClutch).some(v => v > 0),
    has_high_clutch: (totalClutch['1v3'] + totalClutch['1v4'] + totalClutch['1v5']) > 0,
    shot_teammate:    totalFFOut > 0,
    got_shot_by_team: totalFFIn  > 0,
    is_eco_buyer:    n > 0 && Math.round(totalEconSpent / n) < 2500,
    is_full_buyer:   n > 0 && Math.round(totalEconSpent / n) >= 3800,
    is_sniper:       weaponStats?.flags?.is_sniper   || false,
    is_operator:     weaponStats?.flags?.is_operator || false,
    uses_rifle:      weaponStats?.flags?.uses_rifle  || false,
    positive_kd:     totalD > 0 ? (totalK / totalD) >= 1.0 : true,
  };

  return {
    name:        displayName,
    agent:       mainAgent,
    agent_image: null,

    kills:            avg('kills'),
    deaths:           avg('deaths'),
    assists:          avg('assists'),
    kd:               totalD > 0 ? (totalK / totalD).toFixed(2) : String(totalK),
    headshot_percent: totalShots > 0 ? Math.round((totalHS / totalShots) * 100) : 0,
    legshot_percent:  totalShots > 0 ? Math.round((totalLS / totalShots) * 100) : 0,
    damage_made:      avg('damage_made'),

    wins,
    total_games: n,
    winrate:     Math.round((wins / n) * 100),

    multi_kills:  totalMK,
    clutches:     totalClutch,
    weapon_stats: weaponStats,

    ability_casts: {
      c: totalAC.c, q: totalAC.q, e: totalAC.e, x: totalAC.x,
      total:    totalAC.c + totalAC.q + totalAC.e + totalAC.x,
      per_game: n > 0 ? Math.round(totalCasts / n) : 0,
    },

    damage_received: n > 0 ? Math.round(totalDmgReceived / n) : 0,
    friendly_fire:   { incoming: totalFFIn, outgoing: totalFFOut },

    economy: {
      avg_spent:   n > 0 ? Math.round(totalEconSpent   / n) : 0,
      avg_loadout: n > 0 ? Math.round(totalEconLoadout / n) : 0,
    },

    flags,
    flash_casts,

    match_ids:      matchIds,
    per_game_kd:    perGameKd,
    per_game_kills: perGameKills,
    botfrag_count:  0,
    afk_rounds:     totalAfkRounds,

    achievements: [],
    ai_report:    null,
  };
}

// ─── Botfrag Pass ─────────────────────────────────────────────────────────────
function assignBotfragCounts(allFacts) {
  const gameCount = Math.max(...allFacts.map(p => p.per_game_kd.length));
  for (let g = 0; g < gameCount; g++) {
    const thisGame = allFacts
      .map((p, i) => ({ i, kd: p.per_game_kd[g] ?? null }))
      .filter(x => x.kd !== null);
    if (thisGame.length < 2) continue;
    const minKd    = Math.min(...thisGame.map(x => x.kd));
    const loserIdx = thisGame.find(x => x.kd === minKd)?.i;
    if (loserIdx !== undefined) allFacts[loserIdx].botfrag_count++;
  }
  return allFacts;
}

module.exports = { buildPlayerFacts, assignBotfragCounts };
