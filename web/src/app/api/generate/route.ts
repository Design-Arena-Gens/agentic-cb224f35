import { NextRequest, NextResponse } from "next/server";

type HordeAsyncResponse = {
  id: string;
  message?: string;
  warnings?: string[];
};

type HordeStatusResponse = {
  finished: boolean;
  processing: number;
  done: number;
  wait_time?: number;
  queue_position?: number;
};

type HordeFetchResponse = {
  id: string;
  state: string;
  generations: Array<{
    img: string; // might be data URL or raw base64
    seed?: number;
    model?: string;
    width?: number;
    height?: number;
    censored?: boolean;
  }>;
};

const HORDE_BASE = "https://stablehorde.net/api/v2";
const HORDE_API_KEY = "0000000000"; // anonymous key with strict rate limits

const DEFAULT_PROMPT =
  [
    "16:9 ultra-HD hyper-realistic cinematic thumbnail of a stunningly handsome dark-skinned Indian male (age 20+),",
    "ultra-sharp facial details, clean glowing skin, perfect jawline, intense cold mafia-king eyes,",
    "full face clearly visible with high clarity.",
    "Scene: a massive black-and-gold mafia throne in the center of a dimly lit royal chamber.",
    "Character sits confidently, leaning slightly forward, exuding dominance and power.",
    "He wears a black royal coat, layered gold chains, heavy rings, and a luxury watch ? dark luxury aesthetic.",
    "Background: behind the throne, three matte-black luxury cars in a symmetrical line-up with glowing headlights cutting through smoke.",
    "Through a huge broken-window skyline, show a private helicopter hovering,",
    "its spotlight casting dramatic shadows across the throne room.",
    "Environment: scattered money on the floor, light smoke drifting, golden reflections on the walls,",
    "glowing dust particles, subtle sparks for explosive mafia energy, dark luxury and ruthless vibe.",
    "Photorealistic, cinematic lighting, volumetric fog, ray-traced reflections, 85mm lens, shallow depth of field,",
    "global illumination, ultra-detailed, 8k, masterpiece, high contrast, dramatic shadows."
  ].join(" ");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = (await req.json().catch(() => ({}))) as {
      prompt?: string;
    };

    const usedPrompt = (prompt ?? DEFAULT_PROMPT).slice(0, 4000);

    // 1) Submit async generation job
    const submitRes = await fetch(`${HORDE_BASE}/generate/async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: HORDE_API_KEY
      },
      body: JSON.stringify({
        prompt: usedPrompt,
        // Avoid nsfw, set trusted_workers false to widen pool
        nsfw: false,
        censor_nsfw: true,
        trusted_workers: false,
        r2: true,
        // Leave models unspecified to allow the network to choose
        models: [],
        params: {
          sampler_name: "k_euler",
          width: 1280,
          height: 720,
          steps: 30,
          cfg_scale: 7,
          karras: true,
          // modest denoise and clip skip defaults
          // upscaling for higher clarity
          post_processing: ["RealESRGAN_x4plus"]
        }
      })
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      return NextResponse.json(
        { error: "Failed to submit generation", details: text },
        { status: 502 }
      );
    }

    const submitJson = (await submitRes.json()) as HordeAsyncResponse;
    if (!submitJson.id) {
      return NextResponse.json(
        { error: "No job id returned", details: submitJson },
        { status: 502 }
      );
    }

    const jobId = submitJson.id;

    // 2) Poll status until finished or timeout
    const startedAt = Date.now();
    const hardTimeoutMs = 180_000; // 3 minutes

    // First quick wait
    await sleep(3000);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (Date.now() - startedAt > hardTimeoutMs) {
        return NextResponse.json(
          {
            error: "Generation timed out",
            jobId
          },
          { status: 504 }
        );
      }

      const statusRes = await fetch(
        `${HORDE_BASE}/generate/status/${encodeURIComponent(jobId)}`,
        {
          headers: { Accept: "application/json", apikey: HORDE_API_KEY }
        }
      );
      if (!statusRes.ok) {
        const text = await statusRes.text();
        return NextResponse.json(
          { error: "Failed to check status", details: text, jobId },
          { status: 502 }
        );
      }

      const statusJson = (await statusRes.json()) as HordeStatusResponse;
      if (statusJson.finished) {
        break;
      }

      const nextWait =
        typeof statusJson.wait_time === "number"
          ? Math.min(Math.max(statusJson.wait_time * 1000, 2000), 10_000)
          : 5000;
      await sleep(nextWait);
    }

    // 3) Fetch the result
    const fetchRes = await fetch(
      `${HORDE_BASE}/generate/fetch/${encodeURIComponent(jobId)}`,
      {
        headers: { Accept: "application/json", apikey: HORDE_API_KEY }
      }
    );
    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      return NextResponse.json(
        { error: "Failed to fetch result", details: text, jobId },
        { status: 502 }
      );
    }
    const fetchJson = (await fetchRes.json()) as HordeFetchResponse;
    const first = fetchJson.generations?.[0];
    if (!first?.img) {
      return NextResponse.json(
        { error: "No image returned", details: fetchJson, jobId },
        { status: 502 }
      );
    }

    const dataUrl = first.img.startsWith("data:")
      ? first.img
      : `data:image/webp;base64,${first.img}`;

    return NextResponse.json({
      jobId,
      image: dataUrl
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected server error", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

