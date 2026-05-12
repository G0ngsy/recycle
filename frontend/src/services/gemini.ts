import { GoogleGenAI } from '@google/genai';
import { WasteInfo, RecyclingResult } from '../types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function analyzeImage(base64Image: string): Promise<string> {
  const model = ai.models;
  const response = await model.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
        { text: '이 이미지에서 분리수거할 품목을 찾아 품목명만 짧게 답해줘. 예: 페트병, 종이컵, 캔' }
      ]
    }]
  });
  return response.text?.trim() || '';
}

export async function getRecyclingGuide(
  itemName: string,
  wasteInfo: WasteInfo | null
): Promise<RecyclingResult> {
  const regionContext = wasteInfo
    ? `
지역 배출 정보 (${wasteInfo.시도명} ${wasteInfo.시군구명}):
- 재활용품 배출방법: ${wasteInfo.재활용품배출방법}
- 재활용품 배출요일: ${wasteInfo.재활용품배출요일}
- 재활용품 배출시각: ${wasteInfo.재활용품배출시작시각} ~ ${wasteInfo.재활용품배출종료시각}
- 배출장소: ${wasteInfo.배출장소}
`
    : '';

  const prompt = `
당신은 한국의 분리수거 전문가입니다.
품목: "${itemName}"
${regionContext}

위 품목의 올바른 분리수거 방법을 아래 JSON 형식으로 답해주세요.
반드시 JSON만 출력하고 다른 텍스트는 포함하지 마세요.

{
  "itemName": "품목명",
  "category": "분류 (플라스틱/종이/유리/금속/일반쓰레기/음식물/특수폐기물 중 하나)",
  "isRecyclable": true 또는 false,
  "disposalSteps": ["배출 단계 1", "배출 단계 2", "배출 단계 3"],
  "tips": ["주의사항 1", "주의사항 2"],
  "source": "근거 출처 (예: 환경부 분리배출 가이드라인 2024, 지역 배출정보 등)"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  const text = response.text?.trim() || '{}';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as RecyclingResult;
}
