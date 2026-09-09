import Image from "next/image";
import Link from "next/link";

const SidebarHeader = () => {
  return (
    <Link href="/browse" className="flex items-center gap-3 px-2 py-1">
      <span className="flex size-9 items-center justify-center rounded-field bg-primary">
        <Image
          className="invert"
          src="/cardano-tools-logo.svg"
          alt="Cardano Tools logo"
          width={24}
          height={24}
          priority
        />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Cardano Tools</span>
    </Link>
  );
};

export default SidebarHeader;
