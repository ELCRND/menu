import express from "express";
import cors from "cors";
import recipesRouter from "./routes/recipes.js";
import templatesRouter from "./routes/templates.js";
import dailyMenusRouter from "./routes/dailyMenus.js";

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Подключаем модули маршрутов
app.use("/api/recipes", recipesRouter);
app.use("/api/menu", templatesRouter);
app.use("/api/daily-menus", dailyMenusRouter);

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://127.0.0.1:${PORT}`);
});
