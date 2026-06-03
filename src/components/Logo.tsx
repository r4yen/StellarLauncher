import logo from "../assets/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export default function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <div className={`logo-lockup logo-${size}`}>
      <img src={logo} alt="Stellar Launcher logo" />
      {showText ? (
        <div>
          <strong>Stellar Launcher</strong>
          <span>Galactic Minecraft Control</span>
        </div>
      ) : null}
    </div>
  );
}
