import Logo from "./Logo";

interface LoadingScreenProps {
  message: string;
  progress: number;
}

export default function LoadingScreen({ message, progress }: LoadingScreenProps) {
  const boundedProgress = Math.max(0, Math.min(progress, 100));

  return (
    <div className="loading-screen">
      <div className="loading-stars" />
      <div className="loading-card">
        <Logo size="lg" />
        <div className="loading-copy">
          <h1>Stellar Launcher</h1>
          <p>{message}</p>
        </div>
        <div className="loading-progress-track" aria-label="Loading progress">
          <div className="loading-progress-fill" style={{ width: `${boundedProgress}%` }} />
        </div>
        <span>{Math.round(boundedProgress)}%</span>
      </div>
    </div>
  );
}
