interface PlaceholderTabProps {
  title: string;
  description: string;
}

export function PlaceholderTab({ title, description }: PlaceholderTabProps) {
  return (
    <section className="rounded-lg bg-card border border-edge p-12 text-center">
      <div className="text-4xl mb-4 opacity-30">🚧</div>
      <h2 className="text-base font-semibold mb-2">{title} · 待实现</h2>
      <p className="text-sm text-ink-3 max-w-md mx-auto">{description}</p>
    </section>
  );
}
