const SERPER_URL = "https://google.serper.dev/news";

export interface NewsItem {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
  source?: string;
}

export async function fetchNews(query: string, num = 10): Promise<NewsItem[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("Missing SERPER_API_KEY");

  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({ q: query, num }),
    // Serper is external; allow 20s timeout via AbortController if desired
  });
  if (!res.ok) throw new Error(`Serper error ${res.status}`);
  const json = await res.json();
  return (json?.news || []) as NewsItem[];
}
