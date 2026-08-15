import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addComment, CommentError, listComments } from "@/lib/comments/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE = 'TRUNCATE "AuditLog", "SubmissionComment", "WeeklySubmission", "Project", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("comments repository (integration)", () => {
  let companyId: string;
  let submissionId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "finance@example.com", name: "Finance" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({ data: { companyId, name: "Project A", startDate: new Date() } });
    const submission = await prisma.weeklySubmission.create({
      data: { companyId, projectId: project.id, userId, weekKey: "2026-W30", minutes: 60, basis: "TRACKED", isRetrospective: false },
    });
    submissionId = submission.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("posts a comment and lists it back with the author's name", async () => {
    await addComment(prisma, { companyId, submissionId, authorId: userId, body: "Looks good, thanks" });
    const comments = await listComments(prisma, submissionId);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ body: "Looks good, thanks", author: { name: "Finance" } });
  });

  it("rejects a blank comment", async () => {
    await expect(addComment(prisma, { companyId, submissionId, authorId: userId, body: "   " })).rejects.toThrow(CommentError);
  });

  it("writes an audit log entry attributed to the author", async () => {
    const comment = await addComment(prisma, { companyId, submissionId, authorId: userId, body: "Needs more detail" });
    const logs = await prisma.auditLog.findMany({ where: { entityType: "SubmissionComment", entityId: comment.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: "comment:create", actorId: userId, companyId });
  });

  it("comments cannot be updated or deleted (append-only trigger)", async () => {
    const comment = await addComment(prisma, { companyId, submissionId, authorId: userId, body: "Original" });
    await expect(prisma.submissionComment.update({ where: { id: comment.id }, data: { body: "Edited" } })).rejects.toThrow();
    await expect(prisma.submissionComment.delete({ where: { id: comment.id } })).rejects.toThrow();
  });

  it("orders comments oldest first", async () => {
    await addComment(prisma, { companyId, submissionId, authorId: userId, body: "First" });
    await addComment(prisma, { companyId, submissionId, authorId: userId, body: "Second" });
    const comments = await listComments(prisma, submissionId);
    expect(comments.map((c) => c.body)).toEqual(["First", "Second"]);
  });
});
