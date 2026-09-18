import { useUiText } from "../uiLanguage";
import logo from "../assets/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export default function Logo({ size = "md", showText = true }: LogoProps) {
  const ui = useUiText();
  return (
    <div className={`logo-lockup logo-${size}`}>
      <img src={logo} alt={ui("Stellar Launcher logo")} />
      {showText ? (
        <div>
          <strong>Stellar Launcher</strong>
          <span>{ui("Your launcher from the future.")}</span>
        </div>
      ) : null}
    </div>
  );
}
