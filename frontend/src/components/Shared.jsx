export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    pending: "bg-[#D27D46]/15 text-[#9c531f]",
    confirmed: "bg-primary/12 text-primary",
    delivered: "bg-[#3d7a4e]/15 text-[#2f6b40]",
    cancelled: "bg-destructive/12 text-destructive",
    active: "bg-primary/12 text-primary",
  };
  return (
    <span
      data-testid={`status-${status}`}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[status] || "bg-secondary text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-card border border-border rounded-2xl ${className}`}>{children}</div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />}
      <p className="font-heading font-semibold text-lg">{title}</p>
      {subtitle && <p className="text-muted-foreground text-sm mt-1 max-w-sm">{subtitle}</p>}
    </div>
  );
}
