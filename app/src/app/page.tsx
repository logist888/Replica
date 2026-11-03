import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Корень ведёт на язык браузера: русский для ru, иначе английский.
export default async function Home() {
  const al = ((await headers()).get("accept-language") ?? "").toLowerCase();
  redirect(al.startsWith("ru") || /(^|,)\s*ru/.test(al) ? "/ru" : "/en");
}
