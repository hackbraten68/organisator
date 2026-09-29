import { describe, expect, it } from 'vitest';
import { fileToBase64 } from './fileToBase64';

/**
 * The UI API `VersionData` field is a Base64 scalar. These tests pin the
 * conversion that makes the document upload work at all — passing a Blob to a
 * Base64 scalar is what the absence upload used to do.
 */
describe('fileToBase64', () => {
  const fileWith = (bytes: Uint8Array, name = 'note.pdf') =>
    new File([bytes as unknown as BlobPart], name, { type: 'application/pdf' });

  it('returns the payload without the data-url prefix', async () => {
    // "PDF" in base64.
    const base64 = await fileToBase64(
      fileWith(new TextEncoder().encode('PDF'))
    );

    expect(base64).toBe('UERG');
    expect(base64).not.toContain('data:');
    expect(base64).not.toContain(',');
  });

  it('encodes an empty file as an empty string', async () => {
    expect(await fileToBase64(fileWith(new Uint8Array(0)))).toBe('');
  });

  it('encodes binary content that is not valid utf-8', async () => {
    const bytes = new Uint8Array([0x00, 0xff, 0xfe, 0x10]);
    const base64 = await fileToBase64(fileWith(bytes));

    expect(base64).toBe('AP/+EA==');
  });

  it('rejects when the file cannot be read', async () => {
    const broken = {
      name: 'broken.pdf',
    } as unknown as File;
    // jsdom's FileReader needs a real Blob; a plain object makes onerror fire.
    await expect(fileToBase64(broken)).rejects.toThrow();
  });
});
