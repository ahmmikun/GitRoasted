"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Menu, X } from "lucide-react";
import { APP_NAME, NAV_ITEMS } from "@/lib/site-config";

/**
 * Shared site header.
 *
 * Renders the full navigation on wide viewports and a disclosure-style menu on
 * narrow ones. The mobile toggle is a real button with `aria-expanded` and
 * `aria-controls`, the panel closes on Escape and on route change, and the
 * active route is marked with `aria-current` so the state is not communicated
 * by colour alone.
 */
export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Allow Escape to dismiss the open menu.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /** A route is active when it matches exactly, or is a parent of the path. */
  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label={`${APP_NAME} home`}>
          <Flame size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>{APP_NAME}</span>
        </Link>

        <nav className="site-nav-desktop" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`site-nav-link${isActive(item.href) ? " is-active" : ""}`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Menu size={20} strokeWidth={2.5} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile panel. Kept in the tree but hidden so the toggle always has a target. */}
      <nav
        id="site-mobile-nav"
        className={`site-nav-mobile${open ? " is-open" : ""}`}
        aria-label="Primary"
        hidden={!open}
      >
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`site-nav-mobile-link${isActive(item.href) ? " is-active" : ""}`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <span className="site-nav-mobile-label">{item.label}</span>
                <span className="site-nav-mobile-desc">{item.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
