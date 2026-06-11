import * as Flags from "country-flag-icons/react/3x2";
import { flagCode } from "@/lib/flags";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  className?: string;
  title?: string;
};

/** Renders an SVG country flag from country-flag-icons. */
export function Flag({ name, className, title }: Props) {
  const code = flagCode(name);
  const key = code?.replace("-", "_") as keyof typeof Flags | undefined;
  const Component = key ? (Flags[key] as React.ComponentType<{ title?: string; className?: string }>) : undefined;

  if (!Component) {
    return (
      <span className={cn("inline-block", className)} role="img" aria-label={name}>
        🏳️
      </span>
    );
  }

  return (
    <Component
      title={title ?? name}
      className={cn("inline-block rounded-[2px] shadow-sm ring-1 ring-black/10 object-cover", className)}
    />
  );
}

export default Flag;