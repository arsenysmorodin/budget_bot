import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN || "");

// Пользователи из .env
const USERS = {
  [Number(process.env.ARSENY_ID)]: "ARSENY",
  [Number(process.env.LERA_ID)]: "LERA",
};

// Главное меню
function showMainMenu(ctx: any) {
  ctx.reply("Главное меню:", {
    reply_markup: {
      keyboard: [["Добавить расход"], ["Добавить доход"], ["Аналитика"]],
      resize_keyboard: true,
    },
  });
}

// Категории
const EXPENSE_CATEGORIES = [
  ["Еда", "Транспорт"],
  ["Подписки", "Развлечения"],
  ["Дом", "Здоровье"],
  ["Другое"],
];

const INCOME_CATEGORIES = [
  ["Зарплата", "Подарок"],
  ["Кэшбек", "Инвестиции"],
  ["Продажи", "Другое"],
];

// Хранение состояний пользователей
interface UserState {
  step:
    | "idle"
    | "expense_amount"
    | "expense_category"
    | "income_amount"
    | "income_category";
  operation: {
    type?: "expense" | "income";
    amount?: number;
    category?: string;
  };
}

const userStates: Record<number, UserState> = {};

// Старт
bot.start((ctx) => {
  const username = USERS[ctx.from?.id || 0] || ctx.from?.first_name;
  ctx.reply(`Привет, ${username}!`);
  showMainMenu(ctx);
});

// Обработка текста
bot.on("text", (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!userStates[userId]) {
    userStates[userId] = { step: "idle", operation: {} };
  }

  const state = userStates[userId];
  const text = ctx.message.text;

  switch (state.step) {
    case "idle":
      if (text === "Добавить расход") {
        state.step = "expense_amount";
        state.operation = { type: "expense" };
        return ctx.reply("На какую сумму расхода?");
      }

      if (text === "Добавить доход") {
        state.step = "income_amount";
        state.operation = { type: "income" };
        return ctx.reply("На какую сумму дохода?");
      }

      if (text === "Аналитика") {
        return ctx.reply("Аналитика пока не реализована.");
      }

      break;

    // --- РАСХОД ---
    case "expense_amount": {
      const expenseAmount = parseFloat(text.replace(",", "."));
      if (isNaN(expenseAmount)) return ctx.reply("Введите число.");
      state.operation.amount = expenseAmount;
      state.step = "expense_category";
      return ctx.reply("Выберите категорию расхода:", {
        reply_markup: { keyboard: EXPENSE_CATEGORIES, resize_keyboard: true },
      });
    }

    case "expense_category": {
      state.operation.category = text;
      ctx.reply(
        `✅ Расход добавлен:\nСумма: ${state.operation.amount}\nКатегория: ${state.operation.category}`
      );
      state.step = "idle";
      state.operation = {};
      return showMainMenu(ctx);
    }

    // --- ДОХОД ---
    case "income_amount": {
      const incomeAmount = parseFloat(text.replace(",", "."));
      if (isNaN(incomeAmount)) return ctx.reply("Введите число.");
      state.operation.amount = incomeAmount;
      state.step = "income_category";
      return ctx.reply("Выберите категорию дохода:", {
        reply_markup: { keyboard: INCOME_CATEGORIES, resize_keyboard: true },
      });
    }

    case "income_category": {
      state.operation.category = text;
      ctx.reply(
        `💰 Доход добавлен:\nСумма: ${state.operation.amount}\nКатегория: ${state.operation.category}`
      );
      state.step = "idle";
      state.operation = {};
      return showMainMenu(ctx);
    }
  }

  ctx.reply("Выберите команду из меню.");
});

bot.launch().then(() => console.log("Бот запущен!"));
