import Image from "next/image";
import Link from "next/link";

const SidebarHeader = () => {
  return (
    <Link href="/browse" className="flex items-center gap-3 px-2 py-1">
      <Image
        src="/images/cardano-tools-logo.svg"
        alt="Cardano Tools logo"
        width={577}
        height={524}
        className="h-8 w-auto lg:h-14"
        loading="eager"
      />
      <span className="text-base font-semibold tracking-tight lg:text-xl">Cardano Tools</span>
    </Link>
  );
};

export default SidebarHeader;
