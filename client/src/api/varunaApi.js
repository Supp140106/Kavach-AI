// src/api/varunaApi.js
// Client for the VARUNA AI incident-analysis backend.
// Separate from VITE_BACKEND_URL (which still handles auth/user endpoints).
import axios from "axios";

const BASE_URL = import.meta.env.VITE_VARUNA_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 90000, // /analyze/all can take 30-60s
});

/** GET /analyze/dashboard — main overview payload */
export const getDashboard = async () => {
  const { data } = await client.get("/analyze/dashboard");
  return data;
};

/** GET /analyze/all?limit=N — trigger fresh analysis. Long running. */
export const getAllAnalyses = async (limit = 10) => {
  const { data } = await client.get("/analyze/all", { params: { limit } });
  return data;
};

/** POST /analyze — manual single-incident analysis */
export const analyzeIncident = async ({ description, latitude, longitude }) => {
  const { data } = await client.post("/analyze", { description, latitude, longitude });
  return data;
};

/** POST /chat — natural language Q&A over current incidents */
export const askVaruna = async (question) => {
  const { data } = await client.post("/chat", { question });
  return data;
};

/** GET /sources/all — raw deduplicated incidents, no AI analysis */
export const getAllSources = async () => {
  const { data } = await client.get("/sources/all");
  return data;
};

/** GET /health */
export const getHealth = async () => {
  const { data } = await client.get("/health");
  return data;
};

// Severity is always one of these four values.
export const SEVERITY_ORDER = ["Low", "Moderate", "High", "Critical"];

export const SEVERITY_COLORS = {
  Low: "#16a34a",
  Moderate: "#eab308",
  High: "#f97316",
  Critical: "#dc2626",
};

export default client;
