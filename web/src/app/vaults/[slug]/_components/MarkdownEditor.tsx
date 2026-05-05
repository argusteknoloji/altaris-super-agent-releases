"use client";

// Obsidian-inspired markdown editor for vault .md files.
// CM6 (CodeMirror 6) — same engine Obsidian itself uses.
//
// Faz 1.2: Wikilink syntax decoration + click-to-navigate + autocomplete.
// Live preview decorations land in 1.3.

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
  keymap,
} from "@codemirror/view";
import { Prec } from "@codemirror/state";
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  /** Vault'taki tüm dosya yolları — wikilink autocomplete besler. */
  vaultFiles?: string[];
  /** [[Target]] üstüne tıklandığında parent navigate etsin. */
  onWikilinkClick?: (target: string) => void;
}

// `[[Page]]` veya `[[folder/Page]]` veya `[[Page|alias]]`
// Newline yasak, ] içeride yok.
const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g;

const wikilinkMatcher = new MatchDecorator({
  regexp: WIKILINK_RE,
  decoration: (match) => {
    // [[X|alias]] → target = X, display = alias (hala raw kullanıcı görünümü)
    const raw = match[1].trim();
    const target = raw.split("|")[0].trim();
    return Decoration.mark({
      class: "cm-wikilink",
      attributes: { "data-wikilink-target": target },
    });
  },
});

// Obsidian-tarzı heading hiyerarşisi: h1/h2/h3 görünür şekilde farklı boyut.
// CM6 markdown grammar'ı heading tag'lerini üretiyor → HighlightStyle ile
// font-size + weight + renk uyguluyoruz. Bu "live preview" hissinin temeli;
// kullanıcı `# Foo` yazdığı anda satır büyür.
const markdownHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.7em", fontWeight: "700", color: "#fb923c", textDecoration: "none" },
  { tag: t.heading2, fontSize: "1.4em", fontWeight: "700", color: "#fdba74", textDecoration: "none" },
  { tag: t.heading3, fontSize: "1.22em", fontWeight: "600", color: "#fed7aa" },
  { tag: t.heading4, fontSize: "1.10em", fontWeight: "600", color: "#fed7aa" },
  { tag: t.heading5, fontSize: "1.05em", fontWeight: "600", color: "#fed7aa" },
  { tag: t.heading6, fontSize: "1.0em", fontWeight: "600", color: "#fed7aa" },
  { tag: t.strong, fontWeight: "700", color: "#fafafa" },
  { tag: t.emphasis, fontStyle: "italic", color: "#e5e5e5" },
  { tag: t.link, color: "#22d3ee", textDecoration: "underline" },
  { tag: t.url, color: "#22d3ee" },
  { tag: t.quote, color: "#a78bfa", fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "#737373" },
  { tag: t.monospace, color: "#facc15", fontFamily: "ui-monospace, Menlo, monospace" },
  { tag: t.list, color: "#e5e5e5" },
]);

const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikilinkMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = wikilinkMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

function makeWikilinkClickHandler(onWikilinkClick?: (target: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(ev) {
      // Cmd/Ctrl + click → wikilink navigate (Obsidian convention).
      // Plain click sadece imleci yerleştirir, link açmaz — yazı yazarken
      // yanlışlıkla navigate etmemek için.
      if (!(ev.metaKey || ev.ctrlKey)) return false;
      const el = (ev.target as HTMLElement | null)?.closest(".cm-wikilink") as HTMLElement | null;
      if (!el) return false;
      const target = el.getAttribute("data-wikilink-target");
      if (!target || !onWikilinkClick) return false;
      ev.preventDefault();
      onWikilinkClick(target);
      return true;
    },
  });
}

function makeWikilinkCompletion(vaultFiles: string[]) {
  // Sadece markdown dosyaları suggest et — Obsidian convention.
  const mdPaths = vaultFiles.filter((p) => /\.(md|markdown)$/i.test(p));

  return autocompletion({
    activateOnTyping: true,
    override: [
      (ctx: CompletionContext): CompletionResult | null => {
        // `[[partial` paternini cursor'dan geriye doğru ara.
        const before = ctx.matchBefore(/\[\[([^\]\n]*)/);
        if (!before) return null;
        // matchBefore.text örn. "[[partial" → partial slice
        const partial = before.text.slice(2).toLowerCase();

        const options = mdPaths
          .map((p) => {
            const noExt = p.replace(/\.(md|markdown)$/i, "");
            const base = noExt.split("/").pop() ?? noExt;
            return {
              label: base, // listelenen kısa ad
              detail: noExt !== base ? noExt : undefined, // klasör yolu
              apply: `${noExt}]]`, // insert sonrası bracket'ı kapat
              boost: noExt === base ? 1 : 0, // root'taki dosyalara öncelik
            };
          })
          .filter((o) => o.label.toLowerCase().includes(partial));

        if (options.length === 0) return null;

        return {
          // [[ kısmından sonraki konumda replace başlasın
          from: before.from + 2,
          options,
          validFor: /^[^\]\n]*$/,
        };
      },
    ],
  });
}

export default function MarkdownEditor({
  value,
  onChange,
  onSave,
  vaultFiles = [],
  onWikilinkClick,
}: Props) {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, addKeymap: true }),
      syntaxHighlighting(markdownHighlightStyle),
      EditorView.lineWrapping,
      wikilinkPlugin,
      makeWikilinkClickHandler(onWikilinkClick),
      makeWikilinkCompletion(vaultFiles),
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
          ".cm-header": { color: "#fb923c" },
          ".cm-quote": { color: "#a78bfa" },
          ".cm-link": { color: "#22d3ee" },
          ".cm-url": { color: "#22d3ee", textDecoration: "underline" },
          ".cm-strong": { color: "#fafafa", fontWeight: "700" },
          ".cm-emphasis": { color: "#e5e5e5", fontStyle: "italic" },
          ".cm-strikethrough": { color: "#737373", textDecoration: "line-through" },
          ".cm-keyword": { color: "#a78bfa" },
          ".cm-atom": { color: "#facc15" },
          ".cm-number": { color: "#34d399" },
          // Wikilink — Obsidian'ın internal-link rengi: cyan, hover'da
          // underline. Cmd+click ile navigate (handler yukarıda).
          ".cm-wikilink": {
            color: "#22d3ee",
            backgroundColor: "rgba(34, 211, 238, 0.08)",
            borderRadius: "2px",
            padding: "0 2px",
          },
          ".cm-wikilink:hover": {
            color: "#67e8f9",
            backgroundColor: "rgba(34, 211, 238, 0.16)",
            cursor: "pointer",
          },
        },
        { dark: true },
      ),
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
    [onSave, vaultFiles, onWikilinkClick],
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
        autocompletion: false, // override above
        searchKeymap: true,
        defaultKeymap: true,
      }}
      height="100%"
      className="h-full"
    />
  );
}
