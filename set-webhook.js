require("dotenv").config();
const axios = require("axios");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PROD_URL = process.env.PROD_WEBHOOK_URL;
const DEV_URL = process.env.DEV_WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set in .env file");
  process.exit(1);
}

const argv = yargs(hideBin(process.argv))
  .option("env", {
    alias: "e",
    description: "Set environment (dev/prod)",
    type: "string",
  })
  .option("url", {
    alias: "u",
    description: "Set custom webhook URL",
    type: "string",
  })
  .option("info", {
    alias: "i",
    description: "Get current webhook info",
    type: "boolean",
  })
  .help()
  .alias("help", "h").argv;

async function setWebhook(url) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url}`
    );
    console.log("Webhook set successfully:", response.data);
  } catch (error) {
    console.error(
      "Error setting webhook:",
      error.response ? error.response.data : error.message
    );
  }
}

async function getWebhookInfo() {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    console.log("Current webhook info:", response.data);
  } catch (error) {
    console.error(
      "Error getting webhook info:",
      error.response ? error.response.data : error.message
    );
  }
}

async function main() {
  if (argv.info) {
    await getWebhookInfo();
    return;
  }

  let url;
  if (argv.url) {
    url = argv.url;
  } else if (argv.env) {
    switch (argv.env.toLowerCase()) {
      case "dev":
        url = DEV_URL;
        break;
      case "prod":
        url = PROD_URL;
        break;
      default:
        console.error('Invalid environment. Use "dev" or "prod".');
        process.exit(1);
    }
  }

  if (url) {
    console.log(`Setting webhook to: ${url}`);
    await setWebhook(url);
    console.log("\nUpdated webhook info:");
    await getWebhookInfo();
  } else {
    console.error(
      "No URL or environment specified. Use --help for usage information."
    );
    process.exit(1);
  }
}

main();
