import { describe, expect, it, vi, afterEach } from 'vitest';
import { preparePhoto } from './photo';

afterEach(() => vi.unstubAllGlobals());

describe('photo input', () => {
  it('rejects unsupported phone formats before decoding', async () => {
    await expect(preparePhoto({ type: 'image/heic', size: 100 } as File)).rejects.toThrow('JPEG');
  });
  it('rejects oversized input before decoding', async () => {
    await expect(preparePhoto({ type: 'image/jpeg', size: 21 * 1024 * 1024 } as File)).rejects.toThrow('20MB');
  });
  it('turns decoding failure into a readable error', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));
    await expect(preparePhoto({ type: 'image/jpeg', size: 100 } as File)).rejects.toThrow('손상되지 않은');
  });
  it('limits long side to 1600 and releases decoded resources', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }));
    const drawImage = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage }),
      toDataURL: () => 'data:image/jpeg;base64,result' };
    vi.stubGlobal('document', { createElement: () => canvas });
    expect(await preparePhoto({ type: 'image/png', size: 100 } as File)).toContain('image/jpeg');
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect(close).toHaveBeenCalledOnce();
  });
});
