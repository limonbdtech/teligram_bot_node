// bot.js
const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const Sentiment = require("sentiment");
const config = require("./config"); // BOT_TOKEN + WEBHOOK_URL

const app = express();
app.use(bodyParser.json());

// Initialize bot (no polling)
const bot = new TelegramBot(config.BOT_TOKEN);
const sentiment = new Sentiment();

// Wordlist / Phrase list (Bangla + English)
const wordlist = [
  'চুদি','চোদ','মাগী','হারামি','গাধা','বোকা','চুতমারানি','খানকিরপোলা','শুয়োর',
  'শালা','মাদারচোদ','বাপচোদ','চুতিয়া','chudi','chod','magi','harami','gadha','boka',
  'chutmarani','khanakirpola','shuar','shala','madarchod','bapchod','chutiya','fuck',
  'motherfucker','shit','bitch','asshole','bastard','idiot','fraud','cheat',
  'looter','conman','admin fraud','fake','thief',
  'এডমিন চুদি','এডমিন চোর','এডমিন খারাপ','this is a scam','admin fraud',
  'Pulu Marma বাটপার','Pulu Marma চোর','pulu marma চোর','pulu marma একজন বাটপার','পুলু মারমা চোর',
   'পুলু মারমা বাটপার', 'পুলু মারমা মানুষের টাকা মেরে খায়'
];

// Track user offenses
const userOffenses = {};

// Set webhook
bot.setWebHook(`${config.WEBHOOK_URL}/bot${config.BOT_TOKEN}`);

// Webhook route
app.post(`/bot${config.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body); // pass update to bot
  res.sendStatus(200);
});

// Message handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || userId;
  const text = msg.text || "";

  // Clean text
  const cleanText = text.replace(/[.,!?;:()\[\]{}"]/g, " ").trim().toLowerCase();

  // Detect bad words (just contains)
  const detectedWords = wordlist.filter(word => cleanText.includes(word.toLowerCase()));

  // Sentiment analysis
  const sentimentScore = sentiment.analyze(cleanText).score;

  if (detectedWords.length > 0 || sentimentScore < -2) {
    const timestamp = new Date().toLocaleString();
    // console.log(`❌ [${timestamp}] BAD MESSAGE from ${username}: "${text}"`);
    // console.log(`Detected: ${detectedWords.join(", ")}`);
    // console.log(`Sentiment score: ${sentimentScore}`);

    // Delete message
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

    // Track offenses
    userOffenses[userId] = (userOffenses[userId] || 0) + 1;

    // Ban user
    await bot.banChatMember(chatId, userId).catch(() => {});

    // Send reason
    let reason = [];
    if (detectedWords.length > 0) reason.push(`Words/phrases: ${detectedWords.join(", ")}`);
    if (sentimentScore < -2) reason.push(`Negative sentiment (score: ${sentimentScore})`);

    bot.sendMessage(chatId, `⛔ User ${username} permanently banned for: ${reason.join("; ")}`);
  } else {
    const timestamp = new Date().toLocaleString();
    // console.log(`✅ [${timestamp}] Safe message from ${username}: "${text}"`);
  }
});

// Home route (for Render check)
app.get('/', (req, res) => {
  res.send('Bot is running ✅');
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));