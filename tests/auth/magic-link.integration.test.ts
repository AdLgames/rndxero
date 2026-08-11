import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { sendMagicLinkIfAllowed } from "@/lib/auth/magic-link";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("sendMagicLinkIfAllowed (integration)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User" RESTART IDENTITY CASCADE');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User" RESTART IDENTITY CASCADE');
    await prisma.$disconnect();
  });

  it("sends and records lastMagicLinkSentAt on a fresh user", async () => {
    const user = await prisma.user.create({ data: { email: "a@example.com", name: "A" } });
    expect(user.lastMagicLinkSentAt).toBeNull();

    const result = await sendMagicLinkIfAllowed(prisma, user, {
      origin: "https://app.example.com",
      context: "sign-in",
    });

    expect(result).toEqual({ sent: true });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.lastMagicLinkSentAt).not.toBeNull();
  });

  it("suppresses a repeat send within the cooldown — the actual bug reported (2-3 emails per signup)", async () => {
    const user = await prisma.user.create({ data: { email: "a@example.com", name: "A" } });

    const first = await sendMagicLinkIfAllowed(prisma, user, {
      origin: "https://app.example.com",
      context: "signup",
    });
    const stillFresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    // Simulate a near-immediate duplicate request (double-click, reload, second tab).
    const second = await sendMagicLinkIfAllowed(prisma, stillFresh, {
      origin: "https://app.example.com",
      context: "signup",
    });
    const third = await sendMagicLinkIfAllowed(prisma, stillFresh, {
      origin: "https://app.example.com",
      context: "signup",
    });

    expect(first).toEqual({ sent: true });
    expect(second).toEqual({ sent: false });
    expect(third).toEqual({ sent: false });
  });

  it("allows a fresh send once the cooldown has elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const user = await prisma.user.create({ data: { email: "a@example.com", name: "A" } });
    await sendMagicLinkIfAllowed(prisma, user, { origin: "https://app.example.com", context: "sign-in" });

    vi.setSystemTime(new Date("2026-01-01T00:02:00.000Z")); // 2 minutes later
    const afterCooldown = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const result = await sendMagicLinkIfAllowed(prisma, afterCooldown, {
      origin: "https://app.example.com",
      context: "sign-in",
    });

    expect(result).toEqual({ sent: true });
  });
});
