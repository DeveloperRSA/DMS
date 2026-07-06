import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth';
import { generateInsights } from '@/lib/gemini';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const vendor = searchParams.get('vendor') || undefined;
    const status = searchParams.get('status') || undefined;
    const analyzeAI = searchParams.get('analyze') === 'true';

    const where: any = {};
    if (vendor) where.vendorName = { contains: vendor, mode: 'insensitive' };
    if (status) where.status = status;

    const [records, totals] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          type: true,
          vendorName: true,
          amountInclVat: true,
          vatAmount: true,
          amountExclVat: true,
          documentDate: true,
          status: true,
          currency: true,
          invoiceNumber: true,
          currentStep: true,
          fileName: true,
        },
        orderBy: { documentDate: 'asc' },
        take: 500,
      }),
      prisma.document.aggregate({
        where,
        _sum: { amountInclVat: true, vatAmount: true },
        _count: true,
      }),
    ]);

    let insights: string | null = null;
    if (analyzeAI && records.length > 0) {
      const contextSummary = records
        .map(
          (r) =>
            `Date:${r.documentDate.toISOString().split('T')[0]} | Vendor:${r.vendorName} | Type:${r.type} | Total:${r.amountInclVat} | VAT:${r.vatAmount} | Status:${r.status}`
        )
        .join('\n');
      insights = await generateInsights(contextSummary);
    }

    return NextResponse.json({ data: records, totals, insights });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
