import { getCategoriesCached, getFeaturedCached } from "@/lib/landing";

export default async function Page() {
  const [categoriesResult, featuredResult] = await Promise.all([
    getCategoriesCached(),
    getFeaturedCached(),
  ]);

  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const featured = featuredResult.ok ? featuredResult.data : [];

  return (
    <main style={{ padding: "2rem", maxWidth: 640 }}>
      <h1>@g14o/core cache demo</h1>
      <p>
        This page calls <code>withCache</code> during render (same pattern as
        cozy-haven landing). Run <code>next build</code> to verify no{" "}
        <code>DYNAMIC_SERVER_USAGE</code> errors.
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Categories</h2>
        <ul>
          {categories.map((category) => (
            <li key={category.id}>{category.name}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Featured</h2>
        <ul>
          {featured.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
      </section>

      <p style={{ marginTop: "2rem", color: "#666", fontSize: 14 }}>
        Runtime adapter: <a href="/api/cache-info">GET /api/cache-info</a>
      </p>
    </main>
  );
}
