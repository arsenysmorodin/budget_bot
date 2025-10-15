import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import db from "../db/index";

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN || "");

const USERS: Record<number, string> = {
  [Number(process.env.ARSENY_ID)]: "ARSENY",
  [Number(process.env.LERA_ID)]: "LERA",
};

// --- главное меню ---
function showMainMenu(ctx: any) {
  ctx.reply("Главное меню:", {
    reply_markup: {
      keyboard: [["Добавить расход"], ["Добавить доход"], ["Аналитика"]],
      resize_keyboard: true,
    },
  });
}

// --- состояние пользователей ---
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

// --- старт ---
bot.start(async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const username = USERS[userId] || ctx.from?.first_name;

  // Добавляем пользователя, если его нет
  const getUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!getUser) {
    db.prepare("INSERT INTO users (id, username) VALUES (?, ?)").run(
      userId,
      username
    );
  }

  ctx.reply(`Привет, ${username}!`);
  showMainMenu(ctx);
});

// --- типы для данных ---
interface Row {
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
}

// --- логика операций ---
bot.on("text", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!userStates[userId]) {
    userStates[userId] = { step: "idle", operation: {} };
  }

  const state = userStates[userId];
  const text = ctx.message.text;

  switch (state.step) {
    // --- главные команды ---
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
        const rows = db
          .prepare("SELECT * FROM operations WHERE user_id = ?")
          .all(userId) as Row[];

        const income = rows
          .filter((r) => r.type === "income")
          .reduce((a, b) => a + b.amount, 0);
        const expense = rows
          .filter((r) => r.type === "expense")
          .reduce((a, b) => a + b.amount, 0);
        const balance = income - expense;

        return ctx.reply(
          `📊 Аналитика:\nДоход: ${income} ₽\nРасход: ${expense} ₽\nБаланс: ${balance} ₽`
        );
      }
      break;

    // --- расходы ---
    case "expense_amount": {
      const amount = parseFloat(text.replace(",", "."));
      if (isNaN(amount)) return ctx.reply("Введите число.");
      state.operation.amount = amount;
      state.step = "expense_category";

      // Загружаем категории из БД
      const categories = db
        .prepare("SELECT name FROM expense_categories ORDER BY name")
        .all()
        .map((r: any) => r.name);

      if (categories.length === 0) {
        return ctx.reply("Введите категорию расхода (пока нет сохранённых):");
      }

      return ctx.reply("Выберите категорию расхода:", {
        reply_markup: {
          keyboard: categories.map((c) => [c]),
          resize_keyboard: true,
        },
      });
    }

    case "expense_category": {
      state.operation.category = text;

      // Добавляем операцию
      db.prepare(
        "INSERT INTO operations (user_id, type, amount, category) VALUES (?, ?, ?, ?)"
      ).run(
        userId,
        "expense",
        state.operation.amount,
        state.operation.category
      );

      // Добавляем новую категорию, если нет
      db.prepare(
        "INSERT OR IGNORE INTO expense_categories (name) VALUES (?)"
      ).run(text);

      ctx.reply(
        `✅ Расход добавлен:\n${state.operation.amount} ₽ — ${state.operation.category}`
      );

      // Сброс состояния
      userStates[userId] = { step: "idle", operation: {} };
      return showMainMenu(ctx);
    }

    // --- доходы ---
    case "income_amount": {
      const amount = parseFloat(text.replace(",", "."));
      if (isNaN(amount)) return ctx.reply("Введите число.");
      state.operation.amount = amount;
      state.step = "income_category";

      const INCOME_CATEGORIES = [
        ["Зарплата", "Подарок"],
        ["Кэшбек", "Инвестиции"],
        ["Продажи", "Другое"],
      ];

      return ctx.reply("Выберите категорию дохода:", {
        reply_markup: { keyboard: INCOME_CATEGORIES, resize_keyboard: true },
      });
    }

    case "income_category": {
      state.operation.category = text;

      db.prepare(
        "INSERT INTO operations (user_id, type, amount, category) VALUES (?, ?, ?, ?)"
      ).run(userId, "income", state.operation.amount, state.operation.category);

      ctx.reply(
        `💰 Доход добавлен:\n${state.operation.amount} ₽ — ${state.operation.category}`
      );

      userStates[userId] = { step: "idle", operation: {} };
      return showMainMenu(ctx);
    }
  }

  ctx.reply("Выберите команду из меню.");
});

bot.launch().then(() => console.log("🤖 Бот запущен с SQLite!"));
