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
  return (
    <div
      className={`product-visual product-visual--${mode} product-visual--${product.type}`}
      aria-label={product.name}
      role="img"
    >
      <img
        className="product-visual-mark"
        src="/assets/phuquoclux-mark.webp"
        alt=""
        aria-hidden="true"
      />
      <span className="product-visual-icon" aria-hidden="true">
        {iconByType[product.type]}
      </span>
      <span className="product-visual-location">{product.locationLabel}</span>
      <span className="product-visual-note">
        Hình minh họa · ảnh thật sẽ được bổ sung
      </span>
    </div>
  );
}
