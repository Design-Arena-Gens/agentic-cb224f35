import Generator from "@/components/Generator";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="min-h-screen w-full py-16 px-6 sm:px-10">
        <Generator />
      </main>
    </div>
  );
}
