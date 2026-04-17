import { z } from "zod";

const numberOrEmpty = z.union([z.number(), z.literal("")]);
const numberOrEmptyOptional = numberOrEmpty.optional().default("");

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
  raceNumber: numberOrEmptyOptional,
  raceClass: z.string().optional().default(""),
  trackType: z.string().optional().default(""),
  distance: numberOrEmptyOptional,
  courseDirection: z.string().optional().default(""),
  trackConfig: z.string().nullable().optional().default(null),
  trackCondition: z.string().optional().default(""),
  holdingRound: numberOrEmptyOptional,
  holdingDay: numberOrEmptyOptional
});

const predictionConfidenceBreakdownSchema = z.record(z.string(), z.number());

export const diagnosisRecordSchema = z.object({
  diagnosisId: z.string().optional(),
  predictionConfidenceScore: z.number().optional(),
  predictionConfidenceGrade: z.string().optional(),
  predictionConfidenceVersion: z.string().optional(),
  predictionConfidenceBreakdown: predictionConfidenceBreakdownSchema.optional(),
  predictionConfidenceFlags: z.array(z.string()).optional(),
  predictionConfidenceComputedAt: z.number().int().optional(),
  raceInfo: raceInfoSchema,
  results: z.array(diagnosisResultSchema)
});

const diagnosisTableShareSchema = z.object({
  schemaVersion: z.literal("diagnosis-table-share/v1"),
  exportedAt: z.string(),
  raceInfo: raceInfoSchema,
  results: z.array(diagnosisResultSchema)
});

const diagnosisListShareSchema = z
  .object({
    schemaVersion: z.literal("diagnosis-list-share/v1"),
    exportedAt: z.string(),
    mode: z.string().optional(),
    recordCount: z.number().int().nonnegative().optional(),
    records: z.array(diagnosisRecordSchema).min(1, "records は1件以上必要です")
  })
  .superRefine((value, ctx) => {
    if (typeof value.recordCount === "number" && value.recordCount !== value.records.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordCount"],
        message: `recordCount(${value.recordCount}) と records件数(${value.records.length}) が一致しません`
      });
    }
  });

const normalizedDiagnosisShareSchema = z.object({
  schemaVersion: z.union([
    z.literal("diagnosis-table-share/v1"),
    z.literal("diagnosis-list-share/v1")
  ]),
  exportedAt: z.string(),
  mode: z.string().optional(),
  records: z.array(diagnosisRecordSchema).min(1, "records は1件以上必要です")
});

const diagnosisShareSourceSchema = z.union([diagnosisTableShareSchema, diagnosisListShareSchema]);

export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;
export type RaceInfo = z.infer<typeof raceInfoSchema>;
export type DiagnosisShareRecord = z.infer<typeof diagnosisRecordSchema>;
export type DiagnosisShareData = z.infer<typeof normalizedDiagnosisShareSchema>;

type DiagnosisShareSourceData = z.infer<typeof diagnosisShareSourceSchema>;

const normalizeDiagnosisShareDataInternal = (data: DiagnosisShareSourceData): DiagnosisShareData => {
  if ("records" in data) {
    return {
      schemaVersion: data.schemaVersion,
      exportedAt: data.exportedAt,
      mode: "mode" in data ? data.mode : undefined,
      records: data.records
    };
  }

  return {
    schemaVersion: data.schemaVersion,
    exportedAt: data.exportedAt,
    records: [
      {
        raceInfo: data.raceInfo,
        results: data.results
      }
    ]
  };
};

export const diagnosisShareSchema = diagnosisShareSourceSchema.transform((data) =>
  normalizeDiagnosisShareDataInternal(data)
);

export const normalizeDiagnosisShareData = (data: unknown): DiagnosisShareData | null => {
  const parsed = diagnosisShareSchema.safeParse(data);
  if (parsed.success) return parsed.data;

  const normalizedParsed = normalizedDiagnosisShareSchema.safeParse(data);
  if (!normalizedParsed.success) return null;
  return normalizedParsed.data;
};
