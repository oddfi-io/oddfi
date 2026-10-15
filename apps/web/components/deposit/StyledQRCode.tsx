"use client";

import { useEffect, useMemo, useRef } from "react";

interface StyledQRCodeProps {
  value: string;
  size?: number;
  clearCenterSize?: number;
}

export default function StyledQRCode({
  value,
  size = 180,
  clearCenterSize = 0,
}: StyledQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !containerRef.current) return;
      const qr = new QRCodeStyling({
        width: size,
        height: size,
        data: value,
        type: "svg",
        dotsOptions: { type: "dots", color: "#FFFFFF" },
        cornersSquareOptions: { type: "square", color: "#FFFFFF" },
        cornersDotOptions: { type: "square", color: "#FFFFFF" },
        backgroundOptions: { color: "transparent" },
        qrOptions: { errorCorrectionLevel: "H" },
      });
      containerRef.current.innerHTML = "";
      qr.append(containerRef.current);

      // Shrink data dots (not corner squares) for a thinner, lighter look
      requestAnimationFrame(() => {
        if (cancelled || !containerRef.current) return;
        const circles = containerRef.current.querySelectorAll<SVGCircleElement>("circle");
        circles.forEach((c) => {
          const r = parseFloat(c.getAttribute("r") || "0");
          if (r > 0) c.setAttribute("r", (r * 0.7).toString());
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  const maskStyle = useMemo(() => {
    if (clearCenterSize <= 0) return undefined;
    const offset = (size - clearCenterSize) / 2;
    const end = offset + clearCenterSize;
    // White outer + transparent center square via evenodd — works in default alpha mask mode
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><path fill='white' fill-rule='evenodd' d='M0,0 H${size} V${size} H0 Z M${offset},${offset} H${end} V${end} H${offset} Z'/></svg>`;
    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    return {
      maskImage: url,
      WebkitMaskImage: url,
      maskRepeat: "no-repeat" as const,
      WebkitMaskRepeat: "no-repeat" as const,
    };
  }, [size, clearCenterSize]);

  return <div ref={containerRef} style={{ width: size, height: size, ...maskStyle }} />;
}
