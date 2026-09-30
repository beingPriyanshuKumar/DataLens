import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import "./Header.css";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  const handleNewTaskClick = () => {
    if (isHome) {
      const textarea = document.getElementById("prompt-input") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.scrollIntoView({ behavior: "smooth", block: "center" });
        textarea.focus();
      }
    } else {
      navigate("/#prompt-input");
    }
  };

  const navLinks = [
    { label: "TASKS", href: isHome ? "#tasks" : "/#tasks" },
    { label: "HOW IT WORKS", href: isHome ? "#how-it-works" : "/#how-it-works" },
    { label: "POLICY", href: isHome ? "#policy" : "/#policy" },
  ];

  return (
    <header className="header" role="banner">
      <div className="header__left">
        <Link to="/" className="header__logo" aria-label="DataLens Home">
          // DataLens
        </Link>
      </div>
      <div className="header__right">
        <nav className="header__nav" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="header__nav-link"
              onClick={(e) => {
                if (isHome && link.href.startsWith("#")) {
                  e.preventDefault();
                  const target = document.querySelector(link.href);
                  target?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Button variant="primary" onClick={handleNewTaskClick}>
          NEW TASK
        </Button>
      </div>
    </header>
  );
}
