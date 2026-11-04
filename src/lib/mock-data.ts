import type { Track } from "./types";

/**
 * Deterministic pseudo-random from a string so the same track always gets the
 * same BPM / key / energy. This stands in for real audio analysis until the
 * user wires up the YouTube Data API + an audio-fingerprint backend.
 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const KEYS = [
  "Am",
  "C",
  "Em",
  "G",
  "Dm",
  "F",
  "Bm",
  "A",
  "F#m",
  "D",
  "Gm",
  "E",
];

const COVER_PALETTES = [
  ["#e0a44a", "#c2703a"],
  ["#c2703a", "#7a3b22"],
  ["#8fb573", "#3f5e2a"],
  ["#9c8d7a", "#4a4036"],
  ["#d9694f", "#7a2f24"],
  ["#b9a06b", "#5e4f2e"],
];

/** Builds a stable cover SVG data URI so the demo has real artwork, not gray boxes. */
export function coverFor(seed: string, label: string): string {
  const h = hash(seed);
  const [a, b] = COVER_PALETTES[Math.floor(h * COVER_PALETTES.length)];
  const ang = Math.floor(h * 360);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
    <defs><linearGradient id='g' gradientTransform='rotate(${ang})'>
      <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>
    </linearGradient></defs>
    <rect width='160' height='160' fill='${b}'/>
    <rect width='160' height='160' fill='url(#g)' opacity='0.85'/>
    <circle cx='80' cy='80' r='46' fill='none' stroke='rgba(244,236,226,0.25)' stroke-width='2'/>
    <circle cx='80' cy='80' r='4' fill='rgba(244,236,226,0.85)'/>
    <text x='80' y='142' text-anchor='middle' font-family='monospace' font-size='11'
      fill='rgba(244,236,226,0.8)'>${label}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function makeTrack(
  id: string,
  title: string,
  artist: string,
  source: Track["source"],
  durationSec: number,
  genres: string[]
): Track {
  const h = hash(id);
  const bpm = 84 + Math.floor(h * 60); // 84..143
  const energy = 0.3 + h * 0.65;
  return {
    id,
    title,
    artist,
    source,
    url:
      source === "youtube"
        ? `https://www.youtube.com/watch?v=${id}`
        : `https://open.spotify.com/track/${id}`,
    thumbnail: coverFor(id, artist.slice(0, 3).toUpperCase()),
    durationSec,
    bpm,
    musicalKey: KEYS[Math.floor(h * KEYS.length)],
    energy: Math.round(energy * 100) / 100,
    genres,
    synthetic: true,
  };
}

export const MOCK_TRACKS: Track[] = [
  makeTrack("yt_blinding", "Blinding Lights", "The Weeknd", "youtube", 200, ["Pop", "Synthpop"]),
  makeTrack("yt_starboy", "Starboy", "The Weeknd, Daft Punk", "youtube", 230, ["Pop", "Electro"]),
  makeTrack("yt_onread", "One More Time", "Daft Punk", "youtube", 320, ["House", "French House"]),
  makeTrack("yt_levels", "Levels", "Avicii", "youtube", 200, ["House", "Progressive"]),
  makeTrack("yt_resistan", "Resistance", "Muse", "youtube", 255, ["Rock", "Electro"]),
  makeTrack("yt_getlucky", "Get Lucky", "Daft Punk", "youtube", 248, ["Disco", "House"]),
  makeTrack("yt_sexbo", "SexyBack", "Justin Timberlake", "youtube", 268, ["Pop", "Dance"]),
  makeTrack("yt_jump", "Jumpman", "Drake, Future", "youtube", 209, ["Hip-Hop", "Trap"]),
  makeTrack("yt_maskoff", "Mask Off", "Future", "youtube", 215, ["Hip-Hop", "Trap"]),
  makeTrack("yt_breathe", "Breathe", "Telepopmusik", "youtube", 286, ["Ambient", "Downtempo"]),
  makeTrack("yt_retro", "Retrograde", "James Blake", "youtube", 251, ["Lo-Fi", "Electronic"]),
  makeTrack("yt_nightcall", "Nightcall", "Kavinsky", "youtube", 258, ["Synthwave", "Disco"]),
  makeTrack("yt_faded", "Faded", "Alan Walker", "youtube", 212, ["Future Bass", "Pop"]),
  makeTrack("yt_titant", "Titanium", "David Guetta", "youtube", 244, ["House", "Pop"]),
  makeTrack("yt_sicko", "Sicko Mode", "Travis Scott", "youtube", 312, ["Hip-Hop", "Trap"]),
  makeTrack("yt_dna", "DNA", "Kendrick Lamar", "youtube", 185, ["Hip-Hop", "Rap"]),
  makeTrack("yt_paso", "Pasan", "Afrobeat Mix", "youtube", 223, ["Afrobeats", "Pop"]),
  makeTrack("yt_gasol", "Gasolina", "Daddy Yankee", "youtube", 218, ["Reggaeton", "Latin"]),
  makeTrack("sp_midnight", "Midnight City", "M83", "spotify", 244, ["Synthpop", "Indie"]),
  makeTrack("sp_redbone", "Redbone", "Childish Gambino", "spotify", 327, ["Funk", "Soul"]),
  makeTrack("sp_feel", "Feels Like We Only Go Backwards", "Tame Impala", "spotify", 193, ["Psychedelic", "Rock"]),
  makeTrack("sp_clearskies", "Clear Skies", "Lo-Fi Collective", "spotify", 142, ["Lo-Fi", "Ambient"]),
  makeTrack("sp_kinetic", "Kinetic", "ODESZA", "spotify", 231, ["Future Bass", "Electronic"]),
  makeTrack("sp_suburb", "Suburbia", "Drum & Bass Edit", "spotify", 264, ["Drum & Bass", "Electronic"]),
  makeTrack("yt_submundo1", "Submundo da Noite", "MC Submundo", "youtube", 195, ["Funk Submundo", "Funk"]),
  makeTrack("yt_eletrofunk1", "Eletrofunk da Quebrada", "DJ Eletro", "youtube", 210, ["Eletrofunk", "Funk"]),
  makeTrack("yt_mandela1", "Mandelão do Borel", "MC Mandelão", "youtube", 188, ["Funk Mandelão", "Funk"]),
  makeTrack("yt_proib1", "Proibidão da Favela", "MC Proibido", "youtube", 205, ["Funk Proibidão", "Funk"]),
  makeTrack("yt_baile1", "Baile Funk Hits", "DJ Baile", "youtube", 222, ["Baile Funk", "Funk"]),
  makeTrack("yt_phonkbr1", "Brazilian Phonk Drift", "PHONK BR", "youtube", 175, ["Brazilian Phonk", "Phonk"]),
  makeTrack("yt_ostent1", "Ostentação Vida Louca", "MC Ostenta", "youtube", 198, ["Funk Ostentação", "Funk"]),
  makeTrack("yt_samba1", "Samba de Verão", "Beth Carvalho", "youtube", 240, ["Samba", "MPB"]),
  makeTrack("yt_sertanejo1", "Sertanejo Raiz", "Zezé Di Camargo", "youtube", 230, ["Sertanejo"]),
];

export function searchMock(query: string, source?: string): Track[] {
  const q = query.trim().toLowerCase();
  let pool = MOCK_TRACKS;
  if (source && source !== "all") {
    pool = pool.filter((t) => t.source === source);
  }
  if (!q) return pool.slice(0, 12);
  const matched = pool.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.genres.some((g) => g.toLowerCase().includes(q))
  );
  // If nothing matches the query, surface the whole pool so the search is
  // never an empty "No matches" state (used as a fallback when the live API
  // is unavailable).
  return (matched.length > 0 ? matched : pool).slice(0, 12);
}
