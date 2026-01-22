import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'コミットメント見積ツール',
  description: 'A tool to optimize AWS costs by calculating commitment costs based on uploaded CSV data.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <header className="bg-gradient-to-r from-primary-600 to-primary-700 shadow-lg">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-white flex items-center">
              <span className="mr-3">💰</span>
              コミットメント見積ツール
            </h1>
            <p className="text-primary-100 mt-1 text-sm">
              AWS Reserved Instance & Savings Plans コスト最適化ツール
            </p>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="bg-gray-800 text-gray-300 mt-12">
          <div className="container mx-auto px-4 py-6 text-center">
            <p className="text-sm">
              © 2026 Commitment Estimator Tool v1.0.0
            </p>
            <p className="text-xs mt-1 text-gray-400">
              Built with Next.js 15 + React 19 + TailwindCSS
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
