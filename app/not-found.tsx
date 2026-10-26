import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-white">
      <h1 className="text-36 font-bold text-gray-900">404 - Page Not Found</h1>
      <p className="text-16 text-gray-600">The page you are looking for does not exist.</p>
      <Link href="/" className="form-btn w-fit px-6 py-2">
        Go back home
      </Link>
    </div>
  );
}
