import { useState } from "react";
import { TEMPLATES } from "../templates";
import type { TemplateDefinition } from "../types";
import Button from "./Button";
import "./TemplateModal.css";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export default function TemplateModal({
  isOpen,
  onClose,
  onSelectPrompt,
}: TemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition>(
    TEMPLATES[0]
  );
  const [slotValues, setSlotValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    TEMPLATES[0].slots.forEach((s) => {
      initial[s.id] = s.defaultValue;
    });
    return initial;
  });

  if (!isOpen) return null;

  const handleSelectTemplate = (tmpl: TemplateDefinition) => {
    setSelectedTemplate(tmpl);
    const newVals: Record<string, string> = {};
    tmpl.slots.forEach((s) => {
      newVals[s.id] = s.defaultValue;
    });
    setSlotValues(newVals);
  };

  const handleSlotChange = (slotId: string, val: string) => {
    setSlotValues((prev) => ({ ...prev, [slotId]: val }));
  };

  const assembledPrompt = selectedTemplate.assemblePrompt(slotValues);

  const handleUsePrompt = () => {
    onSelectPrompt(assembledPrompt);
    onClose();
  };

  return (
    <div className="template-modal-overlay" onClick={onClose} role="dialog">
      <div
        className="template-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="template-modal__header">
          <h2 className="template-modal__title">Browse Prompt Templates</h2>
          <button
            type="button"
            className="template-modal__close"
            onClick={onClose}
            aria-label="Close template modal"
          >
            ✕
          </button>
        </div>

        <div className="template-modal__body">
          {/* Left: Template Cards */}
          <div className="template-cards-list">
            {TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className={`template-card-item ${
                  tmpl.id === selectedTemplate.id
                    ? "template-card-item--active"
                    : ""
                }`}
                onClick={() => handleSelectTemplate(tmpl)}
              >
                <div className="template-card-item__title">{tmpl.title}</div>
                <div className="template-card-item__desc">
                  {tmpl.description}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Slot inputs and live prompt preview */}
          <div className="template-composer">
            <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>
              {selectedTemplate.title}
            </h3>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-ink-muted)" }}>
              Customize slots below to adapt this prompt to your domain:
            </p>

            <div className="template-composer__slots">
              {selectedTemplate.slots.map((slot) => (
                <div key={slot.id} className="slot-field">
                  <label className="slot-field__label">{slot.label}</label>
                  <input
                    type="text"
                    className="slot-field__input"
                    placeholder={slot.placeholder}
                    value={slotValues[slot.id] || ""}
                    onChange={(e) => handleSlotChange(slot.id, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="template-preview-box">
              <span className="template-preview-box__label">
                Live Prompt Preview
              </span>
              <p className="template-preview-box__text">{assembledPrompt}</p>
            </div>
          </div>
        </div>

        <div className="template-modal__footer">
          <Button variant="ghost" onClick={onClose}>
            CANCEL
          </Button>
          <Button variant="primary" onClick={handleUsePrompt}>
            USE THIS PROMPT →
          </Button>
        </div>
      </div>
    </div>
  );
}
