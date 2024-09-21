import { useEffect, useState } from "react";

const useTelegramWebApp = () => {
  const [webApp, setWebApp] = useState(null);

  useEffect(() => {
    const twa = window.Telegram.WebApp;
    setWebApp(twa);
    twa.ready();
  }, []);

  return webApp;
};

export default useTelegramWebApp;
