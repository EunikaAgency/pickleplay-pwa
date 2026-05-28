
import { news } from '../../shared/data/index.js';

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div>
        <h1 className="font-heading text-headline-xl font-bold text-on-surface">News</h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">The latest from the pickleball world.</p>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((article, i) => (
          <article key={article.id || i} className="rounded-[14px] bg-surface-container-lowest shadow-card overflow-hidden">
            <div className="h-40 overflow-hidden">
              <img src={article.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="p-5">
              <span className="text-label-sm font-bold uppercase text-primary">{article.category || 'News'}</span>
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">{article.title}</h3>
              <p className="mt-2 line-clamp-2 text-body-md text-on-surface-variant">{article.excerpt}</p>
              <div className="mt-3 flex items-center gap-2 text-body-md text-on-surface-variant">
                <img src={article.authorAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span>{article.author}</span>
                <span>&middot;</span>
                <span>{new Date(article.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
