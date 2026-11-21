export async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`API Error ${res.status} for ${url}:`, text);
      return { ok: false, status: res.status, data: null, error: text };
    }
    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    console.error(`Fetch failed for ${url}:`, err);
    return { ok: false, status: 0, data: null, error: err };
  }
}
