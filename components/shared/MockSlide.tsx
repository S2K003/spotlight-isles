import type { SlideSpec } from "@/lib/engine/types";

/**
 * A deliberately bad mock slide, built from the question's `slide` spec. Rendered at a fixed
 * 16:9 design size and scaled with CSS, so the phone and the projector show the same thing.
 */
export function MockSlide({ slide, width }: { slide: SlideSpec; width: number }) {
  const W = 480;
  const H = 270;
  const k = width / W;
  const wall = slide.kind === "textwall";
  return (
    <div style={{ width, height: H * k }} className="shrink-0 overflow-hidden rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-2 ring-white/30">
      <div
        style={{
          width: W,
          height: H,
          transform: `scale(${k})`,
          transformOrigin: "top left",
          background: wall ? "#fdfdf6" : "#1f9d3a",
          color: wall ? "#222" : "#e02020",
          fontFamily: wall ? "'Times New Roman', serif" : "Arial, sans-serif",
          padding: wall ? "10px 14px" : "26px 30px",
          position: "relative",
        }}
      >
        <div style={{ fontSize: wall ? 22 : 34, fontWeight: 700, color: wall ? "#b3125f" : "#e02020", marginBottom: wall ? 4 : 18 }}>{slide.title}</div>
        {wall ? (
          <>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 9.4, lineHeight: 1.28, listStyle: "disc" }}>
              {slide.bullets.map((b, i) => (
                <li key={i} style={{ color: ["#1a3fb0", "#222", "#0a7a2f"][i % 3] }}>
                  {b}
                </li>
              ))}
            </ul>
            {/* "Clip art": a simple code-drawn lightbulb. */}
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ position: "absolute", right: 8, top: 4 }}>
              <circle cx="26" cy="22" r="14" fill="#ffe14a" stroke="#333" strokeWidth="2" />
              <rect x="20" y="35" width="12" height="9" fill="#999" stroke="#333" strokeWidth="2" />
              <path d="M6 22h-5M51 22h-5M26 3V0M10 8L7 5M42 8l3-3" stroke="#f7a400" strokeWidth="3" />
            </svg>
          </>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 26, fontSize: 24, lineHeight: 1.7, listStyle: "disc" }}>
            {slide.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
