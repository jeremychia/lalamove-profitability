# 🏍️ Lalamove Profitability Calculator

A web-based tool for Singapore motorcycle delivery riders to quickly assess whether a Lalamove order is worth taking.

**Live Site:** [https://jeremychia.github.io/lalamove-profitability/](https://jeremychia.github.io/lalamove-profitability/)

---

## 📋 Table of Contents

- [How Cost is Estimated](#-how-cost-is-estimated)
- [Lalamove Deductions](#-lalamove-deductions)
- [Calculation Approach](#-calculation-approach)
- [Technical Details](#-technical-details)
- [Optimization Suggestions for Riders](#-optimization-suggestions-for-riders)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 💰 How Cost is Estimated

### The Core Formula

For a motorcycle rider, profitability considers Lalamove's deductions:

```
Net Fare = Offered Fare - Commission - VAT - Platform Fee
Net Profit = Net Fare - Fuel Cost

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
- Petrol price: $2.87/L

Fuel Cost = (12 ÷ 45) × 2.87 = $0.77
```

#### 3. Time Estimation

Total time consists of three components:

| Component         | How It's Calculated                                      |
| ----------------- | -------------------------------------------------------- |
| **Travel Time**   | From OneMap API routing, adjusted for traffic conditions |
| **Pickup Wait**   | Fixed 6 minutes (collecting the order)                   |
| **Delivery Wait** | Based on building type detection (see below)             |

#### 4. Traffic Conditions

The app auto-detects traffic based on Singapore time:

| Time Period | Condition | Speed   |
| ----------- | --------- | ------- |
| 7am - 10am  | 🔴 Heavy  | 15 km/h |
| 5pm - 8pm   | 🔴 Heavy  | 15 km/h |
| 11am - 2pm  | 🟡 Normal | 25 km/h |
| 2pm - 5pm   | 🟡 Normal | 25 km/h |
| Other times | 🟢 Light  | 35 km/h |

You can override this in Settings if actual conditions differ.

#### 5. Smart Wait Time by Building Type

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

**Detection Method:** The app analyzes address strings for keywords like "HDB", "BLK", "CONDO", "TOWER", "MALL", etc. Building type badges appear inside input fields.

---

## 💸 Lalamove Deductions

### Understanding Your Earnings

The fare shown in the Lalamove app is NOT what you take home. Here's how deductions work:

```
Offered Fare (what you see in app)
    │
    ├── Platform Fee Offset: $0.50 (already included in offered fare)
    │
    └── Base Fare = Offered Fare - $0.50
            │
            ├── Commission: 15% of Base Fare
            │
            └── VAT/GST: 9% of Base Fare
                    │
                    └── Net Fare (what you receive)
```

### Example Calculation

| Item                       | Amount |
| -------------------------- | ------ |
| **Offered Fare**           | $10.00 |
| − Platform Fee Offset      | −$0.50 |
| = **Base Fare**            | $9.50  |
| − Commission (15% of base) | −$1.43 |
| − VAT/GST (9% of base)     | −$0.86 |
| = **Net Fare**             | $7.22  |
| − Fuel Cost (example)      | −$0.50 |
| = **Your Net Profit**      | $6.72  |

**Effective deduction rate: ~28% of offered fare**

### Multi-Stop Bonus

Each additional delivery stop adds **$3** to the offered fare (part of gross). After deductions:

- Gross: +$3.00
- Net: +$2.28 (after 24% deduction on the additional fare)

This is why multi-stop orders can be very profitable—each stop only adds ~5 min wait time but pays $2.28 net.

### CPF Withholding (Future)

The Platform Workers Act may require CPF contributions in the future. The calculator includes a placeholder for this (currently 0%). When implemented, this will be an additional deduction from the base fare.

---

## 🧮 Calculation Approach

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│  1. GEOCODING                                                    │
│     User inputs → OneMap Search API → Coordinates + Building Info│
│     OR: GPS location → Reverse Geocode → Address                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ROUTING                                                      │
│     Calculate route: You → Pickup → Stop 1 → Stop 2 → ...       │
│     Get distance (km) and travel time (min) for each leg        │
│     Adjust time based on traffic condition (light/normal/heavy) │
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
│  5. FARE BREAKDOWN                                               │
│     Offered Fare → Base Fare → Deductions → Net Fare            │
│     Commission (15%) + VAT (9%) + Platform Fee ($0.50)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. PROFITABILITY CALCULATION                                    │
│     Net Profit = Net Fare - Fuel Cost                            │
│     Total Time = Travel + Pickup Wait + Delivery Waits           │
│     $/Hour = Net Profit ÷ (Total Time / 60)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. RATING & INSIGHTS                                            │
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
├── index.html              # Main calculator page
├── guide.html              # Efficiency guide page
├── style.css               # All styles (mobile-first)
├── js/
│   ├── main.js             # App orchestration
│   ├── config.js           # Constants, bike models, thresholds, deductions
│   ├── guide.js            # Efficiency guide page logic
│   ├── api/
│   │   └── onemap.js       # OneMap API client (search, route, reverse geocode)
│   ├── services/
│   │   ├── geocoding.js    # Address → coordinates + building type
│   │   ├── routing.js      # Multi-stop route calculation with traffic
│   │   ├── fuel.js         # Fuel cost logic
│   │   ├── wait-time.js    # Smart wait estimation by building type
│   │   └── profitability.js # Core profit + fare breakdown calculation
│   ├── ui/
│   │   ├── components.js   # Reusable UI builders (stops, metrics, etc.)
│   │   ├── form.js         # Form handling, GPS location, validation
│   │   └── results.js      # Results rendering, fare breakdown, Google Maps
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
| **GPS + Reverse Geocode**    | Quick location input for riders on the move         |
| **Google Maps integration**  | One-tap navigation to start delivery                |

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

3. **Reverse Geocode API** (No auth required)
   ```
   GET /api/public/revgeocodexy?location={lat,lng}&buffer=50&addressType=all
   ```

**Rate Limits:** 250,000 calls/day (free tier) — more than sufficient for personal use.

### Configuration (config.js)

Key configurable values:

```javascript
// Fare deductions
fareDeductions: {
  commissionRate: 0.15,      // 15% commission
  vatRate: 0.09,             // 9% GST
  cpfWithholdingRate: 0.0,   // Future CPF (currently 0)
  platformFeeOffset: 0.5,    // $0.50 platform fee
}

// Multi-stop pricing
multiStop: {
  additionalStopFare: 3.0,   // $3 per additional stop
}

// Traffic speeds (km/h)
traffic: {
  light: 35,
  normal: 25,
  heavy: 15,
}

// Profitability thresholds ($/hour)
PROFIT_THRESHOLDS: {
  excellent: 20,
  good: 15,
  okay: 10,
  poor: 0,
}
```

### Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features used (optional chaining, nullish coalescing)
- Geolocation API for GPS support
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
- [ ] Dark mode theme
- [ ] Export/share calculations
- [ ] Integration with actual Lalamove order data (if API available)

### Development

```bash
# Clone the repository
git clone https://github.com/jeremychia/lalamove-profitability.git

# Serve locally
cd docs
python -m http.server 8000
# Visit http://localhost:8000

# Run pre-commit hooks before committing
pre-commit run --all-files
```

### Pre-commit Hooks

The project uses pre-commit for code quality:

- **Prettier** - Code formatting
- **Trailing whitespace** - Clean line endings
- **End of file fixer** - Consistent file endings
- **Mixed line ending** - Normalize line endings

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
