export type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  kind: "question" | "activity";
};
export type Draft = {
  algorithm: string;
  variant: string;
  model_version: string;
  source_sha256: string;
  method: "csv" | "pdf_llm" | "sample";
  llm_model: string | null;
  features: Record<string, number | null>;
  evidence: { feature: string; value: number; page: number; evidence: string }[];
  missing: string[];
  warnings: string[];
};
export type Prediction = {
  algorithm: string;
  variant: string;
  model_version: string;
  prediction: number;
  elapsed_ms: number;
};
