import { Suspense } from "react";
import { SiteShell } from "@/components/SiteShell";
import { SearchBar } from "@/components/broadcast/SearchBar";
import { CategoryChips, CategorySidebar } from "@/components/broadcast/CategoryChips";
import { FeedList } from "@/components/broadcast/FeedList";
import { DeadlineRail } from "@/components/broadcast/DeadlineRail";
import { categoryCounts, listBroadcasts, upcomingDeadlines } from "@/lib/queries";
import { todayJakarta } from "@/lib/classify/rules";
import { CATEGORY_KEYS } from "@/lib/categories";

export const revalidate = 60;

type Props = { searchParams: Promise<{ cat?: string; q?: string }> };

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const cat = sp.cat && (CATEGORY_KEYS as string[]).includes(sp.cat) ? sp.cat : undefined;
  const q = sp.q?.trim() || undefined;
  const params = { cat, q };

  const [page, counts, deadlines] = await Promise.all([
    listBroadcasts(params),
    categoryCounts(),
    upcomingDeadlines(todayJakarta()),
  ]);

  return (
    <SiteShell>
      <h1 className="sr-only">Arsip broadcast</h1>
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,680px)_280px] lg:justify-center lg:gap-8">
        <div className="hidden lg:block">
          <CategorySidebar active={cat} q={q} counts={counts} />
        </div>
        <div className="min-w-0">
          <Suspense>
            <SearchBar />
          </Suspense>
          <div className="sticky top-[100px] z-20 -mx-4 mb-2 bg-bg px-4 md:top-14 lg:hidden">
            <CategoryChips active={cat} q={q} counts={counts} />
          </div>
          <div className="mt-2">
            <FeedList key={`${cat ?? ""}|${q ?? ""}`} initial={page.items} nextCursor={page.nextCursor} params={params} />
          </div>
        </div>
        <div className="hidden lg:block">
          <DeadlineRail items={deadlines} />
        </div>
      </div>
    </SiteShell>
  );
}
