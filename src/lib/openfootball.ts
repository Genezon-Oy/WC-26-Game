// Parse openfootball/worldcup.json match data into our DB shape.
// Source: https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json

export interface OFMatch {
  round: string;
  date: string; // "2026-06-11"
  time?: string; // e.g. "13:00 UTC-6"
  team1: string;
  team2: string;
  group?: string; // "Group A"
  ground?: string;
  score?: { ht?: [number, number]; ft?: [number, number]; et?: [number, number]; p?: [number, number] };
}

export interface OFData {
  name: string;
  matches: OFMatch[];
}

// Parse "13:00 UTC-6" -> { time: "13:00", offset: "-06:00" }
function parseTime(time?: string): { hhmm: string; offset: string } {
  if (!time) return { hhmm: "12:00", offset: "+00:00" };
  const m = time.match(/^(\d{1,2}):(\d{2})(?:\s+UTC([+-]\d{1,2})(?::?(\d{2}))?)?$/);
  if (!m) return { hhmm: "12:00", offset: "+00:00" };
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  const offH = m[3] ?? "+0";
  const offM = m[4] ?? "00";
  const sign = offH.startsWith("-") ? "-" : "+";
  const offHN = offH.replace(/^[+-]/, "").padStart(2, "0");
  return { hhmm: `${hh}:${mm}`, offset: `${sign}${offHN}:${offM}` };
}

export function toKickoffISO(date: string, time?: string): string {
  const { hhmm, offset } = parseTime(time);
  // Build an ISO string with offset; let Date parse it to a UTC timestamp.
  const iso = `${date}T${hhmm}:00${offset}`;
  return new Date(iso).toISOString();
}

export function inferStage(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter") && !r.includes("third"))
    return "final";
  if (r.includes("third")) return "third-place";
  if (r.includes("semi")) return "semi-final";
  if (r.includes("quarter")) return "quarter-final";
  if (r.includes("round of 16")) return "round-of-16";
  if (r.includes("round of 32")) return "round-of-32";
  return "group";
}

export function matchKey(m: OFMatch): string {
  // Stable natural key: date + teams (order-insensitive)
  const [a, b] = [m.team1, m.team2].sort();
  return `${m.date}__${a}__vs__${b}`;
}

export function uniqueTeams(matches: OFMatch[]): { name: string; group_code: string | null }[] {
  const map = new Map<string, string | null>();
  for (const m of matches) {
    const g = m.group ? m.group.replace(/^Group\s+/i, "") : null;
    if (!map.has(m.team1)) map.set(m.team1, g);
    if (!map.has(m.team2)) map.set(m.team2, g);
  }
  return Array.from(map.entries()).map(([name, group_code]) => ({ name, group_code }));
}
