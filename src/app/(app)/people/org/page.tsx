import { permanentRedirect } from "next/navigation";

export default function OrgPage() {
  permanentRedirect("/people");
}