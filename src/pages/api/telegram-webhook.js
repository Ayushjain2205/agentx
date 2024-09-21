import axios from "axios";
import OpenAI from "openai";

// Load environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

// Updated availableChains object with new options
const availableChains = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  linea: "Linea",
  airdao: "AirDAO",
};

// Modified function to handle /setchain command
async function handleSetChainCommand(chatId) {
  const keyboard = {
    inline_keyboard: Object.entries(availableChains).map(([key, value]) => [
      { text: value, callback_data: `chain:${key}` },
    ]),
  };

  const message = "Please choose a chain:";

  await sendTelegramMessage(chatId, message, keyboard);
}

// Updated function to send Telegram messages with optional inline keyboard
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
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
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error getting AI response:", error);
    return "Sorry, I'm having trouble processing your request right now.";
  }
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const update = req.body;
    console.log("Received update from Telegram:", update);

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;

      let responseText;
      if (messageText.toLowerCase() === "/start") {
        responseText =
          "Welcome to the AI-powered bot! How can I help you today?";
      } else if (messageText.toLowerCase() === "/setchain") {
        await handleSetChainCommand(chatId);
        res.status(200).json({ message: "OK" });
        return;
      } else {
        // Get AI-generated response
        responseText = await getAIResponse(messageText);
      }

      await sendTelegramMessage(chatId, responseText);
    } else if (update.callback_query) {
      // Handle callback queries from inline keyboard
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      if (data.startsWith("chain:")) {
        const selectedChain = data.split(":")[1];
        const responseText = `Chain set to: ${availableChains[selectedChain]}`;
        await sendTelegramMessage(chatId, responseText);

        // Acknowledge the callback query
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
          {
            callback_query_id: callbackQuery.id,
          }
        );
      }
    }

    res.status(200).json({ message: "OK" });
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
