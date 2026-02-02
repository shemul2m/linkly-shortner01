const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    earnings: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false }
});

// URL Schema
const urlSchema = new mongoose.Schema({
    shortCode: { type: String, required: true, unique: true },
    longUrl: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clicks: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Url = mongoose.model('Url', urlSchema);

// Middleware for authentication
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token provided' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// User Registration
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            isAdmin: email === process.env.ADMIN_EMAIL
        });
        
        await user.save();
        
        // Create token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: { email: user.email, earnings: user.earnings, isAdmin: user.isAdmin }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        // Create token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: { email: user.email, earnings: user.earnings, isAdmin: user.isAdmin }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Shorten URL
app.post('/api/shorten', authenticate, async (req, res) => {
    try {
        const { longUrl, customAlias } = req.body;
        const userId = req.userId;
        
        // Generate short code
        let shortCode;
        if (customAlias) {
            shortCode = customAlias;
            // Check if exists
            const existing = await Url.findOne({ shortCode });
            if (existing) {
                return res.status(400).json({ error: 'Custom alias already exists' });
            }
        } else {
            shortCode = generateShortCode(6);
        }
        
        // Create URL
        const url = new Url({
            shortCode,
            longUrl,
            userId
        });
        
        await url.save();
        
        const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;
        
        res.json({
            success: true,
            shortUrl,
            shortCode,
            earnings: "$10 CPM for USA traffic"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Redirect URL
app.get('/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        // Find URL
        const url = await Url.findOne({ shortCode: code });
        if (!url) {
            return res.status(404).send('URL not found');
        }
        
        // Increment clicks
        url.clicks += 1;
        
        // Calculate earnings based on country
        const country = req.headers['cf-ipcountry'] || 'US';
        const earningsPerClick = getEarningsPerClick(country);
        url.earnings += earningsPerClick;
        
        await url.save();
        
        // Update user earnings
        await User.findByIdAndUpdate(url.userId, {
            $inc: { earnings: earningsPerClick }
        });
        
        // Show ad page before redirect
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirecting...</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; }
                    .countdown { font-size: 48px; color: #007bff; }
                    .ad-container { margin: 30px auto; max-width: 728px; height: 90px; }
                </style>
            </head>
            <body>
                <h2>Please wait while we show an advertisement...</h2>
                <div class="countdown" id="countdown">5</div>
                
                <div class="ad-container">
                    <!-- Adsterra/AdSense Ad will be here -->
                    <div id="ad">Advertisement loading...</div>
                </div>
                
                <script>
                    // Countdown timer
                    let seconds = 5;
                    const timer = setInterval(() => {
                        seconds--;
                        document.getElementById('countdown').innerHTML = seconds;
                        
                        if (seconds <= 0) {
                            clearInterval(timer);
                            window.location.href = '${url.longUrl}';
                        }
                    }, 1000);
                    
                    // Load ad after 1 second
                    setTimeout(() => {
                        // Adsterra Ad Code
                        document.getElementById('ad').innerHTML = 
                        '<script type="text/javascript">' +
                        'atOptions = { key: "YOUR_ADSTERRA_KEY", format: "iframe", height: 90, width: 728, params: {} };' +
                        '<\/script>' +
                        '<script type="text/javascript" src="//www.highperformancedformats.com/YOUR_CODE/invoke.js"><\/script>';
                    }, 1000);
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Get user URLs
app.get('/api/urls', authenticate, async (req, res) => {
    try {
        const urls = await Url.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json({ success: true, urls });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin panel - get all users (admin only)
app.get('/api/admin/users', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const users = await User.find().select('-password');
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Utility functions
function generateShortCode(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getEarningsPerClick(country) {
    const rates = {
        'US': 0.01, // $10 CPM = $0.01 per click
        'CA': 0.008,
        'UK': 0.007,
        'AU': 0.006,
        'DE': 0.005,
        'OTHER': 0.001
    };
    return rates[country] || rates['OTHER'];
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;