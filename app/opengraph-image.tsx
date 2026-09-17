import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social share card for the landing page: deactivated-CRT substrate,
 * macro headline, hazard-red COUNT block, telemetry strip. System fonts
 * only — no network fetches at render time.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A0A0A",
          color: "#EAEAEA",
          padding: "56px 64px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 4,
            color: "#8F8F8F",
          }}
        >
          <span>[ GATE-MENTOR ]</span>
          <span>REV 2.6</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, letterSpacing: 4, color: "#FF2A2A" }}>
            GATE CS / IT STUDY WORKSPACE
          </div>
          <div
            style={{
              fontSize: 118,
              fontWeight: 900,
              letterSpacing: -4,
              lineHeight: 1,
              marginTop: 16,
            }}
          >
            MAKE EVERY
          </div>
          <div
            style={{
              fontSize: 118,
              fontWeight: 900,
              letterSpacing: -4,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            QUESTION&nbsp;
            <span
              style={{
                backgroundColor: "#FF2A2A",
                color: "#0A0A0A",
                padding: "0 24px",
              }}
            >
              COUNT
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 4,
            color: "#8F8F8F",
            borderTop: "2px solid #EAEAEA",
            paddingTop: 20,
          }}
        >
          <span>PYQ PRACTICE /// AI MENTOR /// ANALYTICS</span>
          <span
            style={{
              width: 160,
              height: 18,
              backgroundColor: "#FF2A2A",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
