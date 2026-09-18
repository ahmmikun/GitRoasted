import Link from "next/link";
import { Coffee, Flame } from "lucide-react";
import {
  APP_NAME,
  APP_TAGLINE,
  CREATOR_NAME,
  NAV_ITEMS,
  SOCIAL_LINKS,
  SUPPORT_LINK,
} from "@/lib/site-config";
import SocialIcon from "./SocialIcon";

/**
 * Shared site footer: what the app is, where to go next, who made it, and a
 * low-key support link. Deliberately compact — three short columns.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-footer-brandline">
            <Flame size={16} strokeWidth={2.5} aria-hidden="true" />
            {APP_NAME}
          </span>
          <p>{APP_TAGLINE}</p>
        </div>

        <nav className="site-footer-col" aria-label="Footer">
          <h2 className="site-footer-heading">Explore</h2>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="site-footer-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-footer-col">
          <h2 className="site-footer-heading">Connect</h2>
          <ul className="site-footer-socials">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.key}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.ariaLabel}
                  className="site-footer-social"
                >
                  <SocialIcon name={social.key} size={16} />
                  <span>{social.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>
          © {year} {CREATOR_NAME}. Licensed under MIT.
        </p>
        <a
          href={SUPPORT_LINK.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SUPPORT_LINK.ariaLabel}
          className="site-footer-support"
        >
          <Coffee size={14} strokeWidth={2.5} aria-hidden="true" />
          {SUPPORT_LINK.label}
        </a>
      </div>
    </footer>
  );
}
