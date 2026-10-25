import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl">That page is not here</h1>
      <p className="mt-3 text-sm text-muted">The record may have been deleted, or the address is wrong.</p>
      <div className="mt-6">
        <LinkButton href="/">Back to the desk</LinkButton>
      </div>
    </main>
  );
}
