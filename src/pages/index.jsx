import { useEffect } from "react";
import useTelegramWebApp from "../hooks/useTelegramWebApp";

export default function Home() {
  const webApp = useTelegramWebApp();

  useEffect(() => {
    if (webApp) {
      webApp.expand();
    }
  }, [webApp]);

  return (
    <div>
      <h1>Welcome to My Telegram Mini App!</h1>
      {webApp && (
        <button
          onClick={() => webApp.showAlert("Hello from Telegram Mini App!")}
        >
          Show Alert
        </button>
      )}
    </div>
  );
}
