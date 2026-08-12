import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { searchGuidance } from "@/lib/ai/guidance-search";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("searchGuidance (integration)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "HmrcGuidanceChunk" RESTART IDENTITY CASCADE');

    await prisma.hmrcGuidanceChunk.createMany({
      data: [
        {
          sourceTitle: "CIRD81900",
          sourceUrl: "https://www.gov.uk/hmrc-internal-manuals/corporate-intangibles-research-and-development-manual/cird81900",
          heading: "Conditions to be satisfied: definition of R&D",
          content: "For tax purposes, R&D takes place when a project seeks an advance in science or technology through the resolution of scientific or technological uncertainty.",
          chunkIndex: 0,
        },
        {
          sourceTitle: "CIRD82000",
          sourceUrl: "https://www.gov.uk/hmrc-internal-manuals/corporate-intangibles-research-and-development-manual/cird82000",
          heading: "Software and R&D",
          content: "Software development can qualify as R&D where it seeks to achieve an advance in computer science, not merely an advance in a company's own knowledge or capability.",
          chunkIndex: 0,
        },
        {
          sourceTitle: "CIRD83000",
          sourceUrl: "https://www.gov.uk/hmrc-internal-manuals/corporate-intangibles-research-and-development-manual/cird83000",
          heading: "Competent professional",
          content: "The assessment of whether an advance was sought, and whether an uncertainty existed, is made by reference to a competent professional working in the field.",
          chunkIndex: 0,
        },
      ],
    });
  });

  it("returns chunks matching the query, ranked by relevance", async () => {
    const results = await searchGuidance(prisma, "software advance computer science");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sourceTitle).toBe("CIRD82000");
  });

  it("returns an empty array for a query with no matches", async () => {
    const results = await searchGuidance(prisma, "unrelated gibberish xyzzy plugh");
    expect(results).toEqual([]);
  });

  it("returns an empty array for a blank query without hitting the database", async () => {
    const results = await searchGuidance(prisma, "   ");
    expect(results).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    const results = await searchGuidance(prisma, "R&D uncertainty advance", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("includes the source citation fields", async () => {
    const results = await searchGuidance(prisma, "competent professional");
    expect(results[0]).toMatchObject({
      sourceTitle: "CIRD83000",
      sourceUrl: expect.stringContaining("cird83000"),
      heading: "Competent professional",
    });
  });
});
