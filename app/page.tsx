export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-brand-dark">
        Jaser Platform
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        A national academic–industry collaboration platform connecting students,
        professors, and companies through challenges, projects, and verified NDAs.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card title="Challenges" body="Companies post real problems with micro-grants." />
        <Card title="Projects" body="Students and professors propose solutions." />
        <Card title="NDAs" body="Private challenges gated by digitally signed agreements." />
      </div>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
    </div>
  );
}
