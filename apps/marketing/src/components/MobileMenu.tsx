import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const FEATURES_LINKS = [
  {
    href: "/features/ai-chat",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    label: "AI Chat",
  },
  {
    href: "/features/integrations",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    label: "Integrations",
  },
  {
    href: "/features/shopify",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
    ),
    label: "Shopify",
  },
  {
    href: "/features/customer-memory",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    label: "Customer Memory",
  },
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
        className="sm:hidden flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent transition-colors"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
      >
        <svg
          className="w-6 h-6 text-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity duration-300 sm:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <div
        id="mobile-menu"
        className={cn(
          "fixed top-0 right-0 h-full w-[280px] max-w-[85vw] bg-card border-l border-border shadow-xl z-50 transition-transform duration-300 ease-out sm:hidden",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-heading font-bold text-lg text-foreground">Menu</span>
          <button
            type="button"
            onClick={closeMenu}
            className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent transition-colors"
            aria-label="Close menu"
          >
            <svg
              className="w-6 h-6 text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav className="p-4 space-y-2">
          <div>
            <button
              type="button"
              onClick={toggleFeatures}
              className="flex items-center justify-between w-full px-3 py-3 font-heading text-base font-medium text-foreground hover:bg-accent rounded-md transition-colors"
              aria-expanded={featuresExpanded}
            >
              Features
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  featuresExpanded && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                featuresExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="pl-3 pt-1 space-y-1">
                {FEATURES_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent hover:text-primary rounded-md transition-colors"
                  >
                    <span className="text-primary">{link.icon}</span>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <a
            href="/pricing"
            onClick={closeMenu}
            className="block px-3 py-3 font-heading text-base font-medium text-foreground hover:bg-accent rounded-md transition-colors"
          >
            Pricing
          </a>

          <div className="h-px bg-border my-4" />

          <a
            href="https://app.echo.com"
            onClick={closeMenu}
            className="block px-3 py-3 font-heading text-base font-medium text-foreground hover:bg-accent rounded-md transition-colors"
          >
            Log in
          </a>

          <a
            href="https://app.echo.com/signup"
            onClick={closeMenu}
            className="flex items-center justify-center w-full px-4 py-3 mt-2 bg-primary text-primary-foreground font-heading font-medium rounded-md shadow-sm hover:bg-primary/90 transition-colors"
          >
            Start Free
          </a>
        </nav>
      </div>
    </>
  );
}

export default MobileMenu;
