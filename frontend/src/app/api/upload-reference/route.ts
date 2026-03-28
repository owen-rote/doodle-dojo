import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { image, mimeType } = body as {
    image: string;
    mimeType: string;
  };

  if (!image) {
    return NextResponse.json(
      { error: "Missing image data" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${backendUrl}/api/upload_reference_image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference_image_base64: image, mimeType }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend upload error:", errorText);
      return NextResponse.json(
        { error: "Backend upload failed", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Upload reference error:", err);
    const message = err instanceof Error ? err.message : "Failed to reach backend";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
