import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser, getClientIp } from '@/lib/auth';
import { WorkflowStep, ApprovalStatus, Role } from '@prisma/client';

const STEP_ROLES: Record<WorkflowStep, Role[]> = {
  REVIEWER: [Role.ADMIN, Role.APPROVER],
  MANAGER: [Role.ADMIN, Role.APPROVER],
  FINANCE_ADMIN: [Role.ADMIN],
  COMPLETED: [Role.ADMIN],
};

const NEXT_STEP: Record<WorkflowStep, WorkflowStep> = {
  REVIEWER: WorkflowStep.MANAGER,
  MANAGER: WorkflowStep.FINANCE_ADMIN,
  FINANCE_ADMIN: WorkflowStep.COMPLETED,
  COMPLETED: WorkflowStep.COMPLETED,
};

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId, action, comments } = await req.json();
    if (!documentId || !action) return NextResponse.json({ error: 'documentId and action are required' }, { status: 400 });
    if (!['APPROVE', 'REJECT'].includes(action)) return NextResponse.json({ error: 'action must be APPROVE or REJECT' }, { status: 400 });

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (doc.status !== ApprovalStatus.PENDING) {
      return NextResponse.json({ error: 'Document workflow is already completed' }, { status: 400 });
    }

    const allowedRoles = STEP_ROLES[doc.currentStep];
    if (!allowedRoles.includes(user.role as Role)) {
      return NextResponse.json({ error: `Step "${doc.currentStep}" requires one of: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    const workflowStatus = action === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

    const result = await prisma.$transaction(async (tx) => {
      await tx.approvalHistory.create({
        data: { documentId, step: doc.currentStep, status: workflowStatus, userId: user.id, comments },
      });

      let updatedStep = doc.currentStep;
      let globalStatus: ApprovalStatus = ApprovalStatus.PENDING;

      if (workflowStatus === ApprovalStatus.REJECTED) {
        globalStatus = ApprovalStatus.REJECTED;
      } else {
        updatedStep = NEXT_STEP[doc.currentStep];
        if (updatedStep === WorkflowStep.COMPLETED) {
          globalStatus = ApprovalStatus.APPROVED;
        }
      }

      const updatedDoc = await tx.document.update({
        where: { id: documentId },
        data: { currentStep: updatedStep, status: globalStatus },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: `WORKFLOW_${doc.currentStep}_${action}`,
          documentId,
          details: `Step → ${updatedStep}. Status → ${globalStatus}. Comment: ${comments || 'none'}`,
          ipAddress: getClientIp(req),
        },
      });

      return updatedDoc;
    });

    return NextResponse.json({ document: result });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This step has already been actioned for this document' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
