import { useState } from "react";
import Editor from "@monaco-editor/react";

export default function CodePage() {
  const [code, setCode] = useState<string>("// Altaris Code Editor\n// Workspace açma + AI agent ile düzenleme — Sprint 3\n");
  const [language, setLanguage] = useState("typescript");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <h2 className="text-base font-semibold">Code</h2>
        <select value={language} onChange={e => setLanguage(e.target.value)} className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs">
          {["typescript", "javascript", "python", "csharp", "rust", "go", "json", "markdown"].map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={v => setCode(v ?? "")}
          options={{ fontSize: 13, minimap: { enabled: true }, wordWrap: "on", scrollBeyondLastLine: false }}
        />
      </div>
    </div>
  );
}
