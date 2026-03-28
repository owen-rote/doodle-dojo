function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const frameBase = (paths: string[]) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
    <rect width="1000" height="1000" fill="white"/>
    ${paths.join("\n")}
  </svg>
`;

const outlinePath = `
  <path
    d="M250 740
       C210 560 220 410 270 270
       L360 360
       C400 210 470 160 500 150
       C530 160 600 210 640 360
       L730 270
       C780 410 790 560 750 740
       C680 810 590 850 500 850
       C410 850 320 810 250 740Z"
    stroke="#111827"
    stroke-width="26"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`;

const leftEyePath = `
  <ellipse
    cx="410"
    cy="520"
    rx="42"
    ry="54"
    stroke="#111827"
    stroke-width="24"
  />
`;

const rightEyePath = `
  <ellipse
    cx="590"
    cy="520"
    rx="42"
    ry="54"
    stroke="#111827"
    stroke-width="24"
  />
`;

const mouthPath = `
  <path
    d="M455 655
       C485 685 515 685 545 655"
    stroke="#111827"
    stroke-width="24"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`;

const nosePath = `
  <path
    d="M480 600
       L500 585
       L520 600
       L500 615
       Z"
    stroke="#111827"
    stroke-width="22"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`;

export const mockGuideFrames = [
  svgToDataUrl(frameBase([outlinePath])),
  svgToDataUrl(frameBase([leftEyePath])),
  svgToDataUrl(frameBase([rightEyePath])),
  svgToDataUrl(frameBase([nosePath])),
  svgToDataUrl(frameBase([mouthPath])),
];

export const mockReferenceImageUrl = svgToDataUrl(
  frameBase([outlinePath, leftEyePath, rightEyePath, nosePath, mouthPath])
);
