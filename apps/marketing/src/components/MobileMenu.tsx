import { useState, useEffect, useCallback } from "react";
import { ThemeToggleMobile } from "./ThemeToggle";

const FEATURES_LINKS = [
  { href: "/features/ai-chat", label: "AI Chat" },
  { href: "/features/integrations", label: "Integrations" },
  { href: "/features/shopify", label: "Shopify" },
  { href: "/features/customer-memory", label: "Customer Memory" },
];

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "";
      setFeaturesExpanded(false);
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleEscape]);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);
  const toggleFeatures = () => setFeaturesExpanded((prev) => !prev);

  return (
    <>
      <button
        type="button"
        onClick={toggleMenu}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "6px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
        className="sm:hidden"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <svg
          style={{ width: "24px", height: "24px", color: "#1C1917" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            onClick={closeMenu}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 9998,
            }}
            aria-hidden="true"
          />

          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "280px",
              maxWidth: "85vw",
              height: "100vh",
              backgroundColor: "#FAFAF9",
              borderLeft: "1px solid #E7E5E4",
              boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.1)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                borderBottom: "1px solid #E7E5E4",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "18px", color: "#1C1917" }}>Menu</span>
              <button
                type="button"
                onClick={closeMenu}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
                aria-label="Close menu"
              >
                <svg style={{ width: "24px", height: "24px" }} fill="none" viewBox="0 0 24 24" stroke="#1C1917">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
              <div style={{ marginBottom: "8px" }}>
                <button
                  type="button"
                  onClick={toggleFeatures}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "12px",
                    fontSize: "16px",
                    fontWeight: 500,
                    color: "#1C1917",
                    background: "transparent",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  aria-expanded={featuresExpanded}
                >
                  Features
                  <svg
                    style={{
                      width: "20px",
                      height: "20px",
                      transform: featuresExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#1C1917"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {featuresExpanded && (
                  <div style={{ paddingLeft: "12px", paddingTop: "4px" }}>
                    {FEATURES_LINKS.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={closeMenu}
                        style={{
                          display: "block",
                          padding: "10px 12px",
                          fontSize: "14px",
                          color: "#1C1917",
                          textDecoration: "none",
                          borderRadius: "6px",
                        }}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <a
                href="/pricing"
                onClick={closeMenu}
                style={{
                  display: "block",
                  padding: "12px",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#1C1917",
                  textDecoration: "none",
                  borderRadius: "6px",
                }}
              >
                Pricing
              </a>

              <div style={{ height: "1px", backgroundColor: "#E7E5E4", margin: "16px 0" }} />

              <a
                href="https://app.echo.com"
                onClick={closeMenu}
                style={{
                  display: "block",
                  padding: "12px",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#1C1917",
                  textDecoration: "none",
                  borderRadius: "6px",
                }}
              >
                Log in
              </a>

              <a
                href="https://app.echo.com/signup"
                onClick={closeMenu}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  padding: "12px 16px",
                  marginTop: "8px",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#FAFAF9",
                  backgroundColor: "#EA580C",
                  textDecoration: "none",
                  borderRadius: "6px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                Start Free
              </a>

              <div style={{ height: "1px", backgroundColor: "#E7E5E4", margin: "16px 0" }} />

              <ThemeToggleMobile />
            </nav>
          </div>
        </>
      )}
    </>
  );
}

export default MobileMenu;
