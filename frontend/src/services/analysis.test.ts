import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ analyzeImage: vi.fn() }));
import { analyzeImage } from './api';
import { analyzePhotoOnce, photoItemDraft, rememberPhotoItem } from './analysis';

const mark = { category: null, material: null, texts: [] };
beforeEach(() => vi.mocked(analyzeImage).mockReset());

describe('photo analysis across routes', () => {
  it('shares concurrent analysis and reuses the result after back navigation', async () => {
    vi.mocked(analyzeImage).mockResolvedValue(mark);
    const first = analyzePhotoOnce('photo-one');
    const second = analyzePhotoOnce('photo-one');
    expect(first).toBe(second);
    await first;
    expect(await analyzePhotoOnce('photo-one')).toEqual(mark);
    expect(analyzeImage).toHaveBeenCalledTimes(1);
    rememberPhotoItem('photo-one', '유리병');
    expect(photoItemDraft('photo-one')).toBe('유리병');
  });
  it('allows retry after a failed analysis', async () => {
    vi.mocked(analyzeImage).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(mark);
    await expect(analyzePhotoOnce('photo-two')).rejects.toThrow('offline');
    expect(await analyzePhotoOnce('photo-two')).toEqual(mark);
    expect(analyzeImage).toHaveBeenCalledTimes(2);
  });
  it('bounds the cache rather than retaining all uploaded photos', async () => {
    vi.mocked(analyzeImage).mockResolvedValue(mark);
    for (const photo of ['a', 'b', 'c', 'd']) await analyzePhotoOnce(photo);
    await analyzePhotoOnce('a');
    expect(analyzeImage).toHaveBeenCalledTimes(5);
  });
});
