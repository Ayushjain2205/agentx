import axios from "axios";
import OpenAI from "openai";
import { ethers } from "ethers";

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

const availableChains = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  linea: "Linea",
  airdao: "AirDAO",
};

function escapeMarkdown(text) {
  const escapeCharacters = "_*[]()~`>#+=|{}.!-";
  let escapedText = "";
  let inCodeBlock = false;

  for (let i = 0; i < text.length; i++) {
    if (text.substr(i, 3) === "```") {
      inCodeBlock = !inCodeBlock;
      escapedText += "```";
      i += 2;
    } else if (!inCodeBlock && escapeCharacters.includes(text[i])) {
      escapedText += "\\" + text[i];
    } else {
      escapedText += text[i];
    }
  }

  // Handle special case for multiple consecutive dashes
  escapedText = escapedText.replace(/\\-\\-+/g, (match) =>
    match.replace(/\\/g, "")
  );

  return escapedText;
}

async function handleStartCommand(chatId) {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;
  const privateKey = wallet.privateKey;

  const message = `
Welcome to the AI-powered Web3 bot!

Your new Ethereum wallet has been created:

*Address:* \`${address}\`

*Private Key:* \`${privateKey}\`

*IMPORTANT:* Never share your private key with anyone. Store it securely. If you lose it, you lose access to your wallet.

How can I assist you today?
  `;

  await sendTelegramMessage(chatId, message);
}

async function handleSetChainCommand(chatId) {
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

async function getCryptoPrice(cryptoId) {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd`
    );
    const price = response.data[cryptoId].usd;
    return `The current price of ${cryptoId} is $${price}`;
  } catch (error) {
    console.error("Error fetching crypto price:", error);
    return "Sorry, I couldn't fetch the crypto price at the moment.";
  }
}

async function getAIResponse(message) {
  try {
    const functions = [
      {
        name: "get_crypto_price",
        description: "Get the current price of a cryptocurrency",
        parameters: {
          type: "object",
          properties: {
            crypto_id: {
              type: "string",
              description:
                "The ID of the cryptocurrency (e.g., bitcoin, ethereum)",
            },
          },
          required: ["crypto_id"],
        },
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: message }],
      functions: functions,
      function_call: "auto",
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      if (functionName === "get_crypto_price") {
        const cryptoPrice = await getCryptoPrice(functionArgs.crypto_id);
        return cryptoPrice;
      }
    }

    return responseMessage.content;
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
        await handleStartCommand(chatId);
        res.status(200).json({ message: "OK" });
        return;
      } else if (messageText.toLowerCase() === "/setchain") {
        await handleSetChainCommand(chatId);
        res.status(200).json({ message: "OK" });
        return;
      } else {
        responseText = await getAIResponse(messageText);
      }

      await sendTelegramMessage(chatId, responseText);
    } else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      if (data.startsWith("chain:")) {
        const selectedChain = data.split(":")[1];
        const responseText = `Chain set to: ${availableChains[selectedChain]}`;
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
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
