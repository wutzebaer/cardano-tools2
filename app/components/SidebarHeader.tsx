import Image from "next/image";

const SidebarHeader = () => {
  return (
    <h1 className="text-3xl font-bold font-[family-name:var(--font-quicksand)] flex items-center gap-x-2 p-4 mb-20">
      <Image
        className="invert"
        src="/cardano-tools-logo.svg"
        alt="Cardano logo"
        width={150}
        height={150}
        priority
      />
      <span>Cardano Tools</span>
    </h1>
  );
};

export default SidebarHeader;
