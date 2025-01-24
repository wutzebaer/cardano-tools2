import Image from "next/image";
import Link from "next/link";

const Navbar = () => {
  return (
    <div className="navbar bg-base-300 w-full lg:hidden">
      <div className="flex-none lg:hidden">
        <label
          htmlFor="my-drawer-2"
          aria-label="open sidebar"
          className="btn btn-square btn-ghost"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="inline-block h-6 w-6 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>
          </svg>
        </label>
      </div>
      <div className="mx-2 flex-1 px-2">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-quicksand)] flex items-center gap-x-2">
          <Image
            className="invert"
            src="/cardano-tools-logo.svg"
            alt="Cardano logo"
            width={40}
            height={40}
            priority
          />
          <span>Cardano Tools</span>
        </h1>
      </div>
      <div className="hidden flex-none lg:block">
        <ul className="menu menu-horizontal">
          {/* Navbar menu content here */}
          <li>
            <Link href="#">Navbar Item 1</Link>
          </li>
          <li>
            <Link href="#">Navbar Item 2</Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Navbar;
