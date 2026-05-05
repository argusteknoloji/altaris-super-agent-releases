"use client";

// Obsidian-inspired markdown editor for vault .md files.
// CM6 (CodeMirror 6) — same engine Obsidian itself uses.
// Skeleton (Faz 1, commit 1): basic CM6 + markdown grammar + dark theme +
// Cmd+S save hook. Wikilink decoration + autocomplete + live preview
// are added in subsequent commits.

import { useMemo } from "react";
import CodeMirror, {
  EditorView,
  keymap,
  Prec,
} from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
}

export default function MarkdownEditor({ value, onChange, onSave }: Props) {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, addKeymap: true }),
      EditorView.lineWrapping,
      EditorView.theme(
        {
          "&": {
            height: "100%",
            fontSize: "14px",
            fontFamily: "ui-monospace, Menlo, monospace",
            backgroundColor: "#0a0a0a",
          },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { padding: "16px 24px", caretColor: "#f97316" },
          ".cm-line": { padding: "0" },
          "&.cm-focused": { outline: "none" },
          ".cm-cursor": { borderLeftColor: "#f97316" },
          // Markdown emphasis: Obsidian-tarzı yumuşak renkler
          ".cm-header": { color: "#fb923c" },
          ".cm-quote":  { color: "#a78bfa" },
          ".cm-link":   { color: "#22d3ee" },
          ".cm-url":    { color: "#22d3ee", textDecoration: "underline" },
          ".cm-strong": { color: "#fafafa", fontWeight: "700" },
          ".cm-emphasis": { color: "#e5e5e5", fontStyle: "italic" },
          ".cm-strikethrough": { color: "#737373", textDecoration: "line-through" },
          ".cm-keyword": { color: "#a78bfa" },
          ".cm-atom":    { color: "#facc15" },
          ".cm-number":  { color: "#34d399" },
        },
        { dark: true },
      ),
      // Cmd+S → save (Prec.highest ile default browser handler'ından önce)
      Prec.highest(
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              onSave?.();
              return true;
            },
          },
        ]),
      ),
    ],
    [onSave],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="dark"
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false, // wikilink autocomplete sonraki commit'te
        searchKeymap: true,
        defaultKeymap: true,
      }}
      height="100%"
      className="h-full"
    />
  );
}
