/**
 * Un registre central (le losange) relié à trois porteurs (les nœuds) —
 * l'un d'eux, vérifié, porte le repère de conformité. La thèse de l'app en
 * un pictogramme : un registre unique, alimenté par des identités vérifiées,
 * animé pour rester "vivant" (flux le long des branches, halo qui respire).
 *
 * Géométrie exacte (tripode à 120°, rayon 13 depuis le centre 20,20) :
 * nœud haut (20,7), nœud bas-droite (31.26,26.5), nœud bas-gauche (8.74,26.5).
 * Le losange est un carré de 13×13 centré sur son propre pivot de rotation
 * (20,20) — contrairement à une v1 où le pivot et le centre du rect
 * divergeaient, décalant tout le motif.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <line
        x1="20" y1="20" x2="20" y2="7"
        stroke="var(--accent)" strokeWidth="1.4" strokeOpacity="0.6"
        className="logo-spoke" style={{ animationDelay: "0s" }}
      />
      <line
        x1="20" y1="20" x2="31.26" y2="26.5"
        stroke="var(--accent)" strokeWidth="1.4" strokeOpacity="0.6"
        className="logo-spoke" style={{ animationDelay: "-0.8s" }}
      />
      <line
        x1="20" y1="20" x2="8.74" y2="26.5"
        stroke="var(--accent)" strokeWidth="1.4" strokeOpacity="0.6"
        className="logo-spoke" style={{ animationDelay: "-1.6s" }}
      />

      <rect
        x="13.5"
        y="13.5"
        width="13"
        height="13"
        rx="3"
        transform="rotate(45 20 20)"
        fill="var(--accent-soft)"
        stroke="var(--accent)"
        strokeWidth="1.7"
      />
      <line x1="16.5" y1="20" x2="23.5" y2="20" stroke="var(--accent)" strokeWidth="1.2" strokeOpacity="0.65" />

      <circle cx="20" cy="7" r="3.2" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.4" />
      <circle cx="8.74" cy="26.5" r="3.2" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.4" />

      <circle cx="31.26" cy="26.5" r="6" fill="var(--accent-2)" fillOpacity="0.3" className="logo-node-glow" />
      <circle cx="31.26" cy="26.5" r="3.2" fill="var(--accent-2)" stroke="var(--accent-2)" strokeWidth="1.4" />
      <path
        d="M29.7 26.6 30.8 27.6 33 25.2"
        stroke="var(--surface)"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
