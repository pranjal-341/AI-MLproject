import { createContext, useContext } from "react";

export const apiBase = (import.meta.env["VITE_API_BASE_URL"] || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
export const modelLabels: Record<string, string> = {
  linear_regression: "Linear regression",
  decision_tree: "Decision tree",
  random_forest: "Random forest",
  xgboost: "XGBoost",
};
export type ModelSlot = {
  algorithm: string;
  variant: string;
  status: string;
  features: string[];
  version: string;
  families: Record<string, number>;
  metrics: Record<string, number>;
  dataset_matches: boolean | null;
  metadata: {
    target?: string;
    training_profile?: string;
    development_rows?: number;
    test_rows?: number;
    seed?: number;
    dataset_sha256?: string;
    test_split_sha256?: string;
  };
};
export type Dashboard = {
  models: ModelSlot[];
  dataset: { status: string; filename: string; rows: number | null; columns: number | null };
  summary: { ready_models: number; tiers: number; descriptors: number };
  updated_at: string;
};
export const DashboardContext = createContext<{
  data: Dashboard | null;
  error: string;
  loading: boolean;
  refresh: () => void;
}>({ data: null, error: "", loading: true, refresh: () => {} });
export function useDashboard() {
  return useContext(DashboardContext);
}
