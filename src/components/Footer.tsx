import { Brain } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border bg-card mt-auto">
    <div className="container py-12">
      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">PsychRef</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A comprehensive clinical psychiatry reference for practitioners. Evidence-based diagnostic criteria, treatment algorithms, and medication guides.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/categories" className="text-muted-foreground hover:text-foreground transition-colors">Browse Categories</Link></li>
            <li><Link to="/search" className="text-muted-foreground hover:text-foreground transition-colors">Search Articles</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground mb-3">Disclaimer</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This resource is intended for educational purposes and clinical reference only. It does not replace professional clinical judgment.
          </p>
        </div>
      </div>
      <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PsychRef. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
