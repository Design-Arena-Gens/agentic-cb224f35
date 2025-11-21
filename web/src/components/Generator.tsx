"use client";

import { useCallback, useMemo, useState } from "react";

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

export default function Generator() {
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [image, setImage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = useMemo(() => prompt.trim().length > 0 && !isLoading, [prompt, isLoading]);

  const onGenerate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setImage(null);
      setJobId(null);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Generation request failed");
      }
      const data = (await res.json()) as { jobId: string; image: string };
      setJobId(data.jobId);
      setImage(data.image);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  const onDownload = useCallback(() => {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = "mafia-king-thumbnail.webp";
    link.click();
  }, [image]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Cinematic Mafia-King Thumbnail Generator
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Generate a photorealistic 16:9 thumbnail with dark luxury aesthetics.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="order-2 md:order-1">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
            Prompt
          </label>
          <textarea
            className="w-full h-56 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 dark:focus:ring-zinc-200"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {isLoading ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={() => setImage(null)}
              disabled={isLoading || !image}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              onClick={onDownload}
              disabled={!image}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {jobId && (
            <p className="mt-2 text-xs text-zinc-500">
              Job ID: {jobId}
            </p>
          )}
          {isLoading && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              This can take 30?90 seconds depending on queue load...
            </p>
          )}
        </div>

        <div className="order-1 md:order-2">
          <div className="relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm aspect-video dark:border-zinc-800 dark:bg-zinc-900">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt="Generated thumbnail"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                {isLoading ? "Rendering..." : "16:9 Preview will appear here"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
