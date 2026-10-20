import { z } from "zod";
import { DIFFICULTIES, GAME_MODES } from "@/lib/sudoku/types";
import { MAX_MOVES } from "@/lib/sudoku/engine";

export const difficultySchema = z.enum(DIFFICULTIES);
export const modeSchema = z.enum(GAME_MODES);

export const gridStringSchema = z.string().regex(/^[0-9]{81}$/, "board must be 81 digits");
export const notesSchema = z.array(z.number().int().min(0).max(0b1111111110)).length(81);
export const moveSchema = z.tuple([
  z.number().int().min(0).max(80),
  z.number().int().min(0).max(9),
  z.union([z.literal(0), z.literal(1), z.literal(2)]),
]);
export const movesSchema = z.array(moveSchema).max(MAX_MOVES);

/** Ten days; anything longer is clamped by the client anyway. */
const elapsedSchema = z.number().int().min(0).max(864_000);

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "invalid id");

export const createGameSchema = z.object({
  mode: z.literal("classic"),
  difficulty: difficultySchema,
});

export const saveGameSchema = z.object({
  baseVersion: z.number().int().min(0),
  board: gridStringSchema,
  notes: notesSchema,
  moves: movesSchema,
  mistakes: z.number().int().min(0).max(10_000),
  hintsUsed: z.number().int().min(0).max(81),
  elapsedSeconds: elapsedSchema,
});
export type SaveGameInput = z.infer<typeof saveGameSchema>;

export const completeGameSchema = z.object({
  board: gridStringSchema,
  moves: movesSchema,
  elapsedSeconds: elapsedSchema,
  notes: notesSchema.optional(),
});
export type CompleteGameInput = z.infer<typeof completeGameSchema>;

export const hintSchema = z.object({ board: gridStringSchema, selected: z.number().int().min(0).max(80).nullable() });

export const ROOM_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9A-HJKMNP-TV-Z]{6}$/, "Room codes are 6 letters or digits");

export const createRoomSchema = z.object({
  difficulty: difficultySchema,
  maxPlayers: z.number().int().min(2).max(20).default(8),
});

export const leaderboardQuerySchema = z.object({
  scope: z.enum(["global", "daily", "room"]).default("global"),
  mode: modeSchema.default("classic"),
  difficulty: difficultySchema.default("medium"),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  roomCode: roomCodeSchema.optional(),
  round: z.coerce.number().int().min(0).optional(),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
});
