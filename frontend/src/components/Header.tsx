import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import "./Header.css";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathname = location.pathname;

  const navLinks = [
    { label: "HOME", to: "/", active: pathname === "/" },
    { label: "COLLECT", to: "/collect", active: pathname.startsWith("/collect") },
    { label: "TASKS", to: "/tasks", active: pathname.startsWith("/tasks") },
    { label: "GUIDE", to: "/guide", active: pathname === "/guide" },
    { label: "TRUST", to: "/trust", active: pathname === "/trust" },
  ];

  return (
    <header className="header" role="banner">
      <a href="#main-content" className="header__skip-link">
        Skip to content
      </a>
      <div className="header__left">
        <Link to="/" className="header__logo" aria-label="DataLens Home">
          // DataLens
        </Link>
      </div>
      <div className="header__right">
        <button
          className="header__menu-btn"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
        <nav
          className={`header__nav ${mobileMenuOpen ? "header__nav--open" : ""}`}
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className={`header__nav-link ${link.active ? "header__nav-link--active" : ""}`}
              aria-current={link.active ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Button
          variant="primary"
          onClick={() => {
            setMobileMenuOpen(false);
            navigate("/collect");
          }}
        >
          NEW TASK ↗
        </Button>
      </div>
    </header>
  );
}
