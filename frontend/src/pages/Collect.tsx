import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Button from "../components/Button";
import PlanEditor from "../components/PlanEditor";
import TaskWorkspace from "../components/TaskWorkspace";
import { previewTask, createTask, getRegions } from "../api";
import type { TaskSpec, Plan, Region, PreviewResponse } from "../types";
import "./Collect.css";

const QUICK_EXAMPLES = [
  "Find remote machine learning engineer openings posted in the last 2 weeks",
  "List 30 Indian SaaS startups that raised seed funding in 2025 with their founders",
  "Find companies that sponsored hackathons in India in the last two years",
  "List YC Winter 2026 enterprise startups with their headquarters and website",
];

const DEFAULT_REGIONS: Region[] = [
  { code: "GLOBAL", name: "Worldwide" },
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
];

export default function Collect() {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for Steps 1 & 2
  const [step, setStep] = useState<1 | 2 | 3 | 4>(taskId ? 3 : 1);
  const [prompt, setPrompt] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("GLOBAL");
  const [spec, setSpec] = useState<TaskSpec | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);

  // Set document title
  useEffect(() => {
    document.title = taskId ? `Task #${taskId.slice(0, 8)} — DataLens` : "Collect Data — DataLens";
  }, [taskId]);

  // Handle ?prompt= query parameter prefilling
  useEffect(() => {
    const p = searchParams.get("prompt");
    if (p && !taskId) {
      setPrompt(p.slice(0, 1000));
    }
  }, [searchParams, taskId]);

  // Sync step if taskId is present
  useEffect(() => {
    if (taskId) {
      setStep(3);
    } else {
      setStep(1);
    }
  }, [taskId]);

  // Fetch regions
  const { data: regions = DEFAULT_REGIONS, isError: regionsError } = useQuery({
    queryKey: ["regions"],
    queryFn: getRegions,
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => previewTask(prompt.trim(), selectedRegion),
    onSuccess: (data: PreviewResponse) => {
      if (data.spec?.clarification) {
        setClarification(data.spec.clarification);
        setStep(1);
      } else if (data.spec && data.plan) {
        setClarification(null);
        setSpec(data.spec);
        setPlan(data.plan);
        setStep(2);
      }
    },
  });

  // Run mutation
  const runMutation = useMutation({
    mutationFn: () => {
      if (!prompt.trim() || !spec || !plan) throw new Error("Plan missing");
      return createTask(prompt.trim(), spec, plan);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      navigate(`/collect/${data.task_id}`);
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (prompt.trim() && !previewMutation.isPending) {
        previewMutation.mutate();
      }
    }
  };

  return (
    <div className="page-shell collect-page">
      <Header />
      <main id="main-content" className="collect-main" role="main">
        {/* 4-Step Stepper */}
        <nav className="collect-stepper" aria-label="Collection steps">
          <div
            className={`collect-step ${step === 1 ? "collect-step--active" : step > 1 ? "collect-step--done" : ""}`}
            aria-current={step === 1 ? "step" : undefined}
          >
            <span className="collect-step__num font-mono">{step > 1 ? "✓" : "01"}</span>
            <span className="collect-step__label">DESCRIBE</span>
          </div>
          <div className="collect-step-sep">→</div>
          <div
            className={`collect-step ${step === 2 ? "collect-step--active" : step > 2 ? "collect-step--done" : ""}`}
            aria-current={step === 2 ? "step" : undefined}
          >
            <span className="collect-step__num font-mono">{step > 2 ? "✓" : "02"}</span>
            <span className="collect-step__label">REVIEW PLAN</span>
          </div>
          <div className="collect-step-sep">→</div>
          <div
            className={`collect-step ${step === 3 ? "collect-step--active" : step > 3 ? "collect-step--done" : ""}`}
            aria-current={step === 3 ? "step" : undefined}
          >
            <span className="collect-step__num font-mono">{step > 3 ? "✓" : "03"}</span>
            <span className="collect-step__label">RUN</span>
          </div>
          <div className="collect-step-sep">→</div>
          <div
            className={`collect-step ${step === 4 ? "collect-step--active" : ""}`}
            aria-current={step === 4 ? "step" : undefined}
          >
            <span className="collect-step__num font-mono">04</span>
            <span className="collect-step__label">RESULTS</span>
          </div>
        </nav>

        {/* WORKSPACE CONTENT */}
        {taskId ? (
          /* Steps 3 & 4: Live Task Workspace */
          <TaskWorkspace taskId={taskId} onStepChange={(s) => setStep(s)} />
        ) : step === 1 ? (
          /* Step 1: Describe Prompt & Region */
          <section className="collect-step1">
            <div className="collect-step1__header">
              <span className="collect-label font-mono">// STEP 01: DEFINE DATASET</span>
              <h1 className="collect-title">What data do you need?</h1>
              <p className="collect-subtitle">
                Describe the entities you want to collect. DataLens will generate field schemas, search queries,
                and validation bounds automatically.
              </p>
            </div>

            {/* Clarification Alert */}
            {clarification && (
              <div className="collect-clarification-banner">
                <span className="font-mono">CLARIFICATION NEEDED:</span>
                <p>{clarification}</p>
              </div>
            )}

            {/* Prompt Textarea */}
            <div className="collect-textarea-wrap">
              <label htmlFor="prompt-input" className="collect-input-label font-mono">
                DATASET PROMPT ({prompt.length}/1000 CHARS)
              </label>
              <textarea
                id="prompt-input"
                className="collect-textarea"
                rows={4}
                maxLength={1000}
                placeholder="e.g. Find 30 B2B SaaS startups founded in 2024 or 2025 that raised seed funding, with their founders, location, and website"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={previewMutation.isPending}
              />
              <span className="collect-textarea-hint font-mono">Tip: Press Ctrl+Enter or Cmd+Enter to preview plan</span>
            </div>

            {/* Region Selector */}
            <div className="collect-region-wrap">
              <div className="collect-region-label-row">
                <label htmlFor="region-select" className="collect-input-label font-mono">
                  SEARCH REGION (GEOGRAPHIC BIAS)
                </label>
                {regionsError && (
                  <span className="collect-region-warn font-mono">Using default regions (API offline)</span>
                )}
              </div>
              <div className="collect-region-select-row">
                <select
                  id="region-select"
                  className="collect-region-select font-mono"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  disabled={previewMutation.isPending}
                >
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name || r.code} ({r.code})
                    </option>
                  ))}
                </select>
                <span className="collect-region-note">
                  Region shifts where we look and which local terms and currencies we prefer. It does not guarantee
                  every result comes from that region.
                </span>
              </div>
            </div>

            {/* Quick Example Chips */}
            <div className="collect-examples-wrap">
              <span className="collect-examples-label font-mono">OR TRY AN EXAMPLE:</span>
              <div className="collect-chips">
                {QUICK_EXAMPLES.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="collect-chip"
                    onClick={() => setPrompt(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="collect-actions-bar">
              <Button
                variant="primary"
                onClick={() => previewMutation.mutate()}
                disabled={!prompt.trim() || previewMutation.isPending}
              >
                {previewMutation.isPending ? "INFERRING PLAN…" : "PREVIEW PLAN →"}
              </Button>
              {previewMutation.isError && (
                <span className="collect-error-text font-mono">
                  Error: {(previewMutation.error as Error).message}
                </span>
              )}
            </div>
          </section>
        ) : (
          /* Step 2: Review & Edit Plan */
          <section className="collect-step2">
            <div className="collect-step2__header">
              <div className="collect-step2__title-wrap">
                <span className="collect-label font-mono">// STEP 02: REVIEW EXTRACTION PLAN</span>
                <h1 className="collect-title">Review Schema &amp; Search Queries</h1>
                <p className="collect-subtitle">
                  Verify the entity fields, required constraints, and targeted search terms before starting the crawl.
                </p>
              </div>
              <div className="collect-step2__actions">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  ← EDIT PROMPT
                </Button>
                <Button
                  variant="primary"
                  onClick={() => runMutation.mutate()}
                  disabled={runMutation.isPending}
                >
                  {runMutation.isPending ? "LAUNCHING RUN…" : "RUN TASK ↗"}
                </Button>
              </div>
            </div>

            {spec && plan && (
              <div className="collect-plan-container">
                <PlanEditor
                  spec={spec}
                  plan={plan}
                  onSpecChange={(newSpec) => setSpec(newSpec)}
                  onPlanChange={(newPlan) => setPlan(newPlan)}
                />
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
