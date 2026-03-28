"use client";

import { useEffect, useState } from "react";

const MIN_WIDTH = 1024;

export default function MinWidthGuard({ children }: { children: React.ReactNode }) {
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    const check = () => {
      // Use the larger of innerWidth and screen dimensions to handle
      // iPadOS Safari where innerWidth can underreport in landscape
      const viewportWidth = window.innerWidth;
      const screenLandscape = Math.max(screen.width, screen.height);
      const effectiveWidth = Math.max(viewportWidth, screenLandscape);
      setTooSmall(effectiveWidth < MIN_WIDTH);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (tooSmall) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-8 text-center">
        <svg
          className="mb-6 h-16 w-16 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z"
          />
        </svg>
        <h1 className="text-[28px] font-semibold text-text-primary">
          Desktop or Tablet Required
        </h1>
        <p className="mt-3 max-w-md text-sm text-text-secondary">
          AI Drawing Coach works best on larger screens. Please switch to a laptop or tablet
          for the full drawing experience.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
