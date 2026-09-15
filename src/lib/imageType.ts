// Real content-type detection via magic bytes, not the client-supplied
// File.type — an authenticated member calling actions.uploadAvatar directly
// (bypassing the <input accept> attribute) controls that string freely, and
// the avatars bucket is public-read, so trusting it would let an arbitrary
// file (e.g. an SVG with an embedded <script>) be uploaded and served back
// with a spoofed image Content-Type from the project's own Supabase domain.
// Allow-listed to the formats the upload flow actually needs to support.
const SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
];

export function sniffImageType(bytes: Uint8Array): string | null {
  for (const { type, bytes: sig } of SIGNATURES) {
    if (sig.every((b, i) => bytes[i] === b)) return type;
  }
  // WEBP: "RIFF" .... "WEBP" — the 4 size bytes at offset 4-7 vary per file.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
