// Lightweight rule-based intent parser: English mood prompt → Japanese magazine query.
// Good enough for the demo; swap for an LLM call later if time allows.

const ACTIVITIES = [
  { key: 'cycling', match: /cycl|bike|bicycle|ride/i, ja: 'サイクリング', magazine: 'BiCYCLE CLUB' },
  { key: 'golf', match: /golf/i, ja: 'ゴルフ', magazine: 'EVEN' },
  { key: 'hiking', match: /hik|walk|trek|trail|mountain|climb/i, ja: 'ハイキング', magazine: 'Randonnée' },
];

const PLACES = [
  { match: /nikko|日光/i, ja: '日光', station: 'Tobu-Nikko' },
  { match: /kinugawa|鬼怒川/i, ja: '鬼怒川', station: 'Kinugawa-Onsen' },
  { match: /chichibu|秩父/i, ja: '秩父', station: 'Chichibu' },
  { match: /arakawa|荒川/i, ja: '荒川', station: null },
];

const MODIFIERS = [
  { match: /autumn|fall|leaves|koyo/i, ja: '紅葉' },
  { match: /lake/i, ja: '湖' },
  { match: /onsen|hot spring/i, ja: '温泉' },
  { match: /view|scenic|vista/i, ja: '絶景' },
  { match: /waterfall/i, ja: '滝' },
  { match: /river/i, ja: '川沿い' },
];

export function parseIntent(query) {
  const activity = ACTIVITIES.find((a) => a.match.test(query)) || ACTIVITIES[2];
  const place = PLACES.find((p) => p.match.test(query)) || PLACES[0]; // default: Nikko corridor
  const mods = MODIFIERS.filter((m) => m.match.test(query)).map((m) => m.ja);
  const level = /beginner|easy|gentle|family|kid/i.test(query)
    ? 'beginner'
    : /hard|challeng|advanced/i.test(query)
      ? 'advanced'
      : 'any';

  const levelJa = level === 'beginner' ? '初心者' : level === 'advanced' ? '上級' : '';
  const keywords_ja = [place.ja, ...mods, activity.ja, levelJa].filter(Boolean).join(' ');

  return {
    activity: activity.key,
    magazineHint: activity.magazine,
    level,
    destinationStation: place.station,
    keywords_ja,
    // Prose queries retrieve better than keyword lists against a semantic index.
    searchSentence: `${keywords_ja}のおすすめコースと見どころ、アクセス方法`,
  };
}
