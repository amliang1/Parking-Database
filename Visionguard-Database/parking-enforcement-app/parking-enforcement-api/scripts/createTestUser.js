const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/Users');

const createTestUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Delete existing test user if it exists
    await User.deleteOne({ email: 'admin@visionguard.com' });
    console.log('Deleted existing test user');

    // Create test user
    const user = new User({
      name: 'Admin User',
      email: 'admin@visionguard.com',
      password: 'admin123', // Will be hashed by the pre-save middleware
      role: 'admin'
    });

    await user.save();
    console.log('Test user created successfully');

    // Verify the user was created correctly
    const savedUser = await User.findOne({ email: 'admin@visionguard.com' }).select('+password');
    console.log('Saved user:', {
      email: savedUser.email,
      role: savedUser.role,
      hasPassword: !!savedUser.password
    });

    // Test password comparison
    const isMatch = await savedUser.matchPassword('admin123');
    console.log('Password match test:', isMatch);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

createTestUser();
