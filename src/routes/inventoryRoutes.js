import express from 'express';
import mongoose from 'mongoose';
import { Inventory } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

const normalizeItem = (item) => {
  if (!item) return null;
  const rawObj = typeof item.toObject === 'function' ? item.toObject() : item;

  const stockVal = Number(
    rawObj.stock !== undefined ? rawObj.stock : 
    (rawObj.quantity !== undefined ? rawObj.quantity : 120)
  );

  const reorderVal = Number(
    rawObj.reorderLimit !== undefined ? rawObj.reorderLimit : 
    (rawObj.minThreshold !== undefined ? rawObj.minThreshold : 50)
  );

  const nameVal = rawObj.name || rawObj.itemName || (rawObj.category ? `${rawObj.category} Supplies` : 'Inventory Asset');
  const safeStock = isNaN(stockVal) ? 100 : stockVal;
  const safeReorder = isNaN(reorderVal) ? 50 : reorderVal;

  const calculatedAvail = safeStock <= 0 ? 'Out of Stock' : safeStock <= safeReorder ? 'Low' : 'Available';

  return {
    ...rawObj,
    id: String(rawObj.id || rawObj._id),
    name: nameVal,
    itemName: nameVal,
    category: rawObj.category || 'General',
    stock: safeStock,
    quantity: safeStock,
    reorderLimit: safeReorder,
    minThreshold: safeReorder,
    availability: calculatedAvail,
    status: calculatedAvail === 'Out of Stock' ? 'Out of Stock' : calculatedAvail === 'Low' ? 'Low Stock' : 'In Stock',
    unit: rawObj.unit || 'Units'
  };
};

// GET inventory items (Always fresh from MongoDB Atlas, no-cache)
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  await connectDatabase();
  let inventory = [];

  try {
    if (mongoose.connection.readyState === 1) {
      inventory = await Inventory.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean();
    }
  } catch (err) {}

  if (!inventory || inventory.length === 0) {
    inventory = readData('inventory.json') || [];
  }

  const normalized = inventory.map(normalizeItem);
  res.json(normalized);
});

// POST add inventory item
router.post('/', async (req, res) => {
  await connectDatabase();

  const stockVal = Number(req.body.stock !== undefined ? req.body.stock : req.body.quantity) || 100;
  const reorderVal = Number(req.body.reorderLimit !== undefined ? req.body.reorderLimit : req.body.minThreshold) || 50;
  const nameVal = req.body.name || req.body.itemName || 'New Supply Item';
  const availVal = stockVal <= 0 ? 'Out of Stock' : stockVal <= reorderVal ? 'Low' : 'Available';

  const newItem = {
    id: `inv_${Date.now()}`,
    name: nameVal,
    itemName: nameVal,
    category: req.body.category || 'General',
    stock: stockVal,
    quantity: stockVal,
    reorderLimit: reorderVal,
    minThreshold: reorderVal,
    availability: availVal,
    status: availVal === 'Available' ? 'In Stock' : availVal,
    unit: req.body.unit || 'Units',
    updatedAt: new Date().toISOString()
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const mongoItem = new Inventory(newItem);
      await mongoItem.save();
    }
  } catch (err) {}

  const inventory = readData('inventory.json') || [];
  inventory.unshift(newItem);
  writeData('inventory.json', inventory);

  res.status(201).json(normalizeItem(newItem));
});

// PUT update inventory item (Persists stock, quantity, reorderLimit, and status to MongoDB Atlas)
router.put('/:id', async (req, res) => {
  await connectDatabase();
  const { id } = req.params;

  const stockVal = req.body.stock !== undefined ? Number(req.body.stock) : 
                   (req.body.quantity !== undefined ? Number(req.body.quantity) : undefined);

  const reorderVal = req.body.reorderLimit !== undefined ? Number(req.body.reorderLimit) : 
                     (req.body.minThreshold !== undefined ? Number(req.body.minThreshold) : undefined);

  const nameVal = req.body.name || req.body.itemName;

  const updateFields = { ...req.body, updatedAt: new Date().toISOString() };

  if (stockVal !== undefined) {
    updateFields.stock = stockVal;
    updateFields.quantity = stockVal;
    const thresh = reorderVal !== undefined ? reorderVal : 50;
    updateFields.availability = stockVal <= 0 ? 'Out of Stock' : stockVal <= thresh ? 'Low' : 'Available';
    updateFields.status = updateFields.availability === 'Available' ? 'In Stock' : updateFields.availability;
  }

  if (reorderVal !== undefined) {
    updateFields.reorderLimit = reorderVal;
    updateFields.minThreshold = reorderVal;
  }

  if (nameVal) {
    updateFields.name = nameVal;
    updateFields.itemName = nameVal;
  }

  let mongoUpdated = null;
  if (mongoose.connection.readyState === 1) {
    try {
      mongoUpdated = await Inventory.findOneAndUpdate(
        { $or: [{ id }, { _id: mongoose.isValidObjectId(id) ? id : null }] },
        { $set: updateFields },
        { new: true }
      ).lean();
    } catch (err) {}
  }

  const inventory = readData('inventory.json') || [];
  const index = inventory.findIndex(item => item.id === id);
  if (index !== -1) {
    inventory[index] = { ...inventory[index], ...updateFields };
    writeData('inventory.json', inventory);
    return res.json(normalizeItem(mongoUpdated || inventory[index]));
  }

  if (mongoUpdated) {
    return res.json(normalizeItem(mongoUpdated));
  }

  res.json(normalizeItem({ id, ...updateFields }));
});

// DELETE inventory item
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  const { id } = req.params;

  try {
    if (mongoose.connection.readyState === 1) {
      await Inventory.deleteOne({ $or: [{ id }, { _id: mongoose.isValidObjectId(id) ? id : null }] });
    }
  } catch (err) {}

  let inventory = readData('inventory.json') || [];
  inventory = inventory.filter(item => item.id !== id);
  writeData('inventory.json', inventory);
  res.json({ success: true, message: 'Item deleted' });
});

export default router;
