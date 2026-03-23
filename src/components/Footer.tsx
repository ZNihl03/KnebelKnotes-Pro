import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import knebelLogo from "@/assets/knebel-logo.png";
import { Button } from "@/components/ui/button";
import { KNEBEL_MAIN_WEBSITE_LABEL, KNEBEL_MAIN_WEBSITE_URL } from "@/lib/siteLinks";

const Footer = () => (
  <footer className="border-t border-border/70 bg-background/90 mt-auto">
    <div className="container py-10 sm:py-12">
      <div className="grid gap-6 md:grid-cols-3 md:gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src={knebelLogo} alt="Knebel Knotes logo" className="h-8 w-8" />
            <span className="font-display text-lg font-bold text-foreground">Knebel Knotes</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A comprehensive clinical psychiatry reference for practitioners. Evidence-based diagnostic criteria,
            treatment algorithms, and medication guides.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground mb-3">Quick Links</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <Link to="/search" className="text-muted-foreground hover:text-foreground transition-colors">
                Search Articles
              </Link>
            </li>
            <li>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={KNEBEL_MAIN_WEBSITE_URL}>
                  <ArrowLeft className="h-4 w-4" />
                  {KNEBEL_MAIN_WEBSITE_LABEL}
                </a>
              </Button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground mb-3">Disclaimer</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This resource is intended for educational purposes and clinical reference only. It does not replace
            professional clinical judgment.
          </p>
        </div>
      </div>
      <div className="mt-8 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Knebel Knotes. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
