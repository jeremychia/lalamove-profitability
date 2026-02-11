# 🏍️ Lalamove Profitability Calculator

A web-based tool for Singapore motorcycle delivery riders to quickly assess whether a Lalamove order is worth taking.

**Live Site:** [https://jeremychia.github.io/lalamove-profitability/](https://jeremychia.github.io/lalamove-profitability/)

---

## 📋 Table of Contents

- [How Cost is Estimated](#-how-cost-is-estimated)
- [Calculation Approach](#-calculation-approach)
- [Technical Details](#-technical-details)
- [Optimization Suggestions for Riders](#-optimization-suggestions-for-riders)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 💰 How Cost is Estimated

### The Core Formula

For a motorcycle rider, profitability is straightforward:

```
Net Profit = Fare Offered - Fuel Cost

Profitability ($/hour) = Net Profit ÷ Total Time (hours)
```

### Why Motorcycle is Different

Unlike car deliveries, motorcycle riders in Singapore have significant cost advantages:

| Factor          | Car                  | Motorcycle              |
| --------------- | -------------------- | ----------------------- |
| ERP Charges     | ✅ Applies           | ❌ Exempt               |
| Parking Fees    | ✅ Applies           | ❌ Free motorcycle lots |
| Traffic Impact  | High (stuck in jams) | Low (lane filtering)    |
| Fuel Efficiency | ~10-12 km/L          | ~35-50 km/L             |

**This means for motorcycles, fuel is essentially the only variable cost.**

### Components of Cost Estimation

#### 1. Distance Calculation

The app uses [OneMap API](https://www.onemap.gov.sg/apidocs/) (Singapore's official mapping service) to calculate actual road distances, not straight-line distances.

- **With API Token:** Accurate road routing with real distances and estimated travel times
- **Without API Token:** Estimates using straight-line distance × 1.4 (typical road factor for Singapore urban areas)

#### 2. Fuel Cost

```
Fuel Cost = (Total Distance ÷ Fuel Efficiency) × Petrol Price

Example:
- Distance: 12 km
- Yamaha YBR125 efficiency: 45 km/L
- Petrol price: $2.75/L

Fuel Cost = (12 ÷ 45) × 2.75 = $0.73
```

#### 3. Time Estimation

Total time consists of three components:

| Component         | How It's Calculated                                      |
| ----------------- | -------------------------------------------------------- |
| **Travel Time**   | From OneMap API routing, or estimated at 30 km/h average |
| **Pickup Wait**   | Fixed 5 minutes (collecting the order)                   |
| **Delivery Wait** | Based on building type detection (see below)             |

#### 4. Smart Wait Time by Building Type

The app detects building types from OneMap data and estimates wait times:

| Building Type  | Wait Time | Reasoning                                |
| -------------- | --------- | ---------------------------------------- |
| **HDB**        | 3 min     | Meet at void deck, quick handover        |
| **Landed**     | 2 min     | Direct handover at gate                  |
| **Condo**      | 7 min     | Security checkpoint, intercom, lift wait |
| **Office**     | 10 min    | Reception, lift, floor navigation        |
| **Mall**       | 8 min     | Navigate through crowds to unit          |
| **Industrial** | 5 min     | Loading bay access varies                |
| **Unknown**    | 5 min     | Default estimate                         |

**Detection Method:** The app analyzes address strings for keywords like "HDB", "BLK", "CONDO", "TOWER", "MALL", etc.

---

## 🧮 Calculation Approach

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│  1. GEOCODING                                                    │
│     User inputs → OneMap Search API → Coordinates + Building Info│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ROUTING                                                      │
│     Calculate route: You → Pickup → Stop 1 → Stop 2 → ...       │
│     Get distance (km) and travel time (min) for each leg        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. WAIT TIME ESTIMATION                                         │
│     Detect building type for each stop → Apply wait time rule   │
│     Allow manual overrides if user knows better                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. FUEL COST CALCULATION                                        │
│     Total distance × (1 / fuel efficiency) × petrol price        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. PROFITABILITY CALCULATION                                    │
│     Net Profit = Fare - Fuel Cost                                │
│     Total Time = Travel + Pickup Wait + Delivery Waits           │
│     $/Hour = Net Profit ÷ (Total Time / 60)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. RATING & INSIGHTS                                            │
│     Excellent: ≥$20/hr | Good: ≥$15/hr | Okay: ≥$10/hr | Poor   │
│     Generate actionable recommendations                          │
└─────────────────────────────────────────────────────────────────┘
```

### Profitability Rating System

| Rating           | $/Hour | Recommendation                                     |
| ---------------- | ------ | -------------------------------------------------- |
| 🔥 **Excellent** | ≥ $20  | Take it! Great earnings                            |
| ✅ **Good**      | ≥ $15  | Worth taking                                       |
| ⚠️ **Okay**      | ≥ $10  | Acceptable if no better options                    |
| ❌ **Poor**      | < $10  | Consider declining unless strategically positioned |

The $15/hr "Good" threshold is based on:

- Singapore's progressive wage model
- Opportunity cost of waiting for better orders
- Covering non-fuel costs (maintenance, insurance, etc.)

---

## 🔧 Technical Details

### Architecture

The application follows a modular architecture with clear separation of concerns:

```
docs/
├── index.html              # Main entry point
├── style.css               # All styles (mobile-first)
├── js/
│   ├── main.js             # App orchestration
│   ├── config.js           # Constants, bike models, thresholds
│   ├── api/
│   │   └── onemap.js       # OneMap API client
│   ├── services/
│   │   ├── geocoding.js    # Address → coordinates
│   │   ├── routing.js      # Multi-stop route calculation
│   │   ├── fuel.js         # Fuel cost logic
│   │   ├── wait-time.js    # Smart wait estimation
│   │   └── profitability.js # Core profit calculation
│   ├── ui/
│   │   ├── components.js   # Reusable UI builders
│   │   ├── form.js         # Form handling
│   │   └── results.js      # Results rendering
│   └── utils/
│       ├── format.js       # Currency, distance, time formatters
│       └── validation.js   # Input validation
```

### Key Design Decisions

| Decision                     | Rationale                                           |
| ---------------------------- | --------------------------------------------------- |
| **Static site (no backend)** | Free hosting on GitHub Pages, no server costs       |
| **ES Modules**               | Modern JavaScript, better code organization         |
| **OneMap API**               | Singapore government API, free, accurate local data |
| **Mobile-first CSS**         | Riders use phones on-the-go                         |
| **Modular services**         | Each module is testable and maintainable            |
| **Fallback estimates**       | App works even without API token                    |

### API Usage

**OneMap API Endpoints:**

1. **Search API** (No auth required)

   ```
   GET /api/common/elastic/search?searchVal={query}&returnGeom=Y&getAddrDetails=Y
   ```

2. **Routing API** (Token recommended)
   ```
   GET /api/public/routingsvc/route?start={lat,lng}&end={lat,lng}&routeType=drive
   ```

**Rate Limits:** 250,000 calls/day (free tier) — more than sufficient for personal use.

### Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features used (optional chaining, nullish coalescing)
- No transpilation needed for modern browsers

---

## 🚀 Optimization Suggestions for Riders

Based on data analysis and delivery experience, here are strategies to maximize earnings:

### 1. Peak Hour Strategy

**As a motorcycle rider, peak hours are GOLD:**

| Time             | Why Profitable                                      |
| ---------------- | --------------------------------------------------- |
| **7:30-9:00 AM** | Office workers need documents, breakfast deliveries |
| **11:30-13:30**  | Lunch rush, high demand, surge pricing              |
| **17:30-20:00**  | Dinner rush, highest demand of the day              |

Cars avoid these times due to traffic. **You can lane-filter through jams.**

### 2. Zone Optimization

**High-profit zones:**

- CBD during lunch (offices ordering food/documents)
- Residential areas during dinner
- Near hawker centres and food courts

**Zones to be cautious about:**

- Far-flung industrial areas with low return trip likelihood
- Orders that leave you stranded with no nearby demand

### 3. Multi-Stop Order Analysis

Multi-stop orders can be profitable IF:

- Stops are clustered geographically
- Per-stop additional payment covers the extra time
- Final stop leaves you in a good position

**Red flags:**

- Stops scattered across the island
- Each stop has office/mall wait times (10+ min each)
- Final stop is in low-demand area

### 4. Decline Strategically

It's okay to decline orders that are:

- Below $10/hr profitability
- Taking you far from high-demand zones
- Multi-stop with poor routing efficiency

**Exception:** Accept lower-paying orders if they position you for better orders (e.g., moving from east to CBD before lunch rush).

### 5. Track Your Data

Over time, track:

- Actual wait times by building type (update your estimates)
- True fuel consumption (varies with riding style)
- Best times and zones for your area

The default estimates in this app are starting points—**your personal data will be more accurate**.

### 6. Weather Consideration

| Weather              | Impact                                        |
| -------------------- | --------------------------------------------- |
| **Rain**             | Fewer riders → surge pricing, but safety risk |
| **Hot afternoon**    | Lower demand, riders fatigued                 |
| **Evening (cooler)** | Pleasant to ride, high dinner demand          |

Decide based on your risk tolerance and equipment (rain gear, etc.).

---

## 📦 Deployment

### GitHub Pages Setup

1. **Push code to repository**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages**

   - Go to repository **Settings**
   - Navigate to **Pages** (left sidebar)
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/docs`
   - Click **Save**

3. **Access your site**
   - URL: `https://{username}.github.io/{repo-name}/`
   - Example: `https://jeremychia.github.io/lalamove-profitability/`

### Optional: Custom Domain

1. Add a `CNAME` file in `/docs` with your domain
2. Configure DNS settings with your domain provider
3. Enable HTTPS in GitHub Pages settings

---

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- [ ] Add more motorcycle models to the database
- [ ] Implement address autocomplete suggestions
- [ ] Add historical tracking / trip logging
- [ ] PWA support for offline use
- [ ] Integrate with actual Lalamove order data (if API available)

### Development

```bash
# Clone the repository
git clone https://github.com/jeremychia/lalamove-profitability.git

# Open in browser (no build step needed)
open docs/index.html

# Or use a local server
cd docs
python -m http.server 8000
# Visit http://localhost:8000
```

---

## 📄 License

MIT License - feel free to use, modify, and distribute.

---

## 🙏 Acknowledgments

- [OneMap API](https://www.onemap.gov.sg/) - Singapore Land Authority
- Singapore's delivery rider community for insights
- Fellow riders who shared their experiences and data

---

**Built with ❤️ for Singapore's delivery riders**

_Ride safe, earn smart! 🏍️_
