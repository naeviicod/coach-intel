import './globals.css';
import './desktop-ui.css';
import './desktop-web.css';

export const metadata = {
  title: 'Coach Intel',
  description: 'Competitive intelligence for Call of Duty. Sign in to the cloud roster.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
