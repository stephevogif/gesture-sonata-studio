/**
 * Heaven Songs — initial HEAVEN VERSIONS catalog (40 songs).
 *
 * These are simplified diatonic readings ("Heaven Versions") arranged for the
 * Seven Heavens 1–7 gesture system. They are NOT official transcriptions of
 * the original recordings: no lyrics, no melody, no tablature, no audio, no
 * artwork. Content is deliberately kept separate from the engine so the
 * catalog can be edited or replaced without touching any component.
 *
 * `keyPc` + `scale` + `degrees` are the source of truth; chord names are
 * always computed by the Music Theory Engine.
 */

import type { Compatibility, Difficulty, ModeIdAlias, Song } from "./catalogTypes";

type Row = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  keyPc: number;
  scale: ModeIdAlias;
  difficulty: Difficulty;
  compatibility: Compatibility;
  main: number[];
  /** optional extra sections; "Main" is always built from `main` */
  sections?: { name: string; degrees: number[] }[];
};

const ROWS: Row[] = [
  { id: "zombie", title: "Zombie", artist: "The Cranberries", genre: "Alternative Rock", keyPc: 4, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "with-or-without-you", title: "With or Without You", artist: "U2", genre: "Rock", keyPc: 2, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 5, 6, 4] },
  { id: "numb", title: "Numb", artist: "Linkin Park", genre: "Nu Metal", keyPc: 6, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "in-the-end", title: "In the End", artist: "Linkin Park", genre: "Nu Metal", keyPc: 3, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "what-ive-done", title: "What I've Done", artist: "Linkin Park", genre: "Alternative Rock", keyPc: 7, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "crawling", title: "Crawling", artist: "Linkin Park", genre: "Nu Metal", keyPc: 1, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "demons", title: "Demons", artist: "Imagine Dragons", genre: "Pop Rock", keyPc: 3, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 5, 6, 4] },
  { id: "apologize", title: "Apologize", artist: "OneRepublic", genre: "Pop Rock", keyPc: 0, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "perfect", title: "Perfect", artist: "Ed Sheeran", genre: "Pop", keyPc: 8, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 6, 4, 5] },
  { id: "photograph", title: "Photograph", artist: "Ed Sheeran", genre: "Pop", keyPc: 4, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 6, 5, 4] },
  { id: "someone-like-you", title: "Someone Like You", artist: "Adele", genre: "Pop", keyPc: 9, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 5, 6, 4] },
  { id: "the-scientist", title: "The Scientist", artist: "Coldplay", genre: "Pop Rock", keyPc: 5, scale: "major", difficulty: "easy", compatibility: "full", main: [6, 4, 1, 5] },
  { id: "fix-you", title: "Fix You", artist: "Coldplay", genre: "Pop Rock", keyPc: 3, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 3, 6, 4] },
  { id: "yellow", title: "Yellow", artist: "Coldplay", genre: "Pop Rock", keyPc: 11, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 5, 4, 1] },
  { id: "wonderwall", title: "Wonderwall", artist: "Oasis", genre: "Britpop", keyPc: 6, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 3, 7, 4] },
  { id: "dont-look-back-in-anger", title: "Don't Look Back in Anger", artist: "Oasis", genre: "Rock", keyPc: 0, scale: "major", difficulty: "easy", compatibility: "simplified", main: [1, 5, 6, 4] },
  { id: "creep", title: "Creep", artist: "Radiohead", genre: "Alternative Rock", keyPc: 7, scale: "major", difficulty: "medium", compatibility: "simplified", main: [1, 3, 4, 4] },
  { id: "boulevard-of-broken-dreams", title: "Boulevard of Broken Dreams", artist: "Green Day", genre: "Alternative Rock", keyPc: 5, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 3, 7, 4] },
  { id: "21-guns", title: "21 Guns", artist: "Green Day", genre: "Rock", keyPc: 5, scale: "major", difficulty: "easy", compatibility: "full", main: [6, 4, 1, 5] },
  { id: "californication", title: "Californication", artist: "Red Hot Chili Peppers", genre: "Alternative Rock", keyPc: 9, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "otherside", title: "Otherside", artist: "Red Hot Chili Peppers", genre: "Alternative Rock", keyPc: 9, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "smells-like-teen-spirit", title: "Smells Like Teen Spirit", artist: "Nirvana", genre: "Grunge", keyPc: 5, scale: "minor", difficulty: "medium", compatibility: "simplified", main: [1, 4, 3, 6] },
  { id: "come-as-you-are", title: "Come as You Are", artist: "Nirvana", genre: "Grunge", keyPc: 4, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 7, 1, 7] },
  { id: "bring-me-to-life", title: "Bring Me to Life", artist: "Evanescence", genre: "Nu Metal", keyPc: 4, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "my-immortal", title: "My Immortal", artist: "Evanescence", genre: "Alternative Rock", keyPc: 9, scale: "major", difficulty: "medium", compatibility: "advanced", main: [1, 5, 6, 4] },
  { id: "aerials", title: "Aerials", artist: "System of a Down", genre: "Alternative Metal", keyPc: 0, scale: "minor", difficulty: "medium", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "lonely-day", title: "Lonely Day", artist: "System of a Down", genre: "Alternative Metal", keyPc: 2, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "change-house-of-flies", title: "Change (In the House of Flies)", artist: "Deftones", genre: "Alternative Metal", keyPc: 0, scale: "minor", difficulty: "medium", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "behind-blue-eyes", title: "Behind Blue Eyes", artist: "Limp Bizkit / The Who", genre: "Rock", keyPc: 4, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 3, 7, 6] },
  { id: "i-hate-everything-about-you", title: "I Hate Everything About You", artist: "Three Days Grace", genre: "Alternative Rock", keyPc: 6, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "the-diary-of-jane", title: "The Diary of Jane", artist: "Breaking Benjamin", genre: "Alternative Metal", keyPc: 10, scale: "minor", difficulty: "medium", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "the-kill", title: "The Kill", artist: "Thirty Seconds to Mars", genre: "Alternative Rock", keyPc: 0, scale: "minor", difficulty: "easy", compatibility: "simplified", main: [1, 6, 3, 7] },
  { id: "radioactive", title: "Radioactive", artist: "Imagine Dragons", genre: "Pop Rock", keyPc: 11, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 3, 7, 4] },
  { id: "stressed-out", title: "Stressed Out", artist: "Twenty One Pilots", genre: "Alternative Pop", keyPc: 9, scale: "minor", difficulty: "medium", compatibility: "advanced", main: [1, 7, 6, 3] },
  { id: "cheap-thrills", title: "Cheap Thrills", artist: "Sia", genre: "Pop", keyPc: 6, scale: "minor", difficulty: "easy", compatibility: "full", main: [3, 7, 1, 6] },
  { id: "you-broke-me-first", title: "You Broke Me First", artist: "Tate McRae", genre: "Pop", keyPc: 1, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "let-her-go", title: "Let Her Go", artist: "Passenger", genre: "Pop", keyPc: 7, scale: "major", difficulty: "easy", compatibility: "full", main: [4, 1, 5, 6] },
  { id: "counting-stars", title: "Counting Stars", artist: "OneRepublic", genre: "Pop Rock", keyPc: 1, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 3, 7, 6] },
  { id: "save-tonight", title: "Save Tonight", artist: "Eagle-Eye Cherry", genre: "Pop Rock", keyPc: 9, scale: "minor", difficulty: "easy", compatibility: "full", main: [1, 6, 3, 7] },
  { id: "no-woman-no-cry", title: "No Woman, No Cry", artist: "Bob Marley & The Wailers", genre: "Reggae", keyPc: 0, scale: "major", difficulty: "easy", compatibility: "full", main: [1, 5, 6, 4] },
];

export const HEAVEN_SONGS: Song[] = ROWS.map((row) => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  genre: row.genre,
  keyPc: row.keyPc,
  scale: row.scale,
  bpm: null,
  difficulty: row.difficulty,
  compatibility: row.compatibility,
  arrangementType: "heaven" as const,
  origin: "heaven" as const,
  sections: [
    { id: `${row.id}-main`, name: "Main", degrees: row.main },
    ...(row.sections ?? []).map((s) => ({
      id: `${row.id}-${s.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: s.name,
      degrees: s.degrees,
    })),
  ],
}));
