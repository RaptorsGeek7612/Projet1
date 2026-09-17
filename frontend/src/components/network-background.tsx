/**
 * Réseau de nœuds/connexions décoratif, superposé au halo (institutional-bg).
 * Positions fixes (pas de Math.random) : décoratif mais identique entre le
 * rendu serveur et client, donc aucun risque de mismatch d'hydratation.
 * Le motif reflète l'idée de l'app : des porteurs vérifiés, en réseau.
 */
const NODES: [number, number, "accent" | "accent-2"][] = [
  [120, 140, "accent"],
  [340, 90, "accent"],
  [560, 220, "accent-2"],
  [260, 310, "accent"],
  [80, 420, "accent-2"],
  [480, 420, "accent"],
  [720, 130, "accent"],
  [900, 260, "accent-2"],
  [1080, 120, "accent"],
  [1240, 260, "accent"],
  [1360, 460, "accent-2"],
  [1150, 500, "accent"],
  [980, 560, "accent"],
  [640, 580, "accent-2"],
  [400, 600, "accent"],
  [180, 620, "accent"],
];

const EDGES: [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 0],
  [1, 2],
  [2, 6],
  [0, 4],
  [3, 5],
  [5, 2],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [13, 14],
  [14, 15],
  [7, 9],
  [11, 13],
];

export function NetworkBackground() {
  return (
    <svg
      viewBox="0 0 1440 800"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {EDGES.map(([a, b], i) => {
        const [x1, y1] = NODES[a];
        const [x2, y2] = NODES[b];
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--accent)"
            strokeWidth="1"
            strokeOpacity="0.16"
            className="constellation-edge"
            style={{ animationDelay: `${(i % 6) * -1}s` }}
          />
        );
      })}
      {NODES.map(([x, y, color], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="3"
          fill={color === "accent" ? "var(--accent)" : "var(--accent-2)"}
          fillOpacity="0.55"
          className="constellation-node"
          style={{ animationDelay: `${(i % 5) * -0.9}s` }}
        />
      ))}
    </svg>
  );
}
