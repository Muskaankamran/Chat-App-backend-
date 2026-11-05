import { MessageCircle } from "lucide-react";

export default function Brand({ compact = false }) {
  return (
    <div className={`brand-mark${compact ? " brand-mark-compact" : ""}`}>
      <span className="brand-icon"><MessageCircle size={19} strokeWidth={2.2} /></span>
      {!compact && (
        <span className="brand-name">orbit<span className="brand-period">.</span></span>
      )}
    </div>
  );
}
