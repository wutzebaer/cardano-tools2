import { redirect } from "next/navigation";

/** A drop is created on the mint page, where the tokens are put together. This address only opens one. */
export default function Page() {
  redirect("/mint");
}
