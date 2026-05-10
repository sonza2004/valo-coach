// ─── Achievement Definitions ──────────────────────────────────────────────────
// แก้ name / dialogue / trigger ได้ที่นี่ไฟล์เดียว
// condition(player, group, d) → boolean   (d = derived group stats)
// reason(player, group, d)   → string     (trigger_reason ที่แสดงบน UI)
// groupOnly: true             → ไม่แสดงเมื่อเล่น solo

module.exports = [

  // ── Solo-capable ──────────────────────────────────────────────────────────

  {
    id:        'ACH004',
    name:      'เอาแบบ ดำเงาหรือดำด้าน?',
    dialogue:  'หมด! หมดทุกแบบ',
    groupOnly: false,
    condition: (p) => ['phoenix', 'astra', 'veto'].includes(p.agent?.toLowerCase()),
    reason:    (p) => `เล่น 1ใน agent ต่อไปนี้ Phoenix, Astra, Veto`,
  },

  {
    id:        'ACH005',
    name:      'เดี๋ยวกูยิงเป็นทิคแทคโทเลย',
    dialogue:  'วางสปาต้าลง ถ้าไม่อยากแดกบาเร็ตต้ากู',
    groupOnly: false,
    condition: (p) => p.multi_kills['3k'] >= 2,
    reason:    (p) => `ทำ 3K (3 kills ในรอบเดียว) ถึง ${p.multi_kills['3k']} ครั้ง`,
  },

  {
    id:        'ACH007',
    name:      'ใครคือสุดยอดพระเจ้า',
    dialogue:  'พระอิศวรจงเจริญ สุดยอด',
    groupOnly: false,
    condition: (p) => p.multi_kills['ace'] >= 1,
    reason:    (p) => `ทำ ACE (5 kills ในรอบเดียว) ถึง ${p.multi_kills['ace']} ครั้ง`,
  },

  {
    id:        'ACH017',
    name:      '40-0 นี่มึงเล่นบอลหรือเป่ากบ!?',
    dialogue:  '',
    groupOnly: false,
    condition: (p) => p.per_game_kills?.some(k => k >= 40),
    reason:    (p) => `ได้ ${Math.max(...(p.per_game_kills || [0]))} kill ในเกมเดียว`,
  },

  {
    id:        'ACH002',
    name:      'มันจ้าซะเหลือเกิน',
    dialogue:  'สงสัยจะเป็นหลอดซีนอน',
    groupOnly: false,
    condition: (p, group, d) => {
      if (p.flash_casts === 0) return false;          // agent ไม่มี flash slot ที่รู้จัก
      const flashThreshold     = d.hasGroup ? d.avgFlash * 1.5 : 14;
      const avgAssistThreshold = d.hasGroup ? d.avgAssists * 0.7 : 3;
      return p.flash_casts > flashThreshold && p.assists < avgAssistThreshold;
    },
    reason: (p, _g, d) =>
      `ใช้ flash ${p.flash_casts} ครั้ง แต่ assist แค่ ${p.assists} (avg ทีม ${d.avgAssists?.toFixed(1) ?? '-'})`,
  },

  {
    // ตรวจจาก economy เท่านั้น: loadout value เฉลี่ยสูงกว่า spent เฉลี่ย 40%+
    // = โดน drop หรือประหยัดมากจนแปลก (ทั้ง solo และ group)
    id:        'ACH003',
    name:      'ลูก 357 นี่หว่า',
    dialogue:  'ร้านเฮียฮงหลังดิโสยาม ไอ่นี่มือปืนมีนาย เด็กซุ้มแน่นอน',
    groupOnly: false,
    condition: (p) =>
      p.economy.avg_spent > 0 &&
      p.economy.avg_loadout > p.economy.avg_spent * 1.4,
    reason: (p) =>
      `loadout value avg = ${p.economy.avg_loadout} | spent avg = ${p.economy.avg_spent}`,
  },

  {
    // ตรวจเฉพาะ C ของ Skye (Guiding Light), E ของ Sage (Healing Orb), C ของ Mik
    id:        'ACH009',
    name:      'หมออออออออ',
    dialogue:  'แต๊งยู',
    groupOnly: false,
    condition: (p) => {
      const ag = p.agent?.toLowerCase();
      if (ag === 'skye') return p.ability_casts.c > 10;
      if (ag === 'sage') return p.ability_casts.e > 10;
      if (ag === 'mik')  return p.ability_casts.c > 10;
      return false;
    },
    reason: (p) => {
      const ag = p.agent?.toLowerCase();
      const slot = ag === 'sage' ? `E ${p.ability_casts.e}` : `C ${p.ability_casts.c}`;
      return `${p.agent} ใช้สกิลฮีล (${slot}) ครั้ง`;
    },
  },

  {
    // ตรวจเฉพาะ C ของ Skye, E ของ Sage, C ของ Mik
    id:        'ACH010',
    name:      'ไอ่หมอออออ',
    dialogue:  'ฮีลลลลลล',
    groupOnly: false,
    condition: (p) => {
      const ag = p.agent?.toLowerCase();
      if (ag === 'skye') return p.ability_casts.c < 4;
      if (ag === 'sage') return p.ability_casts.e < 4;
      if (ag === 'mik')  return p.ability_casts.c < 4;
      return false;
    },
    reason: (p) => {
      const ag = p.agent?.toLowerCase();
      const slot = ag === 'sage' ? `E ${p.ability_casts.e}` : `C ${p.ability_casts.c}`;
      return `${p.agent} แต่ใช้สกิลฮีล (${slot}) ครั้งเท่านั้น`;
    },
  },

  {
    id:        'ACH011',
    name:      'อาปัดชะเย',
    dialogue:  'อาปัดติเถเถนา',
    groupOnly: false,
    condition: (p) => p.agent?.toLowerCase() === 'sage' && p.ability_casts.x >= 3,
    reason:    (p) => `Sage ใช้ ultimate ถึง ${p.ability_casts.x} ครั้ง`,
  },

  {
    id:        'ACH015',
    name:      'Valorant กำลังร้องไห้',
    dialogue:  'วิธีการเล่นของนาย ทำให้ RIOT เจ็บปวด',
    groupOnly: false,
    condition: (p, _g, d) => {
      const healers = ['skye', 'sage', 'mik'];
      if (healers.includes(p.agent?.toLowerCase())) return false;
      const threshold = d.hasGroup && d.avgCasts > 0
        ? d.avgCasts * 0.4
        : 4 * p.total_games;
      return p.ability_casts.total < threshold;
    },
    reason: (p, _g, d) => d.hasGroup
      ? `ใช้สกิล ${p.ability_casts.total} ครั้ง — ต่ำกว่า 40% ของ avg ทีม (${Math.round(d.avgCasts)})`
      : `ใช้สกิลเฉลี่ยแค่ ${p.ability_casts.per_game} ครั้งต่อเกม`,
  },

  {
    id:        'ACH016',
    name:      'ไม่มีเวลาให้เสียใจ',
    dialogue:  'ตอนต่อไป สุกุนะเอาจริง!',
    groupOnly: false,
    condition: (p) => (p.clutches['1v3'] || 0) + (p.clutches['1v4'] || 0) + (p.clutches['1v5'] || 0) >= 3,
    reason: (p) => {
      const parts = [];
      if (p.clutches['1v3'] > 0) parts.push(`${p.clutches['1v3']}x 1v3`);
      if (p.clutches['1v4'] > 0) parts.push(`${p.clutches['1v4']}x 1v4`);
      if (p.clutches['1v5'] > 0) parts.push(`${p.clutches['1v5']}x 1v5`);
      return `clutch ${parts.join(', ')}`;
    },
  },

  // ── Group-only ─────────────────────────────────────────────────────────────

  {
    // แก้เป็นรับดาเมจสูงสุดในทีม
    id:        'ACH001',
    name:      'ไอ้สอง ให้พี่เดินสะดวกเถอะ',
    dialogue:  'นี่มีดปืนไม่ได้แดกเขาหรอก',
    groupOnly: true,
    condition: (p, group) => {
      const max = Math.max(...group.map(x => x.damage_received));
      return p.damage_received === max && max > 0;
    },
    reason: (p) => `รับดาเมจ ${p.damage_received} avg/เกม — สูงสุดในทีม`,
  },

  {
    id:        'ACH006',
    name:      'มึงเอาไอ่เท่งมาฮาแต่เอากูมาฆ่า',
    dialogue:  '',
    groupOnly: true,
    condition: (p, _g, d) => {
      const kdGap = d.sortedKd.length >= 2 ? d.sortedKd[1] - d.sortedKd[0] : 0;
      return parseFloat(p.kd) === Math.min(...d.kdValues) && kdGap >= 0.3;
    },
    reason: (p, _g, d) => {
      const kdGap = d.sortedKd.length >= 2 ? d.sortedKd[1] - d.sortedKd[0] : 0;
      return `KD ${p.kd} — ต่ำสุดในทีม ห่างจากคนรอง ${kdGap.toFixed(2)}`;
    },
  },

  {
    // แก้เป็นตายน้อยสุดในทีม
    id:        'ACH008',
    name:      'จะมีก็มีอยู่แผลเดียวเนี่ย ที่ไหล่',
    dialogue:  'เมา ตกรถเมล์ แถ แท่ดๆๆๆ ร้องหยั่งหมา',
    groupOnly: true,
    condition: (p, group) => {
      const min = Math.min(...group.map(x => x.deaths));
      return p.deaths === min;
    },
    reason: (p) => `ตาย ${p.deaths} ครั้ง — น้อยที่สุดในทีม`,
  },

  {
    id:        'ACH012',
    name:      'กูผู้กออง อาจนะเว้ย มึงต้องช่วยกูนะเว้ย',
    dialogue:  'ผู้กองเอาปืนมา..เหลือปืนสักกระบอกก็ยังดี',
    groupOnly: true,
    condition: (p, _g, d) =>
      p.kills > d.avgKills && p.deaths > d.avgDeaths && parseFloat(p.kd) < 1.0,
    reason: (p) => `Kill ${p.kills} (สูง) แต่ Death ${p.deaths} (สูง) — KD ${p.kd} < 1`,
  },

  {
    // แก้เป็นได้รับดาเมจ friendly fire incoming สูงที่สุดในกลุ่ม
    id:        'ACH013',
    name:      'บาดแผลกลางหลัง',
    dialogue:  'ถือเป็นความอับอายของนักดาบ',
    groupOnly: true,
    condition: (p, group) => {
      const max = Math.max(...group.map(x => x.friendly_fire.incoming));
      return p.friendly_fire.incoming === max && max > 0;
    },
    reason: (p) => `รับ friendly fire ${p.friendly_fire.incoming} ดาเมจ — สูงสุดในทีม`,
  },

  {
    id:        'ACH014',
    name:      'คุณทาจิมาดา ทำอะไรสักอย่างสิ',
    dialogue:  'ทำไมถึงเอาแต่ดูล่ะครับ คุณทาจิมาดา',
    groupOnly: true,
    condition: (p) => p.afk_rounds >= 1,
    reason:    (p) => `AFK จำนวน ${p.afk_rounds} round`,
  },

  {
    // แก้เป็น friendly fire damage_outgoing สูงที่สุดในกลุ่ม
    id:        'ACH018',
    name:      'ซมโต ซมโต๊ย ตูบายขะเนี๊ย โกเนี๊ยบายโอ้น',
    dialogue:  'เปิดไมค์พูดตามนี้ รักษาชื่อเสียงประเทศไทยไว้',
    groupOnly: true,
    condition: (p, group) => {
      const max = Math.max(...group.map(x => x.friendly_fire.outgoing));
      return p.friendly_fire.outgoing === max && max > 0;
    },
    reason: (p) => `ยิงใส่เพื่อน ${p.friendly_fire.outgoing} ดาเมจ — สูงสุดในทีม`,
  },

  {
    // แก้เป็น legshot >= headshot
    id:        'ACH019',
    name:      'หัวเน้นๆ',
    dialogue:  'แต่เป็นหัวแม่โป้งตีน',
    groupOnly: true,
    condition: (p) => p.legshot_percent >= p.headshot_percent && p.legshot_percent > 0,
    reason:    (p) => `Legshot ${p.legshot_percent}% สูงกว่า Headshot ${p.headshot_percent}%`,
  },

];
