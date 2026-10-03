import { Link } from "react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  const markSrc = import.meta.env.VITE_PAGES_PREVIEW === "1"
    ? `${import.meta.env.BASE_URL}assets/myphuquoc-mark.png`
    : "/assets/myphuquoc-mark.png";

  return (
    <Link
      className="brand"
      to="/"
      aria-label="My Phu Quoc - Your Island, Your Way."
    >
      <img
        className="brand-mark"
        src={markSrc}
        alt=""
        width={48}
        height={48}
      />
      <span className="brand-copy">
        <strong>MY PHU QUOC</strong>
        {!compact ? <small>YOUR ISLAND, YOUR WAY.</small> : null}
      </span>
    </Link>
  );
}
