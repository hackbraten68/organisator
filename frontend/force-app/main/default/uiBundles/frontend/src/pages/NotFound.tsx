import { Link } from 'react-router';
import { Button } from '../components/ui/button';

/**
 * Token-driven rather than `text-gray-900` / `bg-blue-600`.
 *
 * These four hardcoded colours were the only ones in the portal and they do not
 * respond to the `.dark` class, so the 404 page stayed dark-on-light inside a dark
 * shell. Everything else in the bundle already used tokens.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-8 text-lg text-muted-foreground">Page not found</p>
        <Button asChild variant="default">
          <Link to="/">Go to Home</Link>
        </Button>
      </div>
    </div>
  );
}