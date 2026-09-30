import type { Product } from "../domain/catalog";

type Props = {
  product: Product;
  mode?: "card" | "hero";
};

const iconByType: Record<Product["type"], string> = {
  tour: "🛥",
  ticket: "🎟",
  transfer: "🚗",
};

export function ProductVisual({ product, mode = "card" }: Props) {
  if (product.media.kind === "photo") {
    return (
      <figure
        className={`product-visual product-visual--photo product-visual--${mode}`}
      >
        <img
          className="product-visual-photo"
          src={import.meta.env.VITE_PAGES_PREVIEW === "1" && product.media.src.startsWith("/") ? `${import.meta.env.BASE_URL}${product.media.src.slice(1)}` : product.media.src}
          alt={product.media.alt}
          loading={mode === "card" ? "lazy" : "eager"}
        />
        <figcaption>
          <span>{product.locationLabel}</span>
          {product.media.credit ? <small>{product.media.credit}</small> : null}
        </figcaption>
      </figure>
    );
  }

  return (
    <div
      className={`product-visual product-visual--${mode} product-visual--${product.type}`}
      aria-label={product.media.alt}
      role="img"
    >
      <img
        className="product-visual-mark"
        src={import.meta.env.VITE_PAGES_PREVIEW === "1" ? `${import.meta.env.BASE_URL}assets/phuquoclux-mark.webp` : "/assets/phuquoclux-mark.webp"}
        alt=""
        aria-hidden="true"
      />
      <span className="product-visual-icon" aria-hidden="true">
        {iconByType[product.type]}
      </span>
      <span className="product-visual-location">{product.locationLabel}</span>
      <span className="product-visual-note">
        Hình minh họa
      </span>
    </div>
  );
}
