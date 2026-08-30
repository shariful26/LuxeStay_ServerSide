import express from 'express';
import { readData, writeData } from '../utils/fileDb.js';

const router = express.Router();

// GET concierge staff
router.get('/', (req, res) => {
  const staff = readData('concierge.json');
  res.json(staff);
});

// POST add concierge staff
router.post('/', (req, res) => {
  const staff = readData('concierge.json');
  const newStaff = {
    id: `FLG${Math.floor(100 + Math.random() * 900)}`,
    name: req.body.name,
    position: req.body.position,
    schedule: req.body.schedule,
    contact: req.body.contact,
    email: req.body.email,
    status: req.body.status || 'Active'
  };
  staff.push(newStaff);
  writeData('concierge.json', staff);
  res.status(201).json(newStaff);
});

// PUT update concierge staff
router.put('/:id', (req, res) => {
  const staff = readData('concierge.json');
  const index = staff.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Staff member not found' });

  staff[index] = {
    ...staff[index],
    ...req.body
  };
  writeData('concierge.json', staff);
  res.json(staff[index]);
});

// GET concierge guest requests
router.get('/requests/all', (req, res) => {
  const requests = readData('concierge-requests.json');
  res.json(requests);
});

// PUT update concierge guest request
router.put('/requests/:id', (req, res) => {
  const requests = readData('concierge-requests.json');
  const index = requests.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Request log not found' });

  requests[index].status = req.body.status || 'Completed';
  writeData('concierge-requests.json', requests);
  res.json(requests[index]);
});

export default router;
