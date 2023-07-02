import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import joi from "joi";

//fuser -k 5000/tcp

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

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;
  console.log(user);

  const schemaUser = joi.string().required();

  const validation1 = schemaUser.validate(user);

  const schemaMessage = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().allow("message", "private_message").required(),
  });

  const validation2 = schemaMessage.validate(req.body, { abortEarly: false });

  const from = await db.collection("participants").findOne({ name: user });

  if (validation1.error || validation2.error || !from) {
    return res.sendStatus(422);
  }

  try {
    await db.collection("messages").insertOne({
      from: user,
      to: to,
      text: text,
      type: type,
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  let limit = 0;
  let validation2 = {};

  if (req.query.limit) {
    limit = parseInt(req.query.limit);
  }

  const schemaQuery = joi.string().pattern(/^\d+$/).not("0");
  const validation1 = schemaQuery.validate(req.query.limit);

  const schemaLimit = joi.number().integer().min(1);

  if (limit !== 0) {
    validation2 = schemaLimit.validate(limit);
  }

  if (validation1.error || validation2.error) {
    console.log(validation1.error);
    return res.sendStatus(422);
  }

  try {
    const messages = await db
      .collection("messages")
      .find({
        $or: [
          { from: user },
          { to: { $in: ["Todos", user] } },
          { type: { $in: ["status", "message"] } },
        ],
      })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
    res.send(messages);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rondando na porta ${PORT}.`));
