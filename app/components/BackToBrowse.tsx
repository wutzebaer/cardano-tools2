import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BackToBrowse({ closeOverlay }: { closeOverlay?: boolean }) {
  const router = useRouter();

  if (closeOverlay) {
    return (
      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1.5 text-sm text-base-content/55 hover:text-base-content"
      >
        <ArrowLeftIcon className="size-4" />
        Browse
      </button>
    );
  }

  return (
    <Link href="/browse" className="flex w-fit items-center gap-1.5 text-sm text-base-content/55 hover:text-base-content">
      <ArrowLeftIcon className="size-4" />
      Browse
    </Link>
  );
}
