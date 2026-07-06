import { prisma } from './prisma';
import crypto from 'crypto';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'HASH_MATCH' | 'INVOICE_NUM_MATCH' | 'VENDOR_AMOUNT_MATCH';
  existingDocumentId?: string;
}

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function verifyDocumentUniqueness(params: {
  fileBuffer: Buffer;
  invoiceNumber?: string;
  vendorName: string;
  amountInclVat: number;
  documentDate?: string; // ISO YYYY-MM-DD
}): Promise<DuplicateCheckResult> {
  // 1. Exact file content hash check
  const fileHash = computeFileHash(params.fileBuffer);
  const exactFileMatch = await prisma.document.findUnique({ where: { fileHash } });
  if (exactFileMatch) {
    return { isDuplicate: true, reason: 'HASH_MATCH', existingDocumentId: exactFileMatch.id };
  }

  // 2. Invoice number + vendor match
  if (params.invoiceNumber) {
    const invoiceNumMatch = await prisma.document.findFirst({
      where: {
        invoiceNumber: params.invoiceNumber,
        vendorName: { equals: params.vendorName, mode: 'insensitive' },
      },
    });
    if (invoiceNumMatch) {
      return { isDuplicate: true, reason: 'INVOICE_NUM_MATCH', existingDocumentId: invoiceNumMatch.id };
    }
  }

  // 3. Same vendor + same total + same document date (only when no invoice number present)
  // We require documentDate to also match so that two legitimately different invoices
  // from the same vendor for the same amount (e.g. monthly recurring) don't false-positive.
  // This layer only runs when invoiceNumber is missing — if both docs have invoice numbers,
  // layer 2 already handles true duplicates.
  if (!params.invoiceNumber && params.documentDate) {
    const dateStart = new Date(params.documentDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(params.documentDate);
    dateEnd.setHours(23, 59, 59, 999);

    const secondaryMatch = await prisma.document.findFirst({
      where: {
        vendorName: { equals: params.vendorName, mode: 'insensitive' },
        amountInclVat: params.amountInclVat,
        documentDate: { gte: dateStart, lte: dateEnd },
        invoiceNumber: null, // only match docs that also had no invoice number
      },
    });
    if (secondaryMatch) {
      return { isDuplicate: true, reason: 'VENDOR_AMOUNT_MATCH', existingDocumentId: secondaryMatch.id };
    }
  }

  return { isDuplicate: false };
}
