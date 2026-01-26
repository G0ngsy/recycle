
import { GoogleGenAI, Type } from "@google/genai";
import { RecyclingResult } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RECYCLING_PROMPT = `당신은 대한민국 분리수거 전문가입니다. 
제공된 정보(이미지 또는 텍스트) 속의 물건을 식별하고, 해당 물건의 분리수거 카테고리와 상세 배출 방법을 한국어로 설명해주세요. 
카테고리는 (플라스틱, 페트, 종이, 종이팩, 유리, 캔, 고철, 비닐, 스티로폼, 폐건전지, 형광등, 대형폐기물, 일반쓰레기) 중 하나를 선택하세요.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    itemName: { type: Type.STRING },
    category: { type: Type.STRING },
    isRecyclable: { type: Type.BOOLEAN },
    disposalSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
    tips: { type: Type.STRING }
  },
  required: ["itemName", "category", "isRecyclable", "disposalSteps", "tips"]
};

export const analyzeImage = async (base64Image: string): Promise<RecyclingResult> => {
  // Use gemini-3-flash-preview for basic text and image tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        { text: RECYCLING_PROMPT }
      ]
    },
    config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
  });
  // Use response.text property to get the generated text directly
  return JSON.parse(response.text || "{}");
};

export const searchRecycling = async (query: string): Promise<RecyclingResult> => {
  // Use gemini-3-flash-preview for basic text tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `물건 이름: "${query}". ${RECYCLING_PROMPT}`,
    config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
  });
  // Use response.text property to get the generated text directly
  return JSON.parse(response.text || "{}");
};
