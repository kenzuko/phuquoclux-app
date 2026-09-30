import { Link } from "react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="PhuQuocLux">
      <img
        className="brand-mark"
        src="/assets/phuquoclux-mark.webp"
        alt=""
        width={46}
        height={46}
      />
      <span className="brand-copy">
        <strong>
          PhuQuoc<span>Lux</span>
        </strong>
        {!compact ? <small>by JoTrip</small> : null}
      </span>
    </Link>
  );
}
