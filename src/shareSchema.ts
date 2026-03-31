import { z } from "zod";

const numberOrEmpty = z.union([z.number(), z.literal("")]);

export const diagnosisResultSchema = z.object({
  rating: z.enum(["S", "A", "B", "C", "D"]),
  score: z.number().optional(),
  number: z.number(),
  horseName: z.string().min(1, "horseName は必須です"),
  reason: z.string().min(1, "reason は必須です")
});

export const raceInfoSchema = z.object({
  date: z.string(),
  venue: z.string(),
  raceName: z.string(),
  raceNumber: numberOrEmpty,
  raceClass: z.string(),
  trackType: z.string(),
  distance: numberOrEmpty,
  courseDirection: z.string(),
  trackConfig: z.string().nullable(),
  trackCondition: z.string(),
  holdingRound: numberOrEmpty,
  holdingDay: numberOrEmpty
});

export const diagnosisShareSchema = z.object({
  schemaVersion: z.literal("diagnosis-table-share/v1"),
  exportedAt: z.string(),
  raceInfo: raceInfoSchema,
  results: z.array(diagnosisResultSchema)
});

export type DiagnosisShareData = z.infer<typeof diagnosisShareSchema>;
