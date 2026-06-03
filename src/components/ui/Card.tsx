import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: "default" | "bright" | "flat";
}

export default function Card({ children, className = "", tone = "default", ...props }: CardProps) {
  return (
    <section className={`card card-${tone} ${className}`} {...props}>
      {children}
    </section>
  );
}
