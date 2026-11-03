// Real file bytes for upload tests: the service sniffs the magic bytes, so payloads must be genuine.
const pad = (head: Buffer, size: number) => Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length), 0x20)]);
const dataUrl = (mime: string, buf: Buffer) => `data:${mime};base64,${buf.toString("base64")}`;

export const pdfDataUrl = (size = 64) => dataUrl("application/pdf", pad(Buffer.from("%PDF-1.4\n"), size));
export const pngDataUrl = (size = 64) => dataUrl("image/png", pad(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), size));
export const webpDataUrl = (size = 64) => dataUrl("image/webp", pad(Buffer.from("RIFF\0\0\0\0WEBP"), size));
