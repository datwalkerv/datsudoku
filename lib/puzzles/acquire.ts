import "server-only";
import { ObjectId } from "mongodb";
import { collections, ensureIndexes, isDuplicateKeyError, type PuzzleDoc, type PuzzleUsage } from "@/lib/db/collections";
import { env } from "@/lib/env";
import { fetchExternalPuzzle, PuzzleApiError } from "@/lib/sudoku/api";
import { generatePuzzle } from "@/lib/sudoku/generator";
import { serializeGrid } from "@/lib/sudoku/board";
import { randomSeed } from "@/lib/sudoku/seeds";
import type { Difficulty } from "@/lib/sudoku/types";
import { verifyPuzzle } from "./verify";

export interface AcquireOptions {
  difficulty: Difficulty;
  /** Reuse a stored pool puzzle this user has not played, when available. */
  userId?: string;
  /** Daily and room puzzles are always fresh and reserved for that use. */
  usage?: PuzzleUsage;
  /** Test hook. */
  fetchImpl?: typeof fetch;
}

export interface AcquiredPuzzle {
  puzzle: PuzzleDoc;
  /** Set when the external API could not be used. */
  fallbackReason: string | null;
  reused: boolean;
}

type NewPuzzle = Omit<PuzzleDoc, "_id" | "seed" | "createdAt">;

/** Saves a puzzle, resolving duplicates to the existing record. */
async function storePuzzle(doc: NewPuzzle): Promise<PuzzleDoc> {
  const now = new Date();
  const result = await collections.puzzles().findOneAndUpdate(
    { puzzle: doc.puzzle },
    { $setOnInsert: { ...doc, _id: new ObjectId(), seed: randomSeed(), createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  if (!result) throw new Error("Failed to store puzzle");
  return result;
}

async function recordRejection(puzzle: string, difficulty: Difficulty, reason: string, latencyMs: number) {
  try {
    await collections.puzzles().updateOne(
      { puzzle },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          seed: randomSeed(),
          source: "youdosudoku",
          externalPuzzleId: null,
          difficulty,
          puzzle,
          solution: "",
          validationStatus: "rejected",
          usage: "pool",
          createdAt: new Date(),
          metadata: { clues: 0, rejectionReason: reason, latencyMs },
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) console.error("[puzzles] failed to record rejection", error);
  }
}

async function samplePool(difficulty: Difficulty, userId: string): Promise<PuzzleDoc | null> {
  const recent = await collections
    .games()
    .find({ userId }, { projection: { puzzleId: 1 } })
    .sort({ updatedAt: -1 })
    .limit(1000)
    .toArray();
  const played = recent.map((g) => g.puzzleId);
  const [doc] = await collections
    .puzzles()
    .aggregate<PuzzleDoc>([
      { $match: { usage: "pool", difficulty, validationStatus: "valid", _id: { $nin: played } } },
      { $sample: { size: 1 } },
    ])
    .toArray();
  return doc ?? null;
}

function generateInternal(difficulty: Difficulty, usage: PuzzleUsage, fallbackReason: string | null): NewPuzzle {
  const generated = generatePuzzle(randomSeed(), difficulty);
  return {
    source: "internal",
    externalPuzzleId: null,
    difficulty,
    puzzle: serializeGrid(generated.puzzle),
    solution: serializeGrid(generated.solution),
    validationStatus: "valid",
    usage,
    metadata: {
      clues: generated.clues,
      logicLevel: generated.level,
      solutionSource: "generator",
      ...(fallbackReason ? { fallbackReason } : {}),
    },
  };
}

/**
 * Acquires a verified puzzle and persists it before returning it.
 *
 * 1. Classic: reuse an unplayed pool puzzle to avoid unnecessary API calls.
 * 2. Easy/Medium/Hard: fetch from YouDoSudoku, validate, verify uniqueness.
 * 3. Expert, or when the API is unavailable: internal seeded generator.
 */
export async function acquirePuzzle(options: AcquireOptions): Promise<AcquiredPuzzle> {
  const { difficulty, userId } = options;
  const usage = options.usage ?? "pool";
  await ensureIndexes();

  if (usage === "pool" && userId) {
    const reused = await samplePool(difficulty, userId);
    if (reused) return { puzzle: reused, fallbackReason: null, reused: true };
  }

  if (difficulty === "expert") {
    return { puzzle: await storePuzzle(generateInternal(difficulty, usage, null)), fallbackReason: null, reused: false };
  }

  let fallbackReason: string;
  try {
    // Two tries: a rare non-unique puzzle from the API is rejected and refetched.
    for (let attempt = 0; attempt < 2; attempt++) {
      const external = await fetchExternalPuzzle(difficulty, {
        apiKey: env.YOUDOSUDOKU_API_KEY,
        url: env.YOUDOSUDOKU_API_URL,
        fetchImpl: options.fetchImpl,
      });
      const verified = verifyPuzzle(external.puzzle, external.solution);
      if (!verified.ok) {
        console.warn(`[puzzles] rejected external puzzle: ${verified.reason}`);
        await recordRejection(external.puzzle, difficulty, verified.reason, external.latencyMs);
        continue;
      }
      const stored = await storePuzzle({
        source: "youdosudoku",
        externalPuzzleId: null,
        difficulty,
        puzzle: external.puzzle,
        solution: verified.solution,
        validationStatus: "valid",
        usage,
        metadata: {
          requestedDifficulty: difficulty,
          reportedDifficulty: external.reportedDifficulty ?? undefined,
          clues: verified.clues,
          latencyMs: external.latencyMs,
          solutionSource: verified.solutionSource,
        },
      });
      return { puzzle: stored, fallbackReason: null, reused: false };
    }
    fallbackReason = "external puzzles failed verification";
  } catch (error) {
    if (!(error instanceof PuzzleApiError)) throw error;
    fallbackReason = error.kind;
    if (error.kind !== "not_configured") console.warn(`[puzzles] YouDoSudoku unavailable: ${error.message}`);
  }

  const stored = await storePuzzle(generateInternal(difficulty, usage, fallbackReason));
  return { puzzle: stored, fallbackReason, reused: false };
}

export async function findPuzzleBySeed(seed: string): Promise<PuzzleDoc | null> {
  return collections.puzzles().findOne({ seed, validationStatus: "valid" });
}
