import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET inventory items
router.get('/', (req, res) => {
  const inventory = readData('inventory.json');
  res.json(inventory);
});

// POST add inventory item
router.post('/', (req, res) => {
  const inventory = readData('inventory.json');
  const newItem = {
    id: `inv_${Date.now()}`,
    name: req.body.name,
    category: req.body.category,
    availability: req.body.availability || 'Available',
    stock: Number(req.body.stock) || 0,
    reorderLimit: Number(req.body.reorderLimit) || 0
  };
  inventory.push(newItem);
  writeData('inventory.json', inventory);
  res.status(201).json(newItem);
});

// PUT update inventory item
router.put('/:id', (req, res) => {
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
