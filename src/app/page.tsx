import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SearchPanel from "@/components/SearchPanel";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen grid grid-rows-[1fr_auto] items-center justify-items-center p-8">
      <main className="w-full max-w-5xl mx-auto flex flex-col items-center gap-8">
        <p className="opacity-70 text-sm">Welcome, {user.email}</p>
        <SearchPanel />
      </main>
      <footer className="row-start-2 mt-12 text-xs opacity-70">
        MVP UI — Search, Levels, and Asset selectors. Analysis action wiring next.
      </footer>
    </div>
  );
}
