const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");
const { MessagePort } = require("node:worker_threads");

// Database connection URL
const url = "mongodb://127.0.0.1:27017";
const client = new MongoClient(url);

// Express app setup
const app = express();
const server = createServer(app);
// Serve static HTML page
app.get("/chart", (req, res) => {
  res.sendFile(join(__dirname, "chart.html"));
});
app.get("/form", (req, res) => {
  res.sendFile(join(__dirname, "form.html"));
});
// Start Express server on port 3000
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

// Create a separate HTTP server for Socket.io
const ioServer = createServer();
const io = new Server(ioServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
// Start Socket.io server on port 4000
ioServer.listen(5000, () => {
  console.log("Socket.io server running at http://localhost:5000");
});
async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    // Handle Socket.io connections after MongoDB is connected
    io.on("connection", (socket) => {
      async function getSales() {
        try {
          const data = await client
            .db("realtime_chart")
            .collection("sales")
            .find({})
            .toArray();
          io.emit("message", JSON.stringify(data));
        } catch (error) {
          console.error("Error in getSales:", error);
        }
      }
      socket.on("message", async (message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === "load") {
          await getSales();
        }
        if (parsedMessage.type === "add") {
          try {
            const docs = JSON.parse(message);
            await client
              .db("realtime_chart")
              .collection("sales")
              .insertOne({ tanggal: docs.tanggal, sales: docs.sales });
            await getSales();
          } catch (error) {
            console.error("Error in addSales:", error);
          }
        }
        if (parsedMessage.type === "edit") {
          try {
            const docs = JSON.parse(message);
            await client
              .db("realtime_chart")
              .collection("sales")
              .updateOne(
                { tanggal: docs.tanggal },
                { $set: { sales: docs.sales } }
              );
            await getSales();
          } catch (error) {
            console.error("Error in edit sales:", error);
          }
        }
      });
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1); // Exit the process if the connection fails
  }
}
// Start the server and MongoDB connection
startServer();
