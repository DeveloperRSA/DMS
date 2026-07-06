import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ExtractedDocumentData {
  type: 'INVOICE' | 'CREDIT_NOTE';
  invoiceNumber?: string;
  vendorName: string;
  documentDate: string; // ISO YYYY-MM-DD
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
  currency: string;
}

export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedDocumentData> {
  if (!process.env.GEMINI_API_KEY) {
    // Demo mode: return plausible mock data when no API key is set
    return {
      type: 'INVOICE',
      invoiceNumber: `INV-${Math.floor(Math.random() * 90000) + 10000}`,
      vendorName: 'Demo Vendor Ltd',
      documentDate: new Date().toISOString().split('T')[0],
      amountExclVat: 1000.0,
      vatAmount: 150.0,
      amountInclVat: 1150.0,
      currency: 'USD',
    };
  }

  const filePart = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      'Extract all parameters from this financial document accurately. Normalize vendor names. Determine if it is an INVOICE or CREDIT_NOTE.',
      filePart,
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['INVOICE', 'CREDIT_NOTE'] },
          invoiceNumber: { type: Type.STRING },
          vendorName: { type: Type.STRING },
          documentDate: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
          amountExclVat: { type: Type.NUMBER },
          vatAmount: { type: Type.NUMBER },
          amountInclVat: { type: Type.NUMBER },
          currency: { type: Type.STRING },
        },
        required: ['type', 'vendorName', 'documentDate', 'amountExclVat', 'vatAmount', 'amountInclVat'],
      },
    },
  });

  return JSON.parse(response.text!) as ExtractedDocumentData;
}

export async function generateInsights(contextSummary: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return `## AI Insights (Demo Mode)\n\nNo Gemini API key configured. Add \`GEMINI_API_KEY\` to your \`.env\` to enable real AI-powered financial analysis.\n\n**What you'd get:**\n- Anomaly detection on vendor spending patterns\n- Duplicate velocity attack warnings\n- VAT optimization recommendations\n- Run-rate projections`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are an expert financial forensic AI. Analyze the following enterprise transaction ledger:\n\n${contextSummary}\n\nProvide a concise summary containing:\n1. Potential anomalies or threats (duplicate velocity attacks, erratic spikes from a single vendor).\n2. Dynamic run-rate projections and optimization strategies regarding VAT profiles.\nKeep the tone direct and highly analytical. Use Markdown format.`,
  });

  return response.text!;
}
