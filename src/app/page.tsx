import { Timeline } from '@/components/Timeline';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 lg:py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            Cleon Timeline
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Paste any URL to summarize and save it to your stream.</p>
        </header>

        <Timeline />
      </div>
    </main>
  );
}
