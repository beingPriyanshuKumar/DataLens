import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Button from "../components/Button";
import { GUIDE_SECTIONS } from "../content/guide";
import "./Guide.css";

export default function Guide() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Guide — DataLens";
    window.scrollTo(0, 0);
  }, []);

  const handleTryExample = () => {
    const prompt = encodeURIComponent(
      "Find 30 B2B SaaS startups founded in 2024 or 2025 that raised seed funding, with founders and website"
    );
    navigate(`/collect?prompt=${prompt}`);
  };

  return (
    <div className="page-shell guide-page">
      <Header />
      <main id="main-content" className="guide-main" role="main">
        {/* Title Header */}
        <section className="guide-hero">
          <div className="guide-hero__content">
            <span className="guide-hero__badge font-mono">// USER DOCUMENTATION</span>
            <h1 className="guide-hero__title">How DataLens Works</h1>
            <p className="guide-hero__subtitle">
              A comprehensive handbook on writing prompts, tuning regional biases, reviewing extraction plans,
              and verifying source provenance.
            </p>
          </div>
          <div className="guide-hero__action">
            <Button variant="primary" onClick={handleTryExample}>
              TRY AN EXAMPLE ↗
            </Button>
          </div>
        </section>

        {/* 2-Column Grid: Sticky TOC + Guide Content */}
        <div className="guide-layout">
          <aside className="guide-sidebar" aria-label="Table of contents">
            <div className="guide-toc-box">
              <div className="guide-toc__header font-mono">TABLE OF CONTENTS</div>
              <nav className="guide-toc__nav">
                {GUIDE_SECTIONS.map((sec, idx) => (
                  <a key={sec.id} href={`#${sec.id}`} className="guide-toc__link">
                    <span className="guide-toc__index font-mono">{(idx + 1).toString().padStart(2, "0")}</span>
                    <span className="guide-toc__label">{sec.title.replace(/^\d+\.\s*/, "")}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="guide-content">
            {GUIDE_SECTIONS.map((section, idx) => (
              <section key={section.id} id={section.id} className="guide-section">
                <div className="guide-section__header">
                  <span className="guide-section__num font-mono">STEP {(idx + 1).toString().padStart(2, "0")}</span>
                  <h2 className="guide-section__title">{section.title}</h2>
                  <p className="guide-section__summary">{section.summary}</p>
                </div>

                <div className="guide-section__body">
                  {section.content.split("\n\n").map((block, bIdx) => {
                    const trimmed = block.trim();
                    if (!trimmed) return null;

                    // Table rendering
                    if (trimmed.includes("|") && trimmed.includes("\n|")) {
                      const rows = trimmed.split("\n").filter((r) => r.trim().startsWith("|"));
                      if (rows.length >= 3) {
                        const headers = rows[0].split("|").slice(1, -1).map((h) => h.trim());
                        const bodyRows = rows.slice(2).map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));
                        return (
                          <div key={bIdx} className="guide-table-wrap">
                            <table className="guide-table">
                              <thead>
                                <tr>
                                  {headers.map((h, hIdx) => (
                                    <th key={hIdx}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {bodyRows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }
                    }

                    // Bulleted / Numbered list
                    if (trimmed.startsWith("- ") || trimmed.startsWith("1. ")) {
                      const items = trimmed.split("\n").map((line) => line.trim());
                      return (
                        <ul key={bIdx} className="guide-list">
                          {items.map((item, itemIdx) => (
                            <li key={itemIdx}>{item.replace(/^[-*]\s+|\d+\.\s+/, "")}</li>
                          ))}
                        </ul>
                      );
                    }

                    return (
                      <p key={bIdx} className="guide-paragraph">
                        {trimmed}
                      </p>
                    );
                  })}

                  {/* Accordion FAQ items */}
                  {section.accordion && section.accordion.length > 0 && (
                    <div className="guide-accordions">
                      {section.accordion.map((item, aIdx) => (
                        <details key={aIdx} className="guide-detail">
                          <summary className="guide-summary">
                            <span>{item.summary}</span>
                            <span className="guide-summary__icon" aria-hidden="true">+</span>
                          </summary>
                          <div className="guide-detail__content">
                            <p>{item.details}</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}

                  {section.id === "quick-start" && (
                    <div className="guide-cta-inline">
                      <Button variant="secondary" onClick={handleTryExample}>
                        LAUNCH SAMPLE RUN IN COLLECT ↗
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
