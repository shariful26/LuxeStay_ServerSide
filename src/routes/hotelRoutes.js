import express from 'express';
import mongoose from 'mongoose';
import { Hotel, Room } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// GET all hotels with search, pagination, projection, and advanced filters
router.get('/', async (req, res) => {
  // Public edge caching for read-only catalog
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  await connectDatabase();
  const { search, destination, minPrice, maxPrice, rating, category, featured, partnerId, partnerEmail, status, isPublic, limit, page, fields } = req.query;

  const mongoFilter = {};

  if (partnerId) {
    mongoFilter.$or = [
      { partnerId: String(partnerId) },
      ...(partnerEmail ? [{ partnerEmail: String(partnerEmail).toLowerCase() }] : [])
    ];
  }

  if (status) {
    mongoFilter.status = { $regex: new RegExp(`^${status}$`, 'i') };
  } else if (isPublic === 'true') {
    mongoFilter.status = { $nin: ['pending approval', 'pending', 'rejected'] };
  }

  if (search && String(search).trim().length > 0) {
    const q = String(search).trim();
    mongoFilter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { destination: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } }
    ];
  }

  if (destination) {
    mongoFilter.$or = [
      { destinationSlug: destination },
      { destination: { $regex: destination, $options: 'i' } }
    ];
  }

  if (category) {
    mongoFilter.category = { $regex: new RegExp(`^${category}$`, 'i') };
  }

  if (minPrice || maxPrice) {
    mongoFilter.pricePerNight = {};
    if (minPrice) mongoFilter.pricePerNight.$gte = Number(minPrice);
    if (maxPrice) mongoFilter.pricePerNight.$lte = Number(maxPrice);
  }

  if (rating) {
    mongoFilter.rating = { $gte: Number(rating) };
  }

  if (featured === 'true') {
    mongoFilter.featured = true;
  }

  const queryLimit = limit ? Math.min(Math.max(Number(limit) || 0, 1), 100) : 0;
  const queryPage = Math.max(Number(page) || 1, 1);

  // Field projection: minimal fields for fast autocomplete search, list fields for standard view
  const isCompactSearch = queryLimit > 0 && queryLimit <= 5;
  const projection = isCompactSearch || fields === 'compact'
    ? 'id name slug destination destinationSlug pricePerNight rating images category featured status'
    : 'id name slug tagline destination destinationSlug address pricePerNight rating reviewCount starRating featured category images amenities status partnerId partnerName';

  let hotels = [];
  try {
    if (mongoose.connection.readyState === 1) {
      let q = Hotel.find(mongoFilter).select(projection).lean();
      if (queryLimit > 0) {
        q = q.skip((queryPage - 1) * queryLimit).limit(queryLimit);
      }
      hotels = await q;
    }
  } catch (err) {
    // safe fallback
  }

  if (!hotels || hotels.length === 0) {
    hotels = readData('hotels.json') || [];

    if (partnerId) {
      const pid = String(partnerId);
      hotels = hotels.filter(h => (h.partnerId && String(h.partnerId) === pid) || (h.partnerEmail && partnerEmail && h.partnerEmail.toLowerCase() === partnerEmail.toLowerCase()));
    }

    if (status) {
      hotels = hotels.filter(h => h.status && h.status.toLowerCase() === status.toLowerCase());
    } else if (isPublic === 'true') {
      hotels = hotels.filter(h => {
        if (!h.status) return true;
        const s = String(h.status).toLowerCase();
        return s === 'approved' || s === 'active' || (s !== 'pending approval' && s !== 'pending' && s !== 'rejected');
      });
    }

    if (search) {
      const q = search.toLowerCase();
      hotels = hotels.filter(h => (h.name && h.name.toLowerCase().includes(q)) || (h.destination && h.destination.toLowerCase().includes(q)));
    }
    if (destination) {
      hotels = hotels.filter(h => h.destinationSlug === destination || (h.destination && h.destination.toLowerCase().includes(destination.toLowerCase())));
    }
    if (category) {
      hotels = hotels.filter(h => h.category && h.category.toLowerCase() === category.toLowerCase());
    }
    if (minPrice) {
      hotels = hotels.filter(h => h.pricePerNight >= Number(minPrice));
    }
    if (maxPrice) {
      hotels = hotels.filter(h => h.pricePerNight <= Number(maxPrice));
    }
    if (rating) {
      hotels = hotels.filter(h => h.rating >= Number(rating));
    }
    if (featured === 'true') {
      hotels = hotels.filter(h => h.featured);
    }
    if (queryLimit > 0) {
      hotels = hotels.slice((queryPage - 1) * queryLimit, queryPage * queryLimit);
    }
  }

  res.json(hotels);
});

// GET hotel by ID / slug with associated rooms
router.get('/:id', async (req, res) => {
  await connectDatabase();
  let hotel = null;
  let rooms = [];

  if (mongoose.connection.readyState === 1) {
    try {
      hotel = await Hotel.findOne({ $or: [{ id: req.params.id }, { slug: req.params.id }] }).lean();
      if (hotel) {
        rooms = await Room.find({ hotelId: hotel.id }).lean();
      }
    } catch (err) {}
  }

  if (!hotel) {
    const hotels = readData('hotels.json');
    hotel = hotels.find(h => String(h.id) === String(req.params.id) || h.slug === req.params.id);
    if (hotel) {
      const allRooms = readData('rooms.json');
      rooms = allRooms.filter(r => String(r.hotelId) === String(hotel.id));
    }
  }

  if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

  // Default fallback suite if no custom rooms exist
  if (!rooms || rooms.length === 0) {
    rooms = [{
      id: `r_def_${hotel.id}`,
      hotelId: hotel.id,
      name: `${hotel.name} Deluxe Executive Suite`,
      slug: `${hotel.slug || 'hotel'}-deluxe-suite`,
      type: 'Deluxe Executive Suite',
      price: hotel.pricePerNight || 450,
      size: '65 m² / 700 sq ft',
      capacity: 2,
      bedType: '1 King Bed',
      view: 'Ocean / Resort Scenic View',
      images: hotel.images || ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80"],
      amenities: ["Private Heated Pool", "Balcony Lounge", "Espresso Machine", "Marble Bath", "Smart TV"],
      inclusions: { freeCancellation: true, breakfastIncluded: true, instantVoucher: true },
      description: `Exclusive luxury executive suite at ${hotel.name} featuring world-class amenities and signature hospitality.`,
      status: "Available"
    }];
  }

  res.json({ ...hotel, rooms });
});

// POST create hotel
router.post('/', async (req, res) => {
  await connectDatabase();
  const newHotel = {
    id: `h${Date.now()}`,
    name: req.body.name || 'New Luxury Hotel',
    slug: (req.body.name || 'new-hotel').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    destination: req.body.destination || 'Santorini, Greece',
    destinationSlug: (req.body.destination || 'santorini').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: req.body.category || 'Resort & Spa',
    pricePerNight: Number(req.body.pricePerNight) || 450,
    rating: 5.0,
    reviewCount: 0,
    starRating: req.body.starRating || 5,
    featured: req.body.featured || false,
    partnerId: req.body.partnerId || 'p1',
    partnerEmail: req.body.partnerEmail || '',
    partnerName: req.body.partnerName || 'Aura Hospitality',
    status: req.body.status || 'Pending',
    description: req.body.description || 'Exclusive luxury hotel property with world-class hospitality.',
    address: req.body.address || 'Oia Cliffside, Santorini, Greece',
    images: req.body.image ? [req.body.image] : (req.body.images || ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"]),
    amenities: req.body.amenities || ["Infinity Pool", "Private Beach", "Luxury Spa", "Free Wi-Fi", "Butler Service"]
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoHotel = new Hotel(newHotel);
      await mongoHotel.save();
    } catch (e) {
      // safe fallback
    }
  }

  const hotels = readData('hotels.json');
  hotels.unshift(newHotel);
  writeData('hotels.json', hotels);
  res.status(201).json(newHotel);
});

// PUT update hotel
router.put('/:id', async (req, res) => {
  await connectDatabase();
  let updatedHotel = null;
  if (mongoose.connection.readyState === 1) {
    try {
      updatedHotel = await Hotel.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { slug: req.params.id }] },
        { $set: req.body },
        { new: true }
      ).lean();
    } catch (e) {}
  }

  let hotels = readData('hotels.json');
  const index = hotels.findIndex(h => h.id === req.params.id || h.slug === req.params.id);
  if (index !== -1) {
    hotels[index] = { ...hotels[index], ...req.body };
    writeData('hotels.json', hotels);
    return res.json(updatedHotel || hotels[index]);
  }
  if (updatedHotel) return res.json(updatedHotel);
  res.json({ message: 'Hotel updated', ...req.body });
});

// DELETE hotel
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  if (mongoose.connection.readyState === 1) {
    try {
      await Hotel.deleteOne({
        $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { slug: req.params.id }]
      });
    } catch (e) {}
  }

  let hotels = readData('hotels.json');
  hotels = hotels.filter(h => h.id !== req.params.id && h.slug !== req.params.id);
  writeData('hotels.json', hotels);
  res.json({ message: 'Hotel deleted successfully' });
});

export default router;
