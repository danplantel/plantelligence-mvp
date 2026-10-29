import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlanTelligence — every benefit, one clear story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #14243A 0%, #1F3A60 55%, #23919C 100%)",
          color: "white",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "28px",
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "#23919C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "19px",
              fontWeight: 700,
            }}
          >
            PT
          </div>
          PlanTelligence
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              maxWidth: "920px",
            }}
          >
            Every benefit, one clear story.
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "rgba(255,255,255,0.74)",
              maxWidth: "840px",
              lineHeight: 1.35,
            }}
          >
            Plan workspaces, a branded participant portal, and benefits
            communication in one platform.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "20px",
            color: "#9FD9DE",
          }}
        >
          <span>plantel.ai</span>
          <span>·</span>
          <span>Benefits communication, end to end</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
