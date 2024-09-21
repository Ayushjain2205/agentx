import axios from "axios";
import OpenAI from "openai";
import { ethers } from "ethers";

// Load environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log("Starting bot...");
console.log("BOT_TOKEN set:", !!BOT_TOKEN);
console.log("OPENAI_API_KEY set:", !!OPENAI_API_KEY);

if (!BOT_TOKEN || !OPENAI_API_KEY) {
  console.error(
    "TELEGRAM_BOT_TOKEN or OPENAI_API_KEY is not set in environment variables"
  );
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: "https://api.red-pill.ai/v1",
  apiKey: OPENAI_API_KEY,
});

const availableChains = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  linea: "Linea",
  airdao: "AirDAO",
};

function escapeMarkdown(text) {
  const escapeCharacters = "_*[]()~`>#+-=|{}.!";
  let escapedText = "";
  let inCodeBlock = false;
  let inBoldOrItalic = false;

  for (let i = 0; i < text.length; i++) {
    if (text.substr(i, 3) === "```") {
      inCodeBlock = !inCodeBlock;
      escapedText += "```";
      i += 2;
    } else if (text[i] === "*" || text[i] === "_") {
      inBoldOrItalic = !inBoldOrItalic;
      escapedText += text[i];
    } else if (
      !inCodeBlock &&
      !inBoldOrItalic &&
      escapeCharacters.includes(text[i])
    ) {
      escapedText += "\\" + text[i];
    } else {
      escapedText += text[i];
    }
  }

  return escapedText;
}

async function handleStartCommand(chatId) {
  console.log(`Handling /start command for chat ID: ${chatId}`);
  const wallet = ethers.Wallet.createRandom();
  const message = `
Welcome to the AI-powered Web3 bot!

A new Ethereum wallet has been created:

*Address:* \`${wallet.address}\`

*Private Key:* \`${wallet.privateKey}\`

*IMPORTANT:* Never share your private key with anyone. Store it securely.

How can I assist you today?
  `;

  await sendTelegramMessage(chatId, message);
}

async function handleDockCommand(chatId) {
  console.log(`Handling /dock command for chat ID: ${chatId}`);
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "Open Mini App",
          web_app: { url: "https://6853-137-59-187-215.ngrok-free.app" },
        },
      ],
    ],
  };

  const message = "Click the button below to open the Mini App:";

  await sendTelegramMessage(chatId, message, keyboard);
}

async function handleSetChainCommand(chatId) {
  console.log(`Handling /setchain command for chat ID: ${chatId}`);
  const keyboard = {
    inline_keyboard: Object.entries(availableChains).map(([key, value]) => [
      { text: value, callback_data: `chain:${key}` },
    ]),
  };

  const message = "Please choose a chain:";

  await sendTelegramMessage(chatId, message, keyboard);
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  try {
    console.log(`Sending message to chat ID: ${chatId}`);
    const payload = {
      chat_id: chatId,
      text: escapeMarkdown(text),
      parse_mode: "MarkdownV2",
    };

    if (replyMarkup) {
      payload.reply_markup = JSON.stringify(replyMarkup);
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      payload
    );
    console.log("Message sent successfully:", response.data);
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response ? error.response.data : error.message
    );
  }
}

async function getAIResponse(message) {
  console.log("Getting AI response for message:", message);
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: message }],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error getting AI response:", error);
    return "Sorry, I'm having trouble processing your request right now.";
  }
}

export default async function handler(req, res) {
  console.log("Received request:", req.method);
  if (req.method === "POST") {
    const update = req.body;
    console.log(
      "Received update from Telegram:",
      JSON.stringify(update, null, 2)
    );

    try {
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const messageText = update.message.text;

        console.log(
          `Received message "${messageText}" from chat ID: ${chatId}`
        );

        if (messageText.toLowerCase() === "/start") {
          await handleStartCommand(chatId);
        } else if (messageText.toLowerCase() === "/setchain") {
          await handleSetChainCommand(chatId);
        } else if (messageText.toLowerCase() === "/dock") {
          await handleDockCommand(chatId);
        } else {
          const responseText = await getAIResponse(messageText);
          await sendTelegramMessage(chatId, responseText);
        }
      } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        console.log(
          `Received callback query with data "${data}" from chat ID: ${chatId}`
        );

        if (data.startsWith("chain:")) {
          const selectedChain = data.split(":")[1];
          const responseText = `Chain set to: *${availableChains[selectedChain]}*`;
          await sendTelegramMessage(chatId, responseText);

          await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
            {
              callback_query_id: callbackQuery.id,
            }
          );
        }
      }

      res.status(200).json({ message: "OK" });
    } catch (error) {
      console.error("Error processing update:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    console.log(`Received unsupported method: ${req.method}`);
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
