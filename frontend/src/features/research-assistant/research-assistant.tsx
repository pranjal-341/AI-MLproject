import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowUp,
  ChevronDown,
  Download,
  FileUp,
  FlaskConical,
  Paperclip,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/use-auth";
import { modelLabels } from "@/features/dashboard/use-dashboard";
import { DescriptorReview } from "./descriptor-review";
import { useResearchAssistant } from "./use-research-assistant";
import { QxMark } from "./qx-mark";
import { useAssistantLayout } from "./use-assistant-layout";
import "./research-assistant.css";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ResearchAssistant(props: Props) {
  const { session, loading } = useAuth();
  const signedIn = !!session && !session.user.is_anonymous;
  return (
    <AssistantSession
      key={session?.user.id ?? "guest"}
      {...props}
      signedIn={signedIn}
      checkingSession={loading}
    />
  );
}

function AssistantSession({
  open,
  onOpenChange,
  signedIn,
  checkingSession,
}: Props & { signedIn: boolean; checkingSession: boolean }) {
  const chat = useResearchAssistant(open, signedIn);
  const [question, setQuestion] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    setPanel,
    composer,
    scrollArea,
    conversationContent,
    followLatest,
    onConversationScroll,
  } = useAssistantLayout(open, signedIn, question, chat.messages.length > 0);
  const connected = signedIn && chat.status.available;
  const modelName = (algorithm: string) =>
    (modelLabels[algorithm] ?? algorithm).replace(/\b\w/g, (letter) => letter.toUpperCase());

  function suggest(text: string) {
    setQuestion(text);
    composer.current?.focus({ preventScroll: true });
  }

  function ask(text: string) {
    if (!text.trim() || chat.busy) return;
    followLatest.current = true;
    chat.ask(text);
    setQuestion("");
  }

  function upload(file: File) {
    followLatest.current = true;
    chat.upload(file);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Trigger
        className="ra-launcher"
        aria-label="Open OncoBind research assistant"
        tabIndex={open ? -1 : 0}
        aria-hidden={open}
      >
        <QxMark />
        <span className="ra-launcher-tooltip" aria-hidden="true">
          Ask OncoBind
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          ref={setPanel}
          className="ra-panel"
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            if (signedIn) {
              event.preventDefault();
              // Opening on touch should not immediately hide the welcome screen behind a keyboard.
              if (window.matchMedia("(pointer: fine)").matches) {
                composer.current?.focus({ preventScroll: true });
              } else if (event.target instanceof HTMLElement) {
                event.target.focus({ preventScroll: true });
              }
            }
          }}
          onDragOver={(event) => {
            if (signedIn && event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!signedIn) return;
            if (event.dataTransfer.files.length !== 1) {
              chat.setError("Drop one PDF or CSV at a time.");
              return;
            }
            const file = event.dataTransfer.files[0];
            if (file) upload(file);
          }}
        >
          <header className="ra-header">
            <div className="ra-avatar">
              <QxMark />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="ra-title">OncoBind Assistant</Dialog.Title>
              <div className="ra-status">
                <span className={connected ? "ra-status-dot is-ready" : "ra-status-dot"} />
                {signedIn
                  ? chat.status.available
                    ? "Connected"
                    : "Chat offline"
                  : "Sign in to chat"}
              </div>
            </div>
            <div className="flex gap-1">
              {signedIn && (
                <button
                  type="button"
                  className="ra-header-button"
                  aria-label="Start a new chat and clear the sample"
                  title="New chat"
                  onClick={() => {
                    followLatest.current = true;
                    chat.reset();
                    setQuestion("");
                    composer.current?.focus({ preventScroll: true });
                  }}
                >
                  <Plus size={18} />
                </button>
              )}
              <Dialog.Close
                className="ra-header-button"
                aria-label="Close research assistant"
                title="Close chat"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
          </header>
          <Dialog.Description className="sr-only">
            Ask research questions, upload one PDF or CSV sample, review its descriptors, and
            predict DDG with a trained model.
          </Dialog.Description>
          {!signedIn ? (
            <div className="ra-signin">
              <span className="ra-welcome-icon">
                <FlaskConical size={30} />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold text-ink">
                Your research, in conversation.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-soft">
                Ask a question, bring a descriptor file, and explore a trained-model DDG prediction
                in one place.
              </p>
              <a href="/auth" className="ra-predict mt-6">
                {checkingSession ? "Checking your session..." : "Sign in to get started"}
              </a>
              <p className="mt-4 text-xs text-soft">
                Your documents and prediction tools require a signed-in account.
              </p>
            </div>
          ) : (
            <>
              <div className="ra-model-bar">
                <FlaskConical size={15} className="shrink-0 text-teal" />
                <label htmlFor="assistant-model" className="sr-only">
                  Prediction model
                </label>
                <select
                  id="assistant-model"
                  value={chat.selected}
                  disabled={!!chat.busy}
                  onChange={(event) => {
                    followLatest.current = true;
                    chat.setSelected(event.target.value);
                  }}
                >
                  {!chat.models.length && (
                    <option value="random_forest/model_C">Loading prediction models...</option>
                  )}
                  {chat.models.map((model) => (
                    <option
                      key={`${model.algorithm}/${model.variant}`}
                      value={`${model.algorithm}/${model.variant}`}
                      disabled={model.status !== "uploaded"}
                    >
                      {modelName(model.algorithm)} &middot; Tier{" "}
                      {model.variant.replace("model_", "")}
                      {model.status !== "uploaded" ? " (unavailable)" : ""}
                    </option>
                  ))}
                </select>
                {chat.slot && (
                  <span className="ra-count">{chat.slot.features.length} features</span>
                )}
              </div>
              <div
                ref={scrollArea}
                className="ra-conversation"
                onScroll={onConversationScroll}
                aria-label="Messages and sample review"
                tabIndex={0}
              >
                <div ref={conversationContent} className="ra-conversation-content">
                  {chat.connectionError && (
                    <div role="alert" className="ra-error">
                      Prediction API unavailable.{" "}
                      <button type="button" onClick={chat.refresh} className="underline">
                        Reconnect
                      </button>
                    </div>
                  )}
                  {!chat.messages.length && !chat.draft && (
                    <div className="ra-welcome ra-arrive">
                      <h3>Explore your research</h3>
                      <p>
                        Understand mutations, explore drug interactions, or review a sample with
                        your trained model.
                      </p>
                      <button
                        type="button"
                        className="ra-upload-card"
                        disabled={
                          !!chat.busy || chat.slot?.status !== "uploaded" || !!chat.connectionError
                        }
                        onClick={() => fileInput.current?.click()}
                      >
                        <span className="ra-file-icon">
                          <FileUp size={22} />
                        </span>
                        <span>
                          <strong>Upload a research sample</strong>
                          <small>Drop a PDF or CSV here &middot; up to 2 MB</small>
                        </span>
                        <Plus size={17} />
                      </button>
                      <div className="ra-suggestions">
                        {[
                          "Explain my prediction",
                          "Compare feature tiers",
                          "What does ΔΔG mean?",
                        ].map((text) => (
                          <button
                            type="button"
                            key={text}
                            onClick={() => suggest(text)}
                            disabled={!!chat.busy}
                          >
                            {text}
                            <ArrowUp size={12} className="rotate-45" />
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          followLatest.current = true;
                          chat.loadExample();
                        }}
                        disabled={
                          !!chat.busy || chat.slot?.status !== "uploaded" || !!chat.connectionError
                        }
                        className="mt-4 text-xs font-semibold text-teal disabled:opacity-40"
                      >
                        Try an exported dataset sample
                      </button>
                    </div>
                  )}
                  <div
                    role="log"
                    aria-label="Research conversation"
                    aria-live="polite"
                    aria-relevant="additions"
                    className="space-y-4"
                  >
                    {chat.messages.map((message) => (
                      <div key={message.id}>
                        <div
                          className={`ra-message ra-arrive ${message.role === "user" ? "is-user" : "is-assistant"}`}
                        >
                          {message.role === "assistant" && (
                            <span className="ra-message-avatar">
                              <QxMark />
                            </span>
                          )}
                          <div>
                            <p className="ra-message-label">
                              {message.role === "user"
                                ? "You"
                                : message.kind === "question"
                                  ? "OncoBind"
                                  : "Research workspace"}
                            </p>
                            <p className="ra-bubble">{message.content}</p>
                          </div>
                        </div>
                        {chat.draft && message.id === chat.reviewId && (
                          <DescriptorReview chat={chat} />
                        )}
                        {chat.result && message.id === chat.predictionId && (
                          <section
                            className="ra-result ra-arrive"
                            aria-label="Trained model prediction"
                            aria-live="polite"
                          >
                            <p className="ra-result-label">
                              <FlaskConical size={14} />
                              Trained-model prediction
                            </p>
                            <p className="ra-ddg">
                              {chat.result.prediction.toFixed(3)}
                              <span>kcal/mol</span>
                            </p>
                            <p className="mt-1 text-xs text-soft">
                              Predicted DDG &middot; {modelName(chat.result.algorithm)} &middot;
                              Tier {chat.result.variant.replace("model_", "")}
                            </p>
                            <p className="mt-3 text-xs leading-relaxed text-soft">
                              An estimate from your reviewed inputs. Missing-value imputation and
                              model limitations affect reliability; no calibrated uncertainty
                              interval is available.
                            </p>
                            <details className="mt-3 text-[10px] text-soft">
                              <summary className="cursor-pointer">Model provenance</summary>
                              <p className="mt-1 break-all">
                                Version {chat.result.model_version} &middot;{" "}
                                {chat.result.elapsed_ms.toFixed(1)} ms inference
                              </p>
                            </details>
                            <button
                              type="button"
                              disabled={!!chat.busy}
                              className="ra-explain"
                              onClick={() =>
                                ask("Explain my current model prediction and its limitations.")
                              }
                            >
                              <Sparkles size={14} />
                              Explain this result
                            </button>
                          </section>
                        )}
                      </div>
                    ))}
                  </div>
                  {chat.busy && (
                    <div className="ra-working" role="status">
                      <span className="ra-thinking-mark">
                        <QxMark thinking />
                      </span>
                      <span className="ra-working-copy">
                        <span>{chat.busy}…</span>
                        <span className="ra-thinking-track" aria-hidden="true">
                          <i />
                        </span>
                      </span>
                    </div>
                  )}
                  {chat.error && (
                    <div role="alert" className="ra-error">
                      {chat.error}
                    </div>
                  )}
                </div>
              </div>
              <footer className="ra-footer">
                <form
                  className="ra-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    ask(question);
                  }}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Upload descriptor PDF or CSV"
                    accept=".pdf,.csv,application/pdf,text/csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) upload(file);
                      event.target.value = "";
                    }}
                  />
                  <DropdownMenu.Root modal={false}>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="ra-attach"
                        aria-label="Upload a file or download a CSV template"
                        title="Files and templates"
                      >
                        <Paperclip size={18} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="ra-upload-menu"
                        side="top"
                        align="start"
                        sideOffset={12}
                        collisionPadding={16}
                      >
                        <DropdownMenu.Item
                          disabled={
                            !!chat.busy ||
                            chat.slot?.status !== "uploaded" ||
                            !!chat.connectionError
                          }
                          onSelect={() => fileInput.current?.click()}
                        >
                          <FileUp size={18} /> Upload PDF or CSV
                        </DropdownMenu.Item>
                        <DropdownMenu.Item disabled={!chat.slot} onSelect={chat.downloadTemplate}>
                          <Download size={18} /> CSV template
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                  <textarea
                    ref={composer}
                    rows={1}
                    maxLength={2000}
                    aria-label="Ask a research question"
                    placeholder="Ask about mutations, drugs, or your results…"
                    aria-describedby="assistant-composer-help"
                    value={question}
                    disabled={!!chat.busy}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        ask(question);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="ra-send"
                    aria-label="Send question"
                    disabled={!!chat.busy || !question.trim()}
                  >
                    <ArrowUp size={18} />
                  </button>
                </form>
                <span id="assistant-composer-help" className="sr-only">
                  Enter sends. Shift+Enter adds a new line.
                </span>
                <p className="ra-disclaimer">
                  AI explanations may be inaccurate. ΔΔG predictions come from trained ML models.
                </p>
                <Popover.Root>
                  <Popover.Trigger className="ra-privacy-trigger">
                    File requirements &amp; privacy <ChevronDown size={12} aria-hidden="true" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="ra-info-popover"
                      side="top"
                      align="end"
                      sideOffset={12}
                      collisionPadding={16}
                      aria-label="File requirements and privacy"
                    >
                      <h3>Files &amp; privacy</h3>
                      <p>
                        One PDF or CSV, up to 2 MB. CSV: one sample with exact feature headers. PDF:
                        text with descriptor/value pairs, up to 12 pages.
                      </p>
                      <p>
                        Files go to your backend. PDF text and questions reach its configured Ollama
                        server. This application does not save uploads or chats.
                      </p>
                      <p>
                        <strong>Language model:</strong> {chat.status.model}. {chat.status.message}
                      </p>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </footer>
            </>
          )}
          {dragging && (
            <div className="ra-drop-overlay">
              <FileUp size={36} />
              <strong>Drop your sample here</strong>
              <span>One PDF or CSV &middot; up to 2 MB</span>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
