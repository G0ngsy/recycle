import type { RecyclingResult } from '../../types';
import { disposalTime, knownText, regionLabel, stepText } from '../../services/display';
import { guidelinePdfUrl } from '../../services/api';
import InfoBox from './InfoBox';

const PAGE_LOADED_AT = Date.now();

export default function GuideContent({ result }: { result: RecyclingResult }) {
  const info = result.wasteInfo;
  const steps = result.disposalSteps ?? [];
  const tips = result.tips ?? [];
  const recordedAt = info?.데이터기준일자 ? new Date(`${info.데이터기준일자}T00:00:00`).getTime() : NaN;
  const stale = info?.오래된정보 || (Number.isFinite(recordedAt) && PAGE_LOADED_AT - recordedAt > 365 * 24 * 60 * 60 * 1000);
  return <div className="guide-layout">
    {result.guideStatus === 'ready' && <div className="guide-main"><InfoBox title="배출 방법">
      {steps.length ? <ol className="flex flex-col gap-3">
        {steps.map((step, index) => <li key={index} className="flex items-start gap-3 leading-7">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">{index + 1}</span>
          <span className="text-slate-700 break-words">{stepText(step)}</span>
        </li>)}
      </ol> : <p className="text-sm text-slate-600">배출 단계가 제공되지 않았습니다. 지역 정보와 공식 근거를 확인해주세요.</p>}
    </InfoBox></div>}
    {info && <div className="guide-region"><InfoBox variant="info" title="우리 지역 배출 정보">
      <p className="mb-3 text-sm text-slate-700 break-words">{regionLabel(info.시도명, info.시군구명, info.관리구역대상지역명)}</p>
      {info.legacyRules ? <div className="space-y-3">{info.legacyRules.map((rule, index) => <div key={index} className="rounded-xl bg-white/70 p-3 text-sm leading-7">
        <p><strong>요일:</strong> {knownText(rule.disposalDays).replaceAll('+', ' · ') || '확인 필요'}</p>
        <p><strong>시간:</strong> {disposalTime(rule.startTime, rule.endTime)}</p>
        <p><strong>장소:</strong> {knownText(rule.place) || '확인 필요'}</p>
        <p><strong>방법:</strong> {knownText(rule.method) || '확인 필요'}</p>
      </div>)}<p className="text-sm text-amber-800">저장 당시의 지역 정보입니다. 정확한 배출장소를 다시 선택해주세요.</p></div>
      : <dl className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-slate-700 leading-7">
        <dt>요일</dt><dd className="font-semibold">{knownText(info.배출요일).replaceAll('+', ' · ') || '확인 필요'}</dd>
        <dt>시간</dt><dd className="font-semibold">{disposalTime(info.배출시작시각, info.배출종료시각)}</dd>
        <dt>장소</dt><dd className="font-semibold break-words">{knownText(info.배출장소).replaceAll('+', ' · ') || '확인 필요'}</dd>
        <dt>방법</dt><dd className="break-words">{knownText(info.재활용품배출방법) || '확인 필요'}</dd>
      </dl>}
      <p className="mt-4 text-sm text-slate-600">데이터 기준일: {info.데이터기준일자 || '미기록'}</p>
      {stale && <p className="mt-2 text-sm font-medium text-amber-800">오래된 정보입니다. 배출 전에 해당 지자체의 최신 안내를 확인해주세요.</p>}
    </InfoBox></div>}
    {result.guideStatus === 'ready' && tips.length > 0 && <div className="guide-main"><InfoBox variant="warning" title="주의사항">
      <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-7">{tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
    </InfoBox></div>}
    {!!result.guidelineReferences?.length && <div className="guide-main"><InfoBox title="공식 근거">
      <p className="text-sm font-medium text-slate-700">환경부 분리배출 가이드라인 · 2018년</p>
      <p className="mt-1 text-sm text-slate-600">배출 전 해당 지자체의 최신 안내를 확인해주세요.</p>
      <div className="mt-3 space-y-3">{result.guidelineReferences.map(reference => <div key={reference.page} className="rounded-xl border border-slate-200 p-3">
        <p className="font-medium text-slate-700">{reference.title} · {reference.page}쪽</p>
        <details className="mt-2"><summary className="cursor-pointer min-h-11 py-3 text-sm font-medium text-emerald-800 focus-visible:outline focus-visible:outline-2">원문 발췌 보기</summary>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600 leading-7 break-words">{reference.excerpt}</p>
        </details>
        <a className="inline-flex min-h-11 items-center text-sm font-medium text-blue-800 underline" href={guidelinePdfUrl(reference.page)} target="_blank" rel="noopener noreferrer">원문 {reference.page}쪽 열기</a>
      </div>)}</div>
    </InfoBox></div>}
  </div>;
}
