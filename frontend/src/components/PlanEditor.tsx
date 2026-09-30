import type { TaskSpec, Plan, FieldSpec } from "../types";
import Button from "./Button";
import "./PlanEditor.css";

interface PlanEditorProps {
  spec: TaskSpec;
  plan: Plan;
  onSpecChange: (spec: TaskSpec) => void;
  onPlanChange: (plan: Plan) => void;
}

export default function PlanEditor({
  spec,
  plan,
  onSpecChange,
  onPlanChange,
}: PlanEditorProps) {
  // Estimate calculations (pure function of target_count and queries)
  const target = spec.target_count || 20;
  const estimatedPages = Math.min(plan.max_pages || 40, Math.ceil(target / 1.5));
  const estimatedSeconds = Math.max(15, Math.round(estimatedPages * 2.2));
  const estimatedCost = (estimatedPages * 0.008).toFixed(2);

  const handleFieldChange = (idx: number, patch: Partial<FieldSpec>) => {
    const updated = [...spec.fields];
    updated[idx] = { ...updated[idx], ...patch };
    onSpecChange({ ...spec, fields: updated });
  };

  const handleAddField = () => {
    const newField: FieldSpec = {
      name: `field_${spec.fields.length + 1}`,
      type: "str",
      description: "Custom field",
      required: false,
    };
    onSpecChange({ ...spec, fields: [...spec.fields, newField] });
  };

  const handleRemoveField = (idx: number) => {
    const updated = spec.fields.filter((_, i) => i !== idx);
    onSpecChange({ ...spec, fields: updated });
  };

  const handleQueryChange = (idx: number, val: string) => {
    const updated = [...plan.queries];
    updated[idx] = val;
    onPlanChange({ ...plan, queries: updated });
  };

  const handleAddQuery = () => {
    onPlanChange({ ...plan, queries: [...plan.queries, ""] });
  };

  const handleRemoveQuery = (idx: number) => {
    onPlanChange({
      ...plan,
      queries: plan.queries.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="plan-editor">
      {/* Estimate Strip */}
      <div className="estimate-strip">
        <div className="estimate-item">
          <span className="estimate-item__label">Estimated Pages</span>
          <span className="estimate-item__val">≈ {estimatedPages} pages</span>
        </div>
        <div className="estimate-item">
          <span className="estimate-item__label">Estimated Time</span>
          <span className="estimate-item__val">≈ {estimatedSeconds}s</span>
        </div>
        <div className="estimate-item">
          <span className="estimate-item__label">Estimated Cost</span>
          <span className="estimate-item__val">≈ ${estimatedCost}</span>
        </div>
        <div className="estimate-item">
          <span className="estimate-item__label">Target Count</span>
          <input
            type="number"
            min={1}
            max={200}
            value={spec.target_count || 20}
            onChange={(e) =>
              onSpecChange({
                ...spec,
                target_count: Math.max(1, parseInt(e.target.value) || 1),
              })
            }
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "1rem",
              fontWeight: 600,
              padding: "0.25rem 0.5rem",
              border: "1px solid var(--color-hairline)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              width: "80px",
            }}
          />
        </div>
      </div>

      {/* Fields Editor */}
      <div className="plan-editor__section">
        <div className="plan-editor__header">
          <h3 className="plan-editor__title">Schema Fields ({spec.fields.length})</h3>
          <Button variant="ghost" onClick={handleAddField}>
            + ADD FIELD
          </Button>
        </div>

        <table className="fields-table">
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Type</th>
              <th style={{ width: "90px" }}>Required</th>
              <th style={{ width: "60px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {spec.fields.map((f, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) =>
                      handleFieldChange(idx, {
                        name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    value={f.type}
                    onChange={(e) =>
                      handleFieldChange(idx, {
                        type: e.target.value as FieldSpec["type"],
                      })
                    }
                  >
                    <option value="str">Text (str)</option>
                    <option value="int">Integer (int)</option>
                    <option value="float">Float (float)</option>
                    <option value="bool">Boolean (bool)</option>
                    <option value="date">Date (date)</option>
                    <option value="url">URL (url)</option>
                    <option value="email">Email (email)</option>
                  </select>
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) =>
                      handleFieldChange(idx, { required: e.target.checked })
                    }
                  />
                </td>
                <td>
                  <Button
                    variant="ghost"
                    onClick={() => handleRemoveField(idx)}
                    disabled={spec.fields.length <= 1}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Search Queries Editor */}
      <div className="plan-editor__section">
        <div className="plan-editor__header">
          <h3 className="plan-editor__title">Search Queries ({plan.queries.length})</h3>
          <Button variant="ghost" onClick={handleAddQuery}>
            + ADD QUERY
          </Button>
        </div>

        <div className="queries-list">
          {plan.queries.map((q, idx) => (
            <div key={idx} className="query-row">
              <input
                type="text"
                className="query-row__input"
                value={q}
                onChange={(e) => handleQueryChange(idx, e.target.value)}
                placeholder="Search query..."
              />
              <Button
                variant="ghost"
                onClick={() => handleRemoveQuery(idx)}
                disabled={plan.queries.length <= 1}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
