import '../globals.css';

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
