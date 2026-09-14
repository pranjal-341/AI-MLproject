import { useState } from "react";
import { Check, ChevronDown, FileCheck2, Search } from "lucide-react";
import type { useResearchAssistant } from "./use-research-assistant";

type Assistant = ReturnType<typeof useResearchAssistant>;

export function DescriptorReview({ chat }: { chat: Assistant }) {
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  if (!chat.draft || !chat.slot) return null;
  const names = chat.slot.features;
  const measured = names.length - chat.missing.length;
  const evidence = new Map(chat.draft.evidence.map((item) => [item.feature, item]));
  const filtered = names.filter(
    (name) =>
      name.toLowerCase().includes(search.toLowerCase()) &&
      (!onlyMissing || chat.values[name] == null),
  );
  return (
    <section className="ra-review ra-arrive" aria-label="Review uploaded descriptors">
      <div className="flex items-start gap-3">
        <span className="ra-file-icon">
          <FileCheck2 size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink" title={chat.filename}>
            {chat.filename}
          </p>
          <p className="mt-1 text-xs text-soft">
            {chat.draft.method === "pdf_llm"
              ? "PDF extraction with source evidence"
              : chat.draft.method === "csv"
                ? "One-sample CSV import"
                : "Exported model sample"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-between text-xs">
        <span className="font-semibold text-teal">
          {measured} / {names.length} measured
        </span>
        <span className="text-soft">{chat.missing.length} missing</span>
      </div>
      <div
        className="ra-progress mt-2"
        role="meter"
        aria-label="Measured descriptor coverage"
        aria-valuenow={measured}
        aria-valuemin={0}
        aria-valuemax={names.length}
      >
        <span style={{ width: `${(measured / names.length) * 100}%` }} />
      </div>
      {chat.draft.warnings.map((warning) => (
        <p key={warning} className="mt-3 text-xs leading-relaxed text-soft">
          Import note: {warning}
        </p>
      ))}
      <details className="mt-4 rounded-xl border border-line bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-xs font-semibold text-ink">
          Review or edit descriptors <ChevronDown size={15} />
        </summary>
        <div className="px-3 pb-3">
          <label className="ra-search">
            <Search size={14} aria-hidden="true" />
            <input
              aria-label="Search descriptors"
              placeholder="Search LIG, PLIP, vina..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="my-3 flex items-center gap-2 text-xs text-soft">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
            Show missing only
          </label>
          <div className="max-h-56 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {filtered.map((name) => {
              const source = evidence.get(name);
              const edited = chat.values[name] !== chat.draft?.features[name];
              return (
                <div key={name} className="border-t border-line pt-3">
                  <label className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 break-all text-[11px] font-medium text-ink">
                      {name}
                    </span>
                    <input
                      aria-label={name}
                      type="number"
                      step="any"
                      placeholder="Missing"
                      disabled={!!chat.busy}
                      value={chat.values[name] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value === "" ? null : Number(event.target.value);
                        if (value === null || Number.isFinite(value)) chat.updateValue(name, value);
                      }}
                      className="w-24 rounded-lg border border-line bg-mist/30 p-2 text-xs text-ink"
                    />
                  </label>
                  {edited ? (
                    <p className="mt-1 text-[10px] text-teal">
                      Edited by you; review before predicting.
                    </p>
                  ) : (
                    source && (
                      <p className="mt-1 break-words text-[10px] text-soft">
                        {chat.draft?.method === "pdf_llm" ? `Page ${source.page}` : "CSV row 2"}:{" "}
                        {source.evidence}
                      </p>
                    )
                  )}
                </div>
              );
            })}
            {!filtered.length && <p className="py-3 text-xs text-soft">No matching descriptors.</p>}
          </div>
        </div>
      </details>
      <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink">
        <input
          type="checkbox"
          className="mt-0.5 accent-teal"
          disabled={!!chat.busy}
          checked={chat.reviewed}
          onChange={(event) => chat.setReviewed(event.target.checked)}
        />
        I checked the values, raw units, and that this is one sample.
      </label>
      {chat.missing.length > 0 && (
        <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-soft">
          <input
            type="checkbox"
            className="mt-0.5 accent-teal"
            disabled={!!chat.busy}
            checked={chat.allowMissing}
            onChange={(event) => chat.setAllowMissing(event.target.checked)}
          />
          Allow fitted imputation for {chat.missing.length} missing values. These are not measured
          inputs and may reduce reliability.
        </label>
      )}
      <button
        type="button"
        onClick={chat.predict}
        disabled={
          !!chat.busy ||
          !!chat.connectionError ||
          !chat.reviewed ||
          (chat.missing.length > 0 && !chat.allowMissing) ||
          measured === 0
        }
        className="ra-predict mt-4"
      >
        <Check size={16} />
        Predict DDG
      </button>
      <p className="mt-2 text-center text-[10px] text-soft">
        Uses the trained {chat.draft.algorithm.replaceAll("_", " ")} model
      </p>
      {chat.draft.source_sha256 && (
        <details className="mt-3 text-[10px] text-soft">
          <summary className="cursor-pointer">Original file fingerprint</summary>
          <p className="mt-1 break-all">SHA-256: {chat.draft.source_sha256}</p>
        </details>
      )}
    </section>
  );
}
