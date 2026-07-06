import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        approvals: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { actionedAt: 'asc' },
        },
        auditLogs: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ document });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
