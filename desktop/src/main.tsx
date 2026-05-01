import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import CodePage from "./pages/CodePage";
import TerminalPage from "./pages/TerminalPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="code" element={<CodePage />} />
          <Route path="terminal" element={<TerminalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
