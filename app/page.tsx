import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  House,
  MessageSquareText,
  Ruler,
  ClipboardCheck,
} from "lucide-react";
export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <House size={22} />
          </span>
          <span>
            Host Upgrade<span className="brand-sub">PLANNER</span>
          </span>
        </Link>
        <div>
          <Link className="text-link" href="/auth">
            Sign in
          </Link>
          <Link className="button primary" href="/app">
            Create workspace <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <p className="eyebrow">SMALL CHANGES. A MORE THOUGHTFUL STAY.</p>
          <h1>
            A better stay
            <br />
            starts with
            <br />
            <em>listening.</em>
          </h1>
          <p className="hero-copy">
            Turn guest feedback into practical property improvements. A clear
            plan for what to change, what to buy, and what to do next.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" href="/demo">
              Explore the demo <ArrowRight size={18} />
            </Link>
            <Link className="button secondary large" href="/app">
              Create workspace
            </Link>
          </div>
          <p className="muted small">
            For independent hosts and small property portfolios.
          </p>
        </div>
        <div className="hero-art">
          <div className="art-window">
            <span />
            <span />
          </div>
          <div className="art-curtain left" />
          <div className="art-curtain right" />
          <div className="art-lamp" />
          <div className="art-table" />
          <div className="art-bed">
            <span />
          </div>
          <div className="art-plant">✳</div>
          <div className="art-card">
            <span className="icon-soft">
              <Check size={19} />
            </span>
            <div>
              <strong>A little more comfort.</strong>
              <p>A plan you can put into practice.</p>
            </div>
          </div>
          <span className="art-caption">THE THOUGHTFUL HOST’S TOOLKIT</span>
        </div>
      </section>
      <section className="landing-workflow">
        <p className="eyebrow">FROM FEEDBACK TO FINISHED</p>
        <h2>Make the next improvement a considered one.</h2>
        <div className="three-cols">
          {[
            [
              MessageSquareText,
              "01 · Understand",
              "Bring reviews and your observations together. Keep every priority connected to its source.",
            ],
            [
              Ruler,
              "02 · Make a plan",
              "Compare options, record measurements and see the complete budget, including what is still unknown.",
            ],
            [
              ClipboardCheck,
              "03 · Get it done",
              "Approve an exact plan, track the work and compare later feedback without promising outcomes.",
            ],
          ].map(([Icon, title, copy]) => {
            const I = Icon as typeof House;
            return (
              <article key={String(title)}>
                <I size={24} />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <footer>
        <span>Host Upgrade Planner</span>
        <span>
          No purchases, payments or public reports. Just a practical plan.
        </span>
      </footer>
    </main>
  );
}
