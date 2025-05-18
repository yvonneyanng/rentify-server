const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 5050;

app.use(
  cors({
    origin: ["https://rentify-client-chi.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);
app.use(express.json());

const CARS_PATH = path.join(__dirname, "data", "cars.json");
const ORDERS_PATH = path.join(__dirname, "data", "orders.json");

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/cars", async (req, res) => {
  try {
    const { search = "", type, brand } = req.query;
    const data = await fs.readFile(CARS_PATH, "utf-8");
    let cars = JSON.parse(data).cars;
    if (search && search.trim() !== "") {
      const searchTerms = search.toLowerCase().trim().split(/\s+/);
      cars = cars.filter((car) => {
        return searchTerms.some(
          (term) =>
            car.brand.toLowerCase().includes(term) ||
            car.carModel.toLowerCase().includes(term) ||
            (car.description && car.description.toLowerCase().includes(term)) ||
            car.carType.toLowerCase().includes(term)
        );
      });
    }
    if (type && type.trim() !== "") {
      cars = cars.filter(
        (car) => car.carType.toLowerCase().trim() === type.toLowerCase().trim()
      );
    }
    if (brand && brand.trim() !== "") {
      cars = cars.filter(
        (car) => car.brand.toLowerCase().trim() === brand.toLowerCase().trim()
      );
    }
    res.json({ cars });
  } catch (err) {
    res.status(500).json({ error: "Failed to load cars" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customer, car, rental } = req.body;
    if (!customer || !car || !rental) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const ordersData = await fs.readFile(ORDERS_PATH, "utf-8");
    const existing = JSON.parse(ordersData).orders.find(
      (o) => o.car.vin === car.vin
    );
    if (existing) {
      return res.status(400).json({ error: "Car already reserved" });
    }
    const orders = JSON.parse(ordersData);
    orders.orders.push({ customer, car, rental, status: "pending" });
    await fs.writeFile(ORDERS_PATH, JSON.stringify(orders));
    res.status(201).json({
      message: "Order placed",
      order: { customer, car, rental, status: "pending" },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to place order" });
  }
});

app.patch("/api/orders/:vin/confirm", async (req, res) => {
  try {
    const vin = req.params.vin;
    const ordersDataRaw = await fs.readFile(ORDERS_PATH, "utf-8");
    const ordersData = JSON.parse(ordersDataRaw);
    const order = ordersData.orders.find((o) => o.car.vin === vin);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    order.status = "confirmed";
    await fs.writeFile(ORDERS_PATH, JSON.stringify(ordersData, null, 2));

    const carsDataRaw = await fs.readFile(CARS_PATH, "utf-8");
    const carsData = JSON.parse(carsDataRaw);
    const car = carsData.cars.find((c) => c.vin === vin);
    if (car) {
      car.available = false;
      await fs.writeFile(CARS_PATH, JSON.stringify(carsData, null, 2));
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: "Failed to confirm order" });
  }
});

app.get("/api/orders/:vin", async (req, res) => {
  try {
    const vin = req.params.vin;
    const ordersDataRaw = await fs.readFile(ORDERS_PATH, "utf-8");
    const ordersData = JSON.parse(ordersDataRaw);
    const order = ordersData.orders.find((o) => o.car.vin === vin);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: "Failed to load order" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
