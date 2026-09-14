import { useCallback, useEffect, useRef, useState } from "react";
import { apiBase, useDashboard } from "@/features/dashboard/use-dashboard";
import { supabase } from "@/integrations/supabase/client";
import type { Draft, Message, Prediction } from "./types";

async function api<T>(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous)
    throw new Error("Please sign in to use the research assistant.");
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(210000)]),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "The request could not be completed. Check your input and try again.",
    );
  return result as T;
}

export function useResearchAssistant(open: boolean, enabled: boolean) {
  const { data, error: connectionError, refresh } = useDashboard();
  const [selected, setSelected] = useState("random_forest/model_C");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [filename, setFilename] = useState("");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [predictionId, setPredictionId] = useState<number | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [allowMissing, setAllowMissing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState({
    available: false,
    model: "Qwen",
    message: "Checking local model...",
  });
  const operation = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const sequence = useRef(0);
  const models = data?.models ?? [];
  const slot = models.find((item) => `${item.algorithm}/${item.variant}` === selected);
  const missing = slot?.features.filter((name) => values[name] == null) ?? [];

  const reset = useCallback(() => {
    revision.current += 1;
    operation.current?.abort();
    operation.current = null;
    setMessages([]);
    setDraft(null);
    setValues({});
    setResult(null);
    setFilename("");
    setReviewId(null);
    setPredictionId(null);
    setReviewed(false);
    setAllowMissing(false);
    setBusy("");
    setError("");
  }, []);

  useEffect(() => {
    reset();
    return () => {
      revision.current += 1;
      operation.current?.abort();
      operation.current = null;
    };
  }, [selected, slot?.version, enabled, reset]);

  useEffect(() => {
    if (!open || !enabled) return;
    const controller = new AbortController();
    void api<typeof status>("/api/documents/status", controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStatus(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus({
            available: false,
            model: "Qwen",
            message: "Chat is offline. CSV import and prediction can still work.",
          });
      });
    return () => controller.abort();
  }, [open, enabled]);

  function add(role: Message["role"], content: string, kind: Message["kind"] = "activity") {
    const id = ++sequence.current;
    setMessages((current) => [...current, { id, role, content, kind }]);
    return id;
  }

  async function perform<T>(
    label: string,
    request: (signal: AbortSignal) => Promise<T>,
    accept: (value: T) => void,
  ) {
    if (!enabled || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    const id = ++revision.current;
    setBusy(label);
    setError("");
    try {
      const value = await request(controller.signal);
      if (revision.current === id) accept(value);
    } catch (cause) {
      if (revision.current === id)
        setError(cause instanceof Error ? cause.message : "Something went wrong. Please retry.");
    } finally {
      if (revision.current === id) {
        setBusy("");
        operation.current = null;
      }
    }
  }

  function applyDraft(next: Draft, name: string) {
    setDraft(next);
    setValues(next.features);
    setFilename(name);
    setResult(null);
    setReviewed(false);
    setAllowMissing(false);
    setReviewId(
      add(
        "assistant",
        `I found ${Object.values(next.features).filter((value) => value !== null).length} of ${Object.keys(next.features).length} measured descriptors. Review the sample below, then run your trained model.`,
      ),
    );
  }

  function canImport() {
    if (!slot || slot.status !== "uploaded" || connectionError) {
      setError("Choose an available model and reconnect to the backend before uploading.");
      return false;
    }
    return !operation.current;
  }

  function upload(file: File) {
    if (!canImport() || !slot) return;
    if (!/\.(pdf|csv)$/i.test(file.name) || !file.size || file.size > 2 * 1024 * 1024) {
      setError("Upload one nonempty PDF or CSV, up to 2 MB.");
      return;
    }
    setDraft(null);
    setResult(null);
    setValues({});
    setReviewed(false);
    setAllowMissing(false);
    add("user", `Attached ${file.name}`);
    const query = new URLSearchParams({
      algorithm: slot.algorithm,
      variant: slot.variant,
      model_version: slot.version,
      filename: file.name,
    });
    void perform(
      "Reading your file and checking the evidence",
      (signal) =>
        api<Draft>(`/api/documents/extract?${query}`, signal, {
          method: "POST",
          body: file,
          headers: {
            "Content-Type": file.name.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "text/csv",
          },
        }),
      (next) => applyDraft(next, file.name),
    );
  }

  function loadExample() {
    if (!canImport() || !slot) return;
    setDraft(null);
    setResult(null);
    setValues({});
    setReviewed(false);
    setAllowMissing(false);
    add("user", "Load an exported dataset sample.");
    void perform(
      "Loading an example",
      (signal) =>
        api<{ features: Record<string, number | null> }>(
          `/api/models/${slot.algorithm}/${slot.variant}/sample`,
          signal,
        ),
      (next) =>
        applyDraft(
          {
            algorithm: slot.algorithm,
            variant: slot.variant,
            model_version: slot.version,
            source_sha256: "",
            method: "sample",
            llm_model: null,
            features: next.features,
            evidence: [],
            missing: Object.keys(next.features).filter((name) => next.features[name] === null),
            warnings: [
              "This exported sample is for demonstration, not independent scientific validation.",
            ],
          },
          "Exported dataset sample",
        ),
    );
  }

  function updateValue(name: string, value: number | null) {
    if (operation.current) return;
    setValues((current) => ({ ...current, [name]: value }));
    setResult(null);
    setReviewed(false);
    setAllowMissing(false);
  }

  function predict() {
    if (
      !draft ||
      !slot ||
      !reviewed ||
      (missing.length > 0 && !allowMissing) ||
      operation.current ||
      connectionError
    )
      return;
    setResult(null);
    add("user", "Predict DDG with my reviewed descriptors.");
    void perform(
      "Running the trained model",
      (signal) =>
        api<Prediction>("/api/predict", signal, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: draft.algorithm,
            variant: draft.variant,
            model_version: draft.model_version,
            features: values,
          }),
        }),
      (next) => {
        setResult(next);
        setPredictionId(
          add(
            "assistant",
            `The trained model returned ${next.prediction.toFixed(3)} kcal/mol for your reviewed sample. You can ask me to explain its meaning and limitations.`,
          ),
        );
      },
    );
  }

  function ask(text: string) {
    const message = text.trim();
    if (!message || operation.current) return;
    if (message.length > 2000) {
      setError("Keep each question under 2,000 characters.");
      return;
    }
    const history = messages
      .filter((item) => item.kind === "question")
      .slice(-8)
      .map(({ role, content }) => ({ role, content: content.slice(0, 1500) }));
    const sample =
      draft && Object.values(values).some((value) => value !== null)
        ? {
            algorithm: draft.algorithm,
            variant: draft.variant,
            model_version: draft.model_version,
            features: values,
          }
        : null;
    add("user", message, "question");
    void perform(
      "Thinking about your question",
      (signal) =>
        api<{ answer: string }>("/api/assistant/chat", signal, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history, sample, explain_prediction: !!result }),
        }),
      (next) => add("assistant", next.answer, "question"),
    );
  }

  function downloadTemplate() {
    if (!slot) return;
    const csv =
      slot.features.map((name) => `"${name.replaceAll('"', '""')}"`).join(",") +
      "\n" +
      slot.features.map(() => "").join(",") +
      "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slot.algorithm}-${slot.variant}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    selected,
    setSelected,
    models,
    slot,
    messages,
    draft,
    values,
    filename,
    reviewId,
    predictionId,
    result,
    reviewed,
    setReviewed,
    allowMissing,
    setAllowMissing,
    missing,
    busy,
    error,
    setError,
    status,
    connectionError,
    refresh,
    reset,
    upload,
    loadExample,
    updateValue,
    predict,
    ask,
    downloadTemplate,
  };
}
