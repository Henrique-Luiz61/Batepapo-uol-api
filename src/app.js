import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import joi from "joi";

/*const data = Date.now();

const currentTime = dayjs().format("HH:mm:ss");
console.log(currentTime); */

// Criação do app
const app = express();

// Configurações
app.use(cors());
app.use(express.json());
dotenv.config();

// Conexão com o Banco
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect(); // top level await
  console.log("MongoDB conectado com sucesso!");
} catch (err) {
  (err) => console.log(err.message);
}

const db = mongoClient.db();

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch((erro) => console.log(erro.message));

// Variáveis globais

// Funções (endpoints)
app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const time = dayjs().format("HH:mm:ss");
  const lastStatus = Date.now();

  const schemaPart = joi.object({
    name: joi.string().required(),
  });

  const validation = schemaPart.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: name });
    if (participant)
      return res.status(409).send("Participante do chat já existente!");

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: lastStatus });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: time,
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rondando na porta ${PORT}.`));
