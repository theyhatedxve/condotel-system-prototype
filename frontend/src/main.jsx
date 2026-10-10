import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./features/auth/AuthContext";

import AppRoutes from "./routes/AppRoutes";

import "./styles/global.css";
import "./styles/presentation.css";
import "./styles/workflows.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
