import express from 'express';
import mongoose from 'mongoose';
import { Inventory } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET inventory items
router.get('/', async (req, res) => {
  let inventory = [];
  try {
    if (mongoose.connection.readyState === 1) {
      inventory = await Inventory.find({}).lean();
    }
  } catch (err) {}

  if (!inventory || inventory.length === 0) {
    inventory = readData('inventory.json');
  }

  res.json(inventory);
});

// POST add inventory item
router.post('/', async (req, res) => {
  const newItem = {
    id: `inv_${Date.now()}`,
    name: req.body.name,
    category: req.body.category,
    availability: req.body.availability || 'Available',
    stock: Number(req.body.stock) || 0,
    reorderLimit: Number(req.body.reorderLimit) || 0
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const mongoItem = new Inventory(newItem);
      await mongoItem.save();
    }
  } catch (err) {}

  const inventory = readData('inventory.json');
  inventory.push(newItem);
  writeData('inventory.json', inventory);

  res.status(201).json(newItem);
});

// PUT update inventory item
router.put('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Inventory.findOneAndUpdate({ id: req.params.id }, { $set: req.body });
    }
  } catch (err) {}

  const inventory = readData('inventory.json');
  const index = inventory.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });

  inventory[index] = {
    ...inventory[index],
    ...req.body
  };
  writeData('inventory.json', inventory);
  res.json(inventory[index]);
});

export default router;
