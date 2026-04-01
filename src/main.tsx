import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, PaletteMode, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";

const COLOR_MODE_STORAGE_KEY = "evaluation-viewer-color-mode";

const getInitialColorMode = (): PaletteMode => {
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage が使えない環境ではシステム設定を参照する
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const buildTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            background: {
              default: "#111318",
              paper: "#1b1f27"
            },
            divider: "#323946"
          }
        : {
            background: {
              default: "#f4f6fb",
              paper: "#ffffff"
            },
            divider: "#d7dce5"
          })
    },
    typography: {
      fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif'
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 10
          }
        }
      }
    }
  });

function RootApp() {
  const [colorMode, setColorMode] = useState<PaletteMode>(() => getInitialColorMode());

  useEffect(() => {
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    } catch {
      // 保存不可の場合は何もしない
    }
  }, [colorMode]);

  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App
        colorMode={colorMode}
        onToggleColorMode={() => setColorMode((prev) => (prev === "dark" ? "light" : "dark"))}
      />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);
