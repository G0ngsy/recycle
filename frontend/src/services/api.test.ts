import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWasteRecords, getRecyclingGuide, getRegions, getSigungu } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('URL-encodes the selected province', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sido: '서울 특별시', sigungu: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await getSigungu('서울 특별시');
    expect(fetchMock.mock.calls[0][0]).toContain('%EC%84%9C%EC%9A%B8%20%ED%8A%B9%EB%B3%84%EC%8B%9C');
  });

  it('returns the server-safe error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: '지원하지 않는 지역입니다.' }), { status: 404 }),
    ));
    await expect(getRegions()).rejects.toThrow('지원하지 않는 지역입니다.');
  });

  it('requests waste records with encoded path segments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 0, records: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await getWasteRecords('경기도', '안성시', '미양면', 30);
    expect(fetchMock.mock.calls[0][0]).toContain('/sigungu/%EC%95%88%EC%84%B1%EC%8B%9C/waste-records');
    expect(fetchMock.mock.calls[0][0]).toContain('offset=30');
  });

  it('sends the selected management number with the guide request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await getRecyclingGuide('페트병', '경기도', '안성시', '12345');
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string).managementId).toBe('12345');
  });
});
