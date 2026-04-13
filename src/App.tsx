import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import FileOpenRoundedIcon from "@mui/icons-material/FileOpenRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import { ZodIssue } from "zod";
import { DiagnosisShareData, diagnosisShareSchema } from "./shareSchema";
import {
  StoredDiagnosisRecord,
  deleteStoredDiagnosisRecord,
  listStoredDiagnosisRecords,
  upsertDiagnosisRecord
} from "./storage";

const joinInfo = (values: Array<string | null | undefined>) =>
  values
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join(" ・ ");

const withSuffix = (value: number | "", suffix: string) => (value === "" ? "" : `${value}${suffix}`);

const formatZodIssues = (issues: ZodIssue[]) =>
  issues
    .slice(0, 8)
    .map((issue) => {
      const location = issue.path.length ? issue.path.join(".") : "root";
      return `- ${location}: ${issue.message}`;
    })
    .join("\n");

const formatRating = (rating: string, score?: number) =>
  typeof score === "number" ? `${rating}(${score})` : rating;

const formatSavedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

type SortKey = "rating" | "number";
type SortDirection = "asc" | "desc";
type CurrentPage = "list" | "loader";
type DiagnosisRaceRecord = DiagnosisShareData["records"][number];
type DiagnosisResultRow = DiagnosisRaceRecord["results"][number];

type AppProps = {
  colorMode: "light" | "dark";
  onToggleColorMode: () => void;
};

const ratingOrder: Record<DiagnosisResultRow["rating"], number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1
};

const compareByRating = (a: DiagnosisResultRow, b: DiagnosisResultRow) => {
  const aHasScore = typeof a.score === "number";
  const bHasScore = typeof b.score === "number";

  // score が両方ある場合は score 優先で比較する（ユーザー表示と一致させる）
  if (typeof a.score === "number" && typeof b.score === "number") {
    const scoreComparison = a.score - b.score;
    if (scoreComparison !== 0) return scoreComparison;
  }

  // score がないケースや同点時は評価ランクで比較
  const ratingComparison = ratingOrder[a.rating] - ratingOrder[b.rating];
  if (ratingComparison !== 0) return ratingComparison;

  // score の有無が異なる同評価では score ありを優先
  if (aHasScore !== bHasScore) return aHasScore ? 1 : -1;

  // 最後は馬番で安定化
  return a.number - b.number;
};

const toRaceTitle = (record: DiagnosisRaceRecord) =>
  joinInfo([
    record.raceInfo.date,
    record.raceInfo.venue,
    withSuffix(record.raceInfo.raceNumber, "R"),
    record.raceInfo.raceName,
    record.raceInfo.raceClass
  ]);

const toRaceSubtitle = (record: DiagnosisRaceRecord) =>
  joinInfo([
    record.raceInfo.trackType,
    withSuffix(record.raceInfo.distance, "m"),
    record.raceInfo.courseDirection,
    record.raceInfo.trackConfig,
    record.raceInfo.trackCondition,
    withSuffix(record.raceInfo.holdingRound, "回"),
    withSuffix(record.raceInfo.holdingDay, "日")
  ]);

const totalHorseCount = (data: DiagnosisShareData) =>
  data.records.reduce((sum, record) => sum + record.results.length, 0);

const toRecordTitle = (data: DiagnosisShareData) => {
  if (data.records.length === 1) {
    return toRaceTitle(data.records[0]);
  }

  const firstRaceTitle = toRaceTitle(data.records[0]);
  return firstRaceTitle
    ? `${data.records.length}レース (${firstRaceTitle} ほか)`
    : `${data.records.length}レース`;
};

const toRecordSubtitle = (data: DiagnosisShareData) => {
  if (data.records.length === 1) {
    return toRaceSubtitle(data.records[0]);
  }

  return `全${data.records.length}レース`;
};

const formatRecordSummary = (data: DiagnosisShareData) =>
  `${data.records.length}レース / ${totalHorseCount(data)}頭`;

const toRaceSelectorLabel = (record: DiagnosisRaceRecord) => {
  const detail = joinInfo([
    record.raceInfo.venue,
    withSuffix(record.raceInfo.raceNumber, "R"),
    record.raceInfo.raceName
  ]);
  return detail || "レース";
};

const toEditorJson = (data: DiagnosisShareData) => {
  if (data.schemaVersion === "diagnosis-table-share/v1" && data.records.length === 1) {
    const [record] = data.records;
    return {
      schemaVersion: "diagnosis-table-share/v1" as const,
      exportedAt: data.exportedAt,
      raceInfo: record.raceInfo,
      results: record.results
    };
  }

  return {
    schemaVersion: "diagnosis-list-share/v1" as const,
    exportedAt: data.exportedAt,
    mode: data.mode,
    recordCount: data.records.length,
    records: data.records
  };
};

export default function App({ colorMode, onToggleColorMode }: AppProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [currentPage, setCurrentPage] = useState<CurrentPage>("list");
  const [jsonInput, setJsonInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [shareData, setShareData] = useState<DiagnosisShareData | null>(null);
  const [storedRecords, setStoredRecords] = useState<StoredDiagnosisRecord[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(true);
  const [listJsonInput, setListJsonInput] = useState("");
  const [isListInputExpanded, setIsListInputExpanded] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRaceIndex, setSelectedRaceIndex] = useState(0);
  const listFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshStoredRecords = async () => {
    setIsRecordsLoading(true);
    try {
      const rows = await listStoredDiagnosisRecords();
      setStoredRecords(rows);
    } catch {
      setErrorMessage("保存済み一覧の読み込みに失敗しました。再起動して再度お試しください。");
    } finally {
      setIsRecordsLoading(false);
    }
  };

  useEffect(() => {
    void refreshStoredRecords();
  }, []);

  const persistShareData = async (data: DiagnosisShareData) => {
    try {
      await upsertDiagnosisRecord(data);
      await refreshStoredRecords();
      setInfoMessage("診断データをローカルに保存しました");
    } catch {
      setErrorMessage("ローカル保存に失敗しました。ブラウザの保存設定をご確認ください。");
    }
  };

  const parseShareData = (source: string): DiagnosisShareData | null => {
    if (!source.trim()) {
      setErrorMessage("JSON入力が空です。貼り付けるかファイルを選択してください。");
      return null;
    }

    try {
      const parsedJson = JSON.parse(source);
      const validated = diagnosisShareSchema.safeParse(parsedJson);

      if (!validated.success) {
        setErrorMessage(`JSONの形式が共有スキーマと一致しません。\n${formatZodIssues(validated.error.issues)}`);
        return null;
      }

      setErrorMessage("");
      return validated.data;
    } catch {
      setErrorMessage("JSONのパースに失敗しました。構文を確認してください。");
      return null;
    }
  };

  const parseAndApply = (source: string): boolean => {
    const parsedData = parseShareData(source);
    if (!parsedData) {
      setShareData(null);
      return false;
    }

    setShareData(parsedData);
    setSelectedRaceIndex(0);
    setIsInputExpanded(false);
    setCurrentPage("loader");
    void persistShareData(parsedData);
    return true;
  };

  const parseAndStoreForList = (source: string): boolean => {
    const parsedData = parseShareData(source);
    if (!parsedData) return false;

    void persistShareData(parsedData);
    return true;
  };

  const handleParseClick = () => {
    parseAndApply(jsonInput);
  };

  const handleListFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const accepted = parseAndStoreForList(text);
    if (accepted) {
      setListJsonInput("");
      setIsListInputExpanded(false);
    }
    event.target.value = "";
  };

  const handleApplyListJsonInput = () => {
    const accepted = parseAndStoreForList(listJsonInput);
    if (!accepted) return;

    setListJsonInput("");
    setIsListInputExpanded(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setJsonInput(text);
    parseAndApply(text);
    event.target.value = "";
  };

  const handleClearCurrentView = () => {
    setJsonInput("");
    setShareData(null);
    setSelectedRaceIndex(0);
    setErrorMessage("");
    setIsInputExpanded(true);
  };

  const handleToggleInput = () => {
    setIsInputExpanded((prev) => !prev);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "rating" ? "desc" : "asc");
  };

  const selectedRace = useMemo<DiagnosisRaceRecord | null>(() => {
    if (!shareData) return null;
    if (shareData.records.length === 0) return null;
    const index = Math.min(selectedRaceIndex, shareData.records.length - 1);
    return shareData.records[index] ?? null;
  }, [selectedRaceIndex, shareData]);

  const raceInfoLines = useMemo(() => {
    if (!selectedRace) {
      return { line1: "", line2: "" };
    }

    const { raceInfo } = selectedRace;

    const line1 = joinInfo([
      raceInfo.date,
      raceInfo.venue,
      withSuffix(raceInfo.raceNumber, "R"),
      raceInfo.raceName,
      raceInfo.raceClass
    ]);

    const line2 = joinInfo([
      raceInfo.trackType,
      withSuffix(raceInfo.distance, "m"),
      raceInfo.courseDirection,
      raceInfo.trackConfig,
      raceInfo.trackCondition,
      withSuffix(raceInfo.holdingRound, "回"),
      withSuffix(raceInfo.holdingDay, "日")
    ]);

    return { line1, line2 };
  }, [selectedRace]);

  const sortedResults = useMemo(() => {
    if (!selectedRace) return [];

    return [...selectedRace.results].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "rating") {
        comparison = compareByRating(a, b);
      } else {
        comparison = a.number - b.number;
        if (comparison === 0) {
          comparison = compareByRating(a, b);
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [selectedRace, sortDirection, sortKey]);

  const handleOpenRecord = (record: StoredDiagnosisRecord) => {
    setShareData(record.data);
    setSelectedRaceIndex(0);
    setJsonInput(JSON.stringify(toEditorJson(record.data), null, 2));
    setErrorMessage("");
    setIsInputExpanded(false);
    setCurrentPage("loader");
  };

  const handleDeleteRecord = async (id: string) => {
    const approved = window.confirm("この保存データを削除しますか？");
    if (!approved) return;

    try {
      await deleteStoredDiagnosisRecord(id);
      await refreshStoredRecords();
      setInfoMessage("保存データを削除しました");
    } catch {
      setErrorMessage("削除に失敗しました。再度お試しください。");
    }
  };

  const colorModeButtonLabel = colorMode === "dark" ? "ライトモードへ切り替え" : "ダークモードへ切り替え";

  return (
    <Box sx={{ minHeight: "100vh", py: 3 }}>
      <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 4 } }}>
        {currentPage === "list" ? (
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Typography component="h1" variant="h4" fontWeight={700}>
                全頭診断一覧
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title={colorModeButtonLabel}>
                  <IconButton color="inherit" aria-label={colorModeButtonLabel} onClick={onToggleColorMode}>
                    {colorMode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<UploadFileRoundedIcon />}
                  onClick={() => listFileInputRef.current?.click()}
                >
                  全頭診断読み込み
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => setIsListInputExpanded((prev) => !prev)}
                >
                  コピーJSON反映
                </Button>
                <input
                  ref={listFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={handleListFileChange}
                />
              </Stack>
            </Stack>

            {isListInputExpanded && (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderColor: "divider" }}>
                <Stack spacing={1.2}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    コピーした共有JSONを追加
                  </Typography>
                  <TextField
                    multiline
                    minRows={5}
                    label="共有JSON"
                    value={listJsonInput}
                    onChange={(event) => setListJsonInput(event.target.value)}
                    fullWidth
                    placeholder='{"schemaVersion":"diagnosis-list-share/v1","records":[...], ... }'
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={handleApplyListJsonInput}>
                      コピー内容を反映
                    </Button>
                    <Button
                      variant="text"
                      color="inherit"
                      startIcon={<DeleteSweepRoundedIcon />}
                      onClick={() => setListJsonInput("")}
                    >
                      入力クリア
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {errorMessage && (
              <Alert severity="error" sx={{ whiteSpace: "pre-line" }}>
                {errorMessage}
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2, borderColor: "divider" }}>
              <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={700}>
                  保存済みデータ
                </Typography>

                {isRecordsLoading ? (
                  <Typography color="text.secondary">読み込み中...</Typography>
                ) : storedRecords.length === 0 ? (
                  <Typography color="text.secondary">
                    保存済みデータはありません。右上の「全頭診断読み込み」からJSONを追加すると一覧に表示されます。
                  </Typography>
                ) : isMobile ? (
                  <Stack spacing={1.2}>
                    {storedRecords.map((record) => (
                      <Paper
                        key={record.id}
                        variant="outlined"
                        onClick={() => handleOpenRecord(record)}
                        sx={{
                          p: 1.5,
                          borderColor: "divider",
                          backgroundColor: "background.default",
                          cursor: "pointer",
                          "&:hover": { borderColor: "primary.main" }
                        }}
                      >
                        <Stack spacing={1}>
                          <Typography fontWeight={700}>{toRecordTitle(record.data)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {toRecordSubtitle(record.data)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            保存日時: {formatSavedAt(record.savedAt)} / {formatRecordSummary(record.data)}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteRecord(record.id);
                              }}
                            >
                              削除
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer
                    sx={{
                      border: (paletteTheme) => `1px solid ${paletteTheme.palette.divider}`,
                      borderRadius: 1.5
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 180 }}>保存日時</TableCell>
                          <TableCell>レース</TableCell>
                          <TableCell>条件</TableCell>
                          <TableCell sx={{ width: 110 }}>操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {storedRecords.map((record) => (
                          <TableRow
                            key={record.id}
                            hover
                            onClick={() => handleOpenRecord(record)}
                            sx={{
                              "& td": { borderColor: "divider" },
                              cursor: "pointer"
                            }}
                          >
                            <TableCell>{formatSavedAt(record.savedAt)}</TableCell>
                            <TableCell>{toRecordTitle(record.data)}</TableCell>
                            <TableCell>{toRecordSubtitle(record.data)}</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="text"
                                  color="error"
                                  startIcon={<DeleteOutlineRoundedIcon />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDeleteRecord(record.id);
                                  }}
                                >
                                  削除
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </Paper>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Typography component="h1" variant="h4" fontWeight={700}>
                レース詳細
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title={colorModeButtonLabel}>
                  <IconButton color="inherit" aria-label={colorModeButtonLabel} onClick={onToggleColorMode}>
                    {colorMode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                  </IconButton>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => setCurrentPage("list")}
                >
                  一覧に戻る
                </Button>
              </Stack>
            </Stack>

            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderColor: "divider" }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={700}>
                    共有JSON入力
                  </Typography>
                  <Button variant="text" color="inherit" onClick={handleToggleInput}>
                    {isInputExpanded ? "入力を閉じる" : "JSON入力を開く"}
                  </Button>
                </Stack>

                {isInputExpanded ? (
                  <>
                    <TextField
                      multiline
                      minRows={8}
                      label="診断表示用JSON"
                      value={jsonInput}
                      onChange={(event) => setJsonInput(event.target.value)}
                      fullWidth
                      placeholder='{"schemaVersion":"diagnosis-list-share/v1","records":[...], ... }'
                    />

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                      <Button
                        variant="contained"
                        startIcon={<RefreshRoundedIcon />}
                        onClick={handleParseClick}
                      >
                        表示更新
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<FileOpenRoundedIcon />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        JSONファイル読込
                      </Button>
                      <Button
                        variant="text"
                        color="inherit"
                        startIcon={<DeleteSweepRoundedIcon />}
                        onClick={handleClearCurrentView}
                      >
                        表示クリア
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={handleFileChange}
                      />
                    </Stack>

                    {errorMessage && (
                      <Alert severity="error" sx={{ whiteSpace: "pre-line" }}>
                        {errorMessage}
                      </Alert>
                    )}
                  </>
                ) : (
                  <Typography color="text.secondary">
                    JSON入力は折りたたみ中です。更新時は「JSON入力を開く」で再入力してください。
                  </Typography>
                )}
              </Stack>
            </Paper>

            {shareData ? (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderColor: "divider" }}>
                <Stack spacing={2.2}>
                  {shareData.records.length > 1 && (
                    <Stack spacing={1}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        レース選択
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {shareData.records.length}レース中{" "}
                        {Math.min(selectedRaceIndex + 1, shareData.records.length)}件目を表示中
                      </Typography>
                      <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                        {shareData.records.map((record, index) => (
                          <Button
                            key={
                              record.diagnosisId ??
                              `${record.raceInfo.date}-${record.raceInfo.venue}-${record.raceInfo.raceNumber}-${index}`
                            }
                            size="small"
                            variant={
                              Math.min(selectedRaceIndex, shareData.records.length - 1) === index
                                ? "contained"
                                : "outlined"
                            }
                            onClick={() => setSelectedRaceIndex(index)}
                          >
                            {toRaceSelectorLabel(record)}
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                  )}

                  <Stack spacing={0.7}>
                    <Typography variant="h6" fontWeight={700}>
                      レース情報
                    </Typography>
                    <Typography color="text.secondary">{raceInfoLines.line1}</Typography>
                    <Typography color="text.secondary">{raceInfoLines.line2}</Typography>
                  </Stack>

                  <Stack spacing={1.2}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={0.8}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Typography variant="h5" fontWeight={700}>
                        診断結果
                      </Typography>
                      {isMobile && (
                        <Stack direction="row" spacing={0.6}>
                          <Button
                            size="small"
                            variant={sortKey === "rating" ? "contained" : "outlined"}
                            onClick={() => handleSort("rating")}
                          >
                            評価順
                          </Button>
                          <Button
                            size="small"
                            variant={sortKey === "number" ? "contained" : "outlined"}
                            onClick={() => handleSort("number")}
                          >
                            馬番順
                          </Button>
                        </Stack>
                      )}
                    </Stack>

                    {isMobile ? (
                      <Stack spacing={1}>
                        {sortedResults.map((item) => (
                          <Paper
                            key={`${item.number}-${item.horseName}`}
                            variant="outlined"
                            sx={{ p: 1.4, borderColor: "divider", backgroundColor: "background.default" }}
                          >
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography fontWeight={700}>{formatRating(item.rating, item.score)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {item.number}番
                                </Typography>
                              </Stack>
                              <Typography fontWeight={700}>{item.horseName}</Typography>
                              <Typography
                                variant="body2"
                                sx={{ whiteSpace: "pre-line", lineHeight: 1.7, color: "text.secondary" }}
                              >
                                {item.reason}
                              </Typography>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <TableContainer
                        sx={{
                          border: (paletteTheme) => `1px solid ${paletteTheme.palette.divider}`,
                          borderRadius: 1.5
                        }}
                      >
                        <Table size="small" sx={{ tableLayout: "fixed" }}>
                          <TableHead>
                            <TableRow>
                              <TableCell
                                sx={{ width: 116 }}
                                sortDirection={sortKey === "rating" ? sortDirection : false}
                              >
                                <TableSortLabel
                                  active={sortKey === "rating"}
                                  direction={sortKey === "rating" ? sortDirection : "asc"}
                                  onClick={() => handleSort("rating")}
                                >
                                  評価
                                </TableSortLabel>
                              </TableCell>
                              <TableCell
                                sx={{ width: 116 }}
                                sortDirection={sortKey === "number" ? sortDirection : false}
                              >
                                <TableSortLabel
                                  active={sortKey === "number"}
                                  direction={sortKey === "number" ? sortDirection : "asc"}
                                  onClick={() => handleSort("number")}
                                >
                                  馬番
                                </TableSortLabel>
                              </TableCell>
                              <TableCell sx={{ width: 220 }}>馬名</TableCell>
                              <TableCell>根拠</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedResults.map((item) => (
                              <TableRow
                                key={`${item.number}-${item.horseName}`}
                                sx={{ "& td": { borderColor: "divider", verticalAlign: "top" } }}
                              >
                                <TableCell>{formatRating(item.rating, item.score)}</TableCell>
                                <TableCell>{item.number}</TableCell>
                                <TableCell>{item.horseName}</TableCell>
                                <TableCell sx={{ whiteSpace: "pre-line" }}>{item.reason}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ) : (
              <Paper variant="outlined" sx={{ p: 2.5, borderColor: "divider" }}>
                <Typography color="text.secondary">
                  JSONを貼り付けるか、JSONファイルを読み込むと表示されます。表示後は自動的にローカル一覧へ保存されます。
                </Typography>
              </Paper>
            )}
          </Stack>
        )}
      </Container>

      <Snackbar
        open={Boolean(infoMessage)}
        autoHideDuration={2200}
        onClose={() => setInfoMessage("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setInfoMessage("")}>
          {infoMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
