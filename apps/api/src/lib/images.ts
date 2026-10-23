// Checks an upload's real type from its bytes, since the declared Content Type can be faked
export type ImageKind = 'png' | 'jpeg' | 'webp';

export function sniffImage(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) 
    return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) 
    return 'jpeg';
  // WebP: "RIFF" .... "WEBP"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') 
  {
    return 'webp';
  }
  return null;
}

export const EXTENSION: Record<ImageKind, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

/* Photos carry metadata: camera, time taken, often the GPS position where they were taken. An avatar is served at a public URL,
so everything that isn't needed to draw the picture is removed before the file is stored. The image data itself is copied byte for byte,
nothing is decoded or re-encoded, so there is no quality loss and no image library to trust with untrusted input.
Returns null when the file isn't structurally what its signature claims */
export function stripMetadata(buffer: Buffer, kind: ImageKind): Buffer | null {
  try {
    if (kind === 'jpeg')
      return stripJpeg(buffer);
    if (kind === 'png')
      return stripPng(buffer);
    return stripWebp(buffer);
  } catch {
    // A read past the end of a malformed file
    return null;
  }
}

// JPEG: a list of segments (FF marker, 2 byte length, data) up to the start of scan, then the compressed image
function stripJpeg(input: Buffer): Buffer | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8)
    return null;
  const parts: Buffer[] = [input.subarray(0, 2)];
  let exifAt = 1;
  let orientation: number | null = null;
  let i = 2;
  while (i < input.length)
  {
    if (input[i] !== 0xff)
      return null;
    // Any number of 0xFF fill bytes may come before a marker
    while (i < input.length && input[i] === 0xff)
      i += 1;
    const marker = input[i];
    if (marker === undefined)
      return null;
    i += 1;
    // End of image. Anything after it (camera trailers, the video of a "motion photo") is dropped with the rest
    if (marker === 0xd9)
    {
      parts.push(Buffer.from([0xff, 0xd9]));
      break;
    }
    // Markers that have no length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
    {
      parts.push(Buffer.from([0xff, marker]));
      continue;
    }
    const length = input.readUInt16BE(i);
    if (length < 2 || i + length > input.length)
      return null;
    const segment = input.subarray(i, i + length);
    const data = segment.subarray(2);
    i += length;
    // APP1 is EXIF and XMP. Only the orientation is worth keeping: phones store photos sideways and rely on it to show them upright
    if (marker === 0xe1)
    {
      orientation ??= exifOrientation(data);
      continue;
    }
    if (!keepJpegSegment(marker, data))
      continue;
    parts.push(Buffer.from([0xff, marker]), segment);
    // The JFIF header is expected first, so the orientation goes right after it
    if (marker === 0xe0 && parts.length === 3)
      exifAt = 3;
    // Start of scan: compressed data follows, up to the next marker that is neither a stuffed FF 00 nor a restart marker
    if (marker === 0xda)
    {
      const start = i;
      while (i < input.length)
      {
        const next = input[i + 1];
        if (input[i] === 0xff && next !== undefined && next !== 0x00 && (next < 0xd0 || next > 0xd7))
          break;
        i += input[i] === 0xff && next !== undefined ? 2 : 1;
      }
      parts.push(input.subarray(start, i));
    }
  }
  // A file with no end marker is truncated; browsers still draw what is there, so it is kept as it is
  if (orientation !== null && orientation !== 1)
    parts.splice(exifAt, 0, orientationSegment(orientation));
  return Buffer.concat(parts);
}

function keepJpegSegment(marker: number, data: Buffer): boolean {
  const id = (text: string) => data.toString('latin1', 0, text.length) === text;
  // APP0: the JFIF header, but not a JFXX thumbnail
  if (marker === 0xe0)
    return id('JFIF\0');
  // APP2: the colour profile, but not FlashPix or the extra pictures of an MPF file
  if (marker === 0xe2)
    return id('ICC_PROFILE\0');
  // APP14: Adobe's colour transform flag, without it some CMYK images decode with the wrong colours
  if (marker === 0xee)
    return id('Adobe');
  // The other APPn segments (IPTC, vendor data) and comments
  if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe)
    return false;
  // Everything else is the image: quantisation and Huffman tables, frame and scan headers
  return true;
}

// Reads the orientation (tag 0x0112) from an EXIF block: "Exif\0\0", then a TIFF header and its first directory
function exifOrientation(data: Buffer): number | null {
  if (data.length < 14 || data.toString('latin1', 0, 6) !== 'Exif\0\0')
    return null;
  const tiff = data.subarray(6);
  const order = tiff.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM')
    return null;
  const little = order === 'II';
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  // A broken EXIF block costs the photo its orientation, not the upload, so a read past its end is not an error
  try {
    if (u16(2) !== 42)
      return null;
    const directory = u32(4);
    const count = u16(directory);
    for (let n = 0; n < count; n += 1)
    {
      const entry = directory + 2 + n * 12;
      // Type 3 is SHORT, the value sits in the entry itself
      if (u16(entry) === 0x0112)
      {
        const value = u16(entry + 2) === 3 ? u16(entry + 8) : 0;
        return value >= 1 && value <= 8 ? value : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// A minimal APP1 EXIF segment holding the orientation and nothing else
function orientationSegment(orientation: number): Buffer {
  return Buffer.from([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big endian TIFF header, first directory at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // orientation, SHORT, 1 value
    0x00, 0x00, 0x00, 0x00, // no next directory
  ]);
}

// PNG chunks needed to draw the image the way it was meant to look, animation included. Text (tEXt, zTXt, iTXt, XMP), eXIf and tIME are not
const PNG_KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs', 'acTL', 'fcTL', 'fdAT',
]);
const PNG_IEND = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

// PNG: the 8 byte signature, then chunks of length, type, data and CRC. Kept chunks are copied whole, so their CRCs stay valid
function stripPng(input: Buffer): Buffer | null {
  const parts: Buffer[] = [input.subarray(0, 8)];
  let sawImage = false;
  let i = 8;
  while (i + 12 <= input.length)
  {
    const length = input.readUInt32BE(i);
    const end = i + 12 + length;
    if (end > input.length)
      return null;
    const type = input.toString('latin1', i + 4, i + 8);
    if (PNG_KEEP.has(type))
      parts.push(input.subarray(i, end));
    if (type === 'IDAT')
      sawImage = true;
    if (type === 'IEND')
      return sawImage ? Buffer.concat(parts) : null;
    i = end;
  }
  // Truncated after the image data: closed off properly rather than refused
  return sawImage ? Buffer.concat([...parts, PNG_IEND]) : null;
}

// WebP chunks needed to draw the image; EXIF, "XMP " and unknown chunks are not
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);

// WebP: a RIFF container, "RIFF", the size, "WEBP", then chunks of type, size and data, each padded to an even length
function stripWebp(input: Buffer): Buffer | null {
  const riffEnd = Math.min(input.length, 8 + input.readUInt32LE(4));
  const parts: Buffer[] = [];
  let sawImage = false;
  let i = 12;
  while (i + 8 <= riffEnd)
  {
    const type = input.toString('latin1', i, i + 4);
    const size = input.readUInt32LE(i + 4);
    if (i + 8 + size > riffEnd)
      return null;
    if (WEBP_KEEP.has(type))
    {
      const chunk = Buffer.from(input.subarray(i, i + 8 + size));
      // The extended header's flags announce which chunks follow; the EXIF (0x08) and XMP (0x04) ones are gone now
      if (type === 'VP8X' && size > 0)
        chunk[8] = (chunk[8] ?? 0) & ~0x0c;
      parts.push(chunk);
      if (size % 2 === 1)
        parts.push(Buffer.from([0]));
      if (type !== 'VP8X')
        sawImage = true;
    }
    i += 8 + size + (size % 2);
  }
  if (!sawImage)
    return null;
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}
