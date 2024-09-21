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

async function sendTelegramMessage(chatId, text) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
      }
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
      } else {
        // Get AI-generated response
        responseText = await getAIResponse(messageText);
      }

      await sendTelegramMessage(chatId, responseText);
    }

    res.status(200).json({ message: "OK" });
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
