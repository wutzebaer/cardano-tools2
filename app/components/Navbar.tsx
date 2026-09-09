import { Bars3Icon } from "@heroicons/react/24/outline";
import SidebarHeader from "./SidebarHeader";

const Navbar = () => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-base-100/85 px-3 backdrop-blur lg:hidden">
      <label htmlFor="my-drawer-2" aria-label="open sidebar" className="btn btn-ghost btn-square btn-sm">
        <Bars3Icon className="size-6" />
      </label>
      <SidebarHeader />
    </header>
  );
};

export default Navbar;
