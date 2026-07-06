import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getClientIp } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractDocumentData } from '@/lib/gemini';
import { verifyDocumentUniqueness, computeFileHash } from '@/lib/duplicateCheck';
import { saveFile } from '@/lib/storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, JPEG, PNG, and WebP files are accepted' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Extract data via Gemini AI
    const extractedData = await extractDocumentData(buffer, file.type);

    // 2. Server-side duplicate check
    const duplicateStatus = await verifyDocumentUniqueness({
      fileBuffer: buffer,
      invoiceNumber: extractedData.invoiceNumber,
      vendorName: extractedData.vendorName,
      amountInclVat: extractedData.amountInclVat,
      documentDate: extractedData.documentDate,
    });

    if (duplicateStatus.isDuplicate) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'DUPLICATE_FLAGGED',
          details: JSON.stringify({ reason: duplicateStatus.reason, existingDocumentId: duplicateStatus.existingDocumentId }),
          ipAddress: getClientIp(req),
        },
      });
      return NextResponse.json(
        { error: 'Duplicate document detected', reason: duplicateStatus.reason, existingDocumentId: duplicateStatus.existingDocumentId },
        { status: 409 }
      );
    }

    // 3. Save file to storage
    const storageUrl = await saveFile(buffer, file.name);
    const fileHash = computeFileHash(buffer);

    // 4. Persist document record
    const document = await prisma.document.create({
      data: {
        type: extractedData.type,
        storageUrl,
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        invoiceNumber: extractedData.invoiceNumber,
        vendorName: extractedData.vendorName,
        documentDate: new Date(extractedData.documentDate),
        amountExclVat: extractedData.amountExclVat,
        vatAmount: extractedData.vatAmount,
        amountInclVat: extractedData.amountInclVat,
        currency: extractedData.currency || 'USD',
        uploadedById: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DOCUMENT_UPLOADED',
        documentId: document.id,
        details: `Uploaded ${file.name} — ${extractedData.vendorName} — ${extractedData.amountInclVat} ${extractedData.currency}`,
        ipAddress: getClientIp(req),
      },
    });

    return NextResponse.json({ document, extractedData }, { status: 201 });
  } catch (error: any) {
    console.error('[UPLOAD ERROR]', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          approvals: { include: { user: { select: { name: true, email: true } } } },
        },
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({ documents, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
