import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__container">
        <div className="footer__honesty">
          Data is collected from public pages and every record links to its source.
        </div>
        <div className="footer__meta">
          <span className="footer__item">v0.1.0</span>
          <span className="footer__sep">·</span>
          <a
            href="https://github.com/beingPriyanshuKumar/codecubicle"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__link"
          >
            GitHub Repository ↗
          </a>
          <span className="footer__sep">·</span>
          <span className="footer__item">MIT License</span>
        </div>
      </div>
    </footer>
  );
}
