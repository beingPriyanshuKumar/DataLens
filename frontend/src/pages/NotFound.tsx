import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Button from "../components/Button";
import "./NotFound.css";

export default function NotFound() {
  useEffect(() => {
    document.title = "404 Not Found — DataLens";
  }, []);

  return (
    <div className="page-shell not-found-page">
      <Header />
      <main id="main-content" className="not-found-main" role="main">
        <div className="not-found-box">
          <span className="not-found-badge font-mono">ERROR 404</span>
          <h1 className="not-found-title">Page Not Found</h1>
          <p className="not-found-text">
            The page you are looking for does not exist or may have moved.
          </p>
          <div className="not-found-actions">
            <Link to="/">
              <Button variant="primary">RETURN TO HOME ↗</Button>
            </Link>
            <Link to="/collect">
              <Button variant="secondary">COLLECT DATA</Button>
            </Link>
            <Link to="/tasks">
              <Button variant="ghost">TASKS LOG</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
